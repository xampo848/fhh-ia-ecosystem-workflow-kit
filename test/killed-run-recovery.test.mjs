// A run killed (SIGKILL) at the two points the journal does not cover: an
// apply between taking its lock and writing its journal, and a rollback after
// it deleted the journal and before it removed the folders and the lock.
// Running rollback again returns the tree exactly to what it was; a lock held
// by a live process still stops everything.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyJournalRelativePath, applyLockRelativePath } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { createMemoryIo, hashTree, makeTempRepo, trackTempPath } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'workflow-kit.mjs');
const preload = pathToFileURL(path.join(root, 'test/fixtures/apply-recovery/kill-point.mjs')).href;
const exists = (target, relativePath) => fs.lstat(path.join(target, relativePath)).then(() => true, () => false);

async function cli(args) {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, ...io.output };
}

function killedAt(point, args) {
  return new Promise((resolve) => {
    const run = spawn(process.execPath, ['--import', preload, bin, ...args], { env: { ...process.env, NODE_NO_WARNINGS: '1', WORKFLOW_KIT_TEST_KILL_AT: point } });
    const output = { stdout: '', stderr: '' };
    run.stdout.on('data', (chunk) => { output.stdout += chunk; });
    run.stderr.on('data', (chunk) => { output.stderr += chunk; });
    run.on('close', (code, signal) => resolve({ code, signal, ...output }));
  });
}

const initArgs = (target) => ['init', '--target', target, '--runtime', 'claude', '--apply', '--yes'];
const rollbackArgs = (target) => ['rollback', '--target', target, '--apply', '--yes'];

async function installedRepo() {
  const target = await makeTempRepo();
  assert.equal((await cli(initArgs(target))).code, 0);
  return target;
}

test('init killed between its lock and its journal: rollback returns the tree to before the run, no lock, no empty folders', async () => {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, 'README.md'), 'mine\n');
  const before = await hashTree(target);

  const stopped = await killedAt('before-journal', initArgs(target));
  assert.equal(stopped.signal, 'SIGKILL', stopped.stderr);
  assert.equal(await exists(target, applyJournalRelativePath), false, 'no journal was written');
  assert.equal(await exists(target, applyLockRelativePath), true);

  const dry = await cli(['rollback', '--target', target]);
  assert.equal(dry.code, 0, dry.stderr);
  assert.doesNotMatch(dry.stdout, /Nothing to roll back/);
  assert.match(dry.stdout, /stopped before it finished/);
  const afterDry = await hashTree(target);
  assert.equal(await exists(target, applyLockRelativePath), true, 'the dry run leaves the lock');
  assert.deepEqual(await hashTree(target), afterDry, 'the dry run changes nothing');

  const rollback = await cli(rollbackArgs(target));
  assert.equal(rollback.code, 0, rollback.stderr);
  assert.deepEqual(await hashTree(target), before);
  // Nothing is left to undo, and init works again.
  assert.match((await cli(rollbackArgs(target))).stdout, /Nothing to roll back/);
  assert.equal((await cli(initArgs(target))).code, 0);
});

test('init killed before its journal, then init again: it proceeds and its own rollback leaves no folder the first run made', async () => {
  const target = await makeTempRepo();
  const before = await hashTree(target);
  assert.equal((await killedAt('before-journal', initArgs(target))).signal, 'SIGKILL');
  const again = await cli(initArgs(target));
  assert.equal(again.code, 0, again.stderr);
  assert.equal((await cli(rollbackArgs(target))).code, 0);
  assert.deepEqual(await hashTree(target), before);
});

test('update killed between its lock and its journal: rollback only cleans up, the previous finished run is untouched and still rollbackable', async () => {
  const target = await installedRepo();
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOur team rule.\n');
  const finished = await hashTree(target);
  const journalBefore = await fs.readFile(path.join(target, applyJournalRelativePath), 'utf8');

  const stopped = await killedAt('before-journal', ['update', '--target', target, '--edited', '.agents/instructions.md=discard', '--apply', '--yes']);
  assert.equal(stopped.signal, 'SIGKILL', stopped.stderr);
  assert.equal(await exists(target, applyLockRelativePath), true);

  const dry = await cli(['rollback', '--target', target]);
  assert.match(dry.stdout, /stopped before it finished/);
  assert.match(dry.stdout, /not touched/);
  const cleaned = await cli(rollbackArgs(target));
  assert.equal(cleaned.code, 0, cleaned.stderr);
  assert.deepEqual(await hashTree(target), finished, 'only the lock and temporary files went');
  assert.equal(await fs.readFile(path.join(target, applyJournalRelativePath), 'utf8'), journalBefore, 'the previous journal is intact');

  // Now the previous run is the one rolled back, knowingly.
  const next = await cli(['rollback', '--target', target]);
  assert.match(next.stdout, /Undoes the last `init`/);
  assert.equal((await cli(rollbackArgs(target))).code, 0);
  assert.equal(await exists(target, applyJournalRelativePath), false);
  assert.equal(await exists(target, applyLockRelativePath), false);
  assert.equal(await exists(target, '.agents/workflow-kit'), false, 'the folders the install made are gone');
});

test('rollback of an init killed after it deleted its journal: the next rollback removes the folders and the lock', async () => {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, 'README.md'), 'mine\n');
  const before = await hashTree(target);
  assert.equal((await cli(initArgs(target))).code, 0);

  const stopped = await killedAt('after-journal-removed', rollbackArgs(target));
  assert.equal(stopped.signal, 'SIGKILL', stopped.stderr);
  assert.equal(await exists(target, applyJournalRelativePath), false);
  assert.equal(await exists(target, applyLockRelativePath), true);
  assert.equal(await exists(target, '.agents/workflow-kit'), true);

  const rollback = await cli(rollbackArgs(target));
  assert.equal(rollback.code, 0, rollback.stderr);
  assert.deepEqual(await hashTree(target), before);
  assert.match((await cli(rollbackArgs(target))).stdout, /Nothing to roll back/);
});

test('rollback of an update killed after it deleted its journal: the next rollback cleans up and the tree is the one from before that update', async () => {
  const target = await installedRepo();
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOur team rule.\n');
  const edited = await hashTree(target);
  assert.equal((await cli(['update', '--target', target, '--edited', '.agents/instructions.md=discard', '--apply', '--yes'])).code, 0);

  const stopped = await killedAt('after-journal-removed', rollbackArgs(target));
  assert.equal(stopped.signal, 'SIGKILL', stopped.stderr);
  assert.equal(await exists(target, applyJournalRelativePath), false);

  const cleaned = await cli(rollbackArgs(target));
  assert.equal(cleaned.code, 0, cleaned.stderr);
  const after = await hashTree(target);
  assert.equal(after[applyLockRelativePath], undefined, 'no lock');
  assert.deepEqual(Object.keys(after).filter((name) => name.includes('.workflow-kit-tmp-')), []);
  // What the update changed is undone (the journal's job); the install stays as the edited one.
  const { [applyJournalRelativePath]: _journal, ...withoutJournal } = after;
  const { [applyJournalRelativePath]: _edited, ...editedWithoutJournal } = edited;
  assert.deepEqual(withoutJournal, editedWithoutJournal);
});

test('a lock held by a live process still stops rollback, and nothing is cleaned', async () => {
  const target = await installedRepo();
  const lockPath = path.join(target, applyLockRelativePath);
  await fs.writeFile(lockPath, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), kind: 'apply', createdDirectories: ['.agents'] })}\n`);
  const before = await hashTree(target);
  for (const args of [['rollback', '--target', target], rollbackArgs(target)]) {
    const result = await cli(args);
    assert.equal(result.code, 2, result.stdout);
    assert.match(result.stderr, /Another workflow-kit run is changing this repository/);
  }
  assert.deepEqual(await hashTree(target), before);
});

async function deadPid() {
  const dead = spawn(process.execPath, ['-e', '']);
  await new Promise((resolve) => dead.on('close', resolve));
  return dead.pid;
}

const lockText = (record) => `${JSON.stringify({ startedAt: new Date().toISOString(), createdDirectories: [], ...record })}\n`;

test('the dry run of a leftovers rollback lists the lock, each temporary file and each folder, and apply removes exactly those', async () => {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, 'README.md'), 'mine\n');
  assert.equal((await killedAt('before-journal', initArgs(target))).signal, 'SIGKILL');
  const tmp = (await fs.readdir(path.join(target, '.agents/workflow-kit'))).filter((name) => name.startsWith('.workflow-kit-tmp-'));
  assert.equal(tmp.length, 1, 'the killed run left its temporary journal');
  const before = await hashTree(target);

  const dry = await cli(['rollback', '--target', target]);
  const listed = dry.stdout.split('\n').filter((line) => line.startsWith('remove ')).map((line) => line.replace(/^remove (folder )?(\S+) .*$/, '$2')).sort();
  assert.deepEqual(listed, [applyLockRelativePath, `.agents/workflow-kit/${tmp[0]}`, '.agents', '.agents/workflow-kit'].sort());
  assert.deepEqual(await hashTree(target), before, 'the dry run removes nothing');

  assert.equal((await cli(rollbackArgs(target))).code, 0);
  const after = await hashTree(target);
  const removed = Object.keys(before).filter((name) => !(name in after)).sort();
  assert.deepEqual(removed, listed);
});

test('journal ownership: only the same process, after taking the lock, owns the journal (pid reuse is not mistaken for it)', async () => {
  const dead = await deadPid();
  const cases = [
    { label: 'same pid, lock after the journal: leftovers only', pid: dead, journalPid: dead, lockOffsetMs: 60_000, leftovers: true },
    { label: 'same pid, lock before the journal: the journal is rolled back', pid: dead, journalPid: dead, lockOffsetMs: -60_000, leftovers: false },
    { label: 'other pid, lock before the journal: leftovers only', pid: dead, journalPid: dead + 1, lockOffsetMs: -60_000, leftovers: true }
  ];
  for (const { label, pid, journalPid, lockOffsetMs, leftovers } of cases) {
    const target = await installedRepo();
    const journalFile = path.join(target, applyJournalRelativePath);
    const journal = JSON.parse(await fs.readFile(journalFile, 'utf8'));
    journal.pid = journalPid;
    await fs.writeFile(journalFile, `${JSON.stringify(journal, null, 2)}\n`);
    const journalBytes = await fs.readFile(journalFile, 'utf8');
    const startedAt = new Date(Date.parse(journal.appliedAt) + lockOffsetMs).toISOString();
    await fs.writeFile(path.join(target, applyLockRelativePath), lockText({ pid, startedAt, kind: 'apply' }));

    const dry = await cli(['rollback', '--target', target]);
    assert.equal(dry.code, 0, `${label}: ${dry.stderr}`);
    if (leftovers) assert.match(dry.stdout, /does not undo any apply/, label);
    else assert.match(dry.stdout, /Undoes the last `init`/, label);
    assert.equal((await cli(rollbackArgs(target))).code, 0, label);
    assert.equal(await exists(target, applyLockRelativePath), false, label);
    if (leftovers) assert.equal(await fs.readFile(journalFile, 'utf8'), journalBytes, `${label}: the journal is untouched`);
    else assert.equal(await exists(target, applyJournalRelativePath), false, `${label}: the journal was rolled back`);
  }
});

test('a symlinked .agents holding a stale lock and temporary files: rollback refuses, dry run and apply, and deletes nothing behind the link', async () => {
  const target = await makeTempRepo();
  const outside = await makeTempRepo();
  await fs.mkdir(path.join(outside, 'workflow-kit'), { recursive: true });
  await fs.writeFile(path.join(outside, 'workflow-kit/apply.lock'), lockText({ pid: await deadPid(), kind: 'rollback', createdDirectories: ['.agents'] }));
  await fs.writeFile(path.join(outside, 'workflow-kit/.workflow-kit-tmp-1'), 'x');
  await fs.symlink(outside, path.join(target, '.agents'));
  const before = await hashTree(outside);
  const targetBefore = await hashTree(target);
  for (const args of [['rollback', '--target', target], rollbackArgs(target)]) {
    const result = await cli(args);
    assert.equal(result.code, 2, result.stdout);
    assert.match(result.stderr, /\.agents is a symbolic link, and workflow-kit will not write or delete through symbolic links/);
    assert.deepEqual(await hashTree(outside), before);
  }
  assert.deepEqual(await hashTree(target), targetBefore);
});

test('a hand-written stale lock never removes an empty folder that was already there, a link, or one outside the target', async () => {
  const dead = await deadPid();
  const target = await installedRepo();
  const sibling = trackTempPath(`${target}-sibling-empty`);
  await fs.mkdir(sibling);
  const emptyLinkTarget = trackTempPath(`${target}-empty-link-target`);
  await fs.mkdir(emptyLinkTarget);
  for (const folder of ['pre/empty', '.agents/emptydir', '.git/refs/tags', '.claude/agents/mine']) await fs.mkdir(path.join(target, folder), { recursive: true });
  await fs.symlink(emptyLinkTarget, path.join(target, 'linkdir'));
  await fs.mkdir(path.join(emptyLinkTarget, 'sub'));
  await fs.rm(path.join(target, applyJournalRelativePath));
  // One entry per lock: a lock with any bad entry is rejected whole, which
  // would hide the check on each of the others.
  const entries = ['pre/empty', '.agents/emptydir', '.git/refs/tags', '.claude/agents/mine', 'linkdir', 'linkdir/sub', `../${path.basename(sibling)}`];
  for (const kind of ['apply', 'rollback']) {
    for (const entry of entries) {
      await fs.writeFile(path.join(target, applyLockRelativePath), lockText({ pid: dead, kind, createdDirectories: [entry] }));
      const before = await hashTree(target);
      const result = await cli(rollbackArgs(target));
      assert.equal(result.code, 0, `${kind} ${entry}: ${result.stderr}`);
      const { [applyLockRelativePath]: _lock, ...expected } = before;
      assert.deepEqual(await hashTree(target), expected, `${kind} ${entry}: only the lock went`);
      assert.equal(await exists(sibling, '.'), true, `${kind} ${entry}`);
      assert.equal(await exists(emptyLinkTarget, 'sub'), true, `${kind} ${entry}`);
    }
  }
});

test('init after a stale lock from a rollback does not take over the folders that lock names', async () => {
  const target = await makeTempRepo();
  await fs.mkdir(path.join(target, 'pre/empty'), { recursive: true });
  await fs.mkdir(path.join(target, '.agents/workflow-kit'), { recursive: true });
  await fs.writeFile(path.join(target, applyLockRelativePath), lockText({ pid: await deadPid(), kind: 'rollback', createdDirectories: ['pre/empty'] }));
  assert.equal((await cli(initArgs(target))).code, 0);
  assert.equal((await cli(rollbackArgs(target))).code, 0);
  assert.equal(await exists(target, 'pre/empty'), true, 'a folder that was there before stays');
});

test('a journal-recorded folder behind a symbolic link is not removed by rollback', async () => {
  const target = await installedRepo();
  const outside = await makeTempRepo();
  await fs.mkdir(path.join(outside, 'sub'));
  await fs.symlink(outside, path.join(target, 'linkdir'));
  const journalFile = path.join(target, applyJournalRelativePath);
  const journal = JSON.parse(await fs.readFile(journalFile, 'utf8'));
  journal.createdDirectories = [...journal.createdDirectories, 'linkdir/sub'];
  await fs.writeFile(journalFile, `${JSON.stringify(journal, null, 2)}\n`);
  const result = await cli(rollbackArgs(target));
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await exists(outside, 'sub'), true, 'the empty folder behind the link stays');
});

test('a lock held by a live process also stops init and update', async () => {
  const installed = await installedRepo();
  // Something for the update to write, so it needs the lock.
  await fs.rm(path.join(installed, '.agents/capabilities/manifests/context7.md'));
  const fresh = await makeTempRepo();
  await fs.mkdir(path.join(fresh, '.agents/workflow-kit'), { recursive: true });
  for (const [target, args] of [[fresh, initArgs(fresh)], [installed, ['update', '--target', installed, '--apply', '--yes']]]) {
    await fs.writeFile(path.join(target, applyLockRelativePath), lockText({ pid: process.pid, kind: 'apply' }));
    const before = await hashTree(target);
    const result = await cli(args);
    assert.equal(result.code, 2, `${args[0]}: ${result.stdout}`);
    assert.match(result.stderr, /Another workflow-kit run is changing this repository/, args[0]);
    assert.deepEqual(await hashTree(target), before, args[0]);
  }
});

test('a stale lock names only what a kit run created: a rollback lock with real kit folders and a temporary file is cleaned', async () => {
  const target = await makeTempRepo();
  assert.equal((await cli(initArgs(target))).code, 0);
  const rollbackStopped = await killedAt('after-journal-removed', rollbackArgs(target));
  assert.equal(rollbackStopped.signal, 'SIGKILL');
  await fs.writeFile(path.join(target, '.agents/workflow-kit/.workflow-kit-tmp-424242'), 'x');
  assert.equal((await cli(rollbackArgs(target))).code, 0);
  assert.deepEqual(await hashTree(target), {});
});
