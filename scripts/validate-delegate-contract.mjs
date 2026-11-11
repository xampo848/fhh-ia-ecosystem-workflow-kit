#!/usr/bin/env node
// Guarantees that taking .agents/instructions.md out of the delegates' startup
// does not drop a rule they need (roadmap D-18):
// 1. every delegate role skill reads the delegate contract and no longer asks
//    for the orchestrator's routing contract;
// 2. every inventory rule scoped to delegates is present in the contract.
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const delegateContractPath = '.agents/delegation/delegate-contract.md';
// Third-party skills keep their upstream text (see docs/legal/third-party/provenance.json).
const thirdPartyPrefixes = ['.agents/skills/05-caveman/'];
const routingContractRead = /^\s*(?:[-*]|\d+\.)\s+(?:Read\s+)?`(?:\.github\/copilot-instructions\.md|\.agents\/instructions\.md)`/m;

export async function validateDelegateContract({ root = packageRoot } = {}) {
  const failures = [];
  const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

  let contract;
  try {
    contract = await read(delegateContractPath);
  } catch {
    return { ok: false, failures: [`Missing ${delegateContractPath}.`] };
  }

  const catalog = JSON.parse(await read('scripts/delegate-agent-catalog.json'));
  const skillPaths = [...new Set(catalog.agents.map((agent) => agent.shared_skill_path))]
    .filter((skillPath) => !thirdPartyPrefixes.some((prefix) => skillPath.startsWith(prefix)));

  for (const skillPath of skillPaths) {
    const skill = await read(skillPath);
    if (!skill.includes(delegateContractPath)) {
      failures.push(`${skillPath} must read ${delegateContractPath}.`);
    }
    if (routingContractRead.test(skill)) {
      failures.push(`${skillPath} still lists the routing contract as a required read; delegates read ${delegateContractPath} instead.`);
    }
  }

  const inventory = JSON.parse(await read('scripts/delegate-rule-inventory.json'));
  const seen = new Set();
  for (const rule of inventory.rules ?? []) {
    if (!rule.id || seen.has(rule.id)) failures.push(`Invalid or duplicate inventory rule id: ${rule.id}`);
    seen.add(rule.id);
    if (!['orchestrator', 'delegate', 'both'].includes(rule.scope)) {
      failures.push(`Inventory rule ${rule.id} has an invalid scope: ${rule.scope}`);
      continue;
    }
    if (rule.scope === 'orchestrator') continue;
    if (!rule.contractPattern) {
      failures.push(`Inventory rule ${rule.id} needs a contractPattern because delegates must follow it.`);
    } else if (!new RegExp(rule.contractPattern).test(contract)) {
      failures.push(`Rule "${rule.id}" (${rule.scope}) is missing from ${delegateContractPath}.`);
    }
  }

  return { ok: failures.length === 0, failures, skillCount: skillPaths.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateDelegateContract();
  if (!result.ok) {
    console.error('Delegate contract validation failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Delegate contract covers its rule inventory and ${result.skillCount} delegate role skills.`);
}
