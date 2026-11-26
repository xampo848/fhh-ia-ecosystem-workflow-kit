// The apply lock (.agents/workflow-kit/apply.lock): a folder where the file
// goes stops every command with a clear message and is never deleted; a lock
// whose content is not valid is reported as unreadable and its raw content
// is never repeated; a live process id without a start time still blocks.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyLockRelativePath } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { createMemoryIo, hashTree, makeTempRepo } from './helpers.mjs';

async function cli(args) {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, text: io.output.stdout + io.output.stderr };
}

async function installedProject() {
  const target = await makeTempRepo('workflow-kit-lock-');
  const { code } = await cli(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes']);
  assert.equal(code, 0);
  return target;
}

const lockPath = (target) => path.join(target, applyLockRelativePath);
const isFolder = (target) => fs.lstat(lockPath(target)).then((stat) => stat.isDirectory(), () => false);

test('a folder where the lock file goes stops doctor, update, init and rollback with a clear message and is kept', async () => {
  const target = await installedProject();
  await fs.mkdir(lockPath(target));
  const before = await hashTree(target);
  const commands = {
    doctor: ['doctor', '--target', target],
    'update dry run': ['update', '--target', target],
    'update apply': ['update', '--target', target, '--apply', '--yes'],
    'rollback dry run': ['rollback', '--target', target],
    'rollback apply': ['rollback', '--target', target, '--apply', '--yes'],
    'init apply': ['init', '--target', target, '--runtime', 'claude', '--apply', '--yes']
  };
  for (const [name, args] of Object.entries(commands)) {
    const { code, text } = await cli(args);
    assert.equal(code, name === 'doctor' ? 1 : 2, `${name}: exit code\n${text.slice(0, 600)}`);
    assert.match(text, /folder where the lock file goes/, name);
    assert.ok(text.includes(lockPath(target)), `${name}: names the path`);
    assert.match(text, /remove that folder by hand/, name);
    assert.doesNotMatch(text, /EISDIR|Path is a directory|next apply or rollback takes it over/, name);
    assert.equal(await isFolder(target), true, `${name}: the folder is kept`);
  }
  assert.deepEqual(await hashTree(target), before, 'nothing was written');
});

test('doctor reports the folder as an error diagnostic', async () => {
  const target = await installedProject();
  await fs.mkdir(lockPath(target));
  const { code, text } = await cli(['doctor', '--target', target]);
  assert.equal(code, 1);
  assert.match(text, /\[managed\/apply-lock-held\].*folder where the lock file goes/);
});

const invalidPids = {
  string: '4242',
  negative: -5,
  float: 12.5,
  huge: 1e30,
  zero: 0,
  object: { toString: 'x' },
  injection: '12\n- [managed/fake] INJECTED line\u001b[31m'
};

for (const [name, pid] of Object.entries(invalidPids)) {
  test(`a lock with an invalid pid (${name}) is unreadable and its content is never printed`, async () => {
    const target = await installedProject();
    await fs.writeFile(lockPath(target), `${JSON.stringify({ pid, startedAt: new Date().toISOString() })}\n`);
    const raw = typeof pid === 'string' ? pid : null;
    for (const args of [['doctor', '--target', target], ['update', '--target', target]]) {
      const { code, text } = await cli(args);
      assert.notEqual(code, 2, text.slice(0, 400));
      assert.doesNotMatch(text, /INJECTED|\u001b/);
      if (raw && raw.length > 4) assert.ok(!text.includes(raw));
      if (args[0] === 'doctor') {
        assert.match(text, /\[managed\/apply-lock-stale\].*cannot be read or is not valid/);
        assert.doesNotMatch(text, /apply-lock-held/);
      }
    }
    // The next apply takes it over.
    await fs.rm(path.join(target, '.agents/instructions.md'));
    const applied = await cli(['update', '--target', target, '--apply', '--yes']);
    assert.equal(applied.code, 0, applied.text.slice(0, 400));
    assert.doesNotMatch(applied.text, /INJECTED|\u001b/);
    assert.equal(await fs.lstat(lockPath(target)).then(() => true, () => false), false);
  });
}

for (const [name, startedAt] of Object.entries({ text: 'yesterday INJECTED', invalidDate: '2026-13-45T99:00:00Z', number: 17, injection: '2026\n- [x] INJECTED\u001b[31m' })) {
  test(`a lock with an invalid startedAt (${name}) is unreadable even with a live pid and prints nothing of it`, async () => {
    const target = await installedProject();
    await fs.writeFile(lockPath(target), `${JSON.stringify({ pid: process.pid, startedAt })}\n`);
    const doctor = await cli(['doctor', '--target', target]);
    assert.doesNotMatch(doctor.text, /INJECTED|\u001b|2026-13-45|yesterday/);
    assert.match(doctor.text, /\[managed\/apply-lock-stale\]/);
    await fs.rm(path.join(target, '.agents/instructions.md'));
    const applied = await cli(['update', '--target', target, '--apply', '--yes']);
    assert.equal(applied.code, 0, applied.text.slice(0, 400));
    assert.doesNotMatch(applied.text, /INJECTED|\u001b|2026-13-45|yesterday/);
  });
}

test('a lock with a live pid and no start time still blocks: doctor error, apply stop (by design)', async () => {
  const target = await installedProject();
  await fs.writeFile(lockPath(target), `${JSON.stringify({ pid: process.pid })}\n`);
  const doctor = await cli(['doctor', '--target', target]);
  assert.equal(doctor.code, 1);
  assert.match(doctor.text, /\[managed\/apply-lock-held\]/);
  await fs.rm(path.join(target, '.agents/instructions.md'));
  const before = await hashTree(target);
  const applied = await cli(['update', '--target', target, '--apply', '--yes']);
  assert.equal(applied.code, 2);
  assert.match(applied.text, /Another workflow-kit run is changing this repository \(process \d+, started at an unknown time/);
  assert.deepEqual(await hashTree(target), before);
});
