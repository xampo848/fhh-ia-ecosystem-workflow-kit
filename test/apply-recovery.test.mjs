// Robustness of apply and rollback (and the plan checks that keep an apply
// from stopping halfway): a run stopped at any point is recorded and undone
// exactly, rollback never leaves an unfinished journal behind, a run with
// nothing to change writes nothing, a state a newer kit wrote is never
// downgraded, two runs never interleave, and names the file system refuses
// are reported before anything is written.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyInstallPlan, applyJournalRelativePath, applyLockRelativePath } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { buildInstallPlan, buildUpdatePlan, installStateRelativePath } from '../src/planner.mjs';
import { applyRollbackPlan, buildRollbackPlan, formatRollbackPlan } from '../src/rollback.mjs';
import { installLegacy0181 } from './fixtures/legacy-0.18.1/install.mjs';
import { createMemoryIo, hashTree, makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'workflow-kit.mjs');
const interruptPreload = pathToFileURL(path.join(root, 'test/fixtures/apply-recovery/interrupt.mjs')).href;
const sha = (content) => createHash('sha256').update(content).digest('hex');
const read = (target, relativePath) => fs.readFile(path.join(target, relativePath), 'utf8');
const readJson = async (target, relativePath) => JSON.parse(await read(target, relativePath));
const exists = (target, relativePath) => fs.lstat(path.join(target, relativePath)).then(() => true, () => false);
async function write(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function cli(args) {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, ...io.output };
}

// The CLI in its own process, with the interrupt preload.
function child(args, env = {}) {
  return new Promise((resolve) => {
    const run = spawn(process.execPath, ['--import', interruptPreload, bin, ...args], { env: { ...process.env, NODE_NO_WARNINGS: '1', ...env } });
    const output = { stdout: '', stderr: '' };
    run.stdout.on('data', (chunk) => { output.stdout += chunk; });
    run.stderr.on('data', (chunk) => { output.stderr += chunk; });
    run.on('close', (code, signal) => resolve({ code, signal, ...output }));
  });
}

const withoutJournal = (tree) => Object.fromEntries(Object.entries(tree).filter(([relativePath]) => relativePath !== applyJournalRelativePath));
const interruptSignals = ['SIGINT', 'SIGTERM', 'SIGKILL'];

function assertStopped(result, signal, label) {
  // Ctrl-C and SIGTERM stop the run between two files (exit 130 and 143);
  // SIGKILL ends the process where it is.
  if (signal === 'SIGKILL') assert.equal(result.signal, 'SIGKILL', `${label}: ${result.stderr}`);
  else {
    assert.equal(result.code, { SIGINT: 130, SIGTERM: 143 }[signal], `${label}: ${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /workflow-kit rollback --apply --yes/, label);
  }
}

// After a stopped run: the journal says it did not finish, update stops on
// it, and rollback gives back the tree from before the run.
async function assertRecoverable(target, before, label) {
  const journal = await readJson(target, applyJournalRelativePath);
  assert.equal(journal.completed, false, label);
  assert.equal(journal.mode, 'update', label);
  const blocked = await cli(['update', '--target', target]);
  assert.equal(blocked.code, 2, label);
  assert.match(blocked.stderr, /The last workflow-kit apply did not finish/, label);
  const rollback = await cli(['rollback', '--target', target, '--apply', '--yes']);
  assert.equal(rollback.code, 0, `${label}: ${rollback.stderr}`);
  assert.match(rollback.stdout, /which did not finish/, label);
  assert.deepEqual(await hashTree(target), before, `${label}: rollback gives back the tree from before the run`);
  assert.equal((await cli(['update', '--target', target])).code, 0, `${label}: update runs again`);
}

// Item 1: a plain update.
test('an update stopped by SIGINT, SIGTERM or SIGKILL halfway is recorded before its first write; update stops and rollback undoes exactly that run', async () => {
  for (const signal of interruptSignals) {
    const target = await makeTempRepo();
    assert.equal((await cli(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes'])).code, 0);
    await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOur team rule.\n');
    const delegation = (await fs.readdir(path.join(target, '.agents/delegation'))).sort().slice(0, 4);
    for (const name of delegation) await fs.rm(path.join(target, '.agents/delegation', name), { recursive: true });
    const before = await hashTree(target);

    const stopped = await child(['update', '--target', target, '--edited', '.agents/instructions.md=discard', '--apply', '--yes'], {
      WORKFLOW_KIT_TEST_INTERRUPT_AFTER: '2',
      WORKFLOW_KIT_TEST_INTERRUPT_SIGNAL: signal
    });
    // Not the init journal: rollback must not plan to remove every installed file.
    const journal = await readJson(target, applyJournalRelativePath);
    assert.equal(journal.completed, false, `${signal}: the journal of the stopped run`);
    assertStopped(stopped, signal, signal);
    assert.ok(journal.files.some((entry) => entry.relativePath === '.agents/instructions.md'), signal);
    assert.equal(journal.files.length, delegation.length + 1, signal);
    assert.equal(await exists(target, applyLockRelativePath), signal !== 'SIGKILL' ? false : true, `${signal}: the lock`);
    await assertRecoverable(target, withoutJournal(before), signal);
  }
});

// Item 1: the layout migration from a 0.18 install.
test('the layout migration stopped by SIGINT, SIGTERM or SIGKILL halfway is recorded; rollback gives back the 0.18 tree exactly', async () => {
  for (const signal of interruptSignals) {
    const target = await makeTempRepo();
    await installLegacy0181(target, { runtimes: ['claude'] });
    const before = await hashTree(target);

    const stopped = await child(['update', '--target', target, '--apply', '--yes'], {
      WORKFLOW_KIT_TEST_INTERRUPT_AFTER: '3',
      WORKFLOW_KIT_TEST_INTERRUPT_SIGNAL: signal
    });
    // The 1.0.0 install had no journal: the stopped run wrote one.
    assert.equal(await exists(target, applyJournalRelativePath), true, `${signal}: the journal of the stopped run`);
    assertStopped(stopped, signal, signal);
    const journal = await readJson(target, applyJournalRelativePath);
    assert.ok(journal.files.some((entry) => entry.action === 'deleted'), `${signal}: the moves are listed`);
    assert.equal(journal.stateWritten, false, signal);
    // The 1.0.0 state is still there: the run stopped before writing it.
    assert.equal((await readJson(target, installStateRelativePath)).schemaVersion, '1.0.0', signal);
    const dryRun = await cli(['rollback', '--target', target]);
    assert.doesNotMatch(dryRun.stdout, /Nothing to roll back/, signal);
    await assertRecoverable(target, before, signal);
  }
});

// Item 2.
test('rollback of an unfinished apply whose created file the user already removed clears the journal, so update runs again', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  await fs.rm(path.join(target, '.agents/README.md'));
  await fs.rm(path.join(target, 'docs/workflow/standards/backend.md'));
  const plan = await buildUpdatePlan({ targetPath: target });
  // The second write fails: its folder became read-only after the plan.
  const standards = path.join(target, 'docs/workflow/standards');
  await fs.chmod(standards, 0o555);
  try {
    await assert.rejects(applyInstallPlan(plan), { code: 'EACCES' });
  } finally {
    await fs.chmod(standards, 0o755);
  }
  assert.equal(await exists(target, '.agents/README.md'), true, 'the first write happened');
  assert.equal((await readJson(target, applyJournalRelativePath)).completed, false);
  // The user removes what the run wrote, by hand.
  await fs.rm(path.join(target, '.agents/README.md'));
  assert.equal((await cli(['update', '--target', target])).code, 2);

  const rollback = await cli(['rollback', '--target', target, '--apply', '--yes']);
  assert.equal(rollback.code, 0, rollback.stderr);
  assert.doesNotMatch(rollback.stdout, /Nothing to roll back/);
  assert.match(rollback.stdout, /no file needs restoring or removing/);
  assert.equal(await exists(target, applyJournalRelativePath), false, 'the unfinished journal is gone');
  const update = await cli(['update', '--target', target]);
  assert.equal(update.code, 0, update.stderr);
});

// Item 4.
test('an update with nothing to change writes nothing, install-state included, and says so', async () => {
  const target = await makeTempRepo();
  assert.equal((await cli(['init', '--target', target, '--runtime', 'claude,copilot', '--apply', '--yes'])).code, 0);
  const before = await hashTree(target);
  for (const run of ['first', 'second']) {
    const update = await cli(['update', '--target', target, '--apply', '--yes']);
    assert.equal(update.code, 0, update.stderr);
    assert.match(update.stdout, /^Updated writes: 0$/m, run);
    assert.deepEqual(await hashTree(target), before, `${run} update leaves the tree as it is`);
  }
});

// Item 5.
test('a state a newer kit wrote stops update before planning, so no newer file is deleted or replaced', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const futureSkill = '.agents/skills/04-crosscutting/future-skill/SKILL.md';
  const futureContent = '---\nname: future-skill\n---\nShipped by a newer kit.\n';
  await write(target, futureSkill, futureContent);
  const state = await readJson(target, installStateRelativePath);
  state.toolkitVersion = '99.0.0-future';
  state.files[futureSkill] = { sha256: sha(futureContent), class: 'kit' };
  await write(target, installStateRelativePath, `${JSON.stringify(state, null, 2)}\n`);
  const before = await hashTree(target);

  for (const args of [['update', '--target', target], ['update', '--target', target, '--apply', '--yes']]) {
    const result = await cli(args);
    assert.equal(result.code, 2, result.stdout);
    assert.match(result.stderr, /was written by workflow-kit 99\.0\.0-future, newer than this CLI/);
    assert.match(result.stderr, /workflow-kit upgrade --apply --yes/);
    assert.match(result.stderr, /Nothing was written\./);
  }
  assert.deepEqual(await hashTree(target), before);
});

// Item 6.
test('an apply stops while another run holds the target, and takes over a lock its process left behind', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOur edit.\n');
  // Planned before the other run took the lock (this process stands for it).
  const plan = await buildUpdatePlan({ targetPath: target, edited: { '.agents/instructions.md': 'discard' } });
  await write(target, applyLockRelativePath, `${JSON.stringify({ pid: process.pid, startedAt: '2026-01-01T00:00:00.000Z' })}\n`);
  const before = await hashTree(target);

  await assert.rejects(applyInstallPlan(plan), (error) => error.code === 'WORKFLOW_KIT_LOCKED' && /Another workflow-kit run is changing this repository/.test(error.message));
  assert.deepEqual(await hashTree(target), before, 'nothing written, no backup taken');
  // A dry run only reads: the lock does not stop it; the apply stops.
  const planned = await cli(['update', '--target', target]);
  assert.equal(planned.code, 0, planned.stderr);
  const applied = await cli(['update', '--target', target, '--edited', '.agents/instructions.md=discard', '--apply', '--yes']);
  assert.equal(applied.code, 2);
  assert.match(applied.stderr, /Another workflow-kit run is changing this repository/);
  assert.deepEqual(await hashTree(target), before);

  // The process that held it is gone: its lock is taken over and released.
  const gone = spawnSync(process.execPath, ['-e', '']).pid;
  await write(target, applyLockRelativePath, `${JSON.stringify({ pid: gone, startedAt: '2026-01-01T00:00:00.000Z' })}\n`);
  await applyInstallPlan(await buildUpdatePlan({ targetPath: target, edited: { '.agents/instructions.md': 'discard' } }));
  assert.equal(await exists(target, applyLockRelativePath), false);
  assert.equal((await readJson(target, applyJournalRelativePath)).completed, true);
});

test('two applies started on the same target: the second stops and the first keeps its only backup', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const edited = `${await read(target, '.agents/instructions.md')}\nOur edit.\n`;
  await write(target, '.agents/instructions.md', edited);
  const args = ['update', '--target', target, '--edited', '.agents/instructions.md=discard', '--apply', '--yes'];

  // The first run is slow to copy its backup; the second starts once the
  // first holds the lock (or, without a lock, while it is still writing).
  const first = child(args, { WORKFLOW_KIT_TEST_COPY_DELAY: '3000' });
  for (let wait = 0; wait < 60 && !(await exists(target, applyLockRelativePath)); wait += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  const second = await child(args);
  const firstResult = await first;

  assert.equal(firstResult.code, 0, firstResult.stderr);
  assert.equal(second.code, 2, second.stdout);
  assert.match(second.stderr, /Another workflow-kit run is changing this repository/);
  const backups = (await fs.readdir(path.join(target, '.agents'))).filter((name) => name.startsWith('instructions.md.workflow-kit-backup-'));
  assert.equal(backups.length, 1, backups.join(', '));
  assert.equal(await read(target, `.agents/${backups[0]}`), edited, 'the backup holds the edit');
});

// Item 7.
test('a name the file system would refuse (with its backup suffix) stops the plan before anything is written', async () => {
  const target = await makeTempRepo();
  const legacy = await installLegacy0181(target, { runtimes: ['claude'] });
  const longName = `${'n'.repeat(230)}.md`;
  await write(target, `${legacy.localSkill.oldDir}/references/${longName}`, 'Notes with a long name.\n');
  const before = await hashTree(target);

  await assert.rejects(buildUpdatePlan({ targetPath: target }), /These paths are too long for this file system[\s\S]*references\/n+\.md: the name of its backup is longer than 255 bytes[\s\S]*Nothing was written\./);
  const applied = await cli(['update', '--target', target, '--apply', '--yes']);
  assert.equal(applied.code, 2);
  assert.match(applied.stderr, /too long/);
  assert.deepEqual(await hashTree(target), before);
});

test('rollback of the migration keeps an empty folder the user had before it', async () => {
  const target = await makeTempRepo();
  await installLegacy0181(target, { runtimes: ['claude'] });
  await fs.mkdir(path.join(target, '.agents/project/skills'), { recursive: true });
  await fs.mkdir(path.join(target, 'docs/empty-before'), { recursive: true });
  const before = await hashTree(target);
  await applyInstallPlan(await buildUpdatePlan({ targetPath: target }));
  assert.ok(await exists(target, '.agents/project/skills/retry-policy/SKILL.md'));

  await applyRollbackPlan(await buildRollbackPlan({ targetPath: target }));
  assert.deepEqual(await hashTree(target), before);
});

test('--target that is a file or does not exist is named as such; init does not create a missing folder, export does', async () => {
  const parent = await makeTempRepo();
  const file = path.join(parent, 'a-file');
  await fs.writeFile(file, 'text\n');
  const missing = path.join(parent, 'missing');
  for (const args of [['init', '--target', file], ['update', '--target', file], ['rollback', '--target', file]]) {
    const result = await cli(args);
    assert.equal(result.code, 2, args.join(' '));
    assert.match(result.stderr, /is a file, not a folder\. Check --target\./, args.join(' '));
  }
  for (const args of [['init', '--target', missing, '--apply', '--yes'], ['update', '--target', missing], ['rollback', '--target', missing]]) {
    const result = await cli(args);
    assert.equal(result.code, 2, args.join(' '));
    assert.match(result.stderr, /does not exist\. Check --target/, args.join(' '));
    assert.doesNotMatch(result.stderr, /adopt-existing/, args.join(' '));
  }
  assert.equal(await exists(parent, 'missing'), false, 'init creates no folder');
  const exported = await cli(['export', '--output', missing, '--apply', '--yes']);
  assert.equal(exported.code, 0, exported.stderr);
  assert.ok(await exists(parent, 'missing/.agents/instructions.md'));
});

test('a damaged state value is named with the state file, never read as something else', async () => {
  const cases = [
    { change: (state) => ({ ...state, runtimes: 'claude' }), message: /records runtimes as "claude", not as a list of runtime names/ },
    { change: (state) => ({ ...state, stackPack: 'bogus' }), message: /records the stack pack "bogus", and this CLI knows none, rails-react/ },
    { change: (state) => ({ ...state, modelProfiles: { claude: 'bogus' } }), message: /records the model profiles claude="bogus", and this CLI knows calidad, equilibrado, costo/ }
  ];
  for (const { change, message } of cases) {
    const target = await makeTempRepo();
    await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
    await write(target, installStateRelativePath, `${JSON.stringify(change(await readJson(target, installStateRelativePath)), null, 2)}\n`);
    const result = await cli(['update', '--target', target]);
    assert.equal(result.code, 2, String(message));
    assert.ok(result.stderr.startsWith(`${installStateRelativePath} `), result.stderr);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stderr, /--stack value/);
  }
});

test('exporting twice to the same folder writes nothing the second time', async () => {
  const output = path.join(await makeTempRepo(), 'export');
  assert.equal((await cli(['export', '--output', output, '--apply', '--yes'])).code, 0);
  const before = await hashTree(output);
  const again = await cli(['export', '--output', output, '--apply', '--yes']);
  assert.equal(again.code, 0, again.stderr);
  assert.match(again.stdout, /^Exported files: 0$/m);
  assert.equal(await exists(output, 'docs/workflow/migration/legacy-docs-map.md'), false);
  assert.deepEqual(await hashTree(output), before);
});

test('upgrade as a dry run without bun prints the plan and a note instead of stopping', async () => {
  const result = await new Promise((resolve) => {
    const run = spawn(process.execPath, [bin, 'upgrade'], { env: { ...process.env, PATH: '', NODE_NO_WARNINGS: '1' } });
    const output = { stdout: '', stderr: '' };
    run.stdout.on('data', (chunk) => { output.stdout += chunk; });
    run.stderr.on('data', (chunk) => { output.stderr += chunk; });
    run.on('close', (code) => resolve({ code, ...output }));
  });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /^Toolkit upgrade dry-run plan$/m);
  assert.match(result.stdout, /^Note: bun is required in PATH for toolkit upgrade\. Install it before running this command with --apply --yes\.$/m);
});

// Repair round, should-fix 1: a second run that planned before the first one
// applied stops under the lock instead of replacing the first run's journal.
test('a run planned before another run applied stops under the lock, so rollback still undoes the first run', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOur edit.\n');
  const before = await hashTree(target);
  const decisions = { edited: { '.agents/instructions.md': 'discard' } };
  const first = await buildUpdatePlan({ targetPath: target, ...decisions });
  const second = await buildUpdatePlan({ targetPath: target, ...decisions });
  await applyInstallPlan(first);
  const afterFirst = await hashTree(target);

  await assert.rejects(applyInstallPlan(second), (error) => error.code === 'WORKFLOW_KIT_PLAN_STALE'
    && /changed after this plan was made: another workflow-kit run changed this repository in between\. Run this command again/.test(error.message));
  assert.deepEqual(await hashTree(target), afterFirst, 'the second run wrote nothing');
  await applyRollbackPlan(await buildRollbackPlan({ targetPath: target }));
  assert.deepEqual(await hashTree(target), withoutJournal(before), 'rollback undoes the first run: the edit is back');
});

// Repair round, should-fix 2.
test('a rollback killed in the middle of restoring a file leaves the file whole and stays recorded; the next rollback finishes', async () => {
  const target = await makeTempRepo();
  assert.equal((await cli(['init', '--target', target, '--runtime', 'neutral', '--apply', '--yes'])).code, 0);
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOur team rule.\n');
  const before = await hashTree(target);
  assert.equal((await cli(['update', '--target', target, '--edited', '.agents/instructions.md=discard', '--apply', '--yes'])).code, 0);
  const written = await read(target, '.agents/instructions.md');

  const killed = await child(['rollback', '--target', target, '--apply', '--yes'], { WORKFLOW_KIT_TEST_KILL_IN_COPY: '1' });
  assert.equal(killed.signal, 'SIGKILL', killed.stderr);
  assert.equal(await read(target, '.agents/instructions.md'), written, 'never half-written');
  assert.equal((await readJson(target, applyJournalRelativePath)).completed, true, 'the journal stays');
  const again = await cli(['rollback', '--target', target, '--apply', '--yes']);
  assert.equal(again.code, 0, again.stderr);
  assert.doesNotMatch(again.stdout, /^keep /m);
  assert.deepEqual(await hashTree(target), withoutJournal(before));
});

test('Ctrl-C during a rollback stops it between two files (exit 130); its journal stays and the next rollback finishes', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const before = await hashTree(target);
  for (const name of (await fs.readdir(path.join(target, '.agents/delegation'))).sort().slice(0, 2)) {
    await fs.appendFile(path.join(target, '.agents/delegation', name), '\nOur edit.\n');
  }
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOur edit.\n');
  const edited = await hashTree(target);
  assert.equal((await cli(['update', '--target', target, '--edited', 'all=discard', '--apply', '--yes'])).code, 0);

  const stopped = await child(['rollback', '--target', target, '--apply', '--yes'], { WORKFLOW_KIT_TEST_INTERRUPT_AFTER: '1', WORKFLOW_KIT_TEST_INTERRUPT_SIGNAL: 'SIGINT' });
  assert.equal(stopped.code, 130, `${stopped.stdout}\n${stopped.stderr}`);
  assert.match(stopped.stderr, /rollback stopped between two files\. Its journal stays/);
  assert.equal(await exists(target, applyJournalRelativePath), true);
  const again = await cli(['rollback', '--target', target, '--apply', '--yes']);
  assert.equal(again.code, 0, again.stderr);
  assert.deepEqual(await hashTree(target), withoutJournal(edited));
  assert.notDeepEqual(edited, before);
});

// Repair round, minor items.
test('a lock that cannot be a running workflow-kit is taken over: empty, or its process id reused by another process', async () => {
  for (const [name, content] of [
    ['empty lock', ''],
    ['half-written lock', '{"pid": '],
    ['process id reused', `${JSON.stringify({ pid: process.pid, processStartedAt: Date.parse('2000-01-01T00:00:00Z'), startedAt: '2000-01-01T00:00:00.000Z' })}\n`]
  ]) {
    const target = await makeTempRepo();
    await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
    await fs.rm(path.join(target, '.agents/README.md'));
    await write(target, applyLockRelativePath, content);
    const update = await cli(['update', '--target', target, '--apply', '--yes']);
    assert.equal(update.code, 0, `${name}: ${update.stderr}`);
    assert.equal(await exists(target, '.agents/README.md'), true, name);
    assert.equal(await exists(target, applyLockRelativePath), false, name);
  }
});

test('the lock of a running process does not stop a dry run or doctor', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  await write(target, applyLockRelativePath, `${JSON.stringify({ pid: process.pid, startedAt: '2026-01-01T00:00:00.000Z' })}\n`);
  assert.equal((await cli(['update', '--target', target])).code, 0);
  assert.equal((await cli(['rollback', '--target', target])).code, 2, 'a rollback dry run while a run writes would describe a run in progress');
  const doctor = await cli(['doctor', '--target', target]);
  assert.doesNotMatch(doctor.stderr, /Another workflow-kit run/);
  assert.doesNotMatch(doctor.stdout, /Another workflow-kit run/);
});

test('temporary files a killed run left in .agents/workflow-kit are removed by the next run, and the lock and those names are git-ignored', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const gitignore = await read(target, '.gitignore');
  assert.match(gitignore, /^\/\.agents\/workflow-kit\/apply\.lock$/m);
  assert.match(gitignore, /^\.workflow-kit-tmp-\*$/m);
  const gone = spawnSync(process.execPath, ['-e', '']).pid;
  await write(target, `.agents/workflow-kit/.workflow-kit-tmp-${gone}`, '{"half": ');
  await fs.rm(path.join(target, '.agents/README.md'));
  assert.equal((await cli(['update', '--target', target, '--apply', '--yes'])).code, 0);
  assert.equal(await exists(target, `.agents/workflow-kit/.workflow-kit-tmp-${gone}`), false);
});

test('rolling back a journal written before 0.23.2 leaves no empty .agents/workflow-kit behind', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const journal = await readJson(target, applyJournalRelativePath);
  delete journal.pid;
  delete journal.createdDirectories;
  for (const entry of journal.files) delete entry.previousChecksum;
  await write(target, applyJournalRelativePath, `${JSON.stringify(journal, null, 2)}\n`);
  await applyRollbackPlan(await buildRollbackPlan({ targetPath: target }));
  assert.deepEqual(await fs.readdir(target), []);
});

test('a .agents/workflow-kit that cannot be written is named, not a raw EACCES', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  await fs.rm(path.join(target, '.agents/README.md'));
  const folder = path.join(target, '.agents/workflow-kit');
  await fs.chmod(folder, 0o555);
  try {
    const update = await cli(['update', '--target', target, '--apply', '--yes']);
    assert.equal(update.code, 2);
    assert.match(update.stderr, /^Cannot write \.agents\/workflow-kit\/apply\.lock \(EACCES\): workflow-kit writes there while it changes the repository\. Make \.agents\/workflow-kit\/ writable/m);
  } finally {
    await fs.chmod(folder, 0o755);
  }
  assert.equal(await exists(target, '.agents/README.md'), false);
});

test('a state from a newer kit with a stack pack or runtime this CLI does not know says to upgrade, not that it is damaged', async () => {
  for (const change of [{ stackPack: 'future-pack' }, { runtimes: ['future-runtime'] }]) {
    const target = await makeTempRepo();
    await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
    await write(target, installStateRelativePath, `${JSON.stringify({ ...(await readJson(target, installStateRelativePath)), toolkitVersion: '99.0.0', ...change }, null, 2)}\n`);
    const result = await cli(['update', '--target', target]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /was written by workflow-kit 99\.0\.0, newer than this CLI/, JSON.stringify(change));
  }
});

test('rollback keeps a copy of an install-state edited after the run, and names a file removed after it as removed', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOur edit.\n');
  const previousState = await read(target, installStateRelativePath);
  assert.equal((await cli(['update', '--target', target, '--profile', 'claude=costo', '--edited', '.agents/instructions.md=discard', '--apply', '--yes'])).code, 0);
  const editedState = `${JSON.stringify({ ...(await readJson(target, installStateRelativePath)), note: 'edited by hand' }, null, 2)}\n`;
  await write(target, installStateRelativePath, editedState);
  await fs.rm(path.join(target, '.agents/instructions.md'));

  const plan = await buildRollbackPlan({ targetPath: target });
  const text = formatRollbackPlan(plan);
  assert.match(text, /^keep \.agents\/instructions\.md \(removed after the last apply; not touched; its backup instructions\.md\.workflow-kit-backup-\d{8}T\d{6}Z stays\)$/m);
  assert.match(text, /edited after that run, so its current content is kept first as a -before-rollback copy/);
  await applyRollbackPlan(plan);
  assert.equal(await read(target, installStateRelativePath), previousState);
  const copies = (await fs.readdir(path.join(target, '.agents/workflow-kit'))).filter((name) => name.endsWith('-before-rollback'));
  assert.equal(copies.length, 1);
  assert.equal(await read(target, `.agents/workflow-kit/${copies[0]}`), editedState);
});

test('the rollback plan names the run it undoes; for an init it says the install itself goes', async () => {
  const target = await makeTempRepo();
  assert.equal((await cli(['init', '--target', target, '--runtime', 'neutral', '--apply', '--yes'])).code, 0);
  const dryRun = await cli(['rollback', '--target', target]);
  assert.match(dryRun.stdout, /^Undoes the last `init` \(applied \d{4}-\d\d-\d\dT[\d:.]+Z by workflow-kit [^)]+\); .* That run is the install itself: rolling it back removes the files it installed\.$/m);
});

test('upgrade names workflow-kit and the next step as a dry run first', async () => {
  const bin_ = await makeTempRepo();
  for (const name of ['bun', 'git']) {
    await fs.writeFile(path.join(bin_, name), '#!/bin/sh\nexit 0\n');
    await fs.chmod(path.join(bin_, name), 0o755);
  }
  const result = await new Promise((resolve) => {
    const run = spawn(process.execPath, [bin, 'upgrade', '--apply', '--yes'], { env: { ...process.env, PATH: bin_, NODE_NO_WARNINGS: '1' } });
    const output = { stdout: '', stderr: '' };
    run.stdout.on('data', (chunk) => { output.stdout += chunk; });
    run.stderr.on('data', (chunk) => { output.stderr += chunk; });
    run.on('close', (code) => resolve({ code, ...output }));
  });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /^workflow-kit upgraded from github:/m);
  assert.match(result.stdout, /^Next step: in each repository, run `workflow-kit update --target <repo>` \(dry run\), then the same command with --apply --yes\.$/m);
  assert.doesNotMatch(result.stdout, /^Toolkit upgrade completed|^Next step: re-run/m);
});

test('the plugin install steps after init --mode plugin run in the target as printed', async () => {
  const target = await makeTempRepo();
  const init = await cli(['init', '--target', target, '--mode', 'plugin', '--runtime', 'claude', '--apply', '--yes']);
  assert.equal(init.code, 0, init.stderr);
  assert.ok(init.stdout.includes(`- Claude Code: cd ${target} && claude plugin install `), init.stdout);
});

test('docs/migration.md names no release tag that does not exist', async () => {
  const text = await fs.readFile(path.join(root, 'docs/migration.md'), 'utf8');
  assert.doesNotMatch(text, /v0\.18\.0-equilibrado-profile/);
});

// Repair round 3, item 1: a rollback planned before another run applied.
test('a rollback planned before another run applied stops under the lock and writes nothing; that run can still be rolled back', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOur edit.\n');
  const before = await hashTree(target);
  // Planned on the init journal; the update below applies before it does.
  const rollbackOfInit = await buildRollbackPlan({ targetPath: target });
  await applyInstallPlan(await buildUpdatePlan({ targetPath: target, edited: { '.agents/instructions.md': 'discard' } }));
  const afterUpdate = await hashTree(target);

  await assert.rejects(applyRollbackPlan(rollbackOfInit), (error) => error.code === 'WORKFLOW_KIT_PLAN_STALE' && /changed after this plan was made/.test(error.message));
  assert.deepEqual(await hashTree(target), afterUpdate, 'nothing written');
  await applyRollbackPlan(await buildRollbackPlan({ targetPath: target }));
  assert.deepEqual(await hashTree(target), withoutJournal(before), 'the update is undone, the edit is back');
});

// Repair round 3, item 2: an interrupted rollback stops the next run.
test('a rollback stopped by SIGINT, SIGTERM or SIGKILL is recorded: update stops and doctor reports it until rollback finishes', async () => {
  const { runDoctor } = await import('../src/doctor.mjs');
  const stops = [
    ['SIGINT', { WORKFLOW_KIT_TEST_INTERRUPT_AFTER: '1', WORKFLOW_KIT_TEST_INTERRUPT_SIGNAL: 'SIGINT' }],
    ['SIGTERM', { WORKFLOW_KIT_TEST_INTERRUPT_AFTER: '1', WORKFLOW_KIT_TEST_INTERRUPT_SIGNAL: 'SIGTERM' }],
    ['SIGKILL', { WORKFLOW_KIT_TEST_KILL_IN_COPY: '1' }]
  ];
  for (const [signal, env] of stops) {
    const target = await makeTempRepo();
    await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
    for (const name of (await fs.readdir(path.join(target, '.agents/delegation'))).sort().slice(0, 2)) {
      await fs.appendFile(path.join(target, '.agents/delegation', name), '\nOur edit.\n');
    }
    await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOur edit.\n');
    const edited = await hashTree(target);
    assert.equal((await cli(['update', '--target', target, '--edited', 'all=discard', '--apply', '--yes'])).code, 0);

    const stopped = await child(['rollback', '--target', target, '--apply', '--yes'], env);
    if (signal === 'SIGKILL') assert.equal(stopped.signal, 'SIGKILL', signal);
    else assert.equal(stopped.code, { SIGINT: 130, SIGTERM: 143 }[signal], `${signal}: ${stopped.stderr}`);
    const partly = await hashTree(target);

    for (const args of [['update', '--target', target], ['update', '--target', target, '--apply', '--yes'], ['init', '--target', target, '--apply', '--yes']]) {
      const blocked = await cli(args);
      assert.equal(blocked.code, 2, `${signal}: ${args.join(' ')}`);
      assert.match(blocked.stderr, /A workflow-kit rollback of the apply of .+ started \(.+\) and did not finish, so the repository is partly rolled back\. Run `workflow-kit rollback --apply --yes` again to finish it/, `${signal}: ${args.join(' ')}`);
    }
    assert.deepEqual(await hashTree(target), partly, `${signal}: nothing written while it is pending`);
    const doctor = await runDoctor({ targetPath: target });
    assert.equal(doctor.ok, false, signal);
    assert.ok(doctor.diagnostics.some((item) => item.code === 'managed/apply-incomplete' && /rollback --apply --yes/.test(item.message)), signal);

    const plan = await cli(['rollback', '--target', target]);
    assert.match(plan.stdout, /^Finishes the rollback started .+, which did not finish\. Undoes the last `update`/m, signal);
    const finished = await cli(['rollback', '--target', target, '--apply', '--yes']);
    assert.equal(finished.code, 0, `${signal}: ${finished.stderr}`);
    assert.deepEqual(await hashTree(target), withoutJournal(edited), `${signal}: the update is fully undone`);
    assert.equal((await cli(['update', '--target', target])).code, 0, signal);
  }
});

// Repair round 3, item 3.
test('a lock that cannot be proved stale says how to clear it, and its description for doctor gives its process, age and staleness', async () => {
  const { describeTargetLock } = await import('../src/apply.mjs');
  assert.equal(typeof describeTargetLock, 'function');
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  await fs.rm(path.join(target, '.agents/README.md'));
  assert.equal(await describeTargetLock(target), null);
  // A lock without its process start time (an older build, or written by hand).
  const startedAt = new Date(Date.now() - 90_000).toISOString();
  await write(target, applyLockRelativePath, `${JSON.stringify({ pid: process.pid, startedAt })}\n`);
  const blocked = await cli(['update', '--target', target, '--apply', '--yes']);
  assert.equal(blocked.code, 2);
  assert.match(blocked.stderr, /If you are sure no workflow-kit command is running on this repository \(for example after a crash\), remove \.agents\/workflow-kit\/apply\.lock and run again\./);
  const held = await describeTargetLock(target);
  assert.deepEqual({ pid: held.pid, stale: held.stale, relativePath: held.relativePath }, { pid: process.pid, stale: false, relativePath: '.agents/workflow-kit/apply.lock' });
  assert.ok(held.ageSeconds >= 89 && held.ageSeconds < 300, String(held.ageSeconds));
  assert.match(held.message, /is held by process \d+, taken \d+ s ago.*remove \.agents\/workflow-kit\/apply\.lock/);
  const gone = spawnSync(process.execPath, ['-e', '']).pid;
  await write(target, applyLockRelativePath, `${JSON.stringify({ pid: gone, startedAt })}\n`);
  const stale = await describeTargetLock(target);
  assert.equal(stale.stale, true);
  assert.match(stale.message, /the next apply or rollback takes it over/);
});
