import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan, applyJournalRelativePath } from '../src/apply.mjs';
import { buildInstallPlan, buildUpdatePlan, installStateRelativePath } from '../src/planner.mjs';
import { applyRollbackPlan, buildRollbackPlan, formatRollbackPlan, summarizeRollback } from '../src/rollback.mjs';
import { installLegacy0181 } from './fixtures/legacy-0.18.1/install.mjs';
import { makeTempRepo } from './helpers.mjs';

// Journal 2.0.0 and rollback (AC-5): an apply that deleted retired kit files,
// overwrote and created others is undone byte for byte.

const sha = (content) => createHash('sha256').update(content, 'utf8').digest('hex');
const retiredSkill = '.agents/skills/04-crosscutting/retired-skill/SKILL.md';
const otherRetired = '.agents/skills/04-crosscutting/other-retired/SKILL.md';

async function write(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

const readJson = async (target, relativePath) => JSON.parse(await fs.readFile(path.join(target, relativePath), 'utf8'));
const exists = (target, relativePath) => fs.access(path.join(target, relativePath)).then(() => true, () => false);

async function listBackups(root) {
  const found = [];
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.name.includes('.workflow-kit-backup-')) found.push(path.relative(root, absolute));
    }
  }
  await walk(root);
  return found;
}

// A neutral install whose state also records kit files this version retired.
async function installWithRetired(target, retired) {
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const state = await readJson(target, installStateRelativePath);
  for (const [relativePath, content] of Object.entries(retired)) {
    await write(target, relativePath, content);
    state.files[relativePath] = { sha256: sha(content), class: 'kit' };
  }
  await fs.writeFile(path.join(target, installStateRelativePath), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return state;
}

test('rollback restores a deleted and an overwritten file, removes a created one and puts the previous state back (AC-5)', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const retiredContent = '---\nname: retired-skill\n---\nCuerpo con acentos: áéí\r\nsin salto final';
  const olderInstructions = 'older kit instructions\n';
  const created = '.agents/README.md';
  const state = await readJson(target, installStateRelativePath);
  state.files[retiredSkill] = { sha256: sha(retiredContent), class: 'kit' };
  state.files['.agents/instructions.md'] = { sha256: sha(olderInstructions), class: 'kit' };
  const previousState = `${JSON.stringify(state, null, 2)}\n`;
  await write(target, retiredSkill, retiredContent);
  await write(target, '.agents/instructions.md', olderInstructions);
  await write(target, installStateRelativePath, previousState);
  await fs.rm(path.join(target, created));

  await applyInstallPlan(await buildUpdatePlan({ targetPath: target }));

  const journal = await readJson(target, applyJournalRelativePath);
  assert.equal(journal.schemaVersion, '2.0.0');
  assert.equal(journal.previousInstallState, previousState);
  const byPath = Object.fromEntries(journal.files.map((entry) => [entry.relativePath, entry]));
  assert.equal(byPath[retiredSkill].action, 'deleted');
  assert.equal(byPath[retiredSkill].writtenChecksum, null);
  assert.match(byPath[retiredSkill].backup, /^\.agents\/skills\/04-crosscutting\/retired-skill\/SKILL\.md\.workflow-kit-backup-\d{8}T\d{6}Z$/);
  assert.equal(byPath['.agents/instructions.md'].action, 'overwritten');
  assert.equal(byPath[created].action, 'created');
  assert.equal(await exists(target, retiredSkill), false);
  assert.equal(retiredSkill in (await readJson(target, installStateRelativePath)).files, false);

  const plan = await buildRollbackPlan({ targetPath: target });
  assert.match(formatRollbackPlan(plan), /^restore \.agents\/skills\/04-crosscutting\/retired-skill\/SKILL\.md <- SKILL\.md\.workflow-kit-backup-\d{8}T\d{6}Z \(deleted by the last apply\)$/m);
  const summary = summarizeRollback(await applyRollbackPlan(plan));

  assert.deepEqual(summary, { restored: 2, removed: 1, keptModified: 0, withoutBackup: 0 });
  assert.deepEqual(await fs.readFile(path.join(target, retiredSkill)), Buffer.from(retiredContent, 'utf8'));
  assert.equal(await fs.readFile(path.join(target, '.agents/instructions.md'), 'utf8'), olderInstructions);
  assert.equal(await exists(target, created), false);
  assert.equal(await fs.readFile(path.join(target, installStateRelativePath), 'utf8'), previousState);
  assert.deepEqual(await listBackups(target), [], 'used backups are removed');
  assert.equal(await exists(target, applyJournalRelativePath), false);
});

test('a 1.0.0 journal written by an older CLI still rolls back', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const backup = '.agents/instructions.md.workflow-kit-backup-20260101T000000Z';
  const previousState = `${JSON.stringify({ schemaVersion: '1.0.0', runtimes: ['neutral'], files: {} }, null, 2)}\n`;
  await write(target, '.agents/instructions.md', 'written by the apply\n');
  await write(target, backup, 'before the apply\n');
  await write(target, 'docs/workflow/extra.md', 'created by the apply\n');
  await write(target, applyJournalRelativePath, JSON.stringify({
    schemaVersion: '1.0.0',
    appliedAt: '2026-01-01T00:00:00.000Z',
    backupStamp: '20260101T000000Z',
    mode: 'update',
    toolkitVersion: '0.18.1',
    completed: true,
    stateWritten: true,
    previousInstallState: previousState,
    files: [
      { relativePath: '.agents/instructions.md', action: 'overwritten', backup, writtenChecksum: sha('written by the apply\n') },
      { relativePath: 'docs/workflow/extra.md', action: 'created', backup: null, writtenChecksum: sha('created by the apply\n') }
    ]
  }));

  const summary = summarizeRollback(await applyRollbackPlan(await buildRollbackPlan({ targetPath: target })));

  assert.deepEqual(summary, { restored: 1, removed: 1, keptModified: 0, withoutBackup: 0 });
  assert.equal(await fs.readFile(path.join(target, '.agents/instructions.md'), 'utf8'), 'before the apply\n');
  assert.equal(await exists(target, 'docs/workflow/extra.md'), false);
  assert.equal(await exists(target, backup), false);
  assert.equal(await fs.readFile(path.join(target, installStateRelativePath), 'utf8'), previousState);
});

// Review of phase 1: a retired file edited between the plan and the apply is
// no longer the unedited kit file the plan decided to delete.
test('apply does not delete a retired file that changed after the plan', async () => {
  const target = await makeTempRepo();
  await installWithRetired(target, { [retiredSkill]: 'retired body\n' });
  const plan = await buildUpdatePlan({ targetPath: target });
  assert.equal(plan.operations.find((item) => item.relativePath === retiredSkill).operation, 'delete_with_backup');
  await write(target, retiredSkill, 'edited after the plan\n');

  await applyInstallPlan(plan);

  assert.equal(await fs.readFile(path.join(target, retiredSkill), 'utf8'), 'edited after the plan\n');
  assert.equal((await readJson(target, installStateRelativePath)).files[retiredSkill].retired, true);
});

// Final review 5: like a delete, a write planned without a backup is checked
// again right before it happens. Content that appeared or changed since the
// plan is kept as a backup, whatever the backup mode.
test('apply keeps a backup of content that changed after a plan that wrote without one', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const state = await readJson(target, installStateRelativePath);
  const olderInstructions = 'older kit instructions\n';
  state.files['.agents/instructions.md'] = { sha256: sha(olderInstructions), class: 'kit' };
  await write(target, '.agents/instructions.md', olderInstructions);
  await write(target, installStateRelativePath, `${JSON.stringify(state, null, 2)}\n`);
  await fs.rm(path.join(target, '.agents/README.md'));
  const plan = await buildUpdatePlan({ targetPath: target, backupMode: 'none' });
  const cases = [
    { relativePath: '.agents/instructions.md', planned: 'overwrite_no_backup', edit: 'edited after the plan\n' },
    { relativePath: '.agents/README.md', planned: 'create', edit: 'written after the plan\n' }
  ];
  for (const item of cases) {
    assert.equal(plan.operations.find((op) => op.relativePath === item.relativePath).operation, item.planned);
    await write(target, item.relativePath, item.edit);
  }

  await applyInstallPlan(plan);

  const journal = await readJson(target, applyJournalRelativePath);
  for (const item of cases) {
    const entry = journal.files.find((file) => file.relativePath === item.relativePath);
    assert.ok(entry?.backup, `${item.relativePath}: backup recorded`);
    assert.equal(await fs.readFile(path.join(target, entry.backup), 'utf8'), item.edit, item.relativePath);
  }
});

test('rollback keeps a deleted path that was recreated and reports a deleted file whose backup is gone', async () => {
  const target = await makeTempRepo();
  await installWithRetired(target, { [retiredSkill]: 'kit body one\n', [otherRetired]: 'kit body two\n' });
  await applyInstallPlan(await buildUpdatePlan({ targetPath: target }));
  const journal = await readJson(target, applyJournalRelativePath);
  await write(target, retiredSkill, 'recreated by the team\n');
  await fs.rm(path.join(target, journal.files.find((entry) => entry.relativePath === otherRetired).backup));

  const plan = await buildRollbackPlan({ targetPath: target });
  assert.match(formatRollbackPlan(plan), /^keep \.agents\/skills\/04-crosscutting\/retired-skill\/SKILL\.md \(recreated after the last apply; not touched\)$/m);
  assert.match(formatRollbackPlan(plan), /^cannot restore \.agents\/skills\/04-crosscutting\/other-retired\/SKILL\.md \(backup file is missing\)$/m);
  const summary = summarizeRollback(await applyRollbackPlan(plan));

  assert.deepEqual(summary, { restored: 0, removed: 0, keptModified: 1, withoutBackup: 1 });
  assert.equal(await fs.readFile(path.join(target, retiredSkill), 'utf8'), 'recreated by the team\n');
  assert.equal(await exists(target, otherRetired), false);
});

test('a failure halfway through an apply leaves a partial journal that rollback undoes', async () => {
  const target = await makeTempRepo();
  await installWithRetired(target, { [retiredSkill]: 'kit body\n' });
  const stateBefore = await fs.readFile(path.join(target, installStateRelativePath), 'utf8');
  await write(target, 'blocker', 'a file where the next write expects a directory\n');
  const plan = {
    mode: 'update',
    targetPath: target,
    stateFilePath: path.join(target, installStateRelativePath),
    nextInstallState: { schemaVersion: '2.0.0', files: {} },
    operations: [
      { operation: 'delete_with_backup', relativePath: retiredSkill, targetFile: path.join(target, retiredSkill), class: 'kit', retired: true, content: null, recordedChecksum: sha('kit body\n') },
      { operation: 'create', relativePath: 'blocker/inner.md', targetFile: path.join(target, 'blocker/inner.md'), content: 'never written\n' }
    ]
  };

  await assert.rejects(applyInstallPlan(plan));

  const journal = await readJson(target, applyJournalRelativePath);
  assert.equal(journal.completed, false);
  assert.equal(journal.stateWritten, false);
  assert.deepEqual(journal.files.map((entry) => entry.action), ['deleted']);
  await applyRollbackPlan(await buildRollbackPlan({ targetPath: target }));
  assert.equal(await fs.readFile(path.join(target, retiredSkill), 'utf8'), 'kit body\n');
  assert.equal(await fs.readFile(path.join(target, installStateRelativePath), 'utf8'), stateBefore);
});

test('apply refuses a delete through a symbolic link that appeared after the plan', async () => {
  const target = await makeTempRepo();
  const elsewhere = await makeTempRepo();
  await installWithRetired(target, { [retiredSkill]: 'kit body\n' });
  const plan = await buildUpdatePlan({ targetPath: target });
  const directory = path.dirname(path.join(target, retiredSkill));
  await fs.rename(directory, path.join(elsewhere, 'moved'));
  await fs.symlink(path.join(elsewhere, 'moved'), directory);

  await assert.rejects(applyInstallPlan(plan), /Refusing to write or delete through symbolic links/);
  assert.equal(await fs.readFile(path.join(elsewhere, 'moved/SKILL.md'), 'utf8'), 'kit body\n');
  assert.deepEqual(await fs.readdir(path.join(elsewhere, 'moved')), ['SKILL.md']);
});

// Final review 2: without a journal, rollback restores the newest backup of
// each managed file. After a migration those files were edited again; their
// current content is kept as a backup before the restore, never lost.
test('rollback without a journal on a migrated 2.0.0 repository keeps a copy of every file it replaces', async () => {
  const target = await makeTempRepo();
  await installLegacy0181(target);
  await applyInstallPlan(await buildUpdatePlan({ targetPath: target }));
  assert.equal((await readJson(target, installStateRelativePath)).schemaVersion, '2.0.0');
  const ownText = '\nOwn text added after the migration.\n';
  for (const relativePath of ['CLAUDE.md', '.agents/project/quality-gate.md']) await fs.appendFile(path.join(target, relativePath), ownText);
  await fs.rm(path.join(target, applyJournalRelativePath));

  const plan = await buildRollbackPlan({ targetPath: target });
  const restores = plan.operations.filter((item) => item.action === 'restore');
  assert.ok(['CLAUDE.md', '.agents/project/quality-gate.md'].every((relativePath) => restores.some((item) => item.relativePath === relativePath)));
  const before = new Map(await Promise.all(restores.map(async (item) => [item.relativePath, await fs.readFile(item.targetFile)])));
  const restoredFrom = new Map(await Promise.all(restores.map(async (item) => [item.relativePath, await fs.readFile(item.backupPath)])));
  await applyRollbackPlan(plan);

  for (const item of restores) {
    assert.deepEqual(await fs.readFile(item.targetFile), restoredFrom.get(item.relativePath), item.relativePath);
    if (before.get(item.relativePath).equals(restoredFrom.get(item.relativePath))) continue;
    const copies = (await listBackups(target)).filter((backup) => backup.startsWith(`${item.relativePath}.workflow-kit-backup-`));
    const kept = await Promise.all(copies.map((backup) => fs.readFile(path.join(target, backup))));
    assert.ok(kept.some((content) => content.equals(before.get(item.relativePath))), `${item.relativePath}: its content before the rollback is kept`);
  }
});
