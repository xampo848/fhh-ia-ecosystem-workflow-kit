import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const siblingCatalogPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'delegate-agent-catalog.json');
const qualifiedPattern = /^(.+) \(([^()]+)\)$/;

export class CopilotRoutingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CopilotRoutingError';
    this.code = code;
  }
}

// Without an explicit root the catalog is the sibling of this file, so the same bytes work in a checkout (scripts/) and in an installed repo (.agents/model-routing/).
export async function loadCopilotModelRouting({ root = null } = {}) {
  const catalogPath = root === null ? siblingCatalogPath : path.join(root, 'scripts/delegate-agent-catalog.json');
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  return {
    ...catalog.copilotModelRouting,
    agentAliases: Object.fromEntries(catalog.agents.map((agent) => [agent.slug, agent.alias]))
  };
}

function qualifyModelName(name, qualifier) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new CopilotRoutingError('INVALID_INPUT', 'Model names must be non-empty strings');
  }
  const trimmed = name.trim();
  return qualifiedPattern.test(trimmed) ? trimmed : `${trimmed} (${qualifier})`;
}

function displayName(identity) {
  return identity.match(qualifiedPattern)?.[1] ?? identity;
}

const contextFields = ['objective', 'workKind', 'risk', 'ambiguity', 'contextCompleteness', 'bounded', 'criticalConcerns'];
const tokenCountFields = ['uncachedInputTokens', 'cachedInputTokens', 'cacheWriteTokens', 'outputTokens'];
const costFields = ['billingMode', 'estimationDate', 'totalContextInputTokens', ...tokenCountFields];
const tokenBillingMode = 'token';
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const picoPerMicro = 10n ** 6n;
const unsupportedRateReasons = { cacheRead: 'cache-read-unsupported', cacheWrite: 'cache-write-unsupported' };
const suitability = {
  basis: 'unbenchmarked',
  statement: 'Tier eligibility is a policy decision. No comparative quality benchmark or live availability proof backs this selection, and price does not imply capability.'
};

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !isoDatePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateTaskContext(taskContext, policy) {
  const invalid = (message) => new CopilotRoutingError('INVALID_CONTEXT', message);
  if (taskContext === null || typeof taskContext !== 'object' || Array.isArray(taskContext)) {
    throw invalid('taskContext must be an object with objective, workKind, risk, ambiguity, contextCompleteness, and bounded');
  }
  const unsupported = Object.keys(taskContext).filter((field) => !contextFields.includes(field));
  if (unsupported.length > 0) throw invalid(`Unsupported taskContext fields: ${unsupported.join(', ')}`);
  if (typeof taskContext.objective !== 'string' || taskContext.objective.trim() === '') throw invalid('taskContext.objective must be a non-empty string');
  if (typeof taskContext.workKind !== 'string' || !Object.hasOwn(policy.workKinds, taskContext.workKind)) {
    throw invalid(`taskContext.workKind must be one of: ${Object.keys(policy.workKinds).join(', ')}`);
  }
  for (const field of ['risk', 'ambiguity']) {
    if (!policy.levels.includes(taskContext[field])) throw invalid(`taskContext.${field} must be one of: ${policy.levels.join(', ')}`);
  }
  if (!policy.contextCompleteness.includes(taskContext.contextCompleteness)) {
    throw invalid(`taskContext.contextCompleteness must be one of: ${policy.contextCompleteness.join(', ')}`);
  }
  if (typeof taskContext.bounded !== 'boolean') throw invalid('taskContext.bounded must be an explicit boolean');
  const concerns = taskContext.criticalConcerns === undefined ? [] : taskContext.criticalConcerns;
  if (!Array.isArray(concerns) || concerns.some((concern) => !policy.criticalConcerns.includes(concern))) {
    throw invalid(`taskContext.criticalConcerns must be an array drawn from: ${policy.criticalConcerns.join(', ')}`);
  }
  return { ...taskContext, objective: taskContext.objective.trim(), criticalConcerns: [...new Set(concerns)] };
}

export function decideContextualTier({ taskContext, agentDefaultTier, routing }) {
  const policy = routing.contextPolicy;
  if (typeof agentDefaultTier !== 'string' || !Object.hasOwn(policy.tierRank, agentDefaultTier)) {
    throw new CopilotRoutingError('UNKNOWN_TIER', 'agentDefaultTier must be a configured technical tier');
  }
  const context = validateTaskContext(taskContext, policy);
  const rank = policy.tierRank;
  const criticalSignals = [
    ...(context.risk === 'high' ? ['risk=high'] : []),
    ...(context.ambiguity === 'high' ? ['ambiguity=high'] : []),
    ...context.criticalConcerns.map((concern) => `critical-concern=${concern}`)
  ];
  const kind = policy.workKinds[context.workKind];
  const mechanicalException = kind === 'mechanical' && context.bounded && context.contextCompleteness === 'complete'
    && context.risk === 'low' && context.ambiguity === 'low';
  const reasons = [];
  let tier;
  let posture;

  if (criticalSignals.length > 0) {
    tier = policy.criticalTier;
    posture = 'critical';
    reasons.push(`Critical tier required by: ${criticalSignals.join(', ')}.`);
  } else if (mechanicalException) {
    tier = policy.mechanicalTier;
    posture = 'mechanical-exception';
    reasons.push(`Bounded, complete, low-risk, low-ambiguity ${context.workKind} work with no critical concerns qualifies for tier ${tier}.`);
  } else {
    const floorTier = policy.substantiveFloorTier;
    tier = rank[floorTier] > rank[agentDefaultTier] ? floorTier : agentDefaultTier;
    posture = 'role-floor';
    reasons.push(kind === 'substantive'
      ? `Substantive ${context.workKind} work needs at least tier ${policy.substantiveFloorTier}; the role default is ${agentDefaultTier}.`
      : `${context.workKind} work does not meet every mechanical-exception condition; at least tier ${floorTier} is required.`);
  }

  const clarificationRequired = context.contextCompleteness !== 'complete';
  const clarification = clarificationRequired
    ? `contextCompleteness=${context.contextCompleteness}: clarify or gather the missing context before delegating. This uncertainty never lowers the tier.`
    : null;
  if (clarification) reasons.push(clarification);
  return { tier, posture, reasons, clarificationRequired, clarification, taskContext: context };
}

function validateCostEstimate(costEstimate, pricing) {
  const invalid = (message) => new CopilotRoutingError('INVALID_COST_ESTIMATE', message);
  if (costEstimate === null || typeof costEstimate !== 'object' || Array.isArray(costEstimate)) throw invalid('costEstimate must be an object of caller-supplied token counts');
  const unsupported = Object.keys(costEstimate).filter((field) => !costFields.includes(field));
  if (unsupported.length > 0) throw invalid(`Unsupported costEstimate fields: ${unsupported.join(', ')}`);
  if (costEstimate.billingMode !== undefined && !pricing.billingModes.includes(costEstimate.billingMode)) {
    throw invalid(`costEstimate.billingMode must be one of: ${pricing.billingModes.join(', ')}`);
  }
  if (costEstimate.estimationDate !== undefined && !isIsoDate(costEstimate.estimationDate)) throw invalid('costEstimate.estimationDate must be a valid YYYY-MM-DD date');
  for (const field of [...tokenCountFields, 'totalContextInputTokens']) {
    if (costEstimate[field] !== undefined && !isNonNegativeInteger(costEstimate[field])) throw invalid(`costEstimate.${field} must be a non-negative integer token count`);
  }
  const inputCounts = ['uncachedInputTokens', 'cachedInputTokens', 'cacheWriteTokens'].filter((field) => costEstimate[field] !== undefined);
  const inputSum = inputCounts.reduce((sum, field) => sum + costEstimate[field], 0);
  if (!Number.isSafeInteger(inputSum)) throw invalid('Combined input token counts must be a safe integer');
  const totalContextInputTokens = costEstimate.totalContextInputTokens;
  if (totalContextInputTokens !== undefined && (inputCounts.length === 3 ? totalContextInputTokens !== inputSum : totalContextInputTokens < inputSum)) {
    throw invalid(`costEstimate.totalContextInputTokens (${totalContextInputTokens}) contradicts the input token categories (${inputSum})`);
  }
  const missing = ['billingMode', 'estimationDate', ...tokenCountFields].filter((field) => costEstimate[field] === undefined);
  return {
    ...costEstimate,
    totalContextInputTokens: inputCounts.length === 3 ? inputSum : totalContextInputTokens,
    missing
  };
}

function validateBudget(budget) {
  const invalid = (message) => new CopilotRoutingError('INVALID_BUDGET', message);
  if (budget === null || typeof budget !== 'object' || Array.isArray(budget)) throw invalid('budget must be an object with maxUsd');
  const unsupported = Object.keys(budget).filter((field) => field !== 'maxUsd');
  if (unsupported.length > 0) throw invalid(`Unsupported budget fields: ${unsupported.join(', ')}`);
  if (typeof budget.maxUsd !== 'number' || !Number.isFinite(budget.maxUsd) || budget.maxUsd < 0 || budget.maxUsd > 1e6) {
    throw invalid('budget.maxUsd must be a finite non-negative number of USD (micro-USD precision)');
  }
  const microUsd = Math.round(budget.maxUsd * 1e6);
  if (microUsd / 1e6 !== budget.maxUsd) throw invalid('budget.maxUsd supports at most six decimal places; it is never rounded up');
  return { maxUsd: budget.maxUsd, maxPicoUsd: BigInt(microUsd) * picoPerMicro };
}

function priceModel(model, estimate, pricing) {
  const row = Object.hasOwn(pricing.models, model) ? pricing.models[model] : null;
  if (row === null) return { status: 'unpriceable', reason: 'unknown-pricing' };
  if (row.promotionExpires && estimate.estimationDate > row.promotionExpires) return { status: 'unpriceable', reason: 'promotion-expired' };
  const useLong = row.standardMaxContextInputTokens !== null && estimate.totalContextInputTokens > row.standardMaxContextInputTokens;
  const rates = useLong ? row.long : row.standard;
  if (rates === null) return { status: 'unpriceable', reason: 'long-context-unpriced' };

  const charges = [
    ['input', estimate.uncachedInputTokens],
    ['cacheRead', estimate.cachedInputTokens],
    ['cacheWrite', estimate.cacheWriteTokens],
    ['output', estimate.outputTokens]
  ];
  let picoUsd = 0n;
  for (const [category, tokens] of charges) {
    if (tokens === 0) continue;
    if (rates[category] === null) return { status: 'unpriceable', reason: unsupportedRateReasons[category] };
    picoUsd += BigInt(tokens) * BigInt(Math.round(rates[category] * 1e6));
  }
  return { status: 'priced', picoUsd, estimatedUsd: Number(picoUsd) / 1e12, rateTier: useLong ? 'long' : 'standard' };
}

function describeEstimate(model, estimate, pricing, priced) {
  const { picoUsd, ...visible } = priced;
  return {
    ...visible,
    model,
    totalContextInputTokens: estimate.totalContextInputTokens,
    estimationDate: estimate.estimationDate,
    pricingSource: pricing.source,
    pricingVerifiedOn: pricing.verifiedOn,
    caveat: 'List-rate estimate from caller-supplied token counts; not actual spend, a billing receipt, or evidence of model ability.'
  };
}

export function estimateModelCost({ model, costEstimate, routing }) {
  const estimate = validateCostEstimate(costEstimate, routing.pricing);
  if (estimate.missing.length > 0) return { status: 'incomplete', model, missing: estimate.missing };
  if (estimate.billingMode !== tokenBillingMode) return { status: 'not-token-billing', model, billingMode: estimate.billingMode };
  return describeEstimate(model, estimate, routing.pricing, priceModel(model, estimate, routing.pricing));
}

export function resolveCopilotModel({
  agentSlug,
  availableModels,
  routing,
  tier = null,
  overrideModel = null,
  allowPinnedFallback = false,
  taskContext = null,
  costEstimate = null,
  budget = null
}) {
  const qualifier = routing.modelQualifier;
  if (!Array.isArray(availableModels) || availableModels.length === 0) {
    throw new CopilotRoutingError('INVALID_INPUT', 'availableModels must be a non-empty array of options observed in the runtime');
  }
  const observed = [...new Set(availableModels.map((name) => qualifyModelName(name, qualifier)))];

  const agentName = routing.agentAliases?.[agentSlug];
  if (!Object.hasOwn(routing.agentTiers, agentSlug) || !agentName) {
    throw new CopilotRoutingError('UNKNOWN_AGENT', `No Copilot agent identity or tier configured for agent: ${agentSlug}`);
  }

  const agentDefaultTier = routing.agentTiers[agentSlug];
  const contextual = taskContext === null
    ? null
    : decideContextualTier({ taskContext, agentDefaultTier, routing });
  if (tier !== null && (typeof tier !== 'string' || !Object.hasOwn(routing.tiers, tier))) {
    throw new CopilotRoutingError('UNKNOWN_TIER', `Unknown tier "${tier}"; expected one of: ${Object.keys(routing.tiers).join(', ')}`);
  }
  const tierRank = routing.contextPolicy?.tierRank;
  if (contextual && tier !== null && tierRank[tier] < tierRank[contextual.tier]) {
    throw new CopilotRoutingError('TIER_CONFLICT', `Explicit tier ${tier} is below the tier ${contextual.tier} required by the task context (${contextual.reasons[0]}); the constraint is not silently weakened. Raise the tier or revise the task context.`);
  }
  const requestedTier = tier ?? contextual?.tier ?? agentDefaultTier;
  const tierSource = tier !== null ? 'task-override' : contextual ? 'task-context' : 'agent-default';

  let pricedBudget = null;
  let estimate = null;
  if (costEstimate !== null) estimate = validateCostEstimate(costEstimate, routing.pricing);
  if (budget !== null) {
    pricedBudget = validateBudget(budget);
    if (estimate === null || estimate.missing.length > 0) {
      throw new CopilotRoutingError('BUDGET_ESTIMATE_INCOMPLETE', `A budget needs caller-supplied costEstimate counts and billingMode; missing: ${(estimate?.missing ?? ['costEstimate']).join(', ')}. No telemetry is invented.`);
    }
    if (estimate.billingMode !== tokenBillingMode) {
      throw new CopilotRoutingError('BUDGET_BILLING_UNSUPPORTED', `Budget checks need billingMode "${tokenBillingMode}"; "${estimate.billingMode}" is not a USD token estimate.`);
    }
  }
  const tokenEstimate = estimate !== null && estimate.missing.length === 0 && estimate.billingMode === tokenBillingMode ? estimate : null;
  const priceFor = (model) => priceModel(model, tokenEstimate, routing.pricing);
  const withinBudget = (priced) => priced.status === 'priced' && priced.picoUsd <= pricedBudget.maxPicoUsd;

  const candidates = routing.tiers[requestedTier];
  const chooseCandidate = () => {
    const observedCandidates = candidates.filter((candidate) => observed.includes(candidate));
    if (pricedBudget === null || observedCandidates.length === 0) return { model: observedCandidates[0], exclusions: [] };
    const exclusions = [];
    for (const candidate of observedCandidates) {
      const priced = priceFor(candidate);
      if (withinBudget(priced)) return { model: candidate, exclusions };
      exclusions.push(priced.status === 'priced'
        ? { model: candidate, reason: 'over-budget', estimatedUsd: priced.estimatedUsd }
        : { model: candidate, reason: priced.reason });
    }
    throw new CopilotRoutingError('NO_BUDGET_CANDIDATE', `No observed tier ${requestedTier} candidate fits the budget (${exclusions.map((entry) => `${entry.model}: ${entry.reason}`).join('; ')}); no cheaper tier is tried.`);
  };
  const costDetails = (model, exclusions) => ({
    costEstimate: estimate === null ? null : tokenEstimate === null
      ? { status: estimate.missing.length > 0 ? 'incomplete' : 'not-token-billing', model, missing: estimate.missing, billingMode: estimate.billingMode ?? null }
      : describeEstimate(model, tokenEstimate, routing.pricing, priceFor(model)),
    budget: pricedBudget === null ? null : { maxUsd: pricedBudget.maxUsd, withinBudget: true },
    budgetExclusions: exclusions
  });
  const outcome = (selectedModel, details) => ({
    status: 'selected',
    agentSlug,
    agentName,
    requestedTier,
    agentDefaultTier,
    tierSource,
    decisionMode: contextual ? 'contextual' : 'legacy',
    contextualTier: contextual?.tier ?? null,
    contextualPosture: contextual?.posture ?? null,
    costPosture: routing.contextPolicy.costPostures[requestedTier],
    taskContext: contextual?.taskContext ?? null,
    clarificationRequired: contextual?.clarificationRequired ?? false,
    clarification: contextual?.clarification ?? null,
    decisionReasons: contextual
      ? contextual.reasons
      : ['Legacy call without taskContext: tier comes from the agent default or an explicit tier; no contextual check was applied.'],
    suitability,
    requestedModels: candidates,
    selectedModel,
    resolvedModel: 'unknown',
    resolvedModelEvidence: 'none',
    invocation: { agentName, model: selectedModel },
    ...details
  });

  if (overrideModel !== null) {
    const requested = typeof overrideModel === 'string' ? overrideModel.trim() : '';
    if (requested === '') throw new CopilotRoutingError('INVALID_INPUT', 'overrideModel must be a non-empty string when provided');
    if (typeof allowPinnedFallback !== 'boolean') {
      throw new CopilotRoutingError('INVALID_INPUT', 'allowPinnedFallback must be a boolean recording explicit user consent');
    }

    if (!qualifiedPattern.test(requested) && observed.filter((identity) => displayName(identity) === requested).length > 1) {
      throw new CopilotRoutingError('AMBIGUOUS_MODEL', `Model "${requested}" matches several qualified options; pass the exact qualified identifier`);
    }
    const pinnedModel = qualifyModelName(requested, qualifier);
    const pinnedTiers = Object.keys(routing.tiers).filter((name) => routing.tiers[name].includes(pinnedModel));
    const pinnedAdequacy = contextual === null ? null : pinnedTiers.length === 0
      ? 'unknown'
      : pinnedTiers.some((name) => tierRank[name] >= tierRank[requestedTier]);
    const contextMismatch = contextual === null ? null : { requiredTier: requestedTier, pinnedModelTiers: pinnedTiers, adequate: pinnedAdequacy };
    const mismatchWarning = pinnedAdequacy === true || contextual === null
      ? null
      : `Pinned model "${pinnedModel}" ${pinnedAdequacy === 'unknown' ? 'is not classified in any tier' : `belongs only to tier ${pinnedTiers.join(', ')}`}, so it is not shown adequate for the tier ${requestedTier} the task context requires. The user pin is kept; this mismatch is recorded and is not a quality verdict.`;

    if (observed.includes(pinnedModel)) {
      if (pricedBudget !== null && !withinBudget(priceFor(pinnedModel))) {
        const priced = priceFor(pinnedModel);
        throw new CopilotRoutingError('BUDGET_EXCEEDED', `Pinned model "${pinnedModel}" ${priced.status === 'priced' ? `is estimated at ${priced.estimatedUsd} USD, above the ${pricedBudget.maxUsd} USD budget` : `cannot be priced (${priced.reason})`}; a user pin is blocked, never substituted.`);
      }
      return outcome(pinnedModel, {
        routingMode: 'user-pinned-model',
        source: 'user-pinned-model',
        reason: `User-pinned model "${pinnedModel}" is among the observed options.`,
        pinnedModel,
        fallbackApplied: false,
        fallbackConsent: 'not-required',
        overrideApplied: true,
        overrideWarning: mismatchWarning,
        contextMismatch,
        ...costDetails(pinnedModel, [])
      });
    }

    if (!allowPinnedFallback) {
      throw new CopilotRoutingError('PINNED_MODEL_UNAVAILABLE', `Pinned model "${pinnedModel}" is not among the observed options; falling back requires explicit user consent (allowPinnedFallback).`);
    }
    const { model: fallbackModel, exclusions } = chooseCandidate();
    if (!fallbackModel) {
      throw new CopilotRoutingError('NO_TIER_CANDIDATE', `Pinned model "${pinnedModel}" is unavailable and no observed option belongs to tier ${requestedTier}; no other tier is tried.`);
    }
    return outcome(fallbackModel, {
      routingMode: 'user-pinned-model',
      source: 'pinned-fallback',
      reason: `Pinned model "${pinnedModel}" is unavailable; user consented to the first observed tier ${requestedTier} candidate.`,
      pinnedModel,
      fallbackApplied: true,
      fallbackConsent: true,
      overrideApplied: false,
      overrideWarning: `Requested override "${pinnedModel}" is unavailable; used tier ${requestedTier} fallback "${fallbackModel}" with user consent.`,
      contextMismatch: null,
      ...costDetails(fallbackModel, exclusions)
    });
  }

  const { model: selectedModel, exclusions } = chooseCandidate();
  if (!selectedModel) {
    throw new CopilotRoutingError('NO_TIER_CANDIDATE', `No observed Copilot model belongs to tier ${requestedTier} for agent ${agentSlug}; no other tier is tried automatically. Ask the user to choose or confirm a model.`);
  }
  const priority = candidates.indexOf(selectedModel) + 1;
  return outcome(selectedModel, {
    routingMode: routing.mode,
    source: 'tier-candidate',
    reason: `First observed candidate in tier ${requestedTier} (priority ${priority} of ${candidates.length})${exclusions.length > 0 ? ' that fits the budget; observed candidates excluded within the same tier are listed in budgetExclusions' : ''}.`,
    pinnedModel: null,
    fallbackApplied: priority !== 1,
    fallbackConsent: 'not-required',
    overrideApplied: false,
    overrideWarning: null,
    contextMismatch: null,
    ...costDetails(selectedModel, exclusions)
  });
}

const usage = `Usage:
  node <path>/copilot-model-routing.mjs --agent <slug> --available <model> [--available <model>...] [--tier <tier>] [--model <pinned>] [--allow-pinned-fallback]
  node <path>/copilot-model-routing.mjs --input <file|-> (JSON object: agentSlug, availableModels, tier, overrideModel, allowPinnedFallback, taskContext, costEstimate, budget)
  node <path>/copilot-model-routing.mjs <agent-slug> <available-model>...
Available models are options observed in the runtime (qualified or picker names). Exit codes: 0 selected, 1 blocked, 2 usage.`;

async function readInput(source) {
  if (source !== '-') return fs.readFile(source, 'utf8');
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export async function runCopilotRoutingCli(argv, { root = null } = {}) {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        agent: { type: 'string' },
        available: { type: 'string', multiple: true },
        tier: { type: 'string' },
        model: { type: 'string' },
        'allow-pinned-fallback': { type: 'boolean' },
        input: { type: 'string' }
      }
    }));
  } catch (error) {
    return { exitCode: 2, stderr: `${error.message}\n${usage}` };
  }

  let request = {};
  if (values.input !== undefined) {
    try {
      request = JSON.parse(await readInput(values.input));
    } catch (error) {
      return { exitCode: 2, stderr: `Invalid --input: ${error.message}\n${usage}` };
    }
    if (request === null || typeof request !== 'object' || Array.isArray(request)) {
      return { exitCode: 2, stderr: `Invalid --input: expected a JSON object\n${usage}` };
    }
    const allowedFields = ['agentSlug', 'availableModels', 'tier', 'overrideModel', 'allowPinnedFallback', 'taskContext', 'costEstimate', 'budget'];
    const unsupported = Object.keys(request).filter((field) => !allowedFields.includes(field));
    if (unsupported.length > 0) return { exitCode: 2, stderr: `Invalid --input: unsupported fields ${unsupported.join(', ')}\n${usage}` };
    for (const field of ['taskContext', 'costEstimate', 'budget']) {
      if (request[field] === null) return { exitCode: 2, stderr: `Invalid --input: ${field} must be omitted or an object, not null\n${usage}` };
    }
  }
  const [legacyAgent, ...legacyAvailable] = positionals;
  const agentSlug = values.agent ?? legacyAgent ?? request.agentSlug;
  const availableModels = values.available ?? (legacyAvailable.length > 0 ? legacyAvailable : request.availableModels);
  if (!agentSlug || availableModels === undefined) return { exitCode: 2, stderr: usage };

  try {
    const routing = await loadCopilotModelRouting({ root });
    const result = resolveCopilotModel({
      agentSlug,
      availableModels,
      routing,
      tier: values.tier ?? request.tier ?? null,
      overrideModel: values.model ?? request.overrideModel ?? null,
      allowPinnedFallback: values['allow-pinned-fallback'] ?? request.allowPinnedFallback ?? false,
      taskContext: request.taskContext ?? null,
      costEstimate: request.costEstimate ?? null,
      budget: request.budget ?? null
    });
    return { exitCode: 0, stdout: JSON.stringify(result, null, 2) };
  } catch (error) {
    if (error instanceof SyntaxError || (typeof error.code === 'string' && /^E[A-Z]+$/.test(error.code))) {
      return { exitCode: 2, stderr: `Unable to read routing catalog: ${error.message}\n${usage}` };
    }
    if (!(error instanceof CopilotRoutingError)) throw error;
    return { exitCode: 1, stdout: JSON.stringify({ status: 'blocked', code: error.code, message: error.message }, null, 2) };
  }
}

const invokedPath = process.argv[1] ? await fs.realpath(process.argv[1]).catch(() => null) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const { exitCode, stdout, stderr } = await runCopilotRoutingCli(process.argv.slice(2));
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
  process.exitCode = exitCode;
}