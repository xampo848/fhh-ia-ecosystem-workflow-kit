import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { buildInstallPlan } from '../src/planner.mjs';
import manifest from '../templates/template-manifest.json' with { type: 'json' };
import { makeTempRepo } from './helpers.mjs';

test('buildInstallPlan creates portable core and selected adapter operations', async () => {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'codex,copilot', overlay: 'starter' });

  assert.equal(plan.summary.overwrite_with_backup, 0);
  assert.ok(plan.operations.some((item) => item.relativePath === '.agents/instructions.md'));
  assert.ok(plan.operations.some((item) => item.relativePath === 'AGENTS.md'));
  assert.ok(plan.operations.some((item) => item.relativePath === '.github/copilot-instructions.md'));
  assert.ok(plan.operations.some((item) => item.relativePath === '.agents/skills/06-patterns/README.md'));
  const uniquePaths = new Set(plan.operations.map((item) => item.relativePath));
  assert.equal(uniquePaths.size, plan.operations.length);
  assert.equal(plan.operations.some((item) => item.relativePath === 'README.md'), false);
});

test('buildInstallPlan marks identical files unchanged and changed files as backup overwrite', async () => {
  const target = await makeTempRepo();
  let plan = await buildInstallPlan({ targetPath: target, runtime: 'codex' });
  const instructions = plan.operations.find((item) => item.relativePath === '.agents/instructions.md');
  await fs.mkdir(path.dirname(instructions.targetFile), { recursive: true });
  await fs.writeFile(instructions.targetFile, instructions.content, 'utf8');
  await fs.writeFile(path.join(target, 'AGENTS.md'), 'custom existing adapter\n', 'utf8');

  plan = await buildInstallPlan({ targetPath: target, runtime: 'codex' });

  assert.equal(plan.operations.find((item) => item.relativePath === '.agents/instructions.md').operation, 'unchanged');
  assert.equal(plan.operations.find((item) => item.relativePath === 'AGENTS.md').operation, 'overwrite_with_backup');
});

test('buildInstallPlan defaults to complete all-metrics overlay without duplicate paths', async () => {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'neutral' });
  const uniquePaths = new Set(plan.operations.map((item) => item.relativePath));

  assert.equal(uniquePaths.size, plan.operations.length);
  assert.ok(plan.operations.some((item) => item.relativePath === '.agents/skills/01-product/create-epic/SKILL.md'));
  assert.ok(plan.operations.some((item) => item.relativePath === '.agents/workflow-kit/manifest.json'));
});


test('buildInstallPlan all runtimes aligns with manifest required payload files', async () => {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'codex,copilot,claude', overlay: 'starter' });
  const planned = new Set(plan.operations.map((item) => item.relativePath));

  const expectedPacks = new Set(['portable-core', 'repo-overlay-starter', 'adapter-codex', 'adapter-copilot', 'adapter-claude']);
  for (const pack of manifest.packs.filter((item) => expectedPacks.has(item.id))) {
    for (const requiredFile of pack.required_files) {
      assert.ok(planned.has(requiredFile), `missing planned file ${pack.id}:${requiredFile}`);
    }
    for (const docsOnly of pack.documentation_only ?? []) {
      assert.equal(planned.has(docsOnly), false, `documentation-only file should not be planned: ${docsOnly}`);
    }
  }
});

test('buildInstallPlan includes complete all-metrics overlay when requested', async () => {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'neutral', overlay: 'all-metrics-full' });
  const planned = new Set(plan.operations.map((item) => item.relativePath));

  assert.ok(planned.has('.agents/skills/01-product/create-epic/SKILL.md'));
  assert.ok(planned.has('.agents/skills/04-crosscutting/impeccable/SKILL.md'));
  assert.ok(planned.has('.agents/skills/05-caveman/cavecrew/SKILL.md'));
  assert.ok(planned.has('.agents/workflow-kit/manifest.json'));
  assert.ok(planned.has('.agents/capabilities/manifests/context7.md'));

  const fullPack = manifest.packs.find((item) => item.id === 'repo-overlay-all-metrics-full');
  assert.ok(fullPack, 'repo-overlay-all-metrics-full pack missing in manifest');
  for (const requiredFile of fullPack.required_files) {
    assert.ok(planned.has(requiredFile), `missing planned file ${fullPack.id}:${requiredFile}`);
  }
});
