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
import { installLegacy0181 } from './fixtures/legacy-0.18.1/install.mjs';
import { makeTempRepo, hashTree } from './helpers.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const overlayTemplates = path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full');
const migrationId = '0.22.0-kit-overlay-layout';
const projectIndexPath = '.agents/project/index.md';
const journalPath = '.agents/workflow-kit/last-apply.json';
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
    /catalog rows moved to \.agents\/project\/index\.md 2 \(rows added 2\)/,
    /catalogs replaced whole 5/,
    /context moved: \.agents\/project-context\.md -> \.agents\/project\/context\.md/,
    /superseded seeds reset 1\./
  ]) assert.match(migration.summary, group);
  assert.deepEqual(migration.pending, [
    { relativePath: instructionsPath, reason: 'edited_kit_file', decisions: ['keep', 'discard'] },
    { relativePath: leafSkill.path, reason: 'edited_kit_file', decisions: ['keep', 'discard', 'shadow'] },
    { relativePath: 'CLAUDE.md', reason: 'unmarked_adapter', decisions: ['keep', 'discard', 'split'] }
  ]);
  // The catalog class the project index does not allow is named.
  const classNote = '`retry-policy` row: class Standards/pattern written as Pattern (a moved skill goes to .agents/project/skills/<name>/, where only Pattern fits)';
  assert.deepEqual(migration.notes, [classNote]);
  const migrationLines = [
    `  - pending ${instructionsPath} (edited_kit_file): keep | discard`,
    `  - pending ${leafSkill.path} (edited_kit_file): keep | discard | shadow`,
    '  - pending CLAUDE.md (unmarked_adapter): keep | discard | split',
    `  - note: ${classNote}`
  ];
  const lines = formatPlan(plan).split('\n');
  const header = lines.findIndex((line) => line.startsWith(`- ${migrationId}: `));
  assert.deepEqual(lines.slice(header + 1, header + 5), migrationLines);
});

test('applying the migration moves project content to the overlay and keeps a backup of every write, also with backupMode none (AC-8)', async () => {
  const { target, legacy } = await legacyRepo();
  // An index the team started (merged), a context readable only by its owner
  // and an empty folder inside the own skill.
  const ownIndex = '# Project Catalog\n\nOwn notes.\n';
  await write(target, projectIndexPath, ownIndex);
  await fs.chmod(path.join(target, legacy.ownContext.path), 0o600);
  const emptyFolder = `${legacy.localSkill.oldDir}/drafts`;
  await fs.mkdir(path.join(target, emptyFolder));
  const retiredContent = await read(target, legacy.retiredPath);
  const qualityGateContent = await read(target, legacy.qualityGate.path);
  const plan = await buildUpdatePlan({ targetPath: target, backupMode: 'none' });
  assert.deepEqual(plan.operations.filter((item) => item.operation.endsWith('_no_backup')).map((item) => item.relativePath), []);
  assert.ok(layoutMigration(plan).notes.includes(`${legacy.localSkill.name}: empty folders left in place: ${emptyFolder}/`));

  const applied = await applyInstallPlan(plan);
  const replacedWithoutBackup = applied.filter((item) => item.applied && item.operation !== 'create' && !item.backupPath);
  assert.deepEqual(replacedWithoutBackup.map((item) => item.relativePath), []);
  const backupOf = (relativePath) => applied.find((item) => item.relativePath === relativePath)?.backupPath;
  const backupContent = (relativePath) => fs.readFile(backupOf(relativePath), 'utf8');
  const modeOf = async (relativePath) => (await fs.stat(path.join(target, relativePath))).mode & 0o777;

  // Own skill (move): every file moved unchanged with its permission bits; the
  // old copies leave backups with their content; the empty folder stays.
  for (const file of legacy.localSkill.files) {
    assert.equal(await read(target, `${legacy.localSkill.newDir}/${file}`), legacy.localSkill.contents[file]);
    assert.equal(await modeOf(`${legacy.localSkill.newDir}/${file}`), legacy.localSkill.modes[file] ?? 0o644, file);
    assert.equal(await exists(target, `${legacy.localSkill.oldDir}/${file}`), false);
    assert.equal(await backupContent(`${legacy.localSkill.oldDir}/${file}`), legacy.localSkill.contents[file]);
  }
  assert.ok(await exists(target, emptyFolder));
  // Project index (merge): the team's text, then the moved rows; the backup is the team's text.
  assert.equal(await read(target, projectIndexPath), `${ownIndex}\n## Skills\n\n| Skill name | Class | Trigger | Physical path | Cost hint |\n| --- | --- | --- | --- | --- |\n${legacy.projectIndexRows.join('\n')}\n`);
  assert.equal(await backupContent(projectIndexPath), ownIndex);

  // Catalogs are replaced whole: the local entry leaves registry.json and
  // lives on only in the project index.
  for (const catalogPath of catalogPaths) {
    assert.equal(await read(target, catalogPath), await fs.readFile(path.join(overlayTemplates, catalogPath), 'utf8'));
    assert.ok(backupOf(catalogPath), `${catalogPath} keeps a backup`);
  }
  assert.equal((await read(target, legacy.registryPath)).includes(legacy.registryEntryPath), false);
  assert.ok((await backupContent(legacy.registryPath)).includes(legacy.registryEntryPath));

  // Context moved with its own content and permission bits; no template context next to it.
  assert.equal(await read(target, legacy.ownContext.newPath), legacy.ownContext.content);
  assert.equal(await modeOf(legacy.ownContext.newPath), 0o600);
  assert.equal(await exists(target, legacy.ownContext.path), false);
  assert.equal(await backupContent(legacy.ownContext.path), legacy.ownContext.content);

  // The unedited 0.18.1 quality gate becomes the current stub (overwrite).
  assert.notEqual(sha(await read(target, legacy.qualityGate.path)), legacy.qualityGate.sha256);
  assert.equal(await read(target, legacy.qualityGate.path), await fs.readFile(path.join(overlayTemplates, legacy.qualityGate.path), 'utf8'));
  assert.equal(await backupContent(legacy.qualityGate.path), qualityGateContent);

  // The retired kit file (delete).
  assert.equal(await exists(target, legacy.retiredPath), false);
  assert.equal(await backupContent(legacy.retiredPath), retiredContent);
  assert.equal(await read(target, legacy.ownBackend.path), legacy.ownBackend.content);

  const state = JSON.parse(await read(target, installStateRelativePath));
  assert.equal(state.schemaVersion, '2.0.0');
  assert.deepEqual(Object.keys(state.files).filter((key) => key.startsWith('.agents/project/skills/') || key.startsWith(legacy.localSkill.oldDir) || key === legacy.ownContext.path || key === legacy.retiredPath), []);
  assert.deepEqual(state.files[legacy.ownContext.newPath], { class: 'seed' });
  assert.deepEqual(state.files[legacy.qualityGate.path], { class: 'seed' });
});

// Edge case Concurrencia/orden: a skill that cannot move unchanged stays
// where it is, without a row, and is listed as pending. Names are compared
// without letter case: on most file systems Tool/ and tool/ are one folder.
// A runbook lives in .agents/project/skills/runbooks/<name>/ with its own
// sections (.agents/kit-boundary.md, "Runbooks"); a moved 0.18 skill goes to
// .agents/project/skills/<name>/, so its row is always a Pattern.
test('a moved skill listed as Runbook in a catalog is written as Pattern, with a note', async () => {
  const { target } = await legacyRepo();
  for (const catalog of ['.agents/skills/06-patterns/index.md', '.agents/skills/registry.md']) {
    const content = await read(target, catalog);
    await write(target, catalog, content.split('\n').map((line) => (line.includes('`retry-policy`') ? line.replace('Standards/pattern', 'Runbook') : line)).join('\n'));
  }
  const plan = await buildUpdatePlan({ targetPath: target });
  const migration = layoutMigration(plan);
  assert.match(operationFor(plan, projectIndexPath).content, /^\| `retry-policy` \| Pattern \|/m);
  assert.ok(migration.notes.some((note) => note.startsWith('`retry-policy` row: class Runbook written as Pattern')));
});

// Without a markdown catalog row, the row takes the trigger of the registry.json entry.
test('an own skill listed only in registry.json takes the trigger of its registry entry', async () => {
  const { target, legacy } = await legacyRepo();
  for (const catalog of ['.agents/skills/06-patterns/index.md', '.agents/skills/registry.md']) {
    await write(target, catalog, (await read(target, catalog)).split('\n').filter((line) => !line.includes('`retry-policy`')).join('\n'));
  }
  const registry = JSON.parse(await read(target, legacy.registryPath));
  registry.pattern_skills.find((entry) => entry.path === legacy.registryEntryPath).trigger = 'Retry calls to external services.';
  const merged = `${JSON.stringify(registry, null, 2)}\n`;
  await write(target, legacy.registryPath, merged);
  // 0.18 recorded the merged registry it wrote.
  const state = JSON.parse(await read(target, installStateRelativePath));
  state.files[legacy.registryPath] = sha(merged);
  await write(target, installStateRelativePath, `${JSON.stringify(state, null, 2)}\n`);

  const plan = await buildUpdatePlan({ targetPath: target, backupMode: 'none' });

  assert.equal(operationFor(plan, legacy.registryPath).operation, 'overwrite_with_backup');
  assert.match(operationFor(plan, projectIndexPath).content, /^\| `retry-policy` \| Pattern \| Retry calls to external services\. \| `\.agents\/project\/skills\/retry-policy\/SKILL\.md` \| lean \|$/m);
});

test('an own skill that cannot move is left pending, not moved and without a row', async () => {
  const { target, legacy } = await legacyRepo();
  const ownSkill = (name) => `---\nname: ${name}\ndescription: Own skill.\n---\n\n# Own\n`;
  const cases = [
    { directory: '.agents/skills/06-patterns/local/router-copy', files: { 'SKILL.md': ownSkill('workflow-router') }, reason: 'kit_skill_name' },
    { directory: '.agents/skills/06-patterns/local/router-upper', files: { 'SKILL.md': ownSkill('Workflow-Router') }, reason: 'kit_skill_name' },
    { directory: legacy.localSkill.oldDir, files: {}, reason: 'project_skill_exists' },
    { directory: '.agents/skills/06-patterns/local/existing', files: { 'SKILL.md': ownSkill('existing') }, reason: 'project_skill_exists' },
    { directory: '.agents/skills/06-patterns/local/escape', files: { 'SKILL.md': ownSkill('../escape') }, reason: 'invalid_skill_name' },
    { directory: '.agents/skills/06-patterns/authoring', files: { 'SKILL.md': ownSkill('authoring') }, reason: 'mixed_with_kit_files' },
    { directory: '.agents/skills/06-patterns/local/diagram', files: { 'SKILL.md': ownSkill('diagram'), 'diagram.png': Buffer.from([0x89, 0xff, 0xfe, 0x00]) }, reason: 'binary_file' },
    // A link would move as the file it points to, or not at all.
    { directory: '.agents/skills/06-patterns/local/linked-file', files: { 'SKILL.md': ownSkill('linked-file') }, links: { 'notes.md': '../../../../../README.md' }, reason: 'symlink' },
    { directory: '.agents/skills/06-patterns/local/linked-dir', files: { 'SKILL.md': ownSkill('linked-dir') }, links: { shared: '../diagram' }, reason: 'symlink' },
    // Two own skills with one name: the first moves, the second waits.
    { directory: '.agents/skills/06-patterns/local/zz-tool', files: { 'SKILL.md': ownSkill('tool') }, reason: 'project_skill_exists' },
    { directory: '.agents/skills/06-patterns/local/zz-tool-upper', files: { 'SKILL.md': ownSkill('TOOL') }, reason: 'project_skill_exists' }
  ];
  await write(target, '.agents/skills/06-patterns/local/aa-tool/SKILL.md', ownSkill('tool'));
  await write(target, `${legacy.localSkill.newDir}/notes.md`, 'already in the overlay\n');
  await write(target, '.agents/project/skills/Existing/SKILL.md', ownSkill('Existing'));
  for (const item of cases) {
    for (const [file, content] of Object.entries(item.files)) await write(target, `${item.directory}/${file}`, content);
    for (const [file, linkTarget] of Object.entries(item.links ?? {})) await fs.symlink(linkTarget, path.join(target, item.directory, file));
  }

  const plan = await buildUpdatePlan({ targetPath: target });

  const pending = layoutMigration(plan).pending;
  for (const item of cases) {
    assert.deepEqual(pending.find((entry) => entry.relativePath === `${item.directory}/`), { relativePath: `${item.directory}/`, reason: item.reason }, item.directory);
    assert.deepEqual(plan.operations.filter((op) => op.migration && op.relativePath.startsWith(`${item.directory}/`)).map((op) => op.relativePath), [], item.directory);
  }
  // The only moved skill and the catalog row that names a document.
  const rows = operationFor(plan, projectIndexPath).content.split('\n').filter((line) => line.startsWith('| `'));
  assert.deepEqual(rows.map((line) => line.split('|')[1].trim()), ['`tool`', '`release-handbook`']);
  assert.match(layoutMigration(plan).summary, /own skills moved to \.agents\/project\/skills\/ 1 \(11 pending\)/);
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
  // The catalog rows keep the team's text; a skill no catalog lists takes its description.
  const [retryRow, handbookRow] = legacy.projectIndexRows;
  const bareRow = '| `bare` | Pattern | Project skill moved from .agents/skills/06-patterns/local/bare/. | `.agents/project/skills/bare/SKILL.md` | lean |';
  const foldedRow = '| `folded` | Pattern | Folded text. | `.agents/project/skills/folded/SKILL.md` | lean |';
  const ownRow = '| `x` | Pattern | t | `.agents/project/skills/x/SKILL.md` | lean |';
  const crlf = (text) => text.replaceAll('\n', '\r\n');
  const cases = [
    { name: 'no Skills section', index: '# Mine\n\nNotes.\n', expected: `# Mine\n\nNotes.\n\n## Skills\n\n${header}\n${bareRow}\n${foldedRow}\n${retryRow}\n${handbookRow}\n` },
    { name: 'a Skills table', index: `## Skills\n\n${header}\n${ownRow}\n\n## Shadows\n`, expected: `## Skills\n\n${header}\n${ownRow}\n${bareRow}\n${foldedRow}\n${retryRow}\n${handbookRow}\n\n## Shadows\n` },
    { name: 'a Skills heading without a table', index: '## Skills\n\nNone yet.\n', expected: `## Skills\n\n${header}\n${bareRow}\n${foldedRow}\n${retryRow}\n${handbookRow}\n\nNone yet.\n` },
    { name: 'a row for the new path already', index: `## Skills\n\n${header}\n${retryRow}\n`, expected: `## Skills\n\n${header}\n${retryRow}\n${bareRow}\n${foldedRow}\n${handbookRow}\n` },
    { name: 'CRLF line endings', index: crlf(`## Skills\n\n${header}\n${ownRow}\n`), expected: crlf(`## Skills\n\n${header}\n${ownRow}\n${bareRow}\n${foldedRow}\n${retryRow}\n${handbookRow}\n`) }
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

// Final review 1: the catalogs are replaced only together with the index that
// takes their own rows, and a shadow needs its row there too. When the index
// has a table the migration cannot extend, the whole migration stops before
// anything is written, so no 2.0.0 state ever keeps own rows only in backups.
test('an index whose tables the migration cannot extend stops the whole migration with the fix', async () => {
  const skillsHeader = '| Skill name | Class | Trigger | Physical path | Cost hint |\n| --- | --- | --- | --- | --- |';
  const indexes = [
    { name: 'a 3-column Skills table', index: '## Skills\n\n| Skill | Trigger | Path |\n| --- | --- | --- |\n| `release-handbook` | Handbook | `docs/handbook.md` |\n' },
    { name: 'a Skills table inside a code fence', index: `# Catalog\n\n\`\`\`markdown\n## Skills\n\n${skillsHeader}\n\`\`\`\n` },
    { name: 'a 3-column Shadows table', index: `## Skills\n\n${skillsHeader}\n\n## Shadows\n\n| Kit skill | Shadow directory | Notes |\n| --- | --- | --- |\n` }
  ];
  const repos = [
    { name: 'own skill and catalog rows', prepare: async () => {} },
    // Nothing moves but the edited leaf skill could become a shadow.
    { name: 'only a shadow candidate', prepare: async (target, legacy) => {
      await fs.rm(path.join(target, legacy.localSkill.oldDir), { recursive: true });
      const patternsIndex = '.agents/skills/06-patterns/index.md';
      await write(target, patternsIndex, (await read(target, patternsIndex)).split('\n').filter((line) => !line.includes(legacy.handbook.path)).join('\n'));
    } }
  ];
  for (const repo of repos) {
    for (const item of indexes) {
      const { target, legacy } = await legacyRepo();
      await repo.prepare(target, legacy);
      await appendTo(target, leafSkill.path, '\nOwn step.\n');
      await write(target, projectIndexPath, item.index);

      await assert.rejects(buildUpdatePlan({ targetPath: target }), (error) => {
        assert.equal(error.code, 'PROJECT_INDEX_UNEXPECTED', `${repo.name}, ${item.name}`);
        assert.match(error.message, /\.agents\/project\/index\.md .*\.agents\/kit-boundary\.md.*run workflow-kit update again.*Nothing was written\.$/s);
        return true;
      }, `${repo.name}, ${item.name}`);
    }
  }
});

// Edge case Datos vacios: nothing to move means nothing created for it.
test('without own skills, project catalog rows or a legacy context the migration creates no project index and moves nothing', async () => {
  const { target, legacy } = await legacyRepo();
  await fs.rm(path.join(target, legacy.localSkill.oldDir), { recursive: true });
  await fs.rm(path.join(target, legacy.ownContext.path));
  // The skill's rows stay in the catalogs, naming a folder that is gone.
  const patternsIndex = '.agents/skills/06-patterns/index.md';
  await write(target, patternsIndex, (await read(target, patternsIndex)).split('\n').filter((line) => !line.includes(legacy.handbook.path)).join('\n'));

  const plan = await buildUpdatePlan({ targetPath: target });

  assert.deepEqual(plan.operations.filter((item) => item.relativePath === projectIndexPath || item.relativePath.startsWith('.agents/project/skills/')), []);
  assert.match(layoutMigration(plan).summary, /own skills moved to \.agents\/project\/skills\/ 0;.*context moved: none;/);
  assert.deepEqual(layoutMigration(plan).notes, [`\`${legacy.localSkill.name}\` row not moved: ${legacy.registryEntryPath} is under .agents/skills/ and is not an own skill`]);
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

// The context moves as text: a file that is not UTF-8, or a folder at either
// path, stays where it is and the new path is not planned.
test('a legacy context that cannot move unchanged is left pending and nothing is planned at either path', async () => {
  const cases = [
    { name: 'legacy file not UTF-8', setup: (target, legacy) => write(target, legacy.ownContext.path, Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a])) },
    { name: 'legacy path is a folder', setup: async (target, legacy) => { await fs.rm(path.join(target, legacy.ownContext.path)); await write(target, `${legacy.ownContext.path}/notes.md`, '# Notes\n'); } },
    { name: 'new path is a folder', setup: (target, legacy) => write(target, `${legacy.ownContext.newPath}/notes.md`, '# Notes\n') }
  ];
  for (const item of cases) {
    const { target, legacy } = await legacyRepo();
    await item.setup(target, legacy);

    const plan = await buildUpdatePlan({ targetPath: target });

    const touched = plan.operations.filter((op) => op.relativePath.startsWith(legacy.ownContext.path) || op.relativePath.startsWith(legacy.ownContext.newPath));
    assert.deepEqual(touched.map((op) => `${op.operation}:${op.relativePath}`), [], item.name);
    assert.deepEqual(layoutMigration(plan).pending.find((entry) => entry.relativePath === legacy.ownContext.path), { relativePath: legacy.ownContext.path, reason: 'legacy_path_unsupported' }, item.name);
    assert.match(layoutMigration(plan).summary, /context moved: none;/, item.name);
  }
});

// Only the catalogs 0.18 preserved reach the planner as recorded; any other
// kit file the 1.0.0 state does not record is someone's own text.
test('an unrecorded kit file that differs from this version is pending until decided', async () => {
  const { target } = await legacyRepo();
  const agentPath = '.claude/agents/arquitecta-fases.md';
  const statePath = path.join(target, installStateRelativePath);
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  delete state.files[agentPath];
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  await write(target, agentPath, '# Our own architect agent\n');

  const plan = await buildUpdatePlan({ targetPath: target });

  assert.equal(operationFor(plan, agentPath).operation, 'skip_modified');
  assert.deepEqual(layoutMigration(plan).pending.find((entry) => entry.relativePath === agentPath), { relativePath: agentPath, reason: 'unrecorded_kit_file', decisions: ['keep', 'discard'] });
  const discarded = operationFor(await buildUpdatePlan({ targetPath: target, edited: { [agentPath]: 'discard' } }), agentPath);
  assert.equal(discarded.operation, 'overwrite_with_backup');
  await assert.rejects(buildUpdatePlan({ targetPath: target, edited: { [agentPath]: 'shadow' } }), invalidDecision(agentPath, 'shadow', ['keep', 'discard']));
});

// init plans as if nothing were installed: over a 1.0.0 state it would
// replace the project content the migration moves.
test('init over a 0.18.1 install stops before planning and points to update', async () => {
  const { target } = await legacyRepo();
  const before = await hashTree(target);

  await assert.rejects(buildInstallPlan({ targetPath: target, runtime: 'claude' }), new Error(`${installStateRelativePath} uses install-state 1.0.0. Run \`workflow-kit update\` to migrate this repository; init would replace project content. Nothing was written.`));

  assert.deepEqual(await hashTree(target), before);
});

// The journal of a run that stopped halfway is the only way back to the
// 0.18.1 tree: no plan may overwrite it before the rollback.
// Rolling back a partial journal is proven in test/rollback-journal.test.mjs.
test('an apply that stops halfway blocks update and init and keeps its journal', async () => {
  const { target, legacy } = await legacyRepo();
  const plan = await buildUpdatePlan({ targetPath: target });
  // Hand-crafted failure: the retired delete reads a folder, after earlier writes.
  const failing = operationFor(plan, legacy.retiredPath);
  assert.ok(plan.operations.indexOf(failing) > 0);
  failing.targetFile = path.join(target, '.agents/skills');
  await assert.rejects(applyInstallPlan(plan), { code: 'EISDIR' });
  const journalRaw = await read(target, journalPath);
  const journal = JSON.parse(journalRaw);
  assert.equal(journal.completed, false);
  assert.ok(journal.files.length > 0);

  const unfinished = new Error(`The last workflow-kit apply did not finish (${journal.appliedAt}). Run \`workflow-kit rollback --apply --yes\` first, then run this command again. Nothing was written.`);
  await assert.rejects(buildUpdatePlan({ targetPath: target }), unfinished);
  await assert.rejects(buildInstallPlan({ targetPath: target, runtime: 'claude' }), unfinished);
  assert.equal(await read(target, journalPath), journalRaw);
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

// The migration writes into the overlay; an overlay that is a link to another
// folder would receive those writes outside the repository.
test('the migration refuses a .agents/project that is a symbolic link and writes nothing', async () => {
  const { target } = await legacyRepo();
  const elsewhere = await makeTempRepo();
  await fs.rename(path.join(target, '.agents/project'), path.join(elsewhere, 'project'));
  await fs.symlink(path.join(elsewhere, 'project'), path.join(target, '.agents/project'));
  const before = await hashTree(target);
  const outside = await hashTree(elsewhere);

  await assert.rejects(buildUpdatePlan({ targetPath: target }), /symbolic link/);

  assert.deepEqual(await hashTree(target), before);
  assert.deepEqual(await hashTree(elsewhere), outside);
});

// Final review 9: a file where a planned write needs a folder stops the plan,
// instead of an apply that fails halfway with ENOTDIR.
test('the migration refuses a .agents/project/skills that is a file and writes nothing', async () => {
  const { target } = await legacyRepo();
  await write(target, '.agents/project/skills', 'not a folder\n');
  const before = await hashTree(target);

  await assert.rejects(buildUpdatePlan({ targetPath: target }), /\.agents\/project\/skills is a file, not a folder.*Nothing was written\./s);

  assert.deepEqual(await hashTree(target), before);
});

// Deselecting a retired delete is proven in test/planner.test.mjs.
test('a partial selection keeps the whole migration', async () => {
  const { target, legacy } = await legacyRepo();
  const plan = await buildUpdatePlan({ targetPath: target });

  const selected = selectPlanOperations(plan, []);

  const migrationOperations = plan.operations.filter((item) => item.migration);
  // The catalogs belong to the block: their project rows already moved.
  for (const catalog of catalogPaths) assert.ok(migrationOperations.some((item) => item.relativePath === catalog), catalog);
  assert.deepEqual(selected.operations, migrationOperations);
  await applyInstallPlan(selected);
  assert.equal(await read(target, `${legacy.localSkill.newDir}/SKILL.md`), legacy.localSkill.contents['SKILL.md']);
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

// split is offered only when the file holds the current kit text as one
// region; the text around it is the team's, byte for byte, whatever it says.
test('split puts the new block where the template places it and keeps the own text byte for byte (UC-6)', async () => {
  const { target } = await legacyRepo();
  const legacyClaude = await read(target, 'CLAUDE.md');
  const template = await fs.readFile(claudeTemplate, 'utf8');
  const { block } = extractManagedBlock(template, 'workflow-kit:managed');
  const kitLine = legacyClaude.split('\n')[0];
  const fence = '```sh\nmake test\n\n\n   \nmake lint\n```\n';
  const cases = [
    // Only the blank lines that touched the kit text go; one blank line keeps the two parts apart.
    { name: 'notes around the old kit text', content: `Intro del equipo\n\n\n${legacyClaude}\n\n  \nNota del equipo.\n\n`, expected: `${block}\n\nIntro del equipo\n\nNota del equipo.\n\n` },
    { name: 'an own line equal to a kit line', content: `${legacyClaude}\n${kitLine}\n\nNota del equipo.\n`, expected: `${block}\n\n${kitLine}\n\nNota del equipo.\n` },
    { name: 'a code fence with blank runs', content: `${fence}\n${legacyClaude}`, expected: `${block}\n\n${fence}` },
    { name: 'only blank lines around the kit text', content: `\n${legacyClaude}\n  \n`, expected: template }
  ];
  for (const item of cases) {
    await write(target, 'CLAUDE.md', item.content);

    const plan = await buildUpdatePlan({ targetPath: target, edited: { 'CLAUDE.md': 'split' } });

    const claude = operationFor(plan, 'CLAUDE.md');
    assert.equal(claude.operation, 'overwrite_with_backup', item.name);
    assert.equal(claude.content, item.expected, item.name);
  }

  // A kit line the team changed: the own text cannot be told apart.
  await write(target, 'CLAUDE.md', legacyClaude.replace(kitLine, `${kitLine} (ours)`));
  assert.deepEqual(operationFor(await buildUpdatePlan({ targetPath: target }), 'CLAUDE.md').decisions, ['keep', 'discard']);
  await assert.rejects(buildUpdatePlan({ targetPath: target, edited: { 'CLAUDE.md': 'split' } }), invalidDecision('CLAUDE.md', 'split', ['keep', 'discard']));
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
