import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function loadCopilotModelRouting({ root = packageRoot } = {}) {
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'scripts/delegate-agent-catalog.json'), 'utf8'));
  return catalog.copilotModelRouting;
}

export function resolveCopilotModel({ agentSlug, availableModels, routing, overrideModel = null }) {
  if (!Array.isArray(availableModels)) {
    throw new TypeError('availableModels must be an array supplied by the local Copilot runtime');
  }

  const tier = routing.agentTiers[agentSlug];
  if (!tier) throw new Error(`No Copilot model tier configured for agent: ${agentSlug}`);

  const candidates = routing.tiers[tier] ?? [];

  if (overrideModel) {
    if (availableModels.includes(overrideModel)) {
      return {
        routingMode: 'user-pinned-model',
        requestedTier: tier,
        requestedModels: candidates,
        resolvedModel: overrideModel,
        fallbackApplied: false,
        overrideApplied: true,
        overrideWarning: null
      };
    }

    const fallbackModel = candidates.find((candidate) => availableModels.includes(candidate));
    if (!fallbackModel) {
      throw new Error(`Override model unavailable and no tier ${tier} candidate matches for agent ${agentSlug}: ${overrideModel}`);
    }

    return {
      routingMode: 'user-pinned-model',
      requestedTier: tier,
      requestedModels: candidates,
      resolvedModel: fallbackModel,
      fallbackApplied: true,
      overrideApplied: false,
      overrideWarning: `Requested override "${overrideModel}" is unavailable locally; used tier ${tier} fallback "${fallbackModel}" instead.`
    };
  }

  const resolvedModel = candidates.find((candidate) => availableModels.includes(candidate));
  if (!resolvedModel) {
    throw new Error(`No available Copilot model matches tier ${tier} for agent ${agentSlug}`);
  }

  return {
    routingMode: routing.mode,
    requestedTier: tier,
    requestedModels: candidates,
    resolvedModel,
    fallbackApplied: resolvedModel !== candidates[0],
    overrideApplied: false,
    overrideWarning: null
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , agentSlug, ...availableModels] = process.argv;
  if (!agentSlug || availableModels.length === 0) {
    console.error('Usage: node scripts/copilot-model-routing.mjs <agent-slug> <available-model>...');
    process.exit(1);
  }

  const routing = await loadCopilotModelRouting();
  console.log(JSON.stringify(resolveCopilotModel({ agentSlug, availableModels, routing }), null, 2));
}