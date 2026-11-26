import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';
import { runDoctor } from '../src/doctor.mjs';
import { installStateRelativePath } from '../src/planner.mjs';
import { inspectInstalledPlugins, pluginListTimeoutMs } from '../src/plugin-mode.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

const copilotWrapper = '.github/instructions/quality-gate.instructions.md';
const exists = (target, relativePath) => fs.access(path.join(target, relativePath)).then(() => true, () => false);
async function cli(args) {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, ...io.output };
}

// AC-11 (plugin mode): a switch to plugin mode retires every recorded kit or
// derived file, also the ones of a runtime dropped by an earlier update.
test('AC-11: after dropping copilot in repo mode, the switch to plugin mode still retires its derived wrapper and stops recording it', async () => {
  const target = await makeTempRepo();
  for (const args of [
    ['init', '--target', target, '--runtime', 'claude,copilot', '--apply', '--yes'],
    ['update', '--target', target, '--runtime', 'claude', '--apply', '--yes']
  ]) {
    const step = await cli(args);
    assert.equal(step.code, 0, step.stderr);
  }
  const switched = await cli(['update', '--target', target, '--mode', 'plugin', '--apply', '--yes']);
  assert.equal(switched.code, 0, switched.stderr);

  assert.equal(await exists(target, copilotWrapper), false, 'the derived wrapper is deleted');
  const state = JSON.parse(await fs.readFile(path.join(target, installStateRelativePath), 'utf8'));
  assert.equal(state.files[copilotWrapper], undefined, 'the state no longer records it');
  const generated = Object.entries(state.files).filter(([relativePath]) => relativePath.startsWith('.github/instructions/'));
  assert.deepEqual(generated, [], 'no copilot wrapper stays recorded');
});

// AC-16: a non-zero exit is "unverified", whatever the command printed.
test('AC-16: claude plugin list printing [] and exiting 1 is mode/plugin-install-unverified, not "not installed"', async () => {
  const target = await makeTempRepo();
  const init = await cli(['init', '--target', target, '--mode', 'plugin', '--runtime', 'claude', '--apply', '--yes']);
  assert.equal(init.code, 0, init.stderr);

  const direct = await inspectInstalledPlugins({ targetPath: target, executor: async () => ({ code: 1, stdout: '[]' }) });
  assert.equal(direct.status, 'unverified');
  assert.match(direct.reason, /exited with code 1/);

  const result = await runDoctor({ targetPath: target, commandExecutor: async () => ({ code: 1, stdout: '[]' }) });
  const codes = result.diagnostics.filter((item) => item.code.startsWith('mode/')).map((item) => item.code);
  assert.deepEqual(codes, ['mode/plugin-install-unverified']);
});

// AC-16 / PRD 2.5: doctor waits at most 5 seconds for the plugin CLI.
test('AC-16: the shipped wait for claude plugin list is 5 seconds, and both the inspection and doctor hand it to the command', async () => {
  assert.equal(pluginListTimeoutMs, 5000);
  const seen = [];
  const executor = async (file, args, options) => { seen.push(options.timeoutMs); return { code: 0, stdout: '[]' }; };
  const target = await makeTempRepo();
  const init = await cli(['init', '--target', target, '--mode', 'plugin', '--runtime', 'claude', '--apply', '--yes']);
  assert.equal(init.code, 0, init.stderr);

  await inspectInstalledPlugins({ targetPath: target, executor });
  await runDoctor({ targetPath: target, commandExecutor: executor });

  assert.deepEqual(seen, [5000, 5000]);
});
