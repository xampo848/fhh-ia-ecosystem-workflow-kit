// Layout migration from install-state 1.0.0 (PRD manifest-updater 2.3, AC-7,
// AC-8, AC-10). Every test starts from a real 0.18.1 install (fixture
// legacy-0.18.1); the planner rules shared with a 2.0.0 state live in
// planner.test.mjs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { loadKitManifest } from '../src/kit-manifest.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan, installStateRelativePath, selectPlanOperations } from '../src/planner.mjs';
import { applyRollbackPlan, buildRollbackPlan } from '../src/rollback.mjs';
import { installLegacy0181 } from './fixtures/legacy-0.18.1/install.mjs';
import { makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const overlayTemplates = path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full');
const migrationId = '0.22.0-kit-overlay-layout';
const projectIndexPath = '.agents/project/index.md';
const catalogPaths = ['.agents/skills/index.md', '.agents/skills/registry.md', '.agents/skills/06-patterns/index.md', '.agents/skills/registry.json'];
const nonWriting = new Set(['unchanged', 'skip_unmanaged', 'skip_modified', 'adopt_existing']);

const sha = (content) => createHash('sha256').update(content).digest('hex');
const read = (target, relativePath) => fs.readFile(path.join(target, relativePath), 'utf8');
const exists = (target, relativePath) => fs.access(path.join(target, relativePath)).then(() => true, () => false);
const operationFor = (plan, relativePath) => plan.operations.find((item) => item.relativePath === relativePath);
const layoutMigration = (plan) => plan.migrations.find((item) => item.id === migrationId);
async function write(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function legacyRepo(options) {
  const target = await makeTempRepo();
  return { target, legacy: await installLegacy0181(target, options) };
}

// Hash of every file in the tree, so "nothing changed" covers files no
// assertion names.
async function hashTree(target) {
  const hashes = {};
  async function walk(relativeDirectory) {
    for (const entry of await fs.readdir(path.join(target, relativeDirectory), { withFileTypes: true })) {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) await walk(relativePath);
      else hashes[relativePath] = sha(await fs.readFile(path.join(target, relativePath)));
    }
  }
  await walk('.');
  return hashes;
}

test('the dry-run lists the migration groups with counts and every pending file, and writes nothing (AC-7)', async () => {
  const { target } = await legacyRepo();
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nLocal edit.\n');
  const before = await hashTree(target);

  const plan = await buildUpdatePlan({ targetPath: target });

  assert.deepEqual(await hashTree(target), before);
  const migration = layoutMigration(plan);
  assert.ok(migration, 'the layout migration is part of the plan');
  for (const group of [
    /edited files pending 1 \(\.agents\/instructions\.md\)/,
    /retired deleted 1;/,
    /own skills moved to \.agents\/project\/skills\/ 1;/,
    /catalog rows moved to \.agents\/project\/index\.md 1 \(rows added 1\)/,
    /catalogs replaced whole 5/,
    /context moved: \.agents\/project-context\.md -> \.agents\/project\/context\.md/,
    /superseded seeds reset 1\./
  ]) assert.match(migration.summary, group);
  assert.deepEqual(migration.pending, [{ relativePath: '.agents/instructions.md', reason: 'edited_kit_file' }]);
  assert.match(formatPlan(plan), new RegExp(`^- ${migrationId}: .*\\n  - pending \\.agents/instructions\\.md \\(edited_kit_file\\)$`, 'm'));
});

test('applying the migration moves project content to the overlay and keeps a backup of every write, also with backupMode none (AC-8)', async () => {
  const { target, legacy } = await legacyRepo();
  const plan = await buildUpdatePlan({ targetPath: target, backupMode: 'none' });
  assert.deepEqual(plan.operations.filter((item) => item.operation.endsWith('_no_backup')).map((item) => item.relativePath), []);

  const applied = await applyInstallPlan(plan);
  const replacedWithoutBackup = applied.filter((item) => item.applied && item.operation !== 'create' && !item.backupPath);
  assert.deepEqual(replacedWithoutBackup.map((item) => item.relativePath), []);
  const backupOf = (relativePath) => applied.find((item) => item.relativePath === relativePath)?.backupPath;

  // Own skill: every file moved unchanged; the old copies leave backups.
  for (const file of legacy.localSkill.files) {
    assert.equal(await read(target, `${legacy.localSkill.newDir}/${file}`), legacy.localSkill.contents[file]);
    assert.equal(await exists(target, `${legacy.localSkill.oldDir}/${file}`), false);
    assert.ok(backupOf(`${legacy.localSkill.oldDir}/${file}`));
  }
  const newSkillPath = `${legacy.localSkill.newDir}/SKILL.md`;
  assert.match(await read(target, projectIndexPath), new RegExp(`^\\| \`${legacy.localSkill.name}\` \\| Pattern \\| Project pattern for retrying calls .* \\| \`${newSkillPath}\` \\| lean \\|$`, 'm'));

  // Catalogs are replaced whole: the local entry leaves registry.json and
  // lives on only in the project index.
  for (const catalogPath of catalogPaths) {
    assert.equal(await read(target, catalogPath), await fs.readFile(path.join(overlayTemplates, catalogPath), 'utf8'));
    assert.ok(backupOf(catalogPath), `${catalogPath} keeps a backup`);
  }
  assert.equal((await read(target, legacy.registryPath)).includes(legacy.registryEntryPath), false);

  // Context moved with its own content; no template context next to it.
  assert.equal(await read(target, legacy.ownContext.newPath), legacy.ownContext.content);
  assert.equal(await exists(target, legacy.ownContext.path), false);
  assert.ok(backupOf(legacy.ownContext.path));

  // The unedited 0.18.1 quality gate becomes the current stub.
  assert.notEqual(sha(await read(target, legacy.qualityGate.path)), legacy.qualityGate.sha256);
  assert.equal(await read(target, legacy.qualityGate.path), await fs.readFile(path.join(overlayTemplates, legacy.qualityGate.path), 'utf8'));
  assert.ok(backupOf(legacy.qualityGate.path));

  assert.equal(await exists(target, legacy.retiredPath), false);
  assert.equal(await read(target, legacy.ownBackend.path), legacy.ownBackend.content);

  const state = JSON.parse(await read(target, installStateRelativePath));
  assert.equal(state.schemaVersion, '2.0.0');
  assert.deepEqual(Object.keys(state.files).filter((key) => key.startsWith('.agents/project/skills/') || key.startsWith(legacy.localSkill.oldDir) || key === legacy.ownContext.path || key === legacy.retiredPath), []);
  assert.deepEqual(state.files[legacy.ownContext.newPath], { class: 'seed' });
  assert.deepEqual(state.files[legacy.qualityGate.path], { class: 'seed' });
});

// Edge case Concurrencia/orden: a skill that cannot move unchanged stays
// where it is, without a row, and is listed as pending.
test('an own skill that cannot move is left pending, not moved and without a row', async () => {
  const { target, legacy } = await legacyRepo();
  const ownSkill = (name) => `---\nname: ${name}\ndescription: Own skill.\n---\n\n# Own\n`;
  const cases = [
    { directory: '.agents/skills/06-patterns/local/router-copy', files: { 'SKILL.md': ownSkill('workflow-router') }, reason: 'kit_skill_name' },
    { directory: legacy.localSkill.oldDir, files: {}, reason: 'project_skill_exists' },
    { directory: '.agents/skills/06-patterns/local/escape', files: { 'SKILL.md': ownSkill('../escape') }, reason: 'invalid_skill_name' },
    { directory: '.agents/skills/06-patterns/authoring', files: { 'SKILL.md': ownSkill('authoring') }, reason: 'mixed_with_kit_files' },
    { directory: '.agents/skills/06-patterns/local/diagram', files: { 'SKILL.md': ownSkill('diagram'), 'diagram.png': Buffer.from([0x89, 0xff, 0xfe, 0x00]) }, reason: 'binary_file' },
    // Two own skills with one name: the first moves, the second waits.
    { directory: '.agents/skills/06-patterns/local/zz-tool', files: { 'SKILL.md': ownSkill('tool') }, reason: 'project_skill_exists' }
  ];
  await write(target, '.agents/skills/06-patterns/local/aa-tool/SKILL.md', ownSkill('tool'));
  await write(target, `${legacy.localSkill.newDir}/notes.md`, 'already in the overlay\n');
  for (const item of cases) {
    for (const [file, content] of Object.entries(item.files)) await write(target, `${item.directory}/${file}`, content);
  }

  const plan = await buildUpdatePlan({ targetPath: target });

  const pending = layoutMigration(plan).pending;
  for (const item of cases) {
    assert.deepEqual(pending.find((entry) => entry.relativePath === `${item.directory}/`), { relativePath: `${item.directory}/`, reason: item.reason });
    assert.deepEqual(plan.operations.filter((op) => op.migration && op.relativePath.startsWith(`${item.directory}/`)).map((op) => op.relativePath), [], item.reason);
  }
  const rows = operationFor(plan, projectIndexPath).content.split('\n').filter((line) => line.startsWith('| `'));
  assert.deepEqual(rows.map((line) => line.split('|')[1].trim()), ['`tool`']);
  assert.match(layoutMigration(plan).summary, /own skills moved to \.agents\/project\/skills\/ 1 \(6 pending\)/);
});

test('moved skills join an existing project index as new rows, never changing the rows it has', async () => {
  const { target, legacy } = await legacyRepo();
  await write(target, '.agents/skills/06-patterns/local/bare/SKILL.md', '---\nname: bare\n---\n');
  await write(target, '.agents/skills/06-patterns/local/folded/SKILL.md', '---\nname: folded\ndescription: >\n  Folded\n  text.\n---\n');
  // A skill folder inside an own skill moves with it and gets no row of its own.
  await write(target, '.agents/skills/06-patterns/local/folded/examples/inner/SKILL.md', '---\nname: inner\n---\n');
  // A registry that is not JSON has no rows to give; the Markdown catalogs still list the skill.
  await write(target, legacy.registryPath, '{ not json');
  const header = '| Skill name | Class | Trigger | Physical path | Cost hint |\n| --- | --- | --- | --- | --- |';
  const retryRow = `| \`retry-policy\` | Pattern | ${legacy.localSkill.contents['SKILL.md'].match(/^description: (.*)$/m)[1]} | \`.agents/project/skills/retry-policy/SKILL.md\` | lean |`;
  const bareRow = '| `bare` | Pattern | Project skill moved from .agents/skills/06-patterns/local/bare/. | `.agents/project/skills/bare/SKILL.md` | lean |';
  const foldedRow = '| `folded` | Pattern | Folded text. | `.agents/project/skills/folded/SKILL.md` | lean |';
  const ownRow = '| `x` | Pattern | t | `.agents/project/skills/x/SKILL.md` | lean |';
  const cases = [
    { name: 'no Skills section', index: '# Mine\n\nNotes.\n', expected: `# Mine\n\nNotes.\n\n## Skills\n\n${header}\n${bareRow}\n${foldedRow}\n${retryRow}\n` },
    { name: 'a Skills table', index: `## Skills\n\n${header}\n${ownRow}\n\n## Shadows\n`, expected: `## Skills\n\n${header}\n${ownRow}\n${bareRow}\n${foldedRow}\n${retryRow}\n\n## Shadows\n` },
    { name: 'a Skills heading without a table', index: '## Skills\n\nNone yet.\n', expected: `## Skills\n\n${header}\n${bareRow}\n${foldedRow}\n${retryRow}\n\nNone yet.\n` },
    { name: 'a row for the new path already', index: `## Skills\n\n${header}\n${retryRow}\n`, expected: `## Skills\n\n${header}\n${retryRow}\n${bareRow}\n${foldedRow}\n` }
  ];
  for (const item of cases) {
    await write(target, projectIndexPath, item.index);

    const plan = await buildUpdatePlan({ targetPath: target });

    const index = operationFor(plan, projectIndexPath);
    assert.equal(index.operation, 'merge_with_backup', item.name);
    assert.equal(index.content, item.expected, item.name);
    assert.equal(operationFor(plan, '.agents/project/skills/folded/examples/inner/SKILL.md').operation, 'create');
  }
});

// Edge case Datos vacios: nothing to move means nothing created for it.
test('without own skills or a legacy context the migration creates no project index and moves nothing', async () => {
  const { target, legacy } = await legacyRepo();
  await fs.rm(path.join(target, legacy.localSkill.oldDir), { recursive: true });
  await fs.rm(path.join(target, legacy.ownContext.path));

  const plan = await buildUpdatePlan({ targetPath: target });

  assert.deepEqual(plan.operations.filter((item) => item.relativePath === projectIndexPath || item.relativePath.startsWith('.agents/project/skills/')), []);
  assert.match(layoutMigration(plan).summary, /own skills moved to \.agents\/project\/skills\/ 0;.*context moved: none;/);
});

test('a legacy file is never deleted unless its content is created at the new path', async () => {
  const { target, legacy } = await legacyRepo();
  await write(target, legacy.ownContext.newPath, '# Context written in the new place\n');
  // A legacy path whose new path this version does not ship.
  const manifest = await loadKitManifest();
  manifest.legacy_paths = { ...manifest.legacy_paths, '.agents/old-notes.md': '.agents/project/notes.md' };
  await write(target, '.agents/old-notes.md', '# Notes\n');

  const plan = await buildUpdatePlan({ targetPath: target, manifest });

  // Both context paths exist: neither is touched.
  assert.equal(operationFor(plan, legacy.ownContext.path), undefined);
  assert.equal(operationFor(plan, legacy.ownContext.newPath).operation, 'skip_unmanaged');
  assert.equal(operationFor(plan, '.agents/old-notes.md'), undefined);
  assert.equal(operationFor(plan, '.agents/project/notes.md'), undefined);
  assert.match(layoutMigration(plan).summary, /context moved: none;/);
});

test('with Windows state keys the migration deletes only the retired skill and the files it moves, nothing live', async () => {
  const { target, legacy } = await legacyRepo({ windowsKeys: true });

  const plan = await buildUpdatePlan({ targetPath: target });

  const deleted = plan.operations.filter((item) => item.operation === 'delete_with_backup').map((item) => item.relativePath);
  const expected = [legacy.retiredPath, legacy.ownContext.path, ...legacy.localSkill.files.map((file) => `${legacy.localSkill.oldDir}/${file}`)];
  assert.deepEqual(deleted.sort(), expected.sort());
  assert.deepEqual(plan.operations.filter((item) => item.retired).map((item) => item.relativePath), [legacy.retiredPath]);
});

test('a migrated repository updates again with no write and no migration; pending files stay pending (AC-10)', async () => {
  const { target } = await legacyRepo();
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nLocal edit.\n');
  await applyInstallPlan(await buildUpdatePlan({ targetPath: target }));

  const again = await buildUpdatePlan({ targetPath: target });

  assert.deepEqual(again.operations.filter((item) => !nonWriting.has(item.operation)).map((item) => `${item.operation}:${item.relativePath}`), []);
  assert.deepEqual(again.migrations, []);
  assert.equal(operationFor(again, '.agents/instructions.md').operation, 'skip_modified');
});

test('a partial selection keeps the whole migration; a retired delete can still be left out', async () => {
  const { target, legacy } = await legacyRepo();
  const plan = await buildUpdatePlan({ targetPath: target });

  const selected = selectPlanOperations(plan, []);

  const migrationOperations = plan.operations.filter((item) => item.migration);
  assert.ok(migrationOperations.length > 0);
  assert.deepEqual(selected.operations, migrationOperations);
  await applyInstallPlan(selected);
  assert.equal(await read(target, `${legacy.localSkill.newDir}/SKILL.md`), legacy.localSkill.contents['SKILL.md']);
  assert.ok(await exists(target, legacy.retiredPath), 'the deselected retired file stays');
  assert.ok(JSON.parse(await read(target, installStateRelativePath)).files[legacy.retiredPath], 'and keeps its record');
});

// An own file edited between the plan and the apply keeps the edit where it
// is; the move never records a project file in install-state.
test('an own skill file edited after the plan keeps the edit and leaves no install-state entry', async () => {
  const { target, legacy } = await legacyRepo();
  const plan = await buildUpdatePlan({ targetPath: target });
  const original = `${legacy.localSkill.oldDir}/SKILL.md`;
  assert.equal(operationFor(plan, original).operation, 'delete_with_backup');
  await write(target, original, 'edited after the plan\n');

  await applyInstallPlan(plan);

  assert.equal(await read(target, original), 'edited after the plan\n');
  const state = JSON.parse(await read(target, installStateRelativePath));
  assert.equal(original in state.files, false);
});

test('rollback after the migration restores the 0.18.1 tree byte for byte and the raw 1.0.0 state', async () => {
  const { target } = await legacyRepo();
  const before = await hashTree(target);
  const rawState = await read(target, installStateRelativePath);
  await applyInstallPlan(await buildUpdatePlan({ targetPath: target }));
  assert.notDeepEqual(await hashTree(target), before);

  await applyRollbackPlan(await buildRollbackPlan({ targetPath: target }));

  assert.equal(await read(target, installStateRelativePath), rawState);
  assert.deepEqual(await hashTree(target), before);
});

// A 2.0.0 state never runs migration code: legacy files are not moved.
test('with a 2.0.0 state no layout migration is planned', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  await write(target, '.agents/skills/06-patterns/local/own/SKILL.md', '---\nname: own\n---\n');

  const plan = await buildUpdatePlan({ targetPath: target });

  assert.equal(layoutMigration(plan), undefined);
  assert.deepEqual(plan.operations.filter((item) => item.migration || item.relativePath.startsWith('.agents/skills/06-patterns/local/')), []);
});
