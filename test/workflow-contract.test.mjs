import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { buildInstallPlan } from '../src/planner.mjs';
import { validateOverlayDrift } from '../src/workflow-contract/drift.mjs';
import { validateWorkflowContract } from '../src/workflow-contract/index.mjs';
import { makeTempRepo } from './helpers.mjs';

async function installedTarget() {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({
    targetPath: target,
    runtime: 'codex,copilot,claude,antigravity'
  });
  await applyInstallPlan(plan);
  return target;
}

test('valid all-runtime installation satisfies workflow contract', async () => {
  const target = await installedTarget();
  const result = await validateWorkflowContract({
    root: target,
    runtimes: ['codex', 'copilot', 'claude', 'antigravity']
  });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics, null, 2));
});

test('validator reports invalid Copilot front matter', async () => {
  const target = await installedTarget();
  const file = path.join(target, '.github/instructions/ai-workflow.instructions.md');
  await fs.writeFile(file, '# no front matter\n', 'utf8');
  const result = await validateWorkflowContract({ root: target, runtimes: ['copilot'] });
  assert.ok(result.diagnostics.some((item) => item.code === 'copilot/missing-apply-to'));
});

test('validator reports unregistered skills', async () => {
  const target = await installedTarget();
  const file = path.join(target, '.agents/skills/local/example/SKILL.md');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, '# Example\n', 'utf8');
  const result = await validateWorkflowContract({ root: target });
  assert.ok(result.diagnostics.some((item) => item.code === 'skills/unregistered-file'));
});

test('validator reports malformed capability manifests', async () => {
  const target = await installedTarget();
  const file = path.join(target, '.agents/capabilities/manifests/broken.md');
  await fs.writeFile(file, '# Capability manifest: broken\n', 'utf8');
  const result = await validateWorkflowContract({ root: target });
  assert.ok(result.diagnostics.some((item) => item.code === 'capabilities/malformed-manifest'));
});

test('package canonical files match the installable overlay', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const result = await validateWorkflowContract({ root, checkOverlayDrift: true });
  assert.equal(
    result.diagnostics.some((item) => item.code === 'overlay/content-drift'),
    false,
    JSON.stringify(result.diagnostics, null, 2)
  );
});

test('overlay drift detects divergence in mirrored third-party skills', async () => {
  const root = await fs.mkdtemp(path.join(process.cwd(), '.tmp-overlay-drift-'));
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  await fs.cp(path.join(sourceRoot, '.agents'), path.join(root, '.agents'), { recursive: true });
  await fs.cp(
    path.join(sourceRoot, 'templates/repo-overlay-fhh-ia-ecosystem-full'),
    path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full'),
    { recursive: true }
  );
  const canonicalSkill = path.join(root, '.agents/skills/04-crosscutting/frontend-design/SKILL.md');
  await fs.appendFile(canonicalSkill, '\nUnmirrored content.\n', 'utf8');

  const diagnostics = await validateOverlayDrift({ root });

  assert.ok(diagnostics.some((item) => item.path.includes('frontend-design/SKILL.md')));
  await fs.rm(root, { recursive: true, force: true });
});

test('workflow router keeps deterministic PR comments hard trigger policy', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const routerPath = path.join(root, '.agents/skills/00-router/workflow-router/SKILL.md');
  const router = await fs.readFile(routerPath, 'utf8');

  assert.match(router, /Deterministic intent resolution \(required in every route\)/);
  assert.match(router, /PR comments hard trigger/);
  assert.match(router, /Route to `pr-comments-resolution` when the user intent is to resolve, process, close, or work through PR\/review comments/);
});

test('workflow router keeps deterministic project-formation trigger and route-options menu', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const routerPath = path.join(root, '.agents/skills/00-router/workflow-router/SKILL.md');
  const registryPath = path.join(root, '.agents/skills/registry.md');
  const [router, registry] = await Promise.all([
    fs.readFile(routerPath, 'utf8'),
    fs.readFile(registryPath, 'utf8')
  ]);

  assert.match(router, /Project formation hard trigger/);
  assert.match(router, /Route to `project-formation` as the recommended option/);
  assert.match(router, /Mandatory route-options block/);
  assert.match(router, /Elige una opción por número o por nombre de skill/);
  assert.match(registry, /`project-formation` \| Workflow \| `\.agents\/skills\/01-product\/project-formation\/SKILL\.md`/);
});

test('implement-prd requires a tracked PRD-local execution lock for closure', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const skillPath = path.join(root, '.agents/skills/02-implement/implement-prd/SKILL.md');
  const skill = await fs.readFile(skillPath, 'utf8');

  assert.match(skill, /git-tracked execution lock at `<prd-directory>\/execution-lock\.toon`/);
  assert.match(skill, /The PRD-local lock is the closure authority/);
  assert.match(skill, /must not be ignored by Git/);
});

test('QA handoff workflow keeps explicit rerun and controlled-lite closure rules', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const qaPath = path.join(root, '.agents/skills/02-implement/qa-handoff-review/SKILL.md');
  const slicingPath = path.join(root, '.agents/skills/02-implement/implementation-slicing/SKILL.md');
  const [qaSkill, slicingSkill] = await Promise.all([
    fs.readFile(qaPath, 'utf8'),
    fs.readFile(slicingPath, 'utf8')
  ]);

  assert.match(qaSkill, /## Executable Procedure/);
  assert.match(qaSkill, /### Decision And Re-entry/);
  assert.match(qaSkill, /The reviewer does not retry automatically/);
  assert.match(qaSkill, /## Permitted Exceptions/);
  assert.match(slicingSkill, /final QA checklist, closure gates, and TOON handoff remain mandatory/);
});

test('create-prd requires use cases, test strategy, and edge-case matrix before a PRD is ready', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const skillPath = path.join(root, '.agents/skills/01-product/create-prd/SKILL.md');
  const templatePath = path.join(root, '.agents/skills/01-product/create-prd/PRD_TEMPLATE.md');
  const [skill, template] = await Promise.all([
    fs.readFile(skillPath, 'utf8'),
    fs.readFile(templatePath, 'utf8')
  ]);

  assert.match(skill, /Hard Gate: Use Cases, Test Strategy, and Edge Cases Are Non-Optional/);
  assert.match(skill, /Every acceptance criterion must link to at least one use case; every use case must link to at least one AC/);
  assert.match(skill, /datos vac[íi]os, l[íi]mites, errores, permisos\/tenancy, concurrencia\/orden, rollout\/rollback/);
  assert.match(skill, /### Casos de Uso \(mandatory\)/);
  assert.match(skill, /### Estrategia de Tests \(mandatory\)/);
  assert.match(skill, /### Matriz de Edge Cases \(mandatory\)/);

  assert.match(template, /### 2\.4 Casos de Uso/);
  assert.match(template, /### 2\.5 Estrategia de Tests/);
  assert.match(template, /### 2\.6 Matriz de Edge Cases/);
  assert.match(template, /\| Use cases \| Tests \| Edge cases \| Validation \| Evidence \|/);
});

test('implementation-slicing and implement-prd enforce use-case/edge-case traceability at closure', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const slicingPath = path.join(root, '.agents/skills/02-implement/implementation-slicing/SKILL.md');
  const implementPrdPath = path.join(root, '.agents/skills/02-implement/implement-prd/SKILL.md');
  const [slicingSkill, implementPrdSkill] = await Promise.all([
    fs.readFile(slicingPath, 'utf8'),
    fs.readFile(implementPrdPath, 'utf8')
  ]);

  assert.match(slicingSkill, /Map every PRD use case \(`UC-N`\) to at least one slice/);
  assert.match(slicingSkill, /is a traceability gap; resolve it before handoff or report it as a stop condition/);
  assert.match(slicingSkill, /- Use cases:\n- Tests:\n- Edge cases:/);

  assert.match(implementPrdSkill, /every PRD edge-case matrix row is either verified with evidence or marked `No aplica`/);
  assert.match(implementPrdSkill, /An orphan acceptance criterion, use case, test-strategy row, or edge-case row blocks closure/);
});

test('qa-handoff-review reports edge-case coverage by mandatory category', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const qaPath = path.join(root, '.agents/skills/02-implement/qa-handoff-review/SKILL.md');
  const qaSkill = await fs.readFile(qaPath, 'utf8');

  assert.match(qaSkill, /### Edge-Case Coverage Gate/);
  assert.match(qaSkill, /A category is `PASS` only when every PRD row for it has concrete validation evidence/);
  assert.match(qaSkill, /`ready_to_close: yes` is not allowed while a critical-category gap is open and unaccepted/);
  assert.match(qaSkill, /Use cases: every PRD use case links to an implemented\/verified slice and at least one executed test; report orphans by ID/);
});
