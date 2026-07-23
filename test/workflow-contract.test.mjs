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
