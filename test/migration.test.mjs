// Layout migration from install-state 1.0.0 (PRD manifest-updater 2.3, AC-7,
// AC-8, AC-10) and the decisions on edited files (2.4, AC-9). Every test starts from a real 0.18.1 install (fixture
// legacy-0.18.1); the planner rules shared with a 2.0.0 state live in
// planner.test.mjs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { extractManagedBlock, loadKitManifest } from '../src/kit-manifest.mjs';
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
const instructionsPath = '.agents/instructions.md';
// A kit leaf skill the manifest lets be shadowed.
const leafSkill = { path: '.agents/skills/02-implement/validation-runner/SKILL.md', name: 'validation-runner' };
const shadowDirectory = `.agents/project/shadows/${leafSkill.name}`;
const claudeTemplate = path.join(root, 'templates/runtime-adapters/claude/CLAUDE.md');

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

const appendTo = (target, relativePath, text) => fs.appendFile(path.join(target, relativePath), text);

// assert.rejects matcher for a decision the planner refuses.
const invalidDecision = (relativePath, decision, validDecisions) => (error) => {
  assert.equal(error.code, 'INVALID_EDITED_DECISION');
  assert.deepEqual({ relativePath: error.relativePath, decision: error.decision, validDecisions: error.validDecisions }, { relativePath, decision, validDecisions });
  assert.ok(error.message.includes(`${relativePath}=${decision}`) && error.message.includes(`Valid decisions: ${validDecisions.join(' | ') || 'none'}.`), error.message);
  return true;
};

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

test('the dry-run lists the migration groups with counts and every pending file with its valid decisions, and writes nothing (AC-7)', async () => {
  const { target } = await legacyRepo();
  for (const relativePath of [instructionsPath, leafSkill.path, 'CLAUDE.md']) await appendTo(target, relativePath, '\nLocal edit.\n');
  const before = await hashTree(target);

  const plan = await buildUpdatePlan({ targetPath: target });

  assert.deepEqual(await hashTree(target), before);
  const migration = layoutMigration(plan);
  assert.ok(migration, 'the layout migration is part of the plan');
  for (const group of [
    /edited files pending 3 \(\.agents\/instructions\.md, \.agents\/skills\/02-implement\/validation-runner\/SKILL\.md, CLAUDE\.md\)/,
    /retired deleted 1;/,
    /own skills moved to \.agents\/project\/skills\/ 1;/,
    /catalog rows moved to \.agents\/project\/index\.md 1 \(rows added 1\)/,
    /catalogs replaced whole 5/,
    /context moved: \.agents\/project-context\.md -> \.agents\/project\/context\.md/,
    /superseded seeds reset 1\./
  ]) assert.match(migration.summary, group);
  assert.deepEqual(migration.pending, [
    { relativePath: instructionsPath, reason: 'edited_kit_file', decisions: ['keep', 'discard'] },
    { relativePath: leafSkill.path, reason: 'edited_kit_file', decisions: ['keep', 'discard', 'shadow'] },
    { relativePath: 'CLAUDE.md', reason: 'unmarked_adapter', decisions: ['keep', 'discard', 'split'] }
  ]);
  const pendingLines = [
    `  - pending ${instructionsPath} (edited_kit_file): keep | discard`,
    `  - pending ${leafSkill.path} (edited_kit_file): keep | discard | shadow`,
    '  - pending CLAUDE.md (unmarked_adapter): keep | discard | split'
  ];
  const lines = formatPlan(plan).split('\n');
  const header = lines.findIndex((line) => line.startsWith(`- ${migrationId}: `));
  assert.deepEqual(lines.slice(header + 1, header + 4), pendingLines);
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

// A 2.0.0 state never runs migration code: legacy files are not moved, and
// no shadow is made, since update never writes the overlay (CR-F2-01).
test('with a 2.0.0 state no layout migration is planned and shadow is not a valid decision', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  await write(target, '.agents/skills/06-patterns/local/own/SKILL.md', '---\nname: own\n---\n');
  await appendTo(target, leafSkill.path, '\nOwn step.\n');

  const plan = await buildUpdatePlan({ targetPath: target });

  assert.equal(layoutMigration(plan), undefined);
  assert.deepEqual(plan.operations.filter((item) => item.migration || item.relativePath.startsWith('.agents/skills/06-patterns/local/')), []);
  assert.deepEqual(operationFor(plan, leafSkill.path).decisions, ['keep', 'discard']);
  await assert.rejects(buildUpdatePlan({ targetPath: target, edited: { [leafSkill.path]: 'shadow' } }), invalidDecision(leafSkill.path, 'shadow', ['keep', 'discard']));
});

// Decisions on edited files (PRD 2.4, AC-9).
test('deciding shadow, split and discard writes each file with a backup, also with backupMode none, and a second update writes nothing', async () => {
  const { target, legacy } = await legacyRepo();
  const recordedSkillHash = JSON.parse(await read(target, installStateRelativePath)).files[leafSkill.path];
  const editedSkill = `${await read(target, leafSkill.path)}\n## Paso propio\n\nRevisar la señal antes de cerrar.\n`;
  await write(target, leafSkill.path, editedSkill);
  await appendTo(target, 'CLAUDE.md', '\nNota del equipo.\n');
  await appendTo(target, instructionsPath, '\nLocal edit.\n');

  const plan = await buildUpdatePlan({ targetPath: target, backupMode: 'none', edited: { [leafSkill.path]: 'shadow', 'CLAUDE.md': 'split', [instructionsPath]: 'discard' } });

  assert.deepEqual(layoutMigration(plan).pending, []);
  // The shadow is part of the migration, which is applied whole; one index
  // operation lists the moved skill and the shadow.
  assert.deepEqual(plan.operations.filter((item) => item.migration && (item.relativePath === leafSkill.path || item.relativePath.startsWith(`${shadowDirectory}/`))).map((item) => item.relativePath).sort(), [`${shadowDirectory}/SKILL.md`, `${shadowDirectory}/shadow.json`, leafSkill.path].sort());
  assert.equal(plan.operations.filter((item) => item.relativePath === projectIndexPath).length, 1);
  const applied = await applyInstallPlan(plan);
  for (const relativePath of [leafSkill.path, 'CLAUDE.md', instructionsPath]) {
    assert.ok(applied.find((item) => item.relativePath === relativePath)?.backupPath, `${relativePath} keeps a backup`);
  }

  // shadow: the edit byte for byte, its base the hash the 1.0.0 state recorded.
  assert.ok((await fs.readFile(path.join(target, shadowDirectory, 'SKILL.md'))).equals(Buffer.from(editedSkill)));
  assert.deepEqual(JSON.parse(await read(target, `${shadowDirectory}/shadow.json`)), { skill: leafSkill.name, kit_path: leafSkill.path, base_sha256: recordedSkillHash, kit_version: legacy.toolkitVersion });
  const index = await read(target, projectIndexPath);
  assert.match(index, /^## Shadows\n\n\| Kit skill \| Shadow directory \|\n\| --- \| --- \|\n\| `validation-runner` \| `\.agents\/project\/shadows\/validation-runner\/` \|\n$/m);
  assert.match(index, new RegExp(`^\\| \`${legacy.localSkill.name}\` \\| Pattern \\|`, 'm'));
  assert.equal(await read(target, leafSkill.path), await fs.readFile(path.join(overlayTemplates, leafSkill.path), 'utf8'));
  // split: the block first, the team's note below its end marker.
  const claude = await read(target, 'CLAUDE.md');
  assert.match(claude, /^<!-- workflow-kit:managed:start -->\n[\s\S]*<!-- workflow-kit:managed:end -->\n\nNota del equipo\.\n$/);
  // The adapter is recorded by its new block.
  const state = JSON.parse(await read(target, installStateRelativePath));
  assert.deepEqual(state.files['CLAUDE.md'], { sha256: sha(extractManagedBlock(claude, 'workflow-kit:managed').block), class: 'adapter' });
  // discard: the kit version.
  assert.equal(await read(target, instructionsPath), await fs.readFile(path.join(overlayTemplates, instructionsPath), 'utf8'));

  const again = await buildUpdatePlan({ targetPath: target });
  assert.equal(again.summary.skip_modified, 0);
  assert.deepEqual(again.operations.filter((item) => !nonWriting.has(item.operation)).map((item) => `${item.operation}:${item.relativePath}`), []);
});

test('split puts the new block where the template places it and keeps only the own lines (UC-6)', async () => {
  const { target } = await legacyRepo();
  const legacyClaude = await read(target, 'CLAUDE.md');
  const template = await fs.readFile(claudeTemplate, 'utf8');
  const { block } = extractManagedBlock(template, 'workflow-kit:managed');
  const cases = [
    // Lines of the old kit text are in the new block; blank runs collapse.
    { name: 'notes around the old kit text', content: `Intro del equipo\n\n\n${legacyClaude}\n\n  \nNota del equipo.\n\n`, expected: `${block}\n\nIntro del equipo\n\nNota del equipo.\n` },
    { name: 'a kit line removed and nothing own', content: legacyClaude.replace(/^.*\n/, ''), expected: template }
  ];
  for (const item of cases) {
    await write(target, 'CLAUDE.md', item.content);

    const plan = await buildUpdatePlan({ targetPath: target, edited: { 'CLAUDE.md': 'split' } });

    const claude = operationFor(plan, 'CLAUDE.md');
    assert.equal(claude.operation, 'overwrite_with_backup', item.name);
    assert.equal(claude.content, item.expected, item.name);
  }
});

// A script that always passes --edited all=discard must keep working on a
// repository with nothing pending.
test('all= with no pending edited file plans normally', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  const plan = await buildUpdatePlan({ targetPath: target, edited: { all: 'discard' } });
  assert.equal(plan.summary.skip_modified, 0);
});

test('all= decides every pending file where its decision is valid; a named path keeps its own decision', async () => {
  const { target } = await legacyRepo();
  for (const relativePath of [instructionsPath, leafSkill.path, 'CLAUDE.md']) await appendTo(target, relativePath, '\nLocal edit.\n');
  const kitVersion = { [instructionsPath]: await fs.readFile(path.join(overlayTemplates, instructionsPath), 'utf8'), 'CLAUDE.md': await fs.readFile(claudeTemplate, 'utf8') };
  const cases = [
    { edited: { all: 'discard' }, decided: [instructionsPath, leafSkill.path, 'CLAUDE.md'] },
    { edited: { all: 'discard', [leafSkill.path]: 'keep' }, decided: [instructionsPath, 'CLAUDE.md'] },
    { edited: { all: 'split' }, decided: ['CLAUDE.md'] }
  ];
  for (const item of cases) {
    const plan = await buildUpdatePlan({ targetPath: target, edited: item.edited });

    const pendingPaths = [instructionsPath, leafSkill.path, 'CLAUDE.md'].filter((relativePath) => !item.decided.includes(relativePath));
    for (const relativePath of item.decided) assert.equal(operationFor(plan, relativePath).operation, 'overwrite_with_backup', `${relativePath} ${JSON.stringify(item.edited)}`);
    assert.deepEqual(layoutMigration(plan).pending.map((entry) => entry.relativePath), pendingPaths, JSON.stringify(item.edited));
    if (item.edited.all === 'discard') {
      for (const [relativePath, content] of Object.entries(kitVersion)) assert.equal(operationFor(plan, relativePath).content, content, relativePath);
    }
  }
});

// Edge case Permisos: workflow-router and instructions never get a shadow.
test('a decision that does not apply stops the plan before anything is written', async () => {
  const { target } = await legacyRepo();
  const router = '.agents/skills/00-router/workflow-router/SKILL.md';
  const nonLeaf = '.agents/skills/01-product/project-formation/SKILL.md';
  const notText = '.agents/skills/02-implement/codebase-discovery/SKILL.md';
  const notSkillFile = '.agents/skills/02-implement/validation-runner/agents/openai.yaml';
  // A runtime wrapper, not the kit skill itself.
  const wrapper = '.claude/skills/create-epic/SKILL.md';
  for (const relativePath of [router, nonLeaf, instructionsPath, leafSkill.path, notSkillFile, wrapper]) await appendTo(target, relativePath, '\nLocal edit.\n');
  await appendTo(target, notText, Buffer.from([0xff, 0xfe, 0x0a]));
  await write(target, `${shadowDirectory}/notes.md`, 'A shadow already started by hand.\n');
  const before = await hashTree(target);
  const kitFileDecisions = ['keep', 'discard'];
  const cases = [
    { edited: { [router]: 'shadow' }, rejected: [router, 'shadow', kitFileDecisions] },
    { edited: { [nonLeaf]: 'shadow' }, rejected: [nonLeaf, 'shadow', kitFileDecisions] },
    { edited: { [instructionsPath]: 'shadow' }, rejected: [instructionsPath, 'shadow', kitFileDecisions] },
    { edited: { [notSkillFile]: 'shadow' }, rejected: [notSkillFile, 'shadow', kitFileDecisions] },
    { edited: { [wrapper]: 'shadow' }, rejected: [wrapper, 'shadow', kitFileDecisions] },
    { edited: { [leafSkill.path]: 'shadow' }, rejected: [leafSkill.path, 'shadow', kitFileDecisions] },
    { edited: { [notText]: 'shadow' }, rejected: [notText, 'shadow', kitFileDecisions] },
    { edited: { [instructionsPath]: 'split' }, rejected: [instructionsPath, 'split', kitFileDecisions] },
    { edited: { 'docs/workflow/README.md': 'discard' }, rejected: ['docs/workflow/README.md', 'discard', []] },
    { edited: { [instructionsPath]: 'merge' }, rejected: [instructionsPath, 'merge', ['keep', 'discard', 'shadow', 'split']] },
    { edited: { [instructionsPath]: 'discard', all: 'shadow' }, rejected: ['all', 'shadow', kitFileDecisions] }
  ];
  for (const item of cases) {
    await assert.rejects(buildUpdatePlan({ targetPath: target, edited: item.edited }), invalidDecision(...item.rejected), JSON.stringify(item.edited));
  }
  assert.deepEqual(await hashTree(target), before);
});
