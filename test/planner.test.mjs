import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { buildInstallPlan, buildUpdatePlan, installStateRelativePath } from '../src/planner.mjs';
import manifest from '../templates/template-manifest.json' with { type: 'json' };
import { makeTempRepo } from './helpers.mjs';

test('buildInstallPlan creates full workflow and selected adapter operations', async () => {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'codex,copilot', overlay: 'fhh-ia-ecosystem-full' });

  assert.equal(plan.summary.overwrite_with_backup, 0);
  assert.ok(plan.operations.some((item) => item.relativePath === '.agents/instructions.md'));
  assert.ok(plan.operations.some((item) => item.relativePath === 'AGENTS.md'));
  assert.ok(plan.operations.some((item) => item.relativePath === '.github/copilot-instructions.md'));
  assert.ok(plan.operations.some((item) => item.relativePath === '.agents/skills/06-patterns/README.md'));
  assert.equal(plan.operations.some((item) => item.relativePath.startsWith('.agents/workflow-kit/')), false);
  const uniquePaths = new Set(plan.operations.map((item) => item.relativePath));
  assert.equal(uniquePaths.size, plan.operations.length);
  assert.equal(plan.operations.some((item) => item.relativePath === 'README.md'), false);
  assert.ok(plan.operations.some((item) => item.relativePath === 'docs/workflow/README.md'));
});

test('codex and copilot share one AGENTS.md bootstrap without collisions', async () => {
  const target = await makeTempRepo();

  for (const runtime of ['codex', 'copilot', 'codex,copilot']) {
    const plan = await buildInstallPlan({ targetPath: target, runtime });
    const agentsFiles = plan.operations.filter((item) => item.relativePath === 'AGENTS.md');
    assert.equal(agentsFiles.length, 1, runtime);
  }
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

test('buildInstallPlan merges existing skills registry and preserves local skill docs artifacts', async () => {
  const target = await makeTempRepo();
  const existingRegistry = {
    schema_version: '1.0.0',
    skills: [
      {
        name: 'custom-skill',
        class: 'Workflow',
        path: '.agents/skills/custom/SKILL.md',
        trigger: 'Custom trigger',
        loading_posture: 'Explicit-only',
        key: 'custom-skill'
      }
    ],
    pattern_skills: []
  };

  await fs.mkdir(path.join(target, '.agents/skills'), { recursive: true });
  await fs.writeFile(path.join(target, '.agents/skills/registry.json'), `${JSON.stringify(existingRegistry, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(target, '.agents/skills/index.md'), '# Existing index\n', 'utf8');
  await fs.writeFile(path.join(target, '.agents/skills/registry.md'), '# Existing registry\n', 'utf8');

  const plan = await buildInstallPlan({ targetPath: target, runtime: 'neutral' });

  const registryOperation = plan.operations.find((item) => item.relativePath === '.agents/skills/registry.json');
  const indexOperation = plan.operations.find((item) => item.relativePath === '.agents/skills/index.md');
  const markdownRegistryOperation = plan.operations.find((item) => item.relativePath === '.agents/skills/registry.md');

  assert.equal(registryOperation.operation, 'merge_with_backup');
  const mergedRegistry = JSON.parse(registryOperation.content);
  assert.equal(mergedRegistry.skills.some((entry) => entry.key === 'custom-skill'), true);
  assert.equal(mergedRegistry.skills.some((entry) => entry.key === 'workflow-router'), true);
  assert.equal(indexOperation.operation, 'skip_unmanaged');
  assert.equal(markdownRegistryOperation.operation, 'skip_unmanaged');
});

test('buildInstallPlan auto-discovers local skills from the target repository and registers them', async () => {
  const target = await makeTempRepo();
  const localSkillPath = path.join(target, '.agents/skills/local/my-project-skill/SKILL.md');

  await fs.mkdir(path.dirname(localSkillPath), { recursive: true });
  await fs.writeFile(localSkillPath, `---\nname: my-project-skill\ndescription: Project-specific custom workflow\n---\n\n# My Skill\n`, 'utf8');

  const plan = await buildInstallPlan({ targetPath: target, runtime: 'neutral' });
  const registryOperation = plan.operations.find((item) => item.relativePath === '.agents/skills/registry.json');
  const mergedRegistry = JSON.parse(registryOperation.content);

  assert.equal(mergedRegistry.skills.some((entry) => entry.key === 'my-project-skill'), true);
  assert.equal(mergedRegistry.skills.some((entry) => entry.path === '.agents/skills/local/my-project-skill/SKILL.md'), true);
});

test('buildInstallPlan appends workflow docs hub section into existing docs README', async () => {
  const target = await makeTempRepo();
  const existing = '# Project Docs\n\nGeneral project documentation.\n';

  await fs.mkdir(path.join(target, 'docs'), { recursive: true });
  await fs.writeFile(path.join(target, 'docs/README.md'), existing, 'utf8');

  const plan = await buildInstallPlan({ targetPath: target, runtime: 'neutral' });
  const docsReadmeOperation = plan.operations.find((item) => item.relativePath === 'docs/README.md');

  assert.equal(docsReadmeOperation.operation, 'merge_with_backup');
  assert.equal(docsReadmeOperation.content.includes('workflow-kit:docs-workflow:start'), true);
  assert.equal(docsReadmeOperation.content.startsWith('# Project Docs'), true);
});

test('buildInstallPlan generates one-time legacy docs migration map when legacy docs exist', async () => {
  const target = await makeTempRepo();
  await fs.mkdir(path.join(target, 'docs/backend'), { recursive: true });
  await fs.writeFile(path.join(target, 'docs/backend/api-guidelines.md'), '# API Guidelines\n', 'utf8');
  await fs.writeFile(path.join(target, 'docs/architecture.md'), '# Architecture\n', 'utf8');

  const plan = await buildInstallPlan({ targetPath: target, runtime: 'neutral' });
  const migrationMapOperation = plan.operations.find((item) => item.relativePath === 'docs/workflow/migration/legacy-docs-map.md');

  assert.ok(migrationMapOperation);
  assert.equal(migrationMapOperation.operation, 'create');
  assert.equal(migrationMapOperation.content.includes('docs/backend/api-guidelines.md'), true);
  assert.equal(migrationMapOperation.content.includes('docs/workflow/standards/imported-backend/api-guidelines.md'), true);
  assert.equal(migrationMapOperation.content.includes('docs/architecture.md'), true);
  assert.equal(migrationMapOperation.content.includes('docs/workflow/decisions/imported-architecture.md'), true);
});

test('buildInstallPlan does not regenerate legacy docs migration map after first generation', async () => {
  const target = await makeTempRepo();
  await fs.mkdir(path.join(target, 'docs/workflow/migration'), { recursive: true });
  await fs.writeFile(path.join(target, 'docs/workflow/migration/legacy-docs-map.md'), '# Existing map\n', 'utf8');
  await fs.mkdir(path.join(target, 'docs/legacy'), { recursive: true });
  await fs.writeFile(path.join(target, 'docs/legacy/notes.md'), '# Notes\n', 'utf8');

  const plan = await buildInstallPlan({ targetPath: target, runtime: 'neutral' });
  const migrationMapOperation = plan.operations.find((item) => item.relativePath === 'docs/workflow/migration/legacy-docs-map.md');

  assert.equal(migrationMapOperation, undefined);
});

test('buildInstallPlan can plan legacy docs relocation when explicitly enabled', async () => {
  const target = await makeTempRepo();
  await fs.mkdir(path.join(target, 'docs/backend'), { recursive: true });
  await fs.writeFile(path.join(target, 'docs/backend/api-guidelines.md'), '# API Guidelines\n', 'utf8');

  const plan = await buildInstallPlan({ targetPath: target, runtime: 'neutral', migrateLegacyDocs: true });
  const relocation = plan.operations.find((item) => item.operation === 'move_with_backup');

  assert.ok(relocation);
  assert.equal(relocation.fromRelativePath, 'docs/backend/api-guidelines.md');
  assert.equal(relocation.relativePath, 'docs/workflow/standards/imported-backend/api-guidelines.md');
  assert.equal(plan.summary.move_with_backup, 1);
});

test('buildInstallPlan defaults to complete fhh-ia-ecosystem overlay without duplicate paths', async () => {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'neutral' });
  const uniquePaths = new Set(plan.operations.map((item) => item.relativePath));

  assert.equal(uniquePaths.size, plan.operations.length);
  assert.ok(plan.operations.some((item) => item.relativePath === '.agents/skills/01-product/create-epic/SKILL.md'));
  assert.equal(plan.operations.some((item) => item.relativePath.startsWith('.agents/workflow-kit/')), false);
});


test('buildInstallPlan all runtimes aligns with manifest required payload files', async () => {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'codex,copilot,claude,antigravity', overlay: 'fhh-ia-ecosystem-full' });
  const planned = new Set(plan.operations.map((item) => item.relativePath));

  const expectedPacks = new Set(['repo-overlay-fhh-ia-ecosystem-full', 'adapter-agents-md', 'adapter-codex', 'adapter-copilot', 'adapter-claude', 'adapter-antigravity']);
  for (const pack of manifest.packs.filter((item) => expectedPacks.has(item.id))) {
    for (const requiredFile of pack.required_files) {
      assert.ok(planned.has(requiredFile), `missing planned file ${pack.id}:${requiredFile}`);
    }
    for (const docsOnly of pack.documentation_only ?? []) {
      assert.equal(planned.has(docsOnly), false, `documentation-only file should not be planned: ${docsOnly}`);
    }
  }
});

test('buildInstallPlan includes complete fhh-ia-ecosystem overlay when requested', async () => {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'neutral', overlay: 'fhh-ia-ecosystem-full' });
  const planned = new Set(plan.operations.map((item) => item.relativePath));

  assert.ok(planned.has('.agents/skills/01-product/create-epic/SKILL.md'));
  assert.ok(planned.has('.agents/skills/04-crosscutting/impeccable/SKILL.md'));
  assert.ok(planned.has('.agents/skills/04-crosscutting/pr-comments-resolution/SKILL.md'));
  assert.ok(planned.has('.agents/skills/05-caveman/cavecrew/SKILL.md'));
  assert.equal([...planned].some((relativePath) => relativePath.startsWith('.agents/workflow-kit/')), false);
  assert.ok(planned.has('.agents/capabilities/manifests/context7.md'));

  const fullPack = manifest.packs.find((item) => item.id === 'repo-overlay-fhh-ia-ecosystem-full');
  assert.ok(fullPack, 'repo-overlay-fhh-ia-ecosystem-full pack missing in manifest');
  for (const requiredFile of fullPack.required_files) {
    assert.ok(planned.has(requiredFile), `missing planned file ${fullPack.id}:${requiredFile}`);
  }
});

test('buildUpdatePlan skips local edits and unmanaged files while keeping managed unchanged', async () => {
  const target = await makeTempRepo();
  const installPlan = await buildInstallPlan({ targetPath: target, runtime: 'codex', toolkitVersion: '0.6.0-test' });
  await applyInstallPlan(installPlan);

  const managedModified = path.join(target, 'AGENTS.md');
  await fs.writeFile(managedModified, 'local override\n', 'utf8');

  const unmanagedPath = path.join(target, '.agents/instructions.md');
  await fs.writeFile(unmanagedPath, 'local unmanaged override\n', 'utf8');

  const statePath = path.join(target, installStateRelativePath);
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  delete state.files['.agents/instructions.md'];
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  const updatePlan = await buildUpdatePlan({ targetPath: target, runtime: 'codex', toolkitVersion: '0.7.0-test' });

  assert.equal(updatePlan.operations.find((item) => item.relativePath === 'AGENTS.md').operation, 'skip_modified');
  assert.equal(updatePlan.operations.find((item) => item.relativePath === '.agents/instructions.md').operation, 'skip_unmanaged');
  assert.equal(updatePlan.summary.skip_modified > 0, true);
  assert.equal(updatePlan.summary.skip_unmanaged > 0, true);
});

test('buildUpdatePlan can unmanage preserved skill catalog docs while keeping registry.json managed', async () => {
  const target = await makeTempRepo();
  const installPlan = await buildInstallPlan({ targetPath: target, runtime: 'neutral', toolkitVersion: '0.6.0-test' });
  await applyInstallPlan(installPlan);

  await fs.writeFile(path.join(target, '.agents/skills/index.md'), '# Local skill index\n', 'utf8');

  const updatePlan = await buildUpdatePlan({ targetPath: target, runtime: 'neutral', toolkitVersion: '0.7.0-test' });
  const indexOperation = updatePlan.operations.find((item) => item.relativePath === '.agents/skills/index.md');

  assert.equal(indexOperation.operation, 'skip_unmanaged');
  assert.equal(indexOperation.dropFromState, true);

  await applyInstallPlan(updatePlan);
  const state = JSON.parse(await fs.readFile(path.join(target, installStateRelativePath), 'utf8'));
  assert.equal(Object.prototype.hasOwnProperty.call(state.files, '.agents/skills/index.md'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(state.files, '.agents/skills/registry.json'), true);
});

test('buildUpdatePlan requires install state unless adopt-existing is enabled', async () => {
  const target = await makeTempRepo();

  await assert.rejects(
    buildUpdatePlan({ targetPath: target, runtime: 'codex' }),
    /No install state found/
  );

  const adoptPlan = await buildUpdatePlan({ targetPath: target, runtime: 'codex', overlay: 'fhh-ia-ecosystem-full', adoptExisting: true });
  assert.equal(adoptPlan.hadExistingState, false);
  assert.equal(adoptPlan.operations.some((item) => item.operation === 'create'), true);
});
