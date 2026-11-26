// Lot L5: a repository that is not in the shape the kit needs (a folder where
// a state file goes, a file nobody may read or write, a link to nothing) stops
// a command with a message that names the path, says what it is and what to
// do, never a raw Node error; and the recovery messages say how to go on with
// commands that run as printed, from any folder.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyJournalRelativePath, applyLockRelativePath, describeTargetLock } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { createMemoryIo, hashTree, makeTempRepo } from './helpers.mjs';

const bin = fileURLToPath(new URL('../bin/workflow-kit.mjs', import.meta.url));
const raw = /EISDIR|EACCES|ENOTDIR|EPERM|illegal operation|permission denied, |at .*\(node:/;
const canNotDeny = process.getuid?.() === 0;
const stateDirectory = '.agents/workflow-kit';

async function cli(args) {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, text: io.output.stdout + io.output.stderr, stderr: io.output.stderr };
}

let baseProject;
async function installedProject() {
  if (!baseProject) {
    baseProject = await makeTempRepo('workflow-kit-l5-base-');
    assert.equal((await cli(['init', '--target', baseProject, '--runtime', 'claude', '--apply', '--yes'])).code, 0);
  }
  const target = await makeTempRepo('workflow-kit-l5-');
  await fs.cp(baseProject, target, { recursive: true });
  return target;
}

// A printed command, run verbatim by a shell from a folder that is not the target.
function runPrinted(command) {
  const elsewhere = path.dirname(bin);
  const result = spawnSync('sh', ['-c', command.replace(/^workflow-kit /, `${JSON.stringify(process.execPath)} ${JSON.stringify(bin)} `)], { cwd: elsewhere, encoding: 'utf8' });
  return { code: result.status, text: result.stdout + result.stderr };
}
const printedCommands = (text) => [...text.matchAll(/`(workflow-kit [^`]+)`/g)].map((match) => match[1]);
const printed = (text, word) => printedCommands(text).find((command) => command.includes(word));
const printedGit = (text) => [...text.matchAll(/`(git [^`]+)`/g)].map((match) => match[1])[0];

const commandsOf = (target) => ({
  'update dry run': ['update', '--target', target],
  'update apply': ['update', '--target', target, '--apply', '--yes'],
  'rollback dry run': ['rollback', '--target', target],
  'rollback apply': ['rollback', '--target', target, '--apply', '--yes'],
  'init dry run': ['init', '--target', target, '--runtime', 'claude'],
  'init apply': ['init', '--target', target, '--runtime', 'claude', '--apply', '--yes']
});

const damages = {
  folder: async (file) => { await fs.rm(file); await fs.mkdir(file); },
  unreadable: async (file) => { await fs.chmod(file, 0o000); }
};

for (const [file, doctorCode] of [['install-state.json', 'managed/install-state-unusable'], ['last-apply.json', 'managed/apply-journal-unusable'], ['manifest.json', null]]) {
  for (const [damage, setUp] of Object.entries(damages)) {
    test(`${file} as ${damage}: every command stops naming the file, without a raw error, and writes nothing`, { skip: damage === 'unreadable' && canNotDeny }, async () => {
      const target = await installedProject();
      const relative = `${stateDirectory}/${file}`;
      const absolute = path.join(target, relative);
      const before = await hashTree(target);
      await setUp(absolute);
      try {
        for (const [name, args] of Object.entries(commandsOf(target))) {
          // An install over a readable state says "already installed": not the file's problem.
          if (file === 'manifest.json' && name.startsWith('init')) continue;
          const result = await cli(args);
          assert.equal(result.code, 2, `${name}: ${result.text}`);
          assert.match(result.stderr, new RegExp(relative.replaceAll('.', '\\.')), name);
          assert.doesNotMatch(result.text, raw, name);
          assert.match(result.stderr, /Nothing was written\./, name);
          assert.ok(!/at .*\(node:/.test(result.text), name);
        }
        if (doctorCode) {
          const doctor = await cli(['doctor', '--target', target]);
          assert.equal(doctor.code, 1);
          assert.match(doctor.text, new RegExp(`\\[${doctorCode}\\] ${relative.replaceAll('.', '\\.')}`));
          assert.doesNotMatch(doctor.text, raw);
        }
      } finally {
        await fs.chmod(absolute, damage === 'folder' ? 0o755 : 0o644);
      }
      if (damage === 'folder') {
        await fs.rmdir(absolute);
        await fs.cp(path.join(baseProject, relative), absolute);
      }
      assert.deepEqual(await hashTree(target), before);
    });
  }
}

test('a read-only kit folder in the middle of an update names the folder and the rollback command, and the journal says it did not finish', { skip: canNotDeny }, async () => {
  const target = await installedProject();
  await fs.rm(path.join(target, '.agents/README.md'));
  await fs.chmod(path.join(target, '.agents'), 0o555);
  let result;
  try {
    const dry = await cli(['update', '--target', target]);
    assert.equal(dry.code, 0, 'a dry run writes nothing: it does not need the folder to be writable');
    result = await cli(['update', '--target', target, '--apply', '--yes']);
  } finally {
    await fs.chmod(path.join(target, '.agents'), 0o755);
  }
  assert.equal(result.code, 2);
  assert.match(result.stderr, /^\.agents cannot be read or written \(permission denied\)/);
  assert.doesNotMatch(result.text, raw);
  const journal = JSON.parse(await fs.readFile(path.join(target, applyJournalRelativePath), 'utf8'));
  assert.equal(journal.completed, false);
  const rollback = printed(result.stderr, 'rollback');
  assert.ok(rollback?.includes(`--target ${target}`) && rollback.endsWith('--apply --yes'), result.stderr);
  const gated = await cli(['update', '--target', target]);
  assert.match(gated.stderr, /did not finish/);
  const done = runPrinted(rollback);
  assert.equal(done.code, 0, done.text);
  assert.equal((await cli(['update', '--target', target])).code, 0);
});

test('export --output a link to nothing is refused in the dry run and the apply, and the link is untouched', async () => {
  const parent = await makeTempRepo('workflow-kit-l5-export-');
  const link = path.join(parent, 'L');
  await fs.symlink('/does/not/exist', link);
  const before = await hashTree(parent);
  for (const extra of [[], ['--apply', '--yes']]) {
    const result = await cli(['export', '--output', link, ...extra]);
    assert.equal(result.code, 2, result.text);
    assert.match(result.stderr, new RegExp(`${link.replaceAll('.', '\\.')} is a symbolic link to a path that does not exist`));
    assert.match(result.stderr, /Nothing was written\./);
    assert.doesNotMatch(result.text, raw);
  }
  assert.deepEqual(await hashTree(parent), before);
  assert.equal(await fs.readlink(link), '/does/not/exist');
  // A file in the middle of the path is a refusal too, not a raw error.
  await fs.writeFile(path.join(parent, 'F'), 'x');
  const underFile = await cli(['export', '--output', path.join(parent, 'F', 'out'), '--apply', '--yes']);
  assert.equal(underFile.code, 2);
  assert.match(underFile.stderr, /a file stands where a folder of that path should be/);
  assert.doesNotMatch(underFile.text, raw);
});

test('an unreadable apply journal says how to go on: put it back, or move it away and check with doctor; both run as printed', async () => {
  for (const content of ['{ not json', '{"schemaVersion":"2.0.0"}']) {
    const target = await installedProject();
    await fs.writeFile(path.join(target, applyJournalRelativePath), content);
    for (const args of [commandsOf(target)['update dry run'], commandsOf(target)['rollback dry run']]) {
      const result = await cli(args);
      assert.equal(result.code, 2);
      assert.match(result.stderr, /last-apply\.json/);
      assert.match(result.stderr, /Git does not track it/);
      assert.match(result.stderr, /To give up rolling back the last apply, move \.agents\/workflow-kit\/last-apply\.json out of the repository/);
      assert.doesNotMatch(result.text, raw);
      assert.ok(printed(result.stderr, 'doctor')?.includes(`--target ${target}`), result.stderr);
    }
    // Move it away, then run the printed check from another folder.
    const message = (await cli(['update', '--target', target])).stderr;
    await fs.rename(path.join(target, applyJournalRelativePath), `${target}-journal-moved`);
    const doctor = runPrinted(printed(message, 'doctor'));
    assert.equal(doctor.code, 0, doctor.text);
    assert.equal((await cli(['update', '--target', target])).code, 0);
    await fs.rm(`${target}-journal-moved`);
  }
});

test('an unusable install-state names the path, the Git command that restores it with --target and the global upgrade; the Git command runs as printed', async () => {
  const target = await installedProject();
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd: target, encoding: 'utf8' });
  assert.equal(git('init', '-q').status, 0);
  assert.equal(git('add', '-f', `${stateDirectory}/install-state.json`).status, 0);
  assert.equal(git('commit', '-q', '-m', 'state').status, 0);
  const statePath = path.join(target, stateDirectory, 'install-state.json');
  const good = await fs.readFile(statePath, 'utf8');
  for (const content of ['{ not json', '[]']) {
    await fs.writeFile(statePath, content);
    const result = await cli(['update', '--target', target]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Nothing was written|Then run this command again\./);
    assert.match(result.stderr, /workflow-kit upgrade --apply --yes` \(a global command: no --target\)/);
    const restore = printedGit(result.stderr);
    assert.ok(restore?.includes(`-C ${target}`), result.stderr);
    const run = spawnSync('sh', ['-c', restore], { cwd: path.dirname(bin), encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(await fs.readFile(statePath, 'utf8'), good);
  }
});

test('rollback with nothing to roll back says what it checked and what to run next, with --target', async () => {
  const target = await installedProject();
  await fs.rm(path.join(target, applyJournalRelativePath));
  const result = await cli(['rollback', '--target', target]);
  assert.equal(result.code, 0);
  assert.match(result.text, /Nothing to roll back\. Checked: \.agents\/workflow-kit\/last-apply\.json \(the record of the last apply\) is not there, and no \*\.workflow-kit-backup-\* file sits next to the \d+ managed file\(s\) install-state lists\./);
  const doctor = printed(result.text, 'doctor');
  assert.ok(doctor?.includes(`--target ${target}`) && printed(result.text, 'update')?.includes(`--target ${target}`), result.text);
  assert.equal(runPrinted(doctor).code, 0);
});

test('a stale lock a stopped run left says so and names the rollback that cleans it up, which runs as printed', async () => {
  const target = await installedProject();
  const gone = spawnSync(process.execPath, ['-e', '']).pid;
  const startedAt = new Date(Date.now() - 90_000).toISOString();
  await fs.writeFile(path.join(target, applyLockRelativePath), `${JSON.stringify({ pid: gone, startedAt, kind: 'apply', createdDirectories: [] })}\n`);
  const stale = await describeTargetLock(target);
  assert.equal(stale.stale, true);
  assert.match(stale.message, /was left by a workflow-kit apply run that was stopped before it finished/);
  assert.match(stale.message, /does not undo an apply that finished\. The next apply takes the lock over by itself\./);
  assert.doesNotMatch(stale.message, /the next apply or rollback takes it over/);
  const rollback = printed(stale.message, 'rollback');
  assert.equal(rollback, `workflow-kit rollback --target ${target} --apply --yes`);
  const done = runPrinted(rollback);
  assert.equal(done.code, 0, done.text);
  assert.equal(await fs.lstat(path.join(target, applyLockRelativePath)).then(() => true, () => false), false);
  // A lock that says nothing of its run keeps the generic text.
  await fs.writeFile(path.join(target, applyLockRelativePath), `${JSON.stringify({ pid: gone, startedAt })}\n`);
  assert.match((await describeTargetLock(target)).message, /the next apply or rollback takes it over\.$/);
});
