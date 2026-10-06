import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import test from 'node:test';
import { promisify } from 'node:util';
import { parse as parseYaml } from 'yaml';
import { validateDelegateRuntimeAdapters } from '../scripts/sync-delegate-runtime-adapters.mjs';
import { validateTemplatePacks } from '../scripts/validate-template-packs.mjs';
import { decideContextualTier, estimateModelCost, loadCopilotModelRouting, resolveCopilotModel, runCopilotRoutingCli } from '../scripts/copilot-model-routing.mjs';
import { parseCcreqLine, verifyCopilotModelEvidence, runEvidenceCli } from '../scripts/verify-copilot-model-evidence.mjs';
import manifest from '../templates/template-manifest.json' with { type: 'json' };

const execFileAsync = promisify(execFile);

test('template manifest declares expected packs', () => {
  const ids = manifest.packs.map((pack) => pack.id).sort();
  assert.deepEqual(ids, ['adapter-agents-md', 'adapter-antigravity', 'adapter-claude', 'adapter-codex', 'adapter-copilot', 'repo-overlay-fhh-ia-ecosystem-full']);
});

test('shared AGENTS adapter owns the root bootstrap', () => {
  const shared = manifest.packs.find((pack) => pack.id === 'adapter-agents-md');
  const codex = manifest.packs.find((pack) => pack.id === 'adapter-codex');

  assert.deepEqual(shared.required_files, ['AGENTS.md']);
  assert.equal(codex.required_files.includes('AGENTS.md'), false);
});

test('validateTemplatePacks passes for bundled packs', async () => {
  const result = await validateTemplatePacks();
  assert.equal(result.ok, true, result.failures.join('\n'));
});

test('validateTemplatePacks catches forbidden adapter terms', async () => {
  const root = await copyFixturePackage();
  const target = path.join(root, 'templates/runtime-adapters/copilot/.github/copilot-instructions.md');
  await fs.appendFile(target, '\nFHH IA Ecosystem measures DORA with backend/ rules.\n', 'utf8');

  const result = await validateTemplatePacks({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('Forbidden portable/adapter term')));
});

test('validateTemplatePacks catches adapters that do not reference neutral instructions', async () => {
  const root = await copyFixturePackage();
  const target = path.join(root, 'templates/runtime-adapters/codex/AGENTS.md');
  await fs.writeFile(target, '# AGENTS.md\n\nRuntime-only rules with no neutral reference.\n', 'utf8');

  const result = await validateTemplatePacks({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('Adapter file must reference .agents/instructions.md')));
});

test('validateTemplatePacks catches runtime wrapper drift against templates', async () => {
  const root = await copyFixtureRepository();
  const target = path.join(root, 'AGENTS.md');
  await fs.appendFile(target, '\nDrifted content.\n', 'utf8');

  const result = await validateTemplatePacks({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('Runtime adapter drift for agents-md')));
});

test('validateDelegateRuntimeAdapters catches manual edits to generated adapters', async () => {
  const root = await copyFixtureRepository();
  const target = path.join(root, '.claude/agents/capitana-alcance.md');
  await fs.appendFile(target, '\nLocal change.\n', 'utf8');

  const result = await validateDelegateRuntimeAdapters({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.includes('Generated delegate adapter drift: .claude/agents/capitana-alcance.md'));
});

test('generated delegate artifacts publish model routing capabilities', async () => {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const catalog = JSON.parse(await fs.readFile(path.join(sourceRoot, 'scripts/delegate-agent-catalog.json'), 'utf8'));
  const matrix = await fs.readFile(
    path.join(sourceRoot, '.agents/skills/02-implement/implement-prd/reference/delegate-skill-matrix.md'),
    'utf8'
  );
  const routingPolicy = await fs.readFile(path.join(sourceRoot, '.agents/model-routing/README.md'), 'utf8');
  const copilotAdapter = await fs.readFile(path.join(sourceRoot, '.github/agents/capitana-alcance.agent.md'), 'utf8');

  assert.equal(catalog.runtimeCapabilities.copilot.pinSubagentModel, true);
  assert.equal(catalog.runtimeCapabilities.copilot.autoFallback, false);
  assert.match(matrix, /## Runtime Model Routing Capabilities/);
  assert.match(routingPolicy, /\| Readiness and implementation slicing delegates \|/);
  assert.match(copilotAdapter, /subagent model pinning=true/);
  assert.match(copilotAdapter, /automatic fallback=false/);
});

test('Copilot model routing selects a qualified model and exact agent identity from observed picker names', async () => {
  const routing = await loadCopilotModelRouting();

  const result = resolveCopilotModel({
    agentSlug: 'sherlock-estructura',
    availableModels: ['Gemini 3.8 Flash', 'Claude Sonnet 5.5 (copilot)'],
    routing
  });

  assert.equal(result.requestedTier, 'Liviano');
  assert.equal(result.selectedModel, 'Gemini 3.8 Flash (copilot)');
  assert.deepEqual(result.invocation, { agentName: 'Sherlock Estructura', model: 'Gemini 3.8 Flash (copilot)' });
  assert.equal(result.resolvedModel, 'unknown');
  assert.equal(result.resolvedModelEvidence, 'none');
  assert.equal(result.source, 'tier-candidate');
  assert.equal(result.fallbackApplied, true);
  assert.match(result.reason, /priority 3 of/);
});

test('Copilot model routing keeps verified lightweight and medium defaults first and drops manufacturer prefixes', async () => {
  const routing = await loadCopilotModelRouting();
  const qualified = /^[^()]+ \(copilot\)$/;

  assert.deepEqual(routing.tiers.Liviano.slice(0, 3), ['GPT-6 Luna (copilot)', 'MAI-Code-1.1-Flash (copilot)', 'Gemini 3.8 Flash (copilot)']);
  assert.deepEqual(routing.tiers.Mediano.slice(0, 4), ['Claude Sonnet 5.5 (copilot)', 'GPT-6.1 Sol (copilot)', 'Claude Sonnet 5 (copilot)', 'GPT-6 Sol (copilot)']);
  assert.equal(routing.tiers.Mediano[0], 'Claude Sonnet 5.5 (copilot)');
  assert.ok(routing.tiers.Grande.includes('GPT-6.1 Sol (copilot)') && routing.tiers.Grande.includes('GPT-6 Sol (copilot)'));
  assert.equal(routing.tiers.Grande[0], 'GPT-6.1 Sol (copilot)');
  for (const [tier, names] of Object.entries(routing.tiers)) {
    for (const name of names) {
      assert.match(name, qualified, `${tier}: ${name}`);
      assert.doesNotMatch(name, /^(OpenAI|Anthropic|Microsoft|Google|xAI) /, `${tier}: ${name}`);
    }
    assert.equal(new Set(names).size, names.length, `${tier} has duplicates`);
  }
  assert.equal(routing.agentAliases['turbo-backend'], 'Turbo Backend');
});

test('Copilot model routing accepts a task tier override including Grande and rejects unknown tiers', async () => {
  const routing = await loadCopilotModelRouting();
  const availableModels = ['Claude Sonnet 5.5 (copilot)', 'GPT-6.1 Sol (copilot)'];

  const escalated = resolveCopilotModel({ agentSlug: 'qa-relampago', availableModels, routing, tier: 'Grande' });
  assert.equal(escalated.requestedTier, 'Grande');
  assert.equal(escalated.agentDefaultTier, 'Mediano');
  assert.equal(escalated.tierSource, 'task-override');
  assert.equal(escalated.invocation.model, 'GPT-6.1 Sol (copilot)');

  assert.throws(
    () => resolveCopilotModel({ agentSlug: 'qa-relampago', availableModels, routing, tier: 'Enorme' }),
    { code: 'UNKNOWN_TIER' }
  );
  assert.throws(
    () => resolveCopilotModel({ agentSlug: 'qa-relampago', availableModels: ['Claude Sonnet 5.5 (copilot)'], routing, tier: 'Grande' }),
    { code: 'NO_TIER_CANDIDATE', message: /no other tier is tried automatically/ }
  );
});

test('implement-prd delegates use the approved contextual-selection fallback defaults for all thirteen roles', async () => {
  const routing = await loadCopilotModelRouting();

  assert.deepEqual(routing.agentTiers, {
    'capitana-alcance': 'Mediano',
    'sherlock-estructura': 'Liviano',
    'arquitecta-fases': 'Mediano',
    'turbo-backend': 'Mediano',
    'pixel-ninja': 'Mediano',
    'guardia-contrato': 'Mediano',
    'testinator-5000': 'Mediano',
    'lint-ranger': 'Liviano',
    'qa-relampago': 'Mediano',
    'escriba-doc': 'Liviano',
    'cavecrew-investigator': 'Liviano',
    'cavecrew-builder': 'Mediano',
    'cavecrew-reviewer': 'Mediano'
  });
  assert.equal(Object.values(routing.agentTiers).includes('Grande'), false);
});

test('Copilot model routing reports an explicit failure when a tier has no observed candidate', async () => {
  const routing = await loadCopilotModelRouting();

  assert.throws(
    () => resolveCopilotModel({ agentSlug: 'turbo-backend', availableModels: ['Unknown local model'], routing }),
    { code: 'NO_TIER_CANDIDATE', message: /tier Mediano/ }
  );
});

test('Copilot model routing does not guess across manufacturer-prefixed or near-miss names', async () => {
  const routing = await loadCopilotModelRouting();

  for (const near of ['Microsoft MAI-Code-1.1-Flash', 'mai-code-1.1-flash', 'MAI-Code-1.1-Flash (other)', 'Gemini 3.8 Flash Preview']) {
    assert.throws(
      () => resolveCopilotModel({ agentSlug: 'sherlock-estructura', availableModels: [near], routing }),
      { code: 'NO_TIER_CANDIDATE' },
      near
    );
  }
});

test('Copilot model routing rejects empty, malformed, and unknown inputs', async () => {
  const routing = await loadCopilotModelRouting();
  const base = { agentSlug: 'turbo-backend', availableModels: ['Claude Sonnet 5.5'], routing };

  assert.throws(() => resolveCopilotModel({ ...base, availableModels: [] }), { code: 'INVALID_INPUT' });
  assert.throws(() => resolveCopilotModel({ ...base, availableModels: 'Claude Sonnet 5.5' }), { code: 'INVALID_INPUT' });
  assert.throws(() => resolveCopilotModel({ ...base, availableModels: ['  ', 'Claude Sonnet 5.5'] }), { code: 'INVALID_INPUT' });
  assert.throws(() => resolveCopilotModel({ ...base, availableModels: [42] }), { code: 'INVALID_INPUT' });
  assert.throws(() => resolveCopilotModel({ ...base, overrideModel: '   ' }), { code: 'INVALID_INPUT' });
  assert.throws(() => resolveCopilotModel({ ...base, agentSlug: 'nobody' }), { code: 'UNKNOWN_AGENT' });
  assert.throws(() => resolveCopilotModel({ ...base, agentSlug: 'constructor' }), { code: 'UNKNOWN_AGENT' });
});

test('Copilot model routing honors a user-pinned override and keeps selection separate from execution', async () => {
  const routing = await loadCopilotModelRouting();

  const result = resolveCopilotModel({
    agentSlug: 'turbo-backend',
    availableModels: ['Claude Sonnet 5 (copilot)', 'GPT-5.4'],
    routing,
    overrideModel: 'GPT-5.4'
  });

  assert.equal(result.routingMode, 'user-pinned-model');
  assert.equal(result.source, 'user-pinned-model');
  assert.equal(result.selectedModel, 'GPT-5.4 (copilot)');
  assert.equal(result.resolvedModel, 'unknown');
  assert.equal(result.overrideApplied, true);
  assert.equal(result.fallbackApplied, false);
  assert.equal(result.overrideWarning, null);
});

test('Copilot model routing blocks an unavailable pinned model unless fallback consent is explicit', async () => {
  const routing = await loadCopilotModelRouting();
  const request = {
    agentSlug: 'turbo-backend',
    availableModels: ['Claude Sonnet 5 (copilot)'],
    routing,
    overrideModel: 'Nonexistent Model'
  };

  assert.throws(() => resolveCopilotModel(request), { code: 'PINNED_MODEL_UNAVAILABLE', message: /explicit user consent/ });
  for (const allowPinnedFallback of ['false', 'true', 1, null]) {
    assert.throws(() => resolveCopilotModel({ ...request, allowPinnedFallback }), { code: 'INVALID_INPUT' });
  }

  const result = resolveCopilotModel({ ...request, allowPinnedFallback: true });
  assert.equal(result.source, 'pinned-fallback');
  assert.equal(result.fallbackApplied, true);
  assert.equal(result.fallbackConsent, true);
  assert.equal(result.overrideApplied, false);
  assert.equal(result.selectedModel, 'Claude Sonnet 5 (copilot)');
  assert.match(result.overrideWarning, /Requested override "Nonexistent Model \(copilot\)" is unavailable/);
});

test('Copilot model routing never downgrades the tier when a consented pinned fallback has no candidate', async () => {
  const routing = await loadCopilotModelRouting();

  assert.throws(
    () => resolveCopilotModel({
      agentSlug: 'turbo-backend',
      availableModels: ['MAI-Code-1.1-Flash (copilot)'],
      routing,
      overrideModel: 'Nonexistent Model',
      allowPinnedFallback: true
    }),
    { code: 'NO_TIER_CANDIDATE' }
  );
});

test('Copilot model routing rejects an ambiguous unqualified override', async () => {
  const routing = await loadCopilotModelRouting();

  assert.throws(
    () => resolveCopilotModel({
      agentSlug: 'turbo-backend',
      availableModels: ['Claude Sonnet 5.5 (copilot)', 'Claude Sonnet 5.5 (other)'],
      routing,
      overrideModel: 'Claude Sonnet 5.5'
    }),
    { code: 'AMBIGUOUS_MODEL' }
  );
  const exact = resolveCopilotModel({
    agentSlug: 'turbo-backend',
    availableModels: ['Claude Sonnet 5.5 (copilot)', 'Claude Sonnet 5.5 (other)'],
    routing,
    overrideModel: 'Claude Sonnet 5.5 (other)'
  });
  assert.equal(exact.selectedModel, 'Claude Sonnet 5.5 (other)');
});

test('Copilot model routing accepts a single permitted model without demanding artificial diversity', async () => {
  const routing = await loadCopilotModelRouting();

  const result = resolveCopilotModel({
    agentSlug: 'turbo-backend',
    availableModels: ['Claude Sonnet 5 (copilot)'],
    routing
  });

  assert.equal(result.selectedModel, 'Claude Sonnet 5 (copilot)');
  assert.equal(result.fallbackApplied, true);
});

test('Copilot delegate adapters emit tier model arrays and explicit identity guidance without touching other runtimes', async () => {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const catalog = JSON.parse(await fs.readFile(path.join(sourceRoot, 'scripts/delegate-agent-catalog.json'), 'utf8'));
  const { tiers, agentTiers } = catalog.copilotModelRouting;

  for (const agent of catalog.agents) {
    const content = await fs.readFile(path.join(sourceRoot, `.github/agents/${agent.slug}.agent.md`), 'utf8');
    const frontMatter = parseYaml(content.split('---')[1]);
    const template = await fs.readFile(path.join(sourceRoot, `templates/runtime-adapters/copilot/.github/agents/${agent.slug}.agent.md`), 'utf8');

    assert.deepEqual(frontMatter.model, tiers[agentTiers[agent.slug]], agent.slug);
    assert.equal(frontMatter.name, agent.alias);
    assert.equal(template, content);
    assert.match(content, new RegExp(`registered Copilot name is \`${agent.alias}\``));
    assert.match(content, new RegExp(`Claude slug \`${agent.slug}\` belongs to a different runtime`));
    assert.match(content, /passes both `agentName`.*and the selected qualified `model` explicitly to `runSubagent`/);
    assert.match(content, /cannot choose or change the model it is already running with/);
    assert.match(content, /does not prove which model executed/);
    assert.doesNotMatch(content, /Select the first locally available candidate/);

    const claude = await fs.readFile(path.join(sourceRoot, `.claude/agents/${agent.slug}.md`), 'utf8');
    const codex = await fs.readFile(path.join(sourceRoot, `.codex/agents/${agent.slug}.toml`), 'utf8');
    assert.match(claude, /^model: inherit$/m);
    assert.match(codex, new RegExp(`sandbox_mode = "${agent.writable ? 'workspace-write' : 'read-only'}"`));
    assert.doesNotMatch(claude + codex, /\(copilot\)/);
  }
});

test('Copilot invocation protocol is mirrored and keeps selection, correction, consent, and evidence limits explicit', async () => {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const overlay = path.join(sourceRoot, 'templates/repo-overlay-fhh-ia-ecosystem-full');
  const shared = [
    '.agents/skills/02-implement/implement-prd/SKILL.md',
    '.agents/skills/02-implement/implement-prd/reference/subagent-prompts.md',
    '.agents/model-routing/README.md'
  ];
  for (const relative of shared) {
    assert.equal(
      await fs.readFile(path.join(overlay, relative), 'utf8'),
      await fs.readFile(path.join(sourceRoot, relative), 'utf8'),
      relative
    );
  }

  const [skill, prompts, policy, guide] = await Promise.all([
    ...shared.map((relative) => fs.readFile(path.join(sourceRoot, relative), 'utf8')),
    fs.readFile(path.join(sourceRoot, 'docs/workflow/copilot-subagent-model-routing.md'), 'utf8')
  ]);

  assert.match(skill, /always load the `Copilot Invocation Protocol` section.*immediately before any `runSubagent` delegation/);
  assert.match(prompts, /## Copilot Invocation Protocol/);
  assert.match(prompts, /`agentName` = `invocation\.agentName`.*never the `\.claude` slug/);
  assert.match(prompts, /One correction only.*before any work started.*same required tier/);
  assert.match(prompts, /Never replay after a timeout, tool failure, task failure/);
  assert.match(prompts, /explicit user consent before any fallback/);
  assert.match(prompts, /does not intercept the VS Code tool and cannot call `runSubagent`/);
  assert.match(prompts, /Do not silently inherit the parent model/);
  assert.match(policy, /### Copilot explicit invocation/);
  assert.match(policy, /fallback only with explicit user consent/);
  assert.match(guide, /node scripts\/copilot-model-routing\.mjs/);
  assert.match(guide, /node scripts\/verify-copilot-model-evidence\.mjs --log <log>/);
  assert.match(prompts, /node \.agents\/model-routing\/copilot-model-routing\.mjs/);
  assert.match(prompts, /node \.agents\/model-routing\/verify-copilot-model-evidence\.mjs/);
  assert.match(guide, /node \.agents\/model-routing\/copilot-model-routing\.mjs/);
  assert.doesNotMatch(guide, /\[--[a-z-]+/);
  assert.match(guide, /`Grande` has no observed or permitted candidate, the result is `BLOCKED`, never `PASS`/);
  assert.match(guide, /SMOKE_VERSION/);
  assert.match(skill, /supplies a structured `taskContext`.*role defaults are only the fallback/);
  assert.match(prompts, /interprets the task and builds a structured `taskContext`.*uncertainty never lowers the tier/);
  assert.match(prompts, /`costEstimate` with caller-supplied token counts plus `budget`.*`decisionMode: legacy`/);
  assert.match(prompts, /A budget never moves a task to a cheaper tier.*not guessed/);
  assert.match(prompts, /`overrideWarning` and `contextMismatch` must be shown and recorded/);
  assert.match(policy, /### Contextual task selection/);
  assert.match(policy, /### Optional cost and budget contract/);
  assert.match(policy, /`Grande` is a risk-justified tier, not an assumption of higher cost/);
  assert.match(policy, /Luna is an economical `Liviano` candidate.*neither is a quality-benchmark winner/);
  assert.match(policy, /\| Readiness \(`capitana-alcance`\) and slicing \(`arquitecta-fases`\) \| Mediano \|/);
  assert.match(policy, /\| Acceptance tests \(`testinator-5000`\) and terse review \(`cavecrew-reviewer`\) \| Mediano \|/);
  assert.match(guide, /node scripts\/copilot-model-routing\.mjs --input - <<'JSON'/);
  assert.match(guide, /`BUDGET_BILLING_UNSUPPORTED` \| budget with `legacy-annual-request` billing/);
  assert.doesNotMatch(guide, /\/Users\/|C:\\\\/);
});

test('Copilot model routing CLI reports selection, blocked outcomes, and usage errors with distinct exit codes', async () => {
  const script = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../scripts/copilot-model-routing.mjs');
  const run = (args) => execFileAsync(process.execPath, [script, ...args]).then(
    ({ stdout }) => ({ code: 0, stdout }),
    (error) => ({ code: error.code, stdout: error.stdout, stderr: error.stderr })
  );

  const selected = await run(['--agent', 'sherlock-estructura', '--available', 'MAI-Code-1.1-Flash']);
  assert.equal(selected.code, 0);
  assert.deepEqual(JSON.parse(selected.stdout).invocation, { agentName: 'Sherlock Estructura', model: 'MAI-Code-1.1-Flash (copilot)' });

  const escalated = await run(['--agent', 'qa-relampago', '--tier', 'Grande', '--available', 'GPT-6.1 Sol (copilot)']);
  assert.equal(escalated.code, 0);
  assert.equal(JSON.parse(escalated.stdout).tierSource, 'task-override');

  const blocked = await run(['--agent', 'turbo-backend', '--model', 'Missing', '--available', 'Claude Sonnet 5.5']);
  assert.equal(blocked.code, 1);
  assert.equal(JSON.parse(blocked.stdout).code, 'PINNED_MODEL_UNAVAILABLE');

  assert.equal((await run(['--agent', 'turbo-backend'])).code, 2);
  assert.equal((await run(['--bogus'])).code, 2);
});

const contextual = (overrides = {}) => ({
  objective: 'Locate the exported routing symbol',
  workKind: 'lookup',
  risk: 'low',
  ambiguity: 'low',
  contextCompleteness: 'complete',
  bounded: true,
  ...overrides
});
const everyTierModel = [
  'GPT-6 Luna (copilot)',
  'MAI-Code-1.1-Flash (copilot)',
  'Claude Sonnet 5.5 (copilot)',
  'GPT-6.1 Sol (copilot)'
];
const withoutField = (record, field) => Object.fromEntries(Object.entries(record).filter(([name]) => name !== field));
const tokenEstimate = (overrides = {}) => ({
  billingMode: 'token',
  estimationDate: '2026-10-06',
  uncachedInputTokens: 0,
  cachedInputTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
  ...overrides
});

test('contextual tier API validates defaults and normalizes explicit signals directly', async () => {
  const routing = await loadCopilotModelRouting();
  for (const agentDefaultTier of ['Bogus', 'constructor', null, undefined, 2]) {
    assert.throws(() => decideContextualTier({ routing, agentDefaultTier, taskContext: contextual() }), { code: 'UNKNOWN_TIER' });
  }
  const critical = decideContextualTier({ routing, agentDefaultTier: 'Liviano', taskContext: contextual({ objective: '  Review permission boundary  ', criticalConcerns: ['security', 'security'], contextCompleteness: 'partial' }) });
  assert.equal(critical.tier, 'Grande');
  assert.equal(critical.taskContext.objective, 'Review permission boundary');
  assert.deepEqual(critical.taskContext.criticalConcerns, ['security']);
  assert.equal(critical.clarificationRequired, true);
  const uncertain = decideContextualTier({ routing, agentDefaultTier: 'Liviano', taskContext: contextual({ contextCompleteness: 'unknown' }) });
  assert.equal(uncertain.tier, 'Mediano');
  assert.equal(uncertain.clarificationRequired, true);
});

test('contextual selection separates mechanical lookup, substantive readiness, and critical work', async () => {
  const routing = await loadCopilotModelRouting();
  const resolve = (agentSlug, taskContext, extra = {}) => resolveCopilotModel({ agentSlug, availableModels: everyTierModel, routing, taskContext, ...extra });

  const lookup = resolve('sherlock-estructura', contextual());
  assert.equal(lookup.decisionMode, 'contextual');
  assert.equal(lookup.requestedTier, 'Liviano');
  assert.equal(lookup.contextualPosture, 'mechanical-exception');
  assert.equal(lookup.costPosture, 'lean');
  assert.equal(lookup.tierSource, 'task-context');
  assert.equal(lookup.selectedModel, 'GPT-6 Luna (copilot)');
  assert.equal(lookup.resolvedModel, 'unknown');
  assert.equal(lookup.suitability.basis, 'unbenchmarked');
  assert.doesNotMatch(lookup.suitability.statement, /best|wins|winner/i);

  const readinessReadOnly = resolve('sherlock-estructura', contextual({ workKind: 'readiness', objective: 'Judge PRD readiness' }));
  assert.equal(readinessReadOnly.requestedTier, 'Mediano');
  assert.equal(readinessReadOnly.contextualPosture, 'role-floor');
  assert.equal(readinessReadOnly.selectedModel, 'Claude Sonnet 5.5 (copilot)');
  assert.equal(readinessReadOnly.costPosture, 'balanced');
  assert.equal(resolve('escriba-doc', contextual({ workKind: 'evidence-synthesis' })).requestedTier, 'Liviano');
  assert.equal(resolve('escriba-doc', contextual({ workKind: 'evidence-synthesis', ambiguity: 'medium' })).requestedTier, 'Mediano');

  const mechanicalForMediumRole = resolve('capitana-alcance', contextual({ workKind: 'mechanical-validation' }));
  assert.equal(mechanicalForMediumRole.requestedTier, 'Liviano');

  for (const critical of [{ risk: 'high' }, { ambiguity: 'high' }, { criticalConcerns: ['security'] }]) {
    const decision = resolve('qa-relampago', contextual({ workKind: 'review', ...critical }));
    assert.equal(decision.requestedTier, 'Grande');
    assert.equal(decision.contextualPosture, 'critical');
    assert.equal(decision.costPosture, 'premium');
    assert.equal(decision.selectedModel, 'GPT-6.1 Sol (copilot)');
    assert.match(decision.decisionReasons[0], /risk=high|ambiguity=high|critical-concern=security/);
  }
});

test('contextual selection never lets non-qualifying or uncertain context cheapen a role', async () => {
  const routing = await loadCopilotModelRouting();
  const resolve = (agentSlug, taskContext) => resolveCopilotModel({ agentSlug, availableModels: everyTierModel, routing, taskContext });

  for (const weaker of [{ risk: 'medium' }, { ambiguity: 'medium' }, { bounded: false }]) {
    const decision = resolve('qa-relampago', contextual(weaker));
    assert.equal(decision.requestedTier, 'Mediano', JSON.stringify(weaker));
    assert.equal(decision.contextualPosture, 'role-floor');
    assert.equal(resolve('sherlock-estructura', contextual(weaker)).requestedTier, 'Mediano');
  }
  for (const contextCompleteness of ['partial', 'unknown']) {
    const decision = resolve('sherlock-estructura', contextual({ contextCompleteness }));
    assert.equal(decision.requestedTier, 'Mediano');
    assert.equal(decision.contextualPosture, 'role-floor');
    assert.equal(decision.clarificationRequired, true);
    assert.match(decision.clarification, /never lowers the tier/);

    const substantive = resolve('sherlock-estructura', contextual({ contextCompleteness, workKind: 'implementation' }));
    assert.equal(substantive.requestedTier, 'Mediano');
    assert.equal(substantive.clarificationRequired, true);
  }
  assert.equal(resolve('sherlock-estructura', contextual()).clarificationRequired, false);
  assert.equal(resolve('sherlock-estructura', contextual({ criticalConcerns: [] })).requestedTier, 'Liviano');
});

test('contextual selection rejects malformed, unsupported, and missing context before classifying', async () => {
  const routing = await loadCopilotModelRouting();
  const attempt = (taskContext) => () => resolveCopilotModel({ agentSlug: 'sherlock-estructura', availableModels: everyTierModel, routing, taskContext });
  const without = (field) => withoutField(contextual(), field);

  for (const bad of [
    'lookup',
    [],
    7,
    contextual({ objective: '   ' }),
    contextual({ objective: 5 }),
    contextual({ workKind: 'refactor' }),
    contextual({ workKind: ['lookup'] }),
    contextual({ workKind: 'constructor' }),
    contextual({ risk: 'none' }),
    contextual({ ambiguity: 'LOW' }),
    contextual({ contextCompleteness: 'mostly' }),
    contextual({ bounded: 'true' }),
    contextual({ criticalConcerns: 'security' }),
    contextual({ criticalConcerns: null }),
    contextual({ criticalConcerns: ['vibes'] }),
    contextual({ extra: true }),
    ...['objective', 'workKind', 'risk', 'ambiguity', 'contextCompleteness', 'bounded'].map(without)
  ]) {
    assert.throws(attempt(bad), { code: 'INVALID_CONTEXT' }, JSON.stringify(bad));
  }
});

test('contextual selection blocks a tier constraint below the requirement and warns on mismatched pins', async () => {
  const routing = await loadCopilotModelRouting();
  const base = { agentSlug: 'qa-relampago', availableModels: everyTierModel, routing };

  assert.throws(
    () => resolveCopilotModel({ ...base, taskContext: contextual({ workKind: 'review' }), tier: 'Liviano' }),
    { code: 'TIER_CONFLICT', message: /not silently weakened/ }
  );
  assert.throws(
    () => resolveCopilotModel({ ...base, taskContext: contextual({ workKind: 'review', risk: 'high' }), tier: 'Mediano' }),
    { code: 'TIER_CONFLICT' }
  );
  const higher = resolveCopilotModel({ ...base, taskContext: contextual(), tier: 'Grande' });
  assert.equal(higher.requestedTier, 'Grande');
  assert.equal(higher.tierSource, 'task-override');
  assert.equal(higher.contextualTier, 'Liviano');

  const criticalContext = contextual({ workKind: 'review', criticalConcerns: ['data-loss'] });
  const cheapPin = resolveCopilotModel({ ...base, taskContext: criticalContext, overrideModel: 'MAI-Code-1.1-Flash' });
  assert.equal(cheapPin.selectedModel, 'MAI-Code-1.1-Flash (copilot)');
  assert.equal(cheapPin.overrideApplied, true);
  assert.match(cheapPin.overrideWarning, /not shown adequate for the tier Grande/);
  assert.deepEqual(cheapPin.contextMismatch, { requiredTier: 'Grande', pinnedModelTiers: ['Liviano'], adequate: false });

  const adequatePin = resolveCopilotModel({ ...base, taskContext: criticalContext, overrideModel: 'GPT-6.1 Sol' });
  assert.equal(adequatePin.overrideWarning, null);
  assert.equal(adequatePin.contextMismatch.adequate, true);

  const unclassified = resolveCopilotModel({ ...base, availableModels: ['Mystery Model (copilot)'], taskContext: criticalContext, overrideModel: 'Mystery Model' });
  assert.equal(unclassified.contextMismatch.adequate, 'unknown');
  assert.match(unclassified.overrideWarning, /not classified in any tier/);
});

test('contextual selection keeps exact names, strict consent, and no tier downgrade', async () => {
  const routing = await loadCopilotModelRouting();
  const base = { agentSlug: 'turbo-backend', routing, taskContext: contextual({ workKind: 'implementation' }) };

  const selected = resolveCopilotModel({ ...base, availableModels: ['GPT-6.1 Sol', 'GPT-6 Luna'] });
  assert.deepEqual(selected.invocation, { agentName: 'Turbo Backend', model: 'GPT-6.1 Sol (copilot)' });
  assert.equal(selected.fallbackApplied, true);

  assert.throws(() => resolveCopilotModel({ ...base, availableModels: ['GPT-6 Luna (copilot)', 'MAI-Code-1.1-Flash (copilot)'] }), { code: 'NO_TIER_CANDIDATE' });
  assert.throws(
    () => resolveCopilotModel({ ...base, availableModels: ['Claude Sonnet 5.5 (copilot)'], taskContext: contextual({ workKind: 'review', risk: 'high' }) }),
    { code: 'NO_TIER_CANDIDATE', message: /tier Grande/ }
  );
  const pinRequest = { ...base, availableModels: ['Claude Sonnet 5 (copilot)', 'GPT-6 Luna (copilot)'], overrideModel: 'Missing Model' };
  assert.throws(() => resolveCopilotModel(pinRequest), { code: 'PINNED_MODEL_UNAVAILABLE' });
  for (const allowPinnedFallback of ['true', 1, null]) {
    assert.throws(() => resolveCopilotModel({ ...pinRequest, allowPinnedFallback }), { code: 'INVALID_INPUT' });
  }
  const consented = resolveCopilotModel({ ...pinRequest, allowPinnedFallback: true });
  assert.equal(consented.selectedModel, 'Claude Sonnet 5 (copilot)');
  assert.equal(consented.requestedTier, 'Mediano');
  assert.equal(consented.fallbackConsent, true);
  assert.throws(
    () => resolveCopilotModel({ ...pinRequest, availableModels: ['GPT-6 Luna (copilot)'], allowPinnedFallback: true }),
    { code: 'NO_TIER_CANDIDATE' }
  );
});

test('legacy calls without task context are preserved and identified as legacy', async () => {
  const routing = await loadCopilotModelRouting();

  const legacy = resolveCopilotModel({ agentSlug: 'qa-relampago', availableModels: ['Claude Sonnet 5.5'], routing });
  assert.equal(legacy.decisionMode, 'legacy');
  assert.equal(legacy.tierSource, 'agent-default');
  assert.equal(legacy.contextualTier, null);
  assert.equal(legacy.costEstimate, null);
  assert.match(legacy.decisionReasons[0], /Legacy call without taskContext/);
  assert.equal(resolveCopilotModel({ agentSlug: 'qa-relampago', availableModels: ['Claude Sonnet 5.5'], routing, taskContext: null }).decisionMode, 'legacy');
});

test('cost estimation applies standard and long context rates exactly at the threshold', async () => {
  const routing = await loadCopilotModelRouting();
  const estimate = (model, counts) => estimateModelCost({ model, routing, costEstimate: tokenEstimate(counts) });

  assert.equal(estimate('GPT-6 Luna (copilot)', { uncachedInputTokens: 200_000 }).estimatedUsd, 0.02);
  assert.equal(estimate('GPT-6 Luna (copilot)', { outputTokens: 1_000_000 }).estimatedUsd, 0.5);
  const standard = estimate('GPT-6 Luna (copilot)', { uncachedInputTokens: 272_000 });
  const long = estimate('GPT-6 Luna (copilot)', { uncachedInputTokens: 272_001 });
  assert.equal(standard.rateTier, 'standard');
  assert.equal(long.rateTier, 'long');
  assert.ok(Math.abs(standard.estimatedUsd - 0.0272) < 1e-12);
  assert.ok(Math.abs(long.estimatedUsd - 0.0544002) < 1e-12);

  assert.equal(estimate('GPT-6.1 Sol (copilot)', { cachedInputTokens: 200_000 }).estimatedUsd, 0.02);
  assert.equal(estimate('GPT-6 Sol (copilot)', { cachedInputTokens: 200_000 }).estimatedUsd, 0.04);
  assert.ok(Math.abs(estimate('GPT-6.1 Sol (copilot)', { cachedInputTokens: 300_000 }).estimatedUsd - 0.06) < 1e-12);
  assert.ok(Math.abs(estimate('GPT-6 Sol (copilot)', { cachedInputTokens: 300_000 }).estimatedUsd - 0.12) < 1e-12);
  assert.ok(Math.abs(estimate('GPT-6.1 Sol (copilot)', { uncachedInputTokens: 300_000, outputTokens: 100_000 }).estimatedUsd - 2.7) < 1e-12);
  assert.equal(estimate('Claude Sonnet 5.5 (copilot)', { uncachedInputTokens: 5_000_000 }).rateTier, 'standard');
});

test('cost estimation sums mutually exclusive token categories including cache writes', async () => {
  const routing = await loadCopilotModelRouting();
  const counts = { uncachedInputTokens: 1_000_000, cachedInputTokens: 1_000_000, cacheWriteTokens: 1_000_000, outputTokens: 1_000_000 };

  const priced = estimateModelCost({ model: 'Claude Sonnet 5.5 (copilot)', routing, costEstimate: tokenEstimate(counts) });
  assert.equal(priced.estimatedUsd, 14.7);
  assert.equal(priced.totalContextInputTokens, 3_000_000);
  assert.equal(estimateModelCost({ model: 'Claude Sonnet 5.5 (copilot)', routing, costEstimate: tokenEstimate({ ...counts, totalContextInputTokens: 3_000_000 }) }).estimatedUsd, 14.7);
  assert.match(priced.caveat, /not actual spend/);

  const unsupportedWrite = estimateModelCost({ model: 'MAI-Code-1.1-Flash (copilot)', routing, costEstimate: tokenEstimate({ cacheWriteTokens: 1 }) });
  assert.deepEqual([unsupportedWrite.status, unsupportedWrite.reason], ['unpriceable', 'cache-write-unsupported']);
  assert.equal(estimateModelCost({ model: 'MAI-Code-1.1-Flash (copilot)', routing, costEstimate: tokenEstimate({ cachedInputTokens: 1_000_000 }) }).estimatedUsd, 0.02);
  assert.equal(estimateModelCost({ model: 'GPT-6 Luna (copilot)', routing, costEstimate: tokenEstimate({ cacheWriteTokens: 200_000 }) }).estimatedUsd, 0.025);
});

test('cost estimation rejects malformed counts and reports missing, unknown, expired, and legacy-billing states', async () => {
  const routing = await loadCopilotModelRouting();
  const model = 'GPT-6 Luna (copilot)';
  const attempt = (costEstimate) => () => estimateModelCost({ model, routing, costEstimate });

  for (const bad of [
    tokenEstimate({ uncachedInputTokens: -1 }),
    tokenEstimate({ cachedInputTokens: 1.5 }),
    tokenEstimate({ cacheWriteTokens: '5' }),
    tokenEstimate({ outputTokens: Number.NaN }),
    tokenEstimate({ outputTokens: Number.POSITIVE_INFINITY }),
    tokenEstimate({ outputTokens: 2 ** 60 }),
    tokenEstimate({ uncachedInputTokens: Number.MAX_SAFE_INTEGER, cachedInputTokens: 1 }),
    tokenEstimate({ totalContextInputTokens: 1.5 }),
    tokenEstimate({ uncachedInputTokens: 10, cachedInputTokens: 5, totalContextInputTokens: 99 }),
    tokenEstimate({ uncachedInputTokens: 10, cachedInputTokens: 5, cacheWriteTokens: 0, totalContextInputTokens: 14 }),
    tokenEstimate({ billingMode: 'subscription' }),
    tokenEstimate({ estimationDate: '2026-13-01' }),
    tokenEstimate({ estimationDate: 'today' }),
    tokenEstimate({ surprise: 1 }),
    null,
    []
  ]) {
    assert.throws(attempt(bad), { code: 'INVALID_COST_ESTIMATE' }, JSON.stringify(bad));
  }

  const partial = withoutField(tokenEstimate(), 'outputTokens');
  const incomplete = estimateModelCost({ model, routing, costEstimate: partial });
  assert.deepEqual([incomplete.status, incomplete.missing], ['incomplete', ['outputTokens']]);
  assert.deepEqual(estimateModelCost({ model, routing, costEstimate: {} }).missing, ['billingMode', 'estimationDate', ...Object.keys(tokenEstimate()).slice(2)]);

  const unknown = estimateModelCost({ model: 'Kimi K3 (copilot)', routing, costEstimate: tokenEstimate({ outputTokens: 10 }) });
  assert.deepEqual([unknown.status, unknown.reason], ['unpriceable', 'unknown-pricing']);
  assert.equal(unknown.estimatedUsd, undefined);

  const legacy = estimateModelCost({ model, routing, costEstimate: tokenEstimate({ billingMode: 'legacy-annual-request' }) });
  assert.equal(legacy.status, 'not-token-billing');

  const promoRouting = structuredClone(routing);
  promoRouting.pricing.models[model].promotionExpires = '2026-12-31';
  const onExpiry = estimateModelCost({ model, routing: promoRouting, costEstimate: tokenEstimate({ estimationDate: '2026-12-31', outputTokens: 10 }) });
  const afterExpiry = estimateModelCost({ model, routing: promoRouting, costEstimate: tokenEstimate({ estimationDate: '2027-01-01', outputTokens: 10 }) });
  assert.equal(onExpiry.status, 'priced');
  assert.deepEqual([afterExpiry.status, afterExpiry.reason], ['unpriceable', 'promotion-expired']);

  const noLongRouting = structuredClone(routing);
  noLongRouting.pricing.models[model].long = null;
  const noLong = estimateModelCost({ model, routing: noLongRouting, costEstimate: tokenEstimate({ uncachedInputTokens: 272_001 }) });
  assert.equal(noLong.reason, 'long-context-unpriced');
  assert.equal(routing.pricing.verifiedOn, '2026-10-06');
  assert.match(routing.pricing.source, /^https:\/\/docs\.github\.com\/es\/copilot\/reference\/copilot-billing\/models-and-pricing$/);
});

test('budget constraints block without sufficient token counts, token billing, or a valid amount', async () => {
  const routing = await loadCopilotModelRouting();
  const base = { agentSlug: 'turbo-backend', availableModels: ['Claude Sonnet 5.5 (copilot)'], routing };
  const budget = { maxUsd: 100 };

  assert.throws(() => resolveCopilotModel({ ...base, budget }), { code: 'BUDGET_ESTIMATE_INCOMPLETE', message: /costEstimate/ });
  assert.throws(() => resolveCopilotModel({ ...base, budget, costEstimate: withoutField(tokenEstimate(), 'billingMode') }), { code: 'BUDGET_ESTIMATE_INCOMPLETE', message: /billingMode/ });
  assert.throws(() => resolveCopilotModel({ ...base, budget, costEstimate: withoutField(tokenEstimate(), 'outputTokens') }), { code: 'BUDGET_ESTIMATE_INCOMPLETE', message: /outputTokens/ });
  assert.throws(
    () => resolveCopilotModel({ ...base, budget, costEstimate: tokenEstimate({ billingMode: 'legacy-annual-request' }) }),
    { code: 'BUDGET_BILLING_UNSUPPORTED' }
  );
  for (const badBudget of [{ maxUsd: -1 }, { maxUsd: '5' }, { maxUsd: Number.NaN }, { maxUsd: Number.POSITIVE_INFINITY }, { maxUsd: 1.9999999 }, { maxUsd: 0.0000005 }, {}, { maxUsd: 1, extra: 2 }, 5, []]) {
    assert.throws(() => resolveCopilotModel({ ...base, budget: badBudget, costEstimate: tokenEstimate() }), { code: 'INVALID_BUDGET' }, JSON.stringify(badBudget));
  }

  const estimateOnly = resolveCopilotModel({ ...base, costEstimate: tokenEstimate({ billingMode: 'legacy-annual-request' }) });
  assert.equal(estimateOnly.costEstimate.status, 'not-token-billing');
  assert.equal(estimateOnly.budget, null);
  const priced = resolveCopilotModel({ ...base, costEstimate: tokenEstimate({ uncachedInputTokens: 1_000_000 }) });
  assert.equal(priced.costEstimate.estimatedUsd, 2);
  assert.equal(priced.resolvedModel, 'unknown');
});

test('budget boundary is exact and a pinned model over budget is blocked rather than substituted', async () => {
  const routing = await loadCopilotModelRouting();
  const base = { agentSlug: 'turbo-backend', availableModels: ['Claude Sonnet 5.5 (copilot)'], routing, costEstimate: tokenEstimate({ uncachedInputTokens: 1_000_000 }) };

  const exact = resolveCopilotModel({ ...base, budget: { maxUsd: 2 } });
  assert.equal(exact.selectedModel, 'Claude Sonnet 5.5 (copilot)');
  assert.deepEqual(exact.budget, { maxUsd: 2, withinBudget: true });
  assert.throws(() => resolveCopilotModel({ ...base, budget: { maxUsd: 1.999999 } }), { code: 'NO_BUDGET_CANDIDATE', message: /no cheaper tier is tried/ });

  const pinned = { ...base, availableModels: ['Claude Sonnet 5.5 (copilot)', 'GPT-6 Luna (copilot)'], overrideModel: 'Claude Sonnet 5.5' };
  assert.equal(resolveCopilotModel({ ...pinned, budget: { maxUsd: 2 } }).selectedModel, 'Claude Sonnet 5.5 (copilot)');
  assert.throws(() => resolveCopilotModel({ ...pinned, budget: { maxUsd: 1.5 } }), { code: 'BUDGET_EXCEEDED', message: /blocked, never substituted/ });
  assert.throws(
    () => resolveCopilotModel({ ...pinned, availableModels: ['Kimi K3 (copilot)'], overrideModel: 'Kimi K3', budget: { maxUsd: 100 } }),
    { code: 'BUDGET_EXCEEDED', message: /cannot be priced \(unknown-pricing\)/ }
  );
});

test('budget fallback stays inside the required tier and never downgrades', async () => {
  const routing = await loadCopilotModelRouting();
  const base = {
    agentSlug: 'turbo-backend',
    routing,
    costEstimate: tokenEstimate({ cachedInputTokens: 200_000 }),
    budget: { maxUsd: 0.03 }
  };

  const cheaperSameTier = resolveCopilotModel({ ...base, availableModels: ['Claude Sonnet 5.5 (copilot)', 'GPT-6.1 Sol (copilot)', 'GPT-6 Luna (copilot)'] });
  assert.equal(cheaperSameTier.requestedTier, 'Mediano');
  assert.equal(cheaperSameTier.selectedModel, 'GPT-6.1 Sol (copilot)');
  assert.equal(cheaperSameTier.fallbackApplied, true);
  assert.deepEqual(cheaperSameTier.budgetExclusions.map((entry) => [entry.model, entry.reason]), [['Claude Sonnet 5.5 (copilot)', 'over-budget']]);
  assert.match(cheaperSameTier.reason, /fits the budget/);

  const unpricedFirstRouting = structuredClone(routing);
  unpricedFirstRouting.tiers.Mediano = ['Grok 4.7 (copilot)', ...routing.tiers.Mediano.filter((name) => name !== 'Grok 4.7 (copilot)')];
  const unknownExcluded = resolveCopilotModel({ ...base, routing: unpricedFirstRouting, availableModels: ['Grok 4.7 (copilot)', 'GPT-6.1 Sol (copilot)'] });
  assert.equal(unknownExcluded.selectedModel, 'GPT-6.1 Sol (copilot)');
  assert.deepEqual(unknownExcluded.budgetExclusions, [{ model: 'Grok 4.7 (copilot)', reason: 'unknown-pricing' }]);

  const maiFirstRouting = structuredClone(routing);
  maiFirstRouting.tiers.Liviano.reverse();
  const writeBase = { ...base, routing: maiFirstRouting, costEstimate: tokenEstimate({ cacheWriteTokens: 1_000 }), budget: { maxUsd: 100 }, agentSlug: 'sherlock-estructura' };
  const writeExcluded = resolveCopilotModel({ ...writeBase, availableModels: ['MAI-Code-1.1-Flash (copilot)', 'GPT-6 Luna (copilot)'] });
  assert.equal(writeExcluded.selectedModel, 'GPT-6 Luna (copilot)');
  assert.deepEqual(writeExcluded.budgetExclusions, [{ model: 'MAI-Code-1.1-Flash (copilot)', reason: 'cache-write-unsupported' }]);

  assert.throws(
    () => resolveCopilotModel({ ...base, availableModels: ['Claude Sonnet 5.5 (copilot)', 'GPT-6 Luna (copilot)'], budget: { maxUsd: 0.001 } }),
    { code: 'NO_BUDGET_CANDIDATE', message: /tier Mediano/ }
  );
  const consentedPinFallback = resolveCopilotModel({
    ...base,
    availableModels: ['Claude Sonnet 5.5 (copilot)', 'GPT-6.1 Sol (copilot)'],
    overrideModel: 'Missing Model',
    allowPinnedFallback: true
  });
  assert.equal(consentedPinFallback.selectedModel, 'GPT-6.1 Sol (copilot)');
});

test('contextual structured CLI accepts task context, token counts, and a budget from stdin and blocks malformed input', async () => {
  const script = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../scripts/copilot-model-routing.mjs');
  const request = {
    agentSlug: 'qa-relampago',
    availableModels: ['Claude Sonnet 5.5', 'GPT-6.1 Sol'],
    taskContext: contextual({ objective: 'Independent QA of the routing slice', workKind: 'review', risk: 'medium', ambiguity: 'medium' }),
    costEstimate: tokenEstimate({ uncachedInputTokens: 100_000, outputTokens: 10_000 }),
    budget: { maxUsd: 1 }
  };
  const run = (body) => spawnSync(process.execPath, [script, '--input', '-'], { input: JSON.stringify(body), encoding: 'utf8' });

  const selected = run(request);
  assert.equal(selected.status, 0, selected.stderr);
  const result = JSON.parse(selected.stdout);
  assert.equal(result.decisionMode, 'contextual');
  assert.equal(result.requestedTier, 'Mediano');
  assert.deepEqual(result.invocation, { agentName: 'QA Relampago', model: 'Claude Sonnet 5.5 (copilot)' });
  assert.ok(Math.abs(result.costEstimate.estimatedUsd - 0.3) < 1e-12);
  assert.equal(result.resolvedModel, 'unknown');

  const badContext = run({ ...request, taskContext: { ...request.taskContext, risk: 'none' } });
  assert.equal(badContext.status, 1);
  assert.equal(JSON.parse(badContext.stdout).code, 'INVALID_CONTEXT');
  for (const badRequest of [{ ...request, budegt: { maxUsd: 0 } }, { ...request, taskContext: null }, { ...request, budget: null }, { ...request, costEstimate: null }]) {
    const invalid = run(badRequest);
    assert.equal(invalid.status, 2);
    assert.match(invalid.stderr, /Invalid --input/);
    assert.doesNotMatch(invalid.stderr, /\n\s+at /);
  }
  const overBudget = run({ ...request, budget: { maxUsd: 0.01 } });
  assert.equal(overBudget.status, 1);
  assert.equal(JSON.parse(overBudget.stdout).code, 'NO_BUDGET_CANDIDATE');
  const conflict = run({ ...request, tier: 'Liviano' });
  assert.equal(JSON.parse(conflict.stdout).code, 'TIER_CONFLICT');

  const mixed = spawnSync(process.execPath, [script, '--agent', 'sherlock-estructura', '--available', 'GPT-6 Luna', '--input', '-'], {
    input: JSON.stringify({ taskContext: contextual() }),
    encoding: 'utf8'
  });
  assert.equal(JSON.parse(mixed.stdout).selectedModel, 'GPT-6 Luna (copilot)');
  assert.equal(JSON.parse(mixed.stdout).decisionMode, 'contextual');
});


const sonnetLine = '2026-10-06 12:12:50.820 [info] ccreq:77296111.copilotmd | success | claude-sonnet-5.5 -> claude-sonnet-5-5 | 3031ms | [tool/runSubagent-Cavecrew Investigator]';
const evidenceBase = {
  agent: 'Cavecrew Investigator',
  modelIds: ['claude-sonnet-5.5', 'claude-sonnet-5-5'],
  requestIds: ['77296111']
};
const ccreq = (id, { status = 'success', chain = 'claude-sonnet-5.5 -> claude-sonnet-5-5', agent = 'Cavecrew Investigator', time = '2026-10-06 12:12:50.820' } = {}) =>
  `${time} [info] ccreq:${id}.copilotmd | ${status} | ${chain} | 3031ms | [tool/runSubagent-${agent}]`;

test('Copilot evidence parser extracts only sanitized metadata and rejects unanchored or malformed lines', () => {
  assert.deepEqual(parseCcreqLine(sonnetLine), {
    timestamp: '2026-10-06 12:12:50.820',
    requestId: '77296111',
    status: 'success',
    modelChain: ['claude-sonnet-5.5', 'claude-sonnet-5-5'],
    durationMs: 3031,
    agent: 'Cavecrew Investigator'
  });

  for (const bad of [
    `prefix ${sonnetLine}`,
    `${sonnetLine} trailing prompt text`,
    sonnetLine.replace('[info]', '[error]'),
    sonnetLine.replace('3031ms', 'slowms'),
    sonnetLine.replace('[tool/runSubagent-Cavecrew Investigator]', '[tool/other]'),
    sonnetLine.replace('claude-sonnet-5.5 -> claude-sonnet-5-5', 'secret key=abc -> x'),
    `${sonnetLine}${'x'.repeat(3000)}`,
    '',
    null
  ]) {
    assert.equal(parseCcreqLine(bad), null, String(bad).slice(0, 60));
  }
});

test('Copilot evidence verifier accepts an exact successful request with explicit model aliases', () => {
  const report = verifyCopilotModelEvidence({ ...evidenceBase, logText: `noise\n${sonnetLine}\n`, requestIds: ['77296111.copilotmd'] });

  assert.equal(report.verdict, 'VERIFIED');
  assert.equal(report.results[0].record.agent, 'Cavecrew Investigator');
  assert.equal(JSON.stringify(report).includes('3031ms'), false);
});

test('Copilot evidence verifier distinguishes NOT_VERIFIED from MISMATCH', () => {
  const verify = (logText, overrides = {}) => verifyCopilotModelEvidence({ ...evidenceBase, logText, ...overrides });

  assert.equal(verify('').verdict, 'NOT_VERIFIED');
  assert.equal(verify(ccreq('99999999')).verdict, 'NOT_VERIFIED');
  assert.equal(verify(ccreq('77296111', { status: 'failure' })).verdict, 'NOT_VERIFIED');
  assert.equal(verify(ccreq('77296111', { status: 'cancelled' })).verdict, 'NOT_VERIFIED');
  assert.equal(verify(`${ccreq('77296111')} partial`).verdict, 'NOT_VERIFIED');
  assert.equal(verify('2026-10-06 12:12:50.820 [info] ccreq:77296111.copilotmd | success | claude-sonnet-5.5').verdict, 'NOT_VERIFIED');

  assert.equal(verify(ccreq('77296111', { agent: 'Turbo Backend' })).verdict, 'MISMATCH');
  assert.equal(verify(ccreq('77296111', { agent: 'Cavecrew Investigator Extra' })).verdict, 'MISMATCH');
  assert.equal(verify(ccreq('77296111', { chain: 'claude-sonnet-5.5 -> gpt-6.1-sol' })).verdict, 'MISMATCH');
  assert.equal(verify(ccreq('77296111', { chain: 'gpt-6.1-sol' })).verdict, 'MISMATCH');
  assert.equal(verify(ccreq('77296111', { chain: 'claude-sonnet-5.5 -> claude-sonnet-5-5 -> claude-sonnet-5.5' })).verdict, 'MISMATCH');
  assert.equal(verify(ccreq('77296111'), { modelIds: ['claude-sonnet-5.5'] }).verdict, 'MISMATCH');
});

test('Copilot evidence verifier rejects conflicting duplicates and tolerates identical duplicates', () => {
  const conflicting = `${ccreq('77296111')}\n${ccreq('77296111', { chain: 'gpt-6.1-sol' })}`;
  const identical = `${ccreq('77296111')}\n${ccreq('77296111')}`;

  assert.equal(verifyCopilotModelEvidence({ ...evidenceBase, logText: conflicting }).verdict, 'MISMATCH');
  assert.equal(verifyCopilotModelEvidence({ ...evidenceBase, logText: identical }).verdict, 'VERIFIED');
  assert.equal(verifyCopilotModelEvidence({
    ...evidenceBase,
    logText: `${ccreq('77296111')}\n${ccreq('77296111', { time: '2026-10-06 12:12:51.000' })}`
  }).verdict, 'MISMATCH');
});

test('Copilot evidence verifier correlates only supplied request IDs among same-label concurrent calls and hostile logs', () => {
  const log = [
    ccreq('11111111'),
    ccreq('22222222', { chain: 'gpt-6.1-sol' }),
    ccreq('33333333', { status: 'failure' }),
    '2026-10-06 12:12:51.000 [info] unrelated ccreq:44444444 | success | claude-sonnet-5.5 | 1ms | [tool/runSubagent-Cavecrew Investigator]',
    '2026-10-06 12:12:52.000 [info] other | note: ccreq:44444444.copilotmd | success | claude-sonnet-5.5 -> claude-sonnet-5-5 | 1ms | [tool/runSubagent-Cavecrew Investigator]',
    ccreq('55555555', { agent: 'Cavecrew Investigator ccreq:66666666' })
  ].join('\n');
  const verify = (requestIds) => verifyCopilotModelEvidence({ ...evidenceBase, logText: log, requestIds });

  assert.equal(verify(['11111111']).verdict, 'VERIFIED');
  assert.equal(verify(['22222222']).verdict, 'MISMATCH');
  assert.equal(verify(['33333333']).verdict, 'NOT_VERIFIED');
  assert.equal(verify(['44444444']).verdict, 'NOT_VERIFIED');
  assert.equal(verify(['66666666']).verdict, 'NOT_VERIFIED');
  assert.equal(verify(['11111111', '22222222']).verdict, 'MISMATCH');
  assert.equal(verify(['11111111', '33333333']).verdict, 'NOT_VERIFIED');
  assert.equal(verify(['11111111', '11111111.copilotmd']).results.length, 1);
});

test('Copilot evidence verifier enforces the supplied invocation interval', () => {
  const logText = ccreq('77296111', { time: '2026-10-06 12:12:50.820' });
  const verify = (bounds) => verifyCopilotModelEvidence({ ...evidenceBase, logText, ...bounds }).verdict;

  assert.equal(verify({ since: '2026-10-06 12:12:50', until: '2026-10-06 12:12:50' }), 'VERIFIED');
  assert.equal(verify({ since: '2026-10-06 12:12:51' }), 'NOT_VERIFIED');
  assert.equal(verify({ until: '2026-10-06 12:12:50.100' }), 'NOT_VERIFIED');
  assert.throws(() => verify({ since: 'yesterday' }), TypeError);
});

test('Copilot evidence verifier rejects missing or malformed inputs', () => {
  const call = (overrides) => () => verifyCopilotModelEvidence({ ...evidenceBase, logText: sonnetLine, ...overrides });

  assert.throws(call({ requestIds: [] }), TypeError);
  assert.throws(call({ requestIds: undefined }), TypeError);
  assert.throws(call({ requestIds: ['bad id'] }), TypeError);
  assert.throws(call({ modelIds: [] }), TypeError);
  assert.throws(call({ modelIds: ['a b'] }), TypeError);
  assert.throws(call({ agent: '  ' }), TypeError);
  assert.throws(call({ logText: null }), TypeError);
});

test('Copilot evidence verifier CLI maps verdicts to distinct exit codes', async () => {
  const script = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../scripts/verify-copilot-model-evidence.mjs');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'copilot-evidence-'));
  const logPath = path.join(dir, 'chat.log');
  await fs.writeFile(logPath, `${sonnetLine}\n${ccreq('22222222', { chain: 'gpt-6.1-sol' })}\n`, 'utf8');
  const run = (args) => execFileAsync(process.execPath, [script, ...args]).then(
    ({ stdout }) => ({ code: 0, stdout }),
    (error) => ({ code: error.code, stdout: error.stdout, stderr: error.stderr })
  );
  const common = ['--log', logPath, '--agent', 'Cavecrew Investigator', '--model-id', 'claude-sonnet-5.5', '--model-id', 'claude-sonnet-5-5'];

  const verified = await run([...common, '--request-id', '77296111']);
  assert.equal(verified.code, 0);
  assert.equal(JSON.parse(verified.stdout).verdict, 'VERIFIED');

  const unknown = await run([...common, '--request-id', '77296111', '--request-id', '99999999']);
  assert.equal(unknown.code, 1);
  assert.equal(JSON.parse(unknown.stdout).verdict, 'NOT_VERIFIED');

  const mismatch = await run([...common, '--request-id', '22222222']);
  assert.equal(mismatch.code, 3);
  assert.equal(JSON.parse(mismatch.stdout).verdict, 'MISMATCH');

  assert.equal((await run(common)).code, 2);
  assert.equal((await run(['--log', path.join(dir, 'missing.log'), '--agent', 'x', '--model-id', 'a', '--request-id', '1'])).code, 2);
});

const portableHelpers = ['copilot-model-routing.mjs', 'delegate-agent-catalog.json', 'verify-copilot-model-evidence.mjs'];

test('Copilot portable helpers are byte-identical generated copies of the scripts sources', async () => {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const overlay = path.join(sourceRoot, 'templates/repo-overlay-fhh-ia-ecosystem-full');

  for (const file of portableHelpers) {
    const source = await fs.readFile(path.join(sourceRoot, 'scripts', file));
    assert.deepEqual(await fs.readFile(path.join(sourceRoot, '.agents/model-routing', file)), source, `canonical ${file}`);
    assert.deepEqual(await fs.readFile(path.join(overlay, '.agents/model-routing', file)), source, `overlay ${file}`);
  }
});

test('Copilot portable CLIs run in a consumer root that has only the installed model-routing helpers', async () => {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const overlayHelpers = path.join(sourceRoot, 'templates/repo-overlay-fhh-ia-ecosystem-full/.agents/model-routing');
  const consumer = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'copilot-consumer-')));
  const helpers = path.join(consumer, '.agents/model-routing');
  await fs.mkdir(helpers, { recursive: true });
  for (const file of portableHelpers) await fs.copyFile(path.join(overlayHelpers, file), path.join(helpers, file));

  const run = (script, args) => execFileAsync(process.execPath, [path.join(helpers, script), ...args], { cwd: consumer }).then(
    ({ stdout }) => ({ code: 0, stdout, stderr: '' }),
    (error) => ({ code: error.code, stdout: error.stdout, stderr: error.stderr })
  );
  const routing = (args) => run('copilot-model-routing.mjs', args);

  const selected = await routing(['--agent', 'turbo-backend', '--available', 'Claude Sonnet 5.5']);
  assert.equal(selected.code, 0, selected.stderr);
  assert.deepEqual(JSON.parse(selected.stdout).invocation, { agentName: 'Turbo Backend', model: 'Claude Sonnet 5.5 (copilot)' });
  assert.equal((await routing(['--agent', 'turbo-backend', '--available', 'Unknown Model'])).code, 1);

  const structured = {
    agentSlug: 'sherlock-estructura',
    availableModels: ['GPT-6 Luna (copilot)', 'Claude Sonnet 5.5 (copilot)'],
    taskContext: contextual(),
    costEstimate: tokenEstimate({ uncachedInputTokens: 200_000 }),
    budget: { maxUsd: 0.02 }
  };
  const structuredPath = path.join(consumer, 'request.json');
  await fs.writeFile(structuredPath, JSON.stringify(structured));
  const contextualRun = await routing(['--input', structuredPath]);
  assert.equal(contextualRun.code, 0, contextualRun.stderr);
  const contextualResult = JSON.parse(contextualRun.stdout);
  assert.equal(contextualResult.decisionMode, 'contextual');
  assert.equal(contextualResult.selectedModel, 'GPT-6 Luna (copilot)');
  assert.equal(contextualResult.costEstimate.estimatedUsd, 0.02);
  await fs.writeFile(structuredPath, JSON.stringify({ ...structured, budget: { maxUsd: 0.019999 } }));
  const overBudgetRun = await routing(['--input', structuredPath]);
  assert.equal(overBudgetRun.code, 1);
  assert.equal(JSON.parse(overBudgetRun.stdout).code, 'NO_BUDGET_CANDIDATE');
  await fs.writeFile(structuredPath, JSON.stringify(structured));

  const link = `${consumer}-link`;
  await fs.symlink(consumer, link);
  const viaSymlink = await execFileAsync(process.execPath, [path.join(link, '.agents/model-routing/copilot-model-routing.mjs'), '--agent', 'turbo-backend', '--available', 'Claude Sonnet 5.5']);
  assert.equal(JSON.parse(viaSymlink.stdout).selectedModel, 'Claude Sonnet 5.5 (copilot)');
  const contextualViaSymlink = await execFileAsync(process.execPath, [path.join(link, '.agents/model-routing/copilot-model-routing.mjs'), '--input', structuredPath]);
  assert.equal(JSON.parse(contextualViaSymlink.stdout).decisionMode, 'contextual');

  const logPath = path.join(consumer, 'chat.log');
  await fs.writeFile(logPath, `${sonnetLine}\n`, 'utf8');
  const common = ['--log', logPath, '--agent', 'Cavecrew Investigator', '--model-id', 'claude-sonnet-5.5', '--model-id', 'claude-sonnet-5-5'];
  const verified = await run('verify-copilot-model-evidence.mjs', [...common, '--request-id', '77296111']);
  assert.equal(verified.code, 0, verified.stderr);
  assert.equal(JSON.parse(verified.stdout).verdict, 'VERIFIED');
  const evidenceViaSymlink = await execFileAsync(process.execPath, [path.join(link, '.agents/model-routing/verify-copilot-model-evidence.mjs'), ...common, '--request-id', '77296111']);
  assert.equal(JSON.parse(evidenceViaSymlink.stdout).verdict, 'VERIFIED');
  const missing = await run('verify-copilot-model-evidence.mjs', [...common, '--request-id', '99999999']);
  assert.equal(missing.code, 1);
  assert.equal(JSON.parse(missing.stdout).verdict, 'NOT_VERIFIED');
});

test('Copilot model routing CLI reports non-object or malformed --input as a usage error without a stack trace', async () => {
  const script = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../scripts/copilot-model-routing.mjs');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'copilot-input-'));

  for (const [name, body] of [['null', 'null'], ['array', '[]'], ['number', '7'], ['string', '"x"'], ['truncated', '{']]) {
    const inputPath = path.join(dir, `${name}.json`);
    await fs.writeFile(inputPath, body, 'utf8');
    const result = await execFileAsync(process.execPath, [script, '--input', inputPath]).then(
      () => ({ code: 0, stderr: '' }),
      (error) => ({ code: error.code, stderr: error.stderr })
    );

    assert.equal(result.code, 2, name);
    assert.match(result.stderr, /Invalid --input/, name);
    assert.doesNotMatch(result.stderr, /\n\s+at /, name);
  }
});

test('Copilot routing CLI accepts structured files, stdin, legacy arguments, and explicit roots', async () => {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const script = path.join(sourceRoot, 'scripts/copilot-model-routing.mjs');
  const consumer = await fs.mkdtemp(path.join(os.tmpdir(), 'copilot-api-'));
  const request = { agentSlug: 'turbo-backend', availableModels: ['Claude Sonnet 5.5 (copilot)'] };
  const input = path.join(consumer, 'request.json');
  await fs.writeFile(input, JSON.stringify(request));
  const fromFile = await runCopilotRoutingCli(['--input', input]);
  assert.equal(fromFile.exitCode, 0);
  assert.equal(JSON.parse(fromFile.stdout).invocation.agentName, 'Turbo Backend');
  const fromStdin = spawnSync(process.execPath, [script, '--input', '-'], { input: JSON.stringify(request), encoding: 'utf8' });
  assert.equal(fromStdin.status, 0, fromStdin.stderr);
  assert.equal(JSON.parse(fromStdin.stdout).selectedModel, 'Claude Sonnet 5.5 (copilot)');
  await fs.mkdir(path.join(consumer, 'scripts'));
  await fs.copyFile(path.join(sourceRoot, 'scripts/delegate-agent-catalog.json'), path.join(consumer, 'scripts/delegate-agent-catalog.json'));
  const routing = await loadCopilotModelRouting({ root: consumer });
  assert.equal(routing.agentAliases['turbo-backend'], 'Turbo Backend');
  const legacy = await runCopilotRoutingCli(['turbo-backend', 'Claude Sonnet 5.5'], { root: consumer });
  assert.equal(legacy.exitCode, 0);
  assert.equal(JSON.parse(legacy.stdout).invocation.model, 'Claude Sonnet 5.5 (copilot)');
  await fs.rm(consumer, { recursive: true });
});

test('Copilot CLI APIs report catalog parse and IO errors as usage errors without stack traces', async () => {
  const consumer = await fs.mkdtemp(path.join(os.tmpdir(), 'copilot-io-'));
  const missingCatalog = await runCopilotRoutingCli(['turbo-backend', 'Claude Sonnet 5.5'], { root: consumer });
  assert.equal(missingCatalog.exitCode, 2);
  assert.match(missingCatalog.stderr, /Unable to read routing catalog/);
  await fs.mkdir(path.join(consumer, 'scripts'));
  await fs.writeFile(path.join(consumer, 'scripts/delegate-agent-catalog.json'), '{');
  const malformedCatalog = await runCopilotRoutingCli(['turbo-backend', 'Claude Sonnet 5.5'], { root: consumer });
  assert.equal(malformedCatalog.exitCode, 2);
  assert.match(malformedCatalog.stderr, /Unable to read routing catalog/);
  const file = path.join(consumer, 'file');
  await fs.writeFile(file, 'not a directory');
  const unreadableLog = await runEvidenceCli(['--log', path.join(file, 'log'), '--agent', 'Turbo Backend', '--model-id', 'claude-sonnet-5.5', '--request-id', 'abcd1234']);
  assert.equal(unreadableLog.exitCode, 2);
  assert.match(unreadableLog.stderr, /ENOTDIR/);
  assert.doesNotMatch(`${missingCatalog.stderr}\n${malformedCatalog.stderr}\n${unreadableLog.stderr}`, /\n\s+at /);
  await fs.rm(consumer, { recursive: true });
});

async function copyFixturePackage() {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-template-pack-'));
  await fs.cp(path.join(sourceRoot, 'templates'), path.join(targetRoot, 'templates'), { recursive: true });
  await fs.mkdir(path.join(targetRoot, 'scripts'), { recursive: true });
  for (const file of ['delegate-agent-catalog.json', 'copilot-model-routing.mjs', 'verify-copilot-model-evidence.mjs']) {
    await fs.copyFile(path.join(sourceRoot, 'scripts', file), path.join(targetRoot, 'scripts', file));
  }
  return targetRoot;
}

async function copyFixtureRepository() {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-repo-pack-'));
  await fs.cp(sourceRoot, targetRoot, {
    recursive: true,
    filter(source) {
      const relative = path.relative(sourceRoot, source);
      if (relative === '') return true;
      if (relative.startsWith('.git')) return false;
      if (relative.startsWith('node_modules')) return false;
      return true;
    }
  });
  return targetRoot;
}
