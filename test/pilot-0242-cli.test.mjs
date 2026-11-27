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
  assert.equal(lastLine((await cli('rollback', '--target', noJournal, '--from-backups', '--apply', '--yes')).stdout), 'Result: nothing-to-undo');

  const stale = await installed();
  await fs.rm(path.join(stale, applyJournalRelativePath));
  await fs.writeFile(path.join(stale, '.agents/workflow-kit/apply.lock'), `${JSON.stringify({ pid: 999999, startedAt: new Date().toISOString(), kind: 'apply', createdDirectories: [] })}\n`);
  assert.equal(lastLine((await cli('rollback', '--target', stale, '--apply', '--yes')).stdout), 'Result: cleaned-up');
});

test('rollback --from-backups says what it leaves behind: the kit stays, and restored adapters lose its block', async () => {
  const target = await installed();
  await fs.rm(path.join(target, applyJournalRelativePath));
  const dry = await cli('rollback', '--target', target, '--from-backups');
  assert.match(dry.stdout, /The kit stays installed: a restored adapter \(such as CLAUDE\.md\) or \.gitignore loses the kit block or lines the install added, and `workflow-kit doctor[^`]*` reports that until `workflow-kit update[^`]*` puts them back\./);
});

test('update recreates a project file that was deleted, and doctor says how to repair it', async () => {
  const target = await installed();
  const file = '.agents/project/frontend.md';
  await fs.rm(path.join(target, file));

  const doctor = await cli('doctor', '--target', target, '--runtime', 'claude');
  assert.equal(doctor.code, 1);
  assert.match(doctor.stdout, /Missing files:\n- \.agents\/project\/frontend\.md/);
  assert.match(doctor.stdout, /A project file is missing \(\.agents\/project\/frontend\.md\): run `workflow-kit update --target \S+ --apply --yes` to recreate it from its template\. If the project does not have that layer, keep the file with one line that says so\./);

  const plan = await buildUpdatePlan({ targetPath: target });
  assert.deepEqual(plan.operations.filter((item) => item.operation === 'create').map((item) => item.relativePath), [file]);
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
  assert.match(update.stdout, /^- skip_unmanaged: \d+ file\(s\) \(project-owned; left as they are; add --all to list them\)$/m);

  const other = await cli('doctor', '--target', target, '--all');
  assert.notEqual(other.code, 0);
  assert.match(other.stderr, /--all does not apply to doctor/);
});
