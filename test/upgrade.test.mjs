import assert from 'node:assert/strict';
import os from 'node:os';
import test from 'node:test';
import packageJson from '../package.json' with { type: 'json' };
import { globalUpgradeWorkingDirectory, isNonBlockingBunRemoveFailure, runUpgradePlan } from '../src/upgrade.mjs';

test('globalUpgradeWorkingDirectory prefers HOME', () => {
  assert.equal(globalUpgradeWorkingDirectory(), os.homedir());
});

test('runUpgradePlan defaults to HOME as cwd', async () => {
  const expected = JSON.stringify(os.homedir());
  const plan = {
    command: 'node',
    args: ['-e', `process.exit(process.cwd()===${expected}?0:9)`]
  };

  const result = await runUpgradePlan(plan);
  assert.equal(result.ok, true);
  assert.equal(result.code, 0);
});

test('isNonBlockingBunRemoveFailure detects missing-package outputs', () => {
  assert.equal(isNonBlockingBunRemoveFailure({ stderr: 'error: package not found' }), true);
  assert.equal(isNonBlockingBunRemoveFailure({ stdout: 'No such package' }), true);
  assert.equal(isNonBlockingBunRemoveFailure({ stderr: 'permission denied' }), false);
});


// Stub `git` and `bun` first on PATH: no test reaches the network or the real
// global install. Each call is logged with GIT_TERMINAL_PROMPT.
async function withStubs(scripts, body) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-stubs-'));
  const log = path.join(dir, 'calls.log');
  for (const [name, script] of Object.entries(scripts)) {
    await fs.writeFile(path.join(dir, name), `#!/bin/sh\necho "${name} $* prompt=$GIT_TERMINAL_PROMPT" >> "${log}"\n${script}\n`, { mode: 0o755 });
  }
  const previous = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${previous}`;
  try {
    return await body({ calls: async () => (await fs.readFile(log, 'utf8').catch(() => '')).split('\n').filter(Boolean) });
  } finally {
    process.env.PATH = previous;
  }
}

const quietIo = () => {
  const output = { stdout: '', stderr: '' };
  return { output, stdout: { write: (text) => { output.stdout += text; } }, stderr: { write: (text) => { output.stderr += text; } } };
};

// The ref only names refs: a mistyped commit is not one, and git answers 2.
const gitStub = `case "$1 $2" in
  "ls-remote --exit-code") case "$4" in main|v1) exit 0;; *) exit 2;; esac;;
  "ls-remote https://github.com/example/repo.git") printf 'abc1234def5678900000000000000000000000000\\tHEAD\\n'; exit 0;;
  "init --quiet") exit 0;;
esac
case "$*" in *" fetch "*) exit 128;; esac
exit 0`;

test('upgrade --ref with a mistyped commit stops before removing workflow-kit, through the CLI', async () => {
  const { runCli } = await import('../src/cli.mjs');
  await withStubs({ git: gitStub, bun: 'exit 0' }, async ({ calls }) => {
    for (const ref of ['deadbee1', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef']) {
      const io = quietIo();
      const code = await runCli(['upgrade', '--ref', ref, '--apply', '--yes'], io);
      assert.equal(code, 2, ref);
      assert.match(io.output.stderr, ref.length === 40
        ? new RegExp(`Ref "${ref}" was not found in .*\\. Nothing was changed\\.`)
        : /is no branch, tag or branch tip of .*a short commit cannot be checked: give the full 40-character commit, or a branch or tag\. Nothing was changed\./, ref);
    }
    const log = await calls();
    assert.equal(log.some((line) => line.startsWith('bun remove') || line.startsWith('bun add')), false, log.join('\n'));
    assert.ok(log.filter((line) => line.startsWith('git ')).every((line) => line.endsWith('prompt=0')), 'git never prompts for credentials');
  });
});

test('upgrade verifies a short commit that is a branch tip and a full commit that the server fetches', async () => {
  const plan = { packageManager: 'bun', repository: 'example/repo', command: 'bun', args: ['add', '-g', 'x'] };
  const { verifyUpgradeRef } = await import('../src/upgrade.mjs');
  const calls = [];
  const run = (answers) => async (args) => { calls.push(args.join(' ')); return answers(args); };
  const tipAnswers = (args) => (args.includes('--exit-code') ? { ok: false, code: 2 } : { ok: true, code: 0, stdout: 'abc1234def5678900000000000000000000000000\trefs/heads/main\n' });
  assert.deepEqual(await verifyUpgradeRef({ ...plan, ref: 'ABC1234' }, run(tipAnswers)), { status: 'found' });
  const full = 'abc1234def5678900000000000000000000000aa';
  const fetchAnswers = (ok) => (args) => (args.includes('--exit-code') ? { ok: false, code: 2 } : args.includes('fetch') ? { ok, code: ok ? 0 : 128 } : { ok: true, code: 0 });
  assert.deepEqual(await verifyUpgradeRef({ ...plan, ref: full }, run(fetchAnswers(true))), { status: 'found' });
  assert.deepEqual(await verifyUpgradeRef({ ...plan, ref: full }, run(fetchAnswers(false))), { status: 'missing' });
  assert.ok(calls.some((call) => /^-C .+ fetch --quiet --depth=1 --no-tags https:\/\/github\.com\/example\/repo\.git abc1234def/.test(call)), calls.join('\n'));
  // A hex-looking branch name is a ref like any other.
  assert.deepEqual(await verifyUpgradeRef({ ...plan, ref: 'deadbee1' }, run(() => ({ ok: true, code: 0 }))), { status: 'found' });
});

test('git ls-remote has a timeout and never prompts', async () => {
  const { runGit, verifyUpgradeRef } = await import('../src/upgrade.mjs');
  // The first run of a new executable can be slow on some systems, so the
  // timeout leaves room for the stub to start.
  await withStubs({ git: '[ "$4" = slow ] && sleep 20; exit 2' }, async ({ calls }) => {
    assert.deepEqual(await verifyUpgradeRef({ repository: 'example/repo', ref: 'main' }, (args) => runGit(args, { timeoutMs: 5000 })), { status: 'missing' });
    assert.match((await calls())[0], /^git ls-remote --exit-code https:\/\/github\.com\/example\/repo\.git main prompt=0$/);
    const started = Date.now();
    const probe = await verifyUpgradeRef({ repository: 'example/repo', ref: 'slow' }, (args) => runGit(args, { timeoutMs: 1500 }));
    assert.deepEqual(probe, { status: 'unreachable', timedOut: true });
    assert.ok(Date.now() - started < 8000);
  });
});

test('when the add fails after the removal, the recovery line names a command that can work', async () => {
  await withStubs({ git: gitStub, bun: '[ "$1" = add ] && exit 1; exit 0' }, async ({ calls }) => {
    const plan = { packageManager: 'bun', repository: 'example/repo', ref: 'v1', command: 'bun', args: ['add', '-g', 'github:example/repo#v1'] };
    const io = quietIo();
    const result = await runUpgradePlan(plan, { ...io });
    assert.equal(result.ok, false);
    assert.match(io.output.stderr, /The previous workflow-kit was removed and the new one failed to install, so workflow-kit is not installed now\. Reinstall with bun add -g github:example\/repo#v1 once the error above is solved or, for the default ref, bun add -g github:example\/repo#main\./);
    assert.deepEqual((await calls()).filter((line) => line.startsWith('bun')).map((line) => line.replace(/ prompt=.*$/, '')), [`bun remove -g ${packageJson.name}`, 'bun add -g github:example/repo#v1']);
  });
});
