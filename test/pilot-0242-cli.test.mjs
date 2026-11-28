// CLI findings of the pilot run on 0.24.1 and the maintainer's decisions on
// them: a result line on every rollback, a deleted project file that update
// recreates, the consequence of --from-backups, doctor on a folder without the
// kit, and a dry run that summarizes what needs no attention.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan, applyJournalRelativePath } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { buildInstallPlan, buildUpdatePlan } from '../src/planner.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

async function installed(options = {}) {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, '.gitignore'), 'node_modules\n');
  await fs.writeFile(path.join(target, 'CLAUDE.md'), '# Own rules\n\nKeep this line.\n');
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude', ...options }));
  return target;
}

const cli = async (...args) => {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, ...io.output };
};
const lastLine = (text) => text.trimEnd().split('\n').at(-1);

test('every rollback ends with a result line a script can read, in a dry run too', async () => {
  const withJournal = await installed();
  assert.equal(lastLine((await cli('rollback', '--target', withJournal)).stdout), 'Result: dry-run (would be: rolled-back)');
  const rolledBack = await cli('rollback', '--target', withJournal, '--apply', '--yes');
  assert.equal(rolledBack.code, 0, rolledBack.stderr);
  assert.equal(lastLine(rolledBack.stdout), 'Result: rolled-back');

  const empty = await makeTempRepo();
  assert.equal(lastLine((await cli('rollback', '--target', empty)).stdout), 'Result: dry-run (would be: nothing-to-undo)');
  assert.equal(lastLine((await cli('rollback', '--target', empty, '--apply', '--yes')).stdout), 'Result: nothing-to-undo');

  const noJournal = await installed();
  await fs.rm(path.join(noJournal, applyJournalRelativePath));
  const dry = await cli('rollback', '--target', noJournal);
  assert.equal(dry.code, 0);
  assert.equal(lastLine(dry.stdout), 'Result: dry-run (would be: backups-not-restored)');
  const kept = await cli('rollback', '--target', noJournal, '--apply', '--yes');
  assert.equal(kept.code, 3);
  assert.equal(lastLine(kept.stdout), 'Result: backups-not-restored');
  assert.equal(lastLine((await cli('rollback', '--target', noJournal, '--from-backups')).stdout), 'Result: dry-run (would be: restored-from-backups)');
  const restored = await cli('rollback', '--target', noJournal, '--from-backups', '--apply', '--yes');
  assert.equal(restored.code, 0, restored.stderr);
  assert.equal(lastLine(restored.stdout), 'Result: restored-from-backups');
  assert.equal(lastLine((await cli('rollback', '--target', noJournal, '--from-backups', '--apply', '--yes')).stdout), 'Result: already-restored');

  const stale = await installed();
  await fs.rm(path.join(stale, applyJournalRelativePath));
  await fs.writeFile(path.join(stale, '.agents/workflow-kit/apply.lock'), `${JSON.stringify({ pid: 999999, startedAt: new Date().toISOString(), kind: 'apply', createdDirectories: [] })}\n`);
  assert.equal(lastLine((await cli('rollback', '--target', stale, '--apply', '--yes')).stdout), 'Result: cleaned-up');
});

test('rollback --from-backups says what it leaves behind: the kit stays, and restored adapters lose its block', async () => {
  const target = await installed();
  await fs.rm(path.join(target, applyJournalRelativePath));
  const dry = await cli('rollback', '--target', target, '--from-backups');
  assert.match(dry.stdout, /The kit stays installed: a restored adapter \(such as CLAUDE\.md\) or \.gitignore loses the kit block or lines the install added, and `workflow-kit doctor[^`]*` reports that until `workflow-kit update[^`]*` puts them back \(for an adapter, with --edited <path>=split, which keeps your text\)\./);
});

test('update recreates a project file that was deleted, and doctor says how to repair it', async () => {
  const target = await installed();
  const file = '.agents/project/frontend.md';
  await fs.rm(path.join(target, file));

  const doctor = await cli('doctor', '--target', target, '--runtime', 'claude');
  assert.equal(doctor.code, 1);
  assert.match(doctor.stdout, /Missing files:\n- \.agents\/project\/frontend\.md/);
  assert.match(doctor.stdout, /A project file is missing \(\.agents\/project\/frontend\.md\): run `workflow-kit update --target \S+` \(a dry run; then add --apply --yes\) to recreate it from its template\. If the project does not have a layer, keep its file with one line that says so\./);

  const plan = await buildUpdatePlan({ targetPath: target });
  assert.deepEqual(plan.operations.filter((item) => item.operation === 'create').map((item) => [item.relativePath, item.recreated]), [[file, true]]);
  const updated = await cli('update', '--target', target, '--apply', '--yes');
  assert.equal(updated.code, 0, updated.stderr);
  assert.match(await fs.readFile(path.join(target, file), 'utf8'), /workflow-kit:project-instructions:template/);
  assert.equal((await cli('doctor', '--target', target, '--runtime', 'claude')).code, 0);

  // A file that exists is still the project's: never rewritten.
  await fs.writeFile(path.join(target, file), 'This project has no frontend.\n');
  await cli('update', '--target', target, '--apply', '--yes');
  assert.equal(await fs.readFile(path.join(target, file), 'utf8'), 'This project has no frontend.\n');
});

test('doctor on a folder without the kit does not list every kit file as missing', async () => {
  const target = await makeTempRepo();
  const doctor = await cli('doctor', '--target', target, '--runtime', 'claude');
  assert.equal(doctor.code, 1);
  assert.match(doctor.stdout, /workflow-kit is not installed in this folder/);
  assert.match(doctor.stdout, /^Missing files: \d+ \(not listed: nothing of the kit is here\)$/m);
  assert.ok(doctor.stdout.split('\n').filter((line) => line.startsWith('- .agents/')).length === 0);
});

test('a plan summarizes the files that need no attention, and --all lists them', async () => {
  const target = await makeTempRepo();
  const dry = await cli('init', '--target', target, '--runtime', 'claude');
  assert.equal(dry.code, 0, dry.stderr);
  assert.match(dry.stdout, /^- create: \d+ file\(s\) \(add --all to list them\)$/m);
  assert.ok(dry.stdout.split('\n').filter((line) => line.startsWith('- create: .agents/')).length === 0);
  assert.ok(dry.stdout.split('\n').length < 40, `a summarized init plan is short (${dry.stdout.split('\n').length} lines)`);
  assert.match(dry.stdout, /^Summary: create=\d+/m);

  const all = await cli('init', '--target', target, '--runtime', 'claude', '--all');
  assert.ok(all.stdout.split('\n').filter((line) => line.startsWith('- create: .agents/')).length > 100);

  await cli('init', '--target', target, '--runtime', 'claude', '--apply', '--yes');
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nedited\n');
  const update = await cli('update', '--target', target);
  assert.match(update.stdout, /^- unchanged: \d+ file\(s\) \(add --all to list them\)$/m);
  assert.match(update.stdout, /^- skip_modified: \.agents\/instructions\.md /m);
  // Every project file the plan leaves alone is still named.
  assert.equal((update.stdout.match(/^- skip_unmanaged: \S+ \(project-owned; left as it is\)$/gm) ?? []).length, 5);

  const other = await cli('doctor', '--target', target, '--all');
  assert.notEqual(other.code, 0);
  assert.match(other.stderr, /--all does not apply to doctor/);
});

// Findings of the independent review of 0.24.2.
test('review: a plan always names the project files it recreates, however many files it creates', async () => {
  const target = await installed();
  const deleted = ['frontend.md', 'context.md', 'quality-gate.md', 'paths.json'].map((name) => `.agents/project/${name}`);
  for (const file of deleted) await fs.rm(path.join(target, file));
  const update = await cli('update', '--target', target);
  for (const file of deleted) {
    assert.match(update.stdout, new RegExp(`^- create: ${file.replace(/[.]/g, '\\.')} \\(project file that was deleted; created again from its template\\)$`, 'm'), file);
  }
  const doctor = await cli('doctor', '--target', target, '--runtime', 'claude');
  assert.match(doctor.stdout, /Project files are missing \(4\): run `workflow-kit update --target \S+` \(a dry run; then add --apply --yes\) to recreate them from their templates\./);
});

test('review: a rollback that fails partway still ends with a result line', async () => {
  const target = await installed();
  // A created file in a folder that cannot be written: removing it fails.
  const folder = path.join(target, '.agents/skills/00-router/workflow-router');
  await fs.chmod(folder, 0o555);
  try {
    const stopped = await cli('rollback', '--target', target, '--apply', '--yes');
    assert.notEqual(stopped.code, 0);
    const resultLines = stopped.stdout.split('\n').filter((line) => line.startsWith('Result: '));
    assert.deepEqual(resultLines, ['Result: failed']);
    assert.equal(lastLine(stopped.stdout), 'Result: failed');
  } finally {
    await fs.chmod(folder, 0o755);
  }
});

// Repair round after the pilot run on this branch.
test('repair: a plan names every kit file that install-state records and is missing from disk', async () => {
  const target = await installed();
  const deleted = ['.agents/instructions.md', '.agents/kit-boundary.md', '.agents/skills/index.md', '.agents/skills/00-router/workflow-router/SKILL.md', 'CLAUDE.md'];
  for (const file of deleted) await fs.rm(path.join(target, file));
  const update = await cli('update', '--target', target);
  for (const file of deleted) {
    assert.match(update.stdout, new RegExp(`^- create: ${file.replace(/[.]/g, '\\.')} \\(recorded as installed and missing from disk; created again\\)$`, 'm'), file);
  }
  // A fresh install has nothing recorded: its creates are still one line.
  const fresh = await makeTempRepo();
  const init = await cli('init', '--target', fresh, '--runtime', 'claude');
  assert.doesNotMatch(init.stdout, /recorded as installed and missing/);
  assert.match(init.stdout, /^- create: \d+ file\(s\) \(add --all to list them\)$/m);
});

test('repair: doctor counts instead of listing when no kit file is there, even next to an own CLAUDE.md', async () => {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, 'CLAUDE.md'), '# Own rules\n');
  const doctor = await cli('doctor', '--target', target, '--runtime', 'claude');
  assert.equal(doctor.code, 1);
  assert.match(doctor.stdout, /^Missing files: \d+ \(not listed: nothing of the kit is here\)$/m);
  assert.ok(doctor.stdout.split('\n').length < 40, `${doctor.stdout.split('\n').length} lines`);
});

test('repair: the help says what --all does and which results a rollback prints', async () => {
  for (const command of ['init', 'update', 'export']) {
    const help = await cli(command, '--help');
    assert.match(help.stdout, /--all lists every file/, command);
  }
  const general = await cli('--help');
  assert.match(general.stdout, /--all lists every file/);
  const rollback = await cli('rollback', '--help');
  assert.match(rollback.stdout, /Result: rolled-back, restored-from-backups, already-restored, cleaned-up, nothing-to-undo or backups-not-restored/);
  assert.match(rollback.stdout, /interrupted or failed/);
});

// Installer findings of the pilot run on 0.24.2.
test('0.25.0: a rollback with only older backups left says the project may already be fine, and what restoring them would undo', async () => {
  const target = await installed();
  assert.equal((await cli('rollback', '--target', target, '--apply', '--yes')).code, 0);
  // The journal is gone and the backups of the init stay: nothing more to undo.
  const reinstalled = await installed();
  await fs.rm(path.join(reinstalled, applyJournalRelativePath));
  const second = await cli('rollback', '--target', reinstalled, '--apply', '--yes');
  assert.equal(second.code, 3);
  assert.match(second.stdout, /If a rollback already succeeded here, the project is back in its previous state and there is nothing more to do\./);
  assert.match(second.stdout, /Restoring them takes each file back to an older copy: an adapter may lose the kit block or go back to an older one, which `workflow-kit update[^`]*` can put back with --edited <path>=split\./);
  assert.match(second.stderr, /Exit code 3: backups exist and none was restored\. That is expected after a rollback that already succeeded; add --from-backups only to go back to those older copies\./);
});

test('0.25.0: backups that already match their files have their own result word', async () => {
  const target = await installed();
  await fs.rm(path.join(target, applyJournalRelativePath));
  await cli('rollback', '--target', target, '--from-backups', '--apply', '--yes');
  assert.equal(lastLine((await cli('rollback', '--target', target, '--from-backups', '--apply', '--yes')).stdout), 'Result: already-restored');
  assert.equal(lastLine((await cli('rollback', '--target', target)).stdout), 'Result: dry-run (would be: already-restored)');
  const empty = await makeTempRepo();
  assert.equal(lastLine((await cli('rollback', '--target', empty, '--apply', '--yes')).stdout), 'Result: nothing-to-undo');
  assert.match((await cli('rollback', '--help')).stdout, /already-restored/);
});

test('0.25.0: doctor names the rollback first when the last apply did not finish', async () => {
  const target = await installed();
  const journalPath = path.join(target, applyJournalRelativePath);
  const journal = JSON.parse(await fs.readFile(journalPath, 'utf8'));
  await fs.writeFile(journalPath, `${JSON.stringify({ ...journal, completed: false }, null, 2)}\n`);
  await fs.rm(path.join(target, '.agents/kit-boundary.md'));
  const statePath = path.join(target, '.agents/workflow-kit/install-state.json');
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  await fs.writeFile(statePath, JSON.stringify({ ...state, toolkitVersion: '0.21.0' }, null, 2));
  const doctor = await cli('doctor', '--target', target, '--runtime', 'claude');
  assert.equal(doctor.code, 1);
  assert.doesNotMatch(doctor.stdout, /most likely new in/);
  const lines = doctor.stdout.split('\n');
  const hint = lines.findIndex((line) => line.startsWith('The last apply did not finish'));
  assert.ok(hint >= 0 && hint < lines.indexOf('Missing files:'), doctor.stdout.slice(0, 900));
  assert.match(lines[hint], /run `workflow-kit rollback --target \S+ --apply --yes` first; update and init stop until then/);
});

test('0.25.0: the plan says an adapter update touches only the kit block, and the stack pack finding names a command', async () => {
  const target = await installed();
  const adapter = path.join(target, 'CLAUDE.md');
  const statePath = path.join(target, '.agents/workflow-kit/install-state.json');
  // An older block: the kit version replaces it, and only it.
  const original = await fs.readFile(adapter, 'utf8');
  const older = original.replace('1–2 production files', '1–2 files');
  assert.notEqual(older, original);
  await fs.writeFile(adapter, older);
  const { extractManagedBlock } = await import('../src/kit-manifest.mjs');
  const { checksumOf } = await import('../src/fs-safety.mjs');
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  state.files['CLAUDE.md'].sha256 = checksumOf(extractManagedBlock(older, 'workflow-kit:managed').block);
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  const update = await cli('update', '--target', target);
  assert.match(update.stdout, /^- overwrite_no_backup: CLAUDE\.md \(only its kit block changes; the rest of the file stays\)$|^- overwrite_with_backup: CLAUDE\.md \(only its kit block changes; the rest of the file stays\)$/m);

  const withPack = await makeTempRepo();
  await cli('init', '--target', withPack, '--runtime', 'claude', '--stack', 'rails-react', '--apply', '--yes');
  await fs.rm(path.join(withPack, '.agents/project/stack.md'));
  const doctor = await cli('doctor', '--target', withPack, '--runtime', 'claude');
  assert.match(doctor.stdout, /stack-pack\/missing[^\n]*restore `\.agents\/project\/stack\.md` from Git \(`git checkout -- \.agents\/project\/stack\.md`\)/);
  assert.doesNotMatch(doctor.stdout, /again by hand/);
});

test('review 0.25.0: doctor words an interrupted rollback as a rollback, not as an apply', async () => {
  const target = await installed();
  const journalPath = path.join(target, applyJournalRelativePath);
  const journal = JSON.parse(await fs.readFile(journalPath, 'utf8'));
  await fs.writeFile(journalPath, `${JSON.stringify({ ...journal, rollbackStartedAt: new Date().toISOString() }, null, 2)}\n`);
  await fs.rm(path.join(target, '.agents/kit-boundary.md'));
  const doctor = await cli('doctor', '--target', target, '--runtime', 'claude');
  assert.doesNotMatch(doctor.stdout, /^The last apply did not finish/m);
  assert.match(doctor.stdout, /^A rollback did not finish, so the files below may be ones it already removed: run `workflow-kit rollback --target \S+ --apply --yes` again first; update and init stop until then\.$/m);
});
