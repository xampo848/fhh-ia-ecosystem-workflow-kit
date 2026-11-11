import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { buildInstallPlan, buildUpdatePlan } from '../src/planner.mjs';
import { projectContextDiagnostics } from '../src/workspace-diagnostics.mjs';
import { validateDelegateContract } from '../scripts/validate-delegate-contract.mjs';
import { extractPrdIds, prdHash, verifyPrdIndex } from '../.agents/skills/02-implement/prd-readiness-review/scripts/verify-prd-index.mjs';
import { makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

test('delegate contract covers the rule inventory and every delegate role skill', async () => {
  const result = await validateDelegateContract({ root });
  assert.deepEqual(result.failures, []);
  assert.equal(result.skillCount, 10);

  const inventory = JSON.parse(await read('scripts/delegate-rule-inventory.json'));
  assert.ok(inventory.rules.filter((rule) => rule.scope !== 'orchestrator').length >= 12);
});

test('delegate contract validation fails when a skill or the contract drops a rule', async () => {
  const fixture = await makeTempRepo('workflow-kit-delegate-');
  await fs.cp(path.join(root, '.agents'), path.join(fixture, '.agents'), { recursive: true });
  await fs.mkdir(path.join(fixture, 'scripts'));
  for (const file of ['delegate-agent-catalog.json', 'delegate-rule-inventory.json']) {
    await fs.copyFile(path.join(root, 'scripts', file), path.join(fixture, 'scripts', file));
  }
  const skill = path.join(fixture, '.agents/skills/02-implement/validation-runner/SKILL.md');
  await fs.writeFile(skill, (await fs.readFile(skill, 'utf8')).replace('1. Read `.agents/delegation/delegate-contract.md`.', '1. Read `.agents/instructions.md`.'), 'utf8');
  const contract = path.join(fixture, '.agents/delegation/delegate-contract.md');
  await fs.writeFile(contract, (await fs.readFile(contract, 'utf8')).replace(/Never install or attach a capability without/g, 'Install capabilities carefully, with'), 'utf8');

  const result = await validateDelegateContract({ root: fixture });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('validation-runner/SKILL.md must read')));
  assert.ok(result.failures.some((failure) => failure.includes('still lists the routing contract')));
  assert.ok(result.failures.some((failure) => failure.includes('"no-silent-install"')));
});

test('generated delegate adapters embed the contract summary and stop pointing at generic instructions', async () => {
  const contract = await read('.agents/delegation/delegate-contract.md');
  const summaryLine = 'If something is not covered (scope change, route decision, installation, missing information), stop and return `blocked` to the orchestrator.';
  assert.ok(contract.includes(summaryLine));
  for (const adapter of ['.claude/agents/turbo-backend.md', '.codex/agents/turbo-backend.toml', '.github/agents/turbo-backend.agent.md']) {
    const content = await read(adapter);
    assert.ok(content.includes(summaryLine), adapter);
    assert.match(content, /\.agents\/delegation\/delegate-contract\.md/, adapter);
    assert.doesNotMatch(content, /applicable repository instructions/, adapter);
  }
});

test('PRD index verifier catches missing ids, missing edge-case categories and a stale PRD', () => {
  const prd = '# PRD\n| AC-1 | a |\n| AC-2 | b |\n| UC-1 | c |\n| P1-S1 | d |\n| INV-AUTH-01 | AC-1 |\n| Datos vacíos | x |\n| Permisos/tenancy | y |\n';
  assert.deepEqual(extractPrdIds(prd), ['AC-1', 'AC-2', 'INV-AUTH-01', 'P1-S1', 'UC-1']);
  const complete = `prd_sha256: ${prdHash(prd)}\nAC-1,texto\nAC-2,texto\nUC-1\nP1-S1\nINV-AUTH-01\nDatos vacios\nPermisos/tenancy\n`;
  assert.equal(verifyPrdIndex({ prd, index: complete }).ok, true);

  const missing = verifyPrdIndex({ prd, index: complete.replace('AC-2,texto\n', '').replace('Permisos/tenancy\n', '') });
  assert.equal(missing.ok, false);
  assert.ok(missing.failures.some((failure) => failure.includes('AC-2')));
  assert.ok(missing.failures.some((failure) => failure.includes('permisos/tenancy')));

  const stale = verifyPrdIndex({ prd: `${prd}| AC-3 | nuevo |\n`, index: complete });
  assert.ok(stale.failures.some((failure) => failure.includes('stale')));
  assert.ok(stale.failures.some((failure) => failure.includes('AC-3')));
});

test('project-context.md is created once, never overwritten, and checked by doctor', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const contextPath = path.join(target, '.agents/project-context.md');
  assert.match(await fs.readFile(contextPath, 'utf8'), /workflow-kit:project-context:template/);
  assert.deepEqual((await projectContextDiagnostics({ targetPath: target })).map((item) => item.code), ['project-context/not-initialized']);

  await fs.mkdir(path.join(target, 'backend'), { recursive: true });
  const own = '# Project Context\n\n| Path | Responsibility |\n| --- | --- |\n| `backend/` | API |\n| `docs/missing/ARCHITECTURE.md` | gone |\n\nRun `make test-fast` per slice.\n';
  await fs.writeFile(contextPath, own, 'utf8');
  const update = await buildUpdatePlan({ targetPath: target, runtime: 'neutral' });
  assert.equal(update.operations.find((item) => item.relativePath === '.agents/project-context.md').operation, 'skip_unmanaged');
  await applyInstallPlan(update);
  assert.equal(await fs.readFile(contextPath, 'utf8'), own);

  const diagnostics = await projectContextDiagnostics({ targetPath: target });
  assert.deepEqual(diagnostics.map((item) => item.code), ['project-context/missing-path']);
  assert.match(diagnostics[0].message, /docs\/missing\/ARCHITECTURE\.md/);
});

test('preparation is proportional: one inline pass at N2, an index at N3, a delta discovery, a proportional matcher', async () => {
  const [n2, n3, discovery, matcher, readiness] = await Promise.all([
    read('.agents/skills/02-implement/implement-change/reference/level-n2.md'),
    read('.agents/skills/02-implement/implement-change/reference/level-n3.md'),
    read('.agents/skills/02-implement/codebase-discovery/SKILL.md'),
    read('.agents/skills/02-implement/implementation-skill-matcher/SKILL.md'),
    read('.agents/skills/02-implement/prd-readiness-review/SKILL.md')
  ]);
  assert.match(n2, /\*\*one inline pass\*\* with three separate\s+verdicts/);
  assert.match(n2, /more than 5\s+exploratory files are needed, the area is not covered by\s+`\.agents\/project-context\.md`, or the input contradicts the code/);
  assert.match(n3, /The orchestrator keeps the\s+index, not the whole PRD/);
  assert.match(n3, /missing from the index is a `high` finding/);
  assert.match(discovery, /`\.agents\/project-context\.md` \*\*first\*\*/);
  assert.match(discovery, /\*\*delta\*\* over this file/);
  assert.match(matcher, /## Proportional Entry/);
  assert.match(matcher, /No mandatory pattern is ever skipped/);
  assert.match(readiness, /The index points; it does not paraphrase/);
});
