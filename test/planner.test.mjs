import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { extractManagedBlock, loadKitManifest } from '../src/kit-manifest.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan, installStateRelativePath, readManagedInstallState, selectPlanOperations } from '../src/planner.mjs';
import manifest from '../templates/template-manifest.json' with { type: 'json' };
import { hashTree, makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const templates = path.join(root, 'templates');
const sha = (content) => createHash('sha256').update(content, 'utf8').digest('hex');
const read = (target, relativePath) => fs.readFile(path.join(target, relativePath), 'utf8');
const readState = async (target) => JSON.parse(await read(target, installStateRelativePath));
const writeState = (target, state) => fs.writeFile(path.join(target, installStateRelativePath), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
const operationFor = (plan, relativePath) => plan.operations.find((item) => item.relativePath === relativePath);
const blockOf = (content, name = 'workflow-kit:managed') => extractManagedBlock(content, name).block;
async function write(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

test('buildInstallPlan creates full workflow and selected adapter operations, each with its manifest class', async () => {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'codex,copilot', overlay: 'fhh-ia-ecosystem-full' });

  assert.equal(plan.summary.overwrite_with_backup, 0);
  assert.ok(plan.operations.some((item) => item.relativePath === '.agents/instructions.md'));
  assert.ok(plan.operations.some((item) => item.relativePath === 'AGENTS.md'));
  assert.ok(plan.operations.some((item) => item.relativePath === '.github/copilot-instructions.md'));
  assert.ok(plan.operations.some((item) => item.relativePath === '.agents/skills/06-patterns/README.md'));
  const uniquePaths = new Set(plan.operations.map((item) => item.relativePath));
  assert.equal(uniquePaths.size, plan.operations.length);
  assert.equal(plan.operations.some((item) => item.relativePath === 'README.md'), false);
  assert.ok(plan.operations.some((item) => item.relativePath === 'docs/workflow/README.md'));

  // AC-1: every planned path carries its class; only .gitignore has none.
  assert.deepEqual(plan.operations.filter((item) => !item.class).map((item) => item.relativePath), ['.gitignore']);
  assert.equal(operationFor(plan, '.agents/workflow-kit/manifest.json').class, 'kit');
  assert.equal(operationFor(plan, '.agents/workflow-kit/manifest.schema.json').class, 'kit');
  assert.equal(operationFor(plan, installStateRelativePath), undefined, 'state paths are never planned');
  assert.equal(operationFor(plan, 'AGENTS.md').class, 'adapter');
  assert.equal(operationFor(plan, '.agents/project/quality-gate.md').class, 'seed');
  assert.equal(operationFor(plan, '.github/instructions/quality-gate.instructions.md').class, 'derived');
  assert.equal(plan.discoveredSkillEntries, undefined);
});

test('a planned path without a manifest entry stops the plan before writing and names the path', async () => {
  const target = await makeTempRepo();
  const kitManifest = await loadKitManifest();
  const withoutDocs = { ...kitManifest, paths: kitManifest.paths.filter((entry) => entry.path !== 'docs/workflow/') };

  await assert.rejects(
    buildInstallPlan({ targetPath: target, runtime: 'neutral', manifest: withoutDocs }),
    /no entry for the planned path docs\/workflow\/[^ ]+\.md/
  );
  assert.deepEqual(await fs.readdir(target), []);
});

test('codex and copilot share one AGENTS.md bootstrap without collisions', async () => {
  const target = await makeTempRepo();

  for (const runtime of ['codex', 'copilot', 'codex,copilot']) {
    const plan = await buildInstallPlan({ targetPath: target, runtime });
    const agentsFiles = plan.operations.filter((item) => item.relativePath === 'AGENTS.md');
    assert.equal(agentsFiles.length, 1, runtime);
  }
});

test('buildInstallPlan marks identical kit files unchanged and different ones as backup overwrite', async () => {
  const target = await makeTempRepo();
  let plan = await buildInstallPlan({ targetPath: target, runtime: 'codex' });
  await write(target, '.agents/instructions.md', operationFor(plan, '.agents/instructions.md').content);
  await write(target, '.agents/README.md', 'older kit readme\n');

  plan = await buildInstallPlan({ targetPath: target, runtime: 'codex' });

  assert.equal(operationFor(plan, '.agents/instructions.md').operation, 'unchanged');
  assert.equal(operationFor(plan, '.agents/README.md').operation, 'overwrite_with_backup');
});

test('init keeps a project-written adapter and inserts the kit block where the template places it', async () => {
  const target = await makeTempRepo();
  const claudeBlock = blockOf(await fs.readFile(path.join(templates, 'runtime-adapters/claude/CLAUDE.md'), 'utf8'));
  const docsBlock = blockOf(await fs.readFile(path.join(templates, 'repo-overlay-fhh-ia-ecosystem-full/docs/README.md'), 'utf8'), 'workflow-kit:docs-workflow');
  const cases = [
    // The CLAUDE.md template starts with its block: the block goes first.
    { relativePath: 'CLAUDE.md', own: '# Reglas del equipo\n', expected: `${claudeBlock}\n\n# Reglas del equipo\n` },
    // The docs hub template has text before its block: the block goes last.
    { relativePath: 'docs/README.md', own: '# Project Docs\n\nGeneral project documentation.', expected: `# Project Docs\n\nGeneral project documentation.\n\n${docsBlock}\n` }
  ];
  for (const item of cases) await write(target, item.relativePath, item.own);

  const plan = await buildInstallPlan({ targetPath: target, runtime: 'claude' });
  for (const item of cases) {
    const operation = operationFor(plan, item.relativePath);
    assert.equal(operation.operation, 'merge_with_backup', item.relativePath);
    assert.equal(operation.content, item.expected, item.relativePath);
  }

  await applyInstallPlan(plan);
  const again = await buildUpdatePlan({ targetPath: target });
  for (const item of cases) assert.equal(operationFor(again, item.relativePath).operation, 'unchanged', item.relativePath);
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
  assert.equal(migrationMapOperation.class, 'seed');
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

test('buildInstallPlan defaults to complete fhh-ia-ecosystem overlay without duplicate paths', async () => {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'neutral' });
  const uniquePaths = new Set(plan.operations.map((item) => item.relativePath));

  assert.equal(uniquePaths.size, plan.operations.length);
  assert.ok(plan.operations.some((item) => item.relativePath === '.agents/skills/01-product/create-epic/SKILL.md'));
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
  assert.ok(planned.has('.agents/capabilities/manifests/context7.md'));

  const fullPack = manifest.packs.find((item) => item.id === 'repo-overlay-fhh-ia-ecosystem-full');
  assert.ok(fullPack, 'repo-overlay-fhh-ia-ecosystem-full pack missing in manifest');
  for (const requiredFile of fullPack.required_files) {
    assert.ok(planned.has(requiredFile), `missing planned file ${fullPack.id}:${requiredFile}`);
  }
});

test('install-state is written as 2.0.0 with a hash per class (AC-3)', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude', toolkitVersion: '0.6.0-test' }));
  const state = await readState(target);

  assert.equal(state.schemaVersion, '2.0.0');
  assert.equal(state.mode, 'repo');
  assert.deepEqual(Object.keys(state).sort(), ['files', 'generatedAt', 'managedBy', 'mode', 'modelProfiles', 'overlay', 'runtimes', 'schemaVersion', 'stackPack', 'toolkitVersion']);
  assert.deepEqual(state.files['.agents/instructions.md'], { sha256: sha(await read(target, '.agents/instructions.md')), class: 'kit' });
  assert.deepEqual(state.files['.agents/skills/index.md'], { sha256: sha(await read(target, '.agents/skills/index.md')), class: 'derived' });
  assert.deepEqual(state.files['CLAUDE.md'], { sha256: sha(blockOf(await read(target, 'CLAUDE.md'))), class: 'adapter' });
  assert.deepEqual(state.files['.agents/project/quality-gate.md'], { class: 'seed' });
  assert.equal(state.files['.agents/workflow-kit/manifest.json'].class, 'kit');
  assert.equal(installStateRelativePath in state.files, false);
  assert.equal('.gitignore' in state.files, false);
  for (const [relativePath, entry] of Object.entries(state.files)) {
    assert.equal(typeof entry.sha256 === 'string', entry.class !== 'seed', relativePath);
  }
});

test('update by class: kit and derived files are created, kept, replaced or left pending (AC-2)', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral', toolkitVersion: '0.6.0-test' }));
  const state = await readState(target);
  // Unedited files of an older version: the record matches the file on disk.
  const olderInstructions = 'older kit instructions\n';
  const olderIndex = '# Skills index\n\n| Skill name | Trigger | Physical path | Cost hint |\n| --- | --- | --- | --- |\n| `zz-project-skill` | Project row | `.agents/project/skills/zz/SKILL.md` | lean |\n';
  await write(target, '.agents/instructions.md', olderInstructions);
  await write(target, '.agents/skills/index.md', olderIndex);
  state.files['.agents/instructions.md'] = { sha256: sha(olderInstructions), class: 'kit' };
  state.files['.agents/skills/index.md'] = { sha256: sha(olderIndex), class: 'derived' };
  await writeState(target, state);
  await fs.rm(path.join(target, '.agents/README.md'));
  await fs.appendFile(path.join(target, '.agents/skills/registry.json'), '\n');

  const plan = await buildUpdatePlan({ targetPath: target, toolkitVersion: '0.7.0-test' });
  const expected = [
    ['.agents/README.md', 'create', undefined],
    ['.agents/kit-boundary.md', 'unchanged', undefined],
    ['.agents/instructions.md', 'overwrite_with_backup', undefined],
    ['.agents/skills/index.md', 'overwrite_with_backup', undefined],
    ['.agents/skills/registry.json', 'skip_modified', 'edited_kit_file']
  ];
  for (const [relativePath, operation, reason] of expected) {
    const item = operationFor(plan, relativePath);
    assert.equal(item.operation, operation, relativePath);
    assert.equal(item.reason, reason, relativePath);
  }
  // A derived catalog is the template whole: rows of the project are not merged.
  const shippedIndex = await fs.readFile(path.join(templates, 'repo-overlay-fhh-ia-ecosystem-full/.agents/skills/index.md'), 'utf8');
  assert.equal(operationFor(plan, '.agents/skills/index.md').content, shippedIndex);
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

test('an edited .agents/instructions.md stays pending unless --edited all=discard; an edited adapter keeps its own text', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'codex,copilot', toolkitVersion: '0.6.0-test' }));
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nlocal instruction customization\n');
  const installedAgents = await read(target, 'AGENTS.md');
  const editedAgents = `Intro del equipo\n\n${installedAgents.replace('# AI Agent Bootstrap', '# AI Agent Bootstrap (edited)')}\nNota del equipo\n`;
  await write(target, 'AGENTS.md', editedAgents);

  for (const edited of [undefined, { all: 'discard' }]) {
    const updatePlan = await buildUpdatePlan({ targetPath: target, toolkitVersion: '0.7.0-test', edited });
    const instructions = operationFor(updatePlan, '.agents/instructions.md');
    assert.equal(instructions.operation, edited ? 'overwrite_with_backup' : 'skip_modified');
    assert.equal(instructions.reason, edited ? undefined : 'edited_kit_file');
    // The dry run lists a pending file with the decisions that settle it.
    const pendingLine = '- skip_modified: .agents/instructions.md (edited_kit_file): keep | discard';
    assert.equal(formatPlan(updatePlan).split('\n').includes(pendingLine), !edited, formatPlan(updatePlan));

    // The block is the kit's: it is regenerated; the text around it stays byte for byte.
    const agents = operationFor(updatePlan, 'AGENTS.md');
    assert.equal(agents.operation, 'overwrite_with_backup');
    assert.equal(agents.content, `Intro del equipo\n\n${installedAgents}\nNota del equipo\n`);
  }
});

test('buildUpdatePlan supports no-backup write operations', async () => {
  const target = await makeTempRepo();
  const installPlan = await buildInstallPlan({ targetPath: target, runtime: 'codex', toolkitVersion: '0.6.0-test' });
  await applyInstallPlan(installPlan);

  // An older kit version of the file, unedited: its hash is the recorded one.
  const olderKitVersion = 'older kit version\n';
  await fs.writeFile(path.join(target, 'docs/workflow/README.md'), olderKitVersion, 'utf8');
  const state = await readState(target);
  state.files['docs/workflow/README.md'] = { sha256: sha(olderKitVersion), class: 'kit' };
  await writeState(target, state);

  const updatePlan = await buildUpdatePlan({
    targetPath: target,
    runtime: 'codex',
    toolkitVersion: '0.7.0-test',
    backupMode: 'none'
  });

  const docsOperation = updatePlan.operations.find((item) => item.relativePath === 'docs/workflow/README.md');
  assert.equal(docsOperation.operation, 'overwrite_no_backup');
  assert.equal(updatePlan.summary.overwrite_no_backup > 0, true);
});

// A 1.0.0 state recorded each file whole. It is read (doctor and the layout
// migration need it); update plans it only through the migration (test below
// and migration.test.mjs), which also covers its unmarked adapters.
test('a 1.0.0 state is read with each entry classified; an unknown schema asks to upgrade the CLI', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude,codex' }));
  const state = await readState(target);
  const files = Object.fromEntries(Object.entries(state.files).filter(([, entry]) => entry.sha256).map(([key, entry]) => [key, entry.sha256]));
  const oldKitClaude = 'old kit adapter without markers\n';
  files['CLAUDE.md'] = sha(oldKitClaude);
  await writeState(target, { ...state, schemaVersion: '1.0.0', files });

  const legacy = await readManagedInstallState(target);
  assert.equal(legacy.schemaVersion, '1.0.0');
  assert.deepEqual(legacy.files['CLAUDE.md'], { sha256: sha(oldKitClaude), class: 'adapter' });

  await writeState(target, { ...state, schemaVersion: '3.0.0' });
  await assert.rejects(buildUpdatePlan({ targetPath: target }), /uses schema 3\.0\.0.*upgrade the CLI/);
});

test('update by class: a seed is created once and never written again (AC-2)', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const state = await readState(target);
  // Never created by the kit here: created now.
  await fs.rm(path.join(target, '.agents/project/frontend.md'));
  delete state.files['.agents/project/frontend.md'];
  await writeState(target, state);
  // Created by the kit and deleted by the project: stays deleted.
  await fs.rm(path.join(target, '.agents/project/context.md'));
  // Edited by the project: untouched.
  await fs.appendFile(path.join(target, '.agents/project/backend.md'), '\n- Regla propia.\n');

  const plan = await buildUpdatePlan({ targetPath: target });
  assert.equal(operationFor(plan, '.agents/project/frontend.md').operation, 'create');
  assert.equal(operationFor(plan, '.agents/project/context.md'), undefined);
  const backend = operationFor(plan, '.agents/project/backend.md');
  assert.equal(backend.operation, 'skip_unmanaged');
  assert.equal(backend.reason, 'project_owned');

  await applyInstallPlan(plan);
  const next = await readState(target);
  assert.deepEqual(next.files['.agents/project/frontend.md'], { class: 'seed' });
  assert.deepEqual(next.files['.agents/project/context.md'], { class: 'seed' }, 'the record keeps the seed from coming back');
});

test('with a 2.0.0 state no operation modifies anything under .agents/project/ (AC-6)', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'copilot', stack: 'rails-react' }));
  const projectFiles = (await fs.readdir(path.join(target, '.agents/project'))).map((name) => `.agents/project/${name}`);
  for (const relativePath of projectFiles) await fs.appendFile(path.join(target, relativePath), '\nedited by the project\n');
  await write(target, '.agents/project/skills/own/SKILL.md', '---\nname: own\n---\n');
  // A pending kit file, so that discarding every edit has something to do.
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nedited by the project\n');

  for (const edited of [undefined, { all: 'discard' }]) {
    const plan = await buildUpdatePlan({ targetPath: target, edited });
    const projectOperations = plan.operations.filter((item) => item.relativePath.startsWith('.agents/project/'));
    assert.ok(projectOperations.length >= projectFiles.length - 1);
    assert.deepEqual(projectOperations.filter((item) => item.operation !== 'skip_unmanaged').map((item) => `${item.operation}:${item.relativePath}`), []);
  }
});

// Review of phase 1: no plan replaces content without a backup unless that
// content matches what the kit recorded (here: init ignores the state, adopt
// records nothing yet; a discarded edit is covered in migration.test.mjs).
test('a file that differs from its recorded hash is never replaced without a backup', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  const kitFile = '.agents/instructions.md';
  const catalog = '.agents/skills/index.md';
  await write(target, kitFile, '# Our own instructions\n');
  await write(target, catalog, '# Our own catalog\n');

  // init runs only where no install state exists.
  const state = await readState(target);
  await fs.rm(path.join(target, installStateRelativePath));
  const init = await buildInstallPlan({ targetPath: target, runtime: 'claude', backupMode: 'none' });
  assert.equal(operationFor(init, kitFile).operation, 'overwrite_with_backup');
  assert.equal(operationFor(init, catalog).operation, 'overwrite_with_backup');
  await writeState(target, state);

  const claude = await read(target, 'CLAUDE.md');
  const { block } = extractManagedBlock(claude, 'workflow-kit:managed');
  await write(target, 'CLAUDE.md', claude.replace(block, block.replace('# CLAUDE.md', '# CLAUDE.md (edited inside the block)')));
  const adapter = await buildUpdatePlan({ targetPath: target, backupMode: 'none' });
  assert.equal(operationFor(adapter, 'CLAUDE.md').operation, 'overwrite_with_backup');
});

test('adopt-existing records a customized kit file as edited, so a later update leaves it alone', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  await fs.rm(path.join(target, installStateRelativePath));
  const customized = ['.agents/instructions.md', '.agents/skills/registry.md'];
  for (const relativePath of customized) await write(target, relativePath, `# Our own ${relativePath}\n`);

  await applyInstallPlan(await buildUpdatePlan({ targetPath: target, adoptExisting: true }));
  const next = await buildUpdatePlan({ targetPath: target, backupMode: 'none' });

  for (const relativePath of customized) {
    assert.equal(operationFor(next, relativePath).operation, 'skip_modified', relativePath);
    assert.equal(operationFor(next, relativePath).reason, 'edited_kit_file', relativePath);
  }
});

test('selectPlanOperations allows partial apply without drifting managed state', async () => {
  const target = await makeTempRepo();
  const installPlan = await buildInstallPlan({ targetPath: target, runtime: 'codex', toolkitVersion: '0.6.0-test' });
  await applyInstallPlan(installPlan);
  const stateBeforePartialApply = JSON.parse(await fs.readFile(path.join(target, installStateRelativePath), 'utf8'));

  await fs.writeFile(path.join(target, 'docs/workflow/README.md'), 'local override\n', 'utf8');
  await fs.writeFile(path.join(target, '.agents/instructions.md'), 'local override\n', 'utf8');

  const updatePlan = await buildUpdatePlan({
    targetPath: target,
    runtime: 'codex',
    toolkitVersion: '0.7.0-test',
    edited: { all: 'discard' }
  });

  const selected = selectPlanOperations(updatePlan, ['docs/workflow/README.md']);
  await applyInstallPlan(selected);

  const state = JSON.parse(await fs.readFile(path.join(target, installStateRelativePath), 'utf8'));
  const currentDocsReadme = await fs.readFile(path.join(target, 'docs/workflow/README.md'), 'utf8');
  const currentInstructions = await fs.readFile(path.join(target, '.agents/instructions.md'), 'utf8');

  assert.notEqual(currentDocsReadme, 'local override\n');
  assert.equal(currentInstructions, 'local override\n');
  assert.deepEqual(state.files['docs/workflow/README.md'], { sha256: sha(currentDocsReadme), class: 'kit' });
  assert.deepEqual(state.files['.agents/instructions.md'], stateBeforePartialApply.files['.agents/instructions.md']);
});

// A file that exists but cannot be read is never "nothing installed" and
// never "the last apply finished": init and update stop before planning.
test('init and update stop on an unusable install-state or apply journal, and write nothing', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const journalPath = '.agents/workflow-kit/last-apply.json';
  // Final review 2: never advise deleting the journal or restoring it from Git (it is ignored).
  const journalAction = 'so rollback cannot use it. Fix it by hand (Git does not track it); only if you will not roll back the last apply, move it out of .agents/workflow-kit/. Then run this command again. Nothing was written.';
  const cases = [
    { file: installStateRelativePath, content: '{ not json', message: /install-state\.json is not valid JSON\. Restore it from Git/ },
    { file: installStateRelativePath, content: '[]', message: /install-state\.json does not have the expected structure\. Restore it from Git/ },
    { file: journalPath, content: '{ not json', message: `${journalPath} cannot be read (not valid JSON), ${journalAction}` },
    { file: journalPath, content: '{"schemaVersion":"2.0.0","completed":true}', message: `${journalPath} cannot be read (unsupported format), ${journalAction}` }
  ];
  for (const item of cases) {
    const original = await read(target, item.file);
    await write(target, item.file, item.content);
    const before = await hashTree(target);
    const expected = typeof item.message === 'string' ? new Error(item.message) : item.message;
    await assert.rejects(buildInstallPlan({ targetPath: target, runtime: 'neutral' }), expected, `init: ${item.content}`);
    await assert.rejects(buildUpdatePlan({ targetPath: target }), expected, `update: ${item.content}`);
    assert.deepEqual(await hashTree(target), before);
    await write(target, item.file, original);
  }
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

// P4: kit files a version no longer ships. The fixture is a skill an older
// version installed: the file on disk plus its record in a 2.0.0 state.
// Final review 4: init plans as if nothing were installed. Over a 2.0.0 install
// it would reset the recorded runtimes, stack and profiles and replace pending
// edited files, so it stops and points to update.
test('init over a 2.0.0 install stops before planning and points to update', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOwn rule.\n');
  const before = await hashTree(target);

  await assert.rejects(buildInstallPlan({ targetPath: target, runtime: 'neutral' }), new Error(`${installStateRelativePath} already records an install (runtimes: claude). Run \`workflow-kit update\` instead (\`workflow-kit update --runtime <list>\` to change the runtimes); init would reset the recorded runtimes, stack and profiles and replace pending edited files. Nothing was written.`));

  assert.deepEqual(await hashTree(target), before);
});

const retiredSkill = '.agents/skills/04-crosscutting/retired-skill/SKILL.md';
async function installWithRetired(target, records, runtime = 'neutral') {
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime }));
  const state = await readState(target);
  for (const { relativePath, content, recorded = content, entry } of records) {
    if (content !== null) await write(target, relativePath, content);
    state.files[relativePath] = entry ?? { sha256: sha(recorded), class: 'kit' };
  }
  await writeState(target, state);
  return state;
}

test('update deletes an unedited retired kit file with a backup, also with backupMode none (AC-4)', async () => {
  const target = await makeTempRepo();
  const content = '---\nname: retired-skill\n---\nOld body \u00e1\n';
  await installWithRetired(target, [{ relativePath: retiredSkill, content }]);

  for (const backupMode of ['required', 'none']) {
    const plan = await buildUpdatePlan({ targetPath: target, backupMode });
    const item = operationFor(plan, retiredSkill);
    assert.equal(item.operation, 'delete_with_backup', backupMode);
    assert.equal(item.class, 'kit', backupMode);
    assert.equal(plan.summary.delete_with_backup, 1, backupMode);
    assert.equal(retiredSkill in plan.nextInstallState.files, false, backupMode);
    assert.match(formatPlan(plan), /- delete_with_backup: \.agents\/skills\/04-crosscutting\/retired-skill\/SKILL\.md \(no longer shipped\)/);
    assert.match(formatPlan(plan), /delete_with_backup=1$/);
    if (backupMode === 'none') await applyInstallPlan(plan);
  }

  await assert.rejects(fs.access(path.join(target, retiredSkill)), { code: 'ENOENT' });
  const directory = path.dirname(path.join(target, retiredSkill));
  const backups = (await fs.readdir(directory)).filter((name) => name.startsWith('SKILL.md.workflow-kit-backup-'));
  assert.equal(backups.length, 1, 'the backup stays next to the deleted file');
  assert.equal(await fs.readFile(path.join(directory, backups[0]), 'utf8'), content);
  assert.equal(retiredSkill in (await readState(target)).files, false);
});

test('an edited retired file is kept and flagged in the state; a missing one only leaves the state (AC-4)', async () => {
  const target = await makeTempRepo();
  const missing = '.agents/skills/04-crosscutting/gone-skill/SKILL.md';
  await installWithRetired(target, [
    { relativePath: retiredSkill, content: 'edited by the team\n', recorded: 'as the kit shipped it\n' },
    { relativePath: missing, content: null, recorded: 'deleted by the team\n' }
  ]);

  const plan = await buildUpdatePlan({ targetPath: target });
  const edited = operationFor(plan, retiredSkill);
  assert.equal(edited.operation, 'skip_modified');
  assert.equal(edited.reason, 'retired_edited');
  assert.equal(operationFor(plan, missing), undefined);
  assert.match(formatPlan(plan), /- skip_modified: \.agents\/skills\/04-crosscutting\/retired-skill\/SKILL\.md \(no longer shipped; edited, kept\)/);

  await applyInstallPlan(plan);
  assert.equal(await read(target, retiredSkill), 'edited by the team\n');
  const state = await readState(target);
  assert.deepEqual(state.files[retiredSkill], { sha256: sha('as the kit shipped it\n'), class: 'kit', retired: true });
  assert.equal(missing in state.files, false);
});

test('deselecting a retired delete keeps the file and its record', async () => {
  const target = await makeTempRepo();
  const missing = '.agents/skills/04-crosscutting/gone-skill/SKILL.md';
  await installWithRetired(target, [
    { relativePath: retiredSkill, content: 'kit body\n' },
    { relativePath: missing, content: null, recorded: 'gone\n' }
  ]);
  const plan = await buildUpdatePlan({ targetPath: target });

  const selected = selectPlanOperations(plan, plan.operations.map((item) => item.relativePath).filter((relativePath) => relativePath !== retiredSkill));
  await applyInstallPlan(selected);

  assert.equal(await read(target, retiredSkill), 'kit body\n');
  const state = await readState(target);
  assert.deepEqual(state.files[retiredSkill], { sha256: sha('kit body\n'), class: 'kit' });
  assert.equal(missing in state.files, false, 'a missing file needs no operation to leave the state');
});

test('never retired: other runtimes, seeds, adapters, the project overlay, generated, legacy and backup paths (AC-4)', async () => {
  const target = await makeTempRepo();
  const kitManifest = await loadKitManifest();
  const testManifest = { ...kitManifest, paths: [...kitManifest.paths, { path: 'OLD-ADAPTER.md', class: 'adapter' }, { path: '.agents/old-seed.md', class: 'seed' }] };
  const kept = [
    'OLD-ADAPTER.md',
    '.agents/old-seed.md',
    '.agents/project/notes.md',
    'docs/workflow/migration/legacy-docs-map.md',
    '.github/instructions/old.instructions.md',
    '.agents/project-context.md',
    `${retiredSkill}.workflow-kit-backup-20260101T000000Z`
  ];
  const installed = await installWithRetired(target, kept.map((relativePath) => ({ relativePath, content: `content of ${relativePath}\n` })), 'claude');
  const claudeFiles = Object.keys(installed.files).filter((relativePath) => relativePath.startsWith('.claude/'));
  assert.ok(claudeFiles.length > 0);

  // Leaving claude out of this run must not delete its files.
  const plan = await buildUpdatePlan({ targetPath: target, runtime: 'neutral', manifest: testManifest });

  assert.deepEqual(plan.operations.filter((item) => item.retired).map((item) => item.relativePath), []);
  for (const relativePath of [...kept, ...claudeFiles]) {
    assert.ok(relativePath in plan.nextInstallState.files, relativePath);
    assert.equal(await fs.access(path.join(target, relativePath)).then(() => true), true, relativePath);
  }
});

// Review of phase 1: install-state keys come from the repository. A key
// written with "\" by an old Windows install, one with "..", one in another
// letter case, or one no manifest entry covers is never retired.
test('never retired: unnormalized, traversing, case-variant or unclassified state keys', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const state = await readState(target);
  const live = '.agents/skills/00-router/workflow-router/SKILL.md';
  const liveContent = await read(target, live);
  const contextContent = await read(target, '.agents/project/context.md');
  state.files[live.replaceAll('/', '\\')] = { sha256: sha(liveContent), class: 'kit' };
  state.files['docs/workflow/../../.agents/project/context.md'] = { sha256: sha(contextContent), class: 'kit' };
  state.files[live.replace('workflow-router', 'Workflow-Router')] = { sha256: sha(liveContent), class: 'kit' };
  await write(target, 'outside-manifest.md', 'kit file of an old version\n');
  state.files['outside-manifest.md'] = { sha256: sha('kit file of an old version\n'), class: null };
  await writeState(target, state);

  const plan = await buildUpdatePlan({ targetPath: target, backupMode: 'none' });
  assert.deepEqual(plan.operations.filter((item) => item.operation === 'delete_with_backup').map((item) => item.relativePath), []);
  const readBack = await readManagedInstallState(target);
  assert.equal(Object.keys(readBack.files).some((key) => key.includes('\\') || key.includes('..')), false);
});

// The ".." case is covered by the state-key test above.
test('a retired path behind a symbolic link is never deleted', async () => {
  const linkedTarget = await makeTempRepo();
  const elsewhere = await makeTempRepo();
  await fs.writeFile(path.join(elsewhere, 'SKILL.md'), 'kit body\n', 'utf8');
  await installWithRetired(linkedTarget, [{ relativePath: '.agents/skills/04-crosscutting/linked/SKILL.md', content: null, recorded: 'kit body\n' }]);
  await fs.symlink(elsewhere, path.join(linkedTarget, '.agents/skills/04-crosscutting/linked'));

  const plan = await buildUpdatePlan({ targetPath: linkedTarget });
  assert.equal(plan.operations.some((item) => item.operation === 'delete_with_backup'), false);
  await applyInstallPlan(plan);
  assert.equal(await fs.readFile(path.join(elsewhere, 'SKILL.md'), 'utf8'), 'kit body\n');
});
