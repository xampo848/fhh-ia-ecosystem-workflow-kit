import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

test('doctor succeeds after selected install is applied', async () => {
  const target = await makeTempRepo();
  const installIo = createMemoryIo();
  const doctorIo = createMemoryIo();

  assert.equal(await runCli(['init', '--target', target, '--runtime', 'codex,copilot', '--overlay', 'fhh-ia-ecosystem-full', '--apply', '--yes'], installIo), 0);
  const code = await runCli(['doctor', '--target', target, '--runtime', 'codex,copilot', '--overlay', 'fhh-ia-ecosystem-full'], doctorIo);

  assert.equal(code, 0);
  assert.match(doctorIo.output.stdout, /Doctor: ok/);
});

test('doctor fails and names missing files for incomplete target', async () => {
  const target = await makeTempRepo();
  const io = createMemoryIo();

  const code = await runCli(['doctor', '--target', target, '--runtime', 'codex'], io);

  assert.equal(code, 1);
  assert.match(io.output.stdout, /Doctor: failed/);
  assert.match(io.output.stdout, /\.agents\/instructions\.md/);
  assert.match(io.output.stdout, /AGENTS\.md/);
});

test('doctor fails with actionable semantic diagnostics', async () => {
  const target = await makeTempRepo();
  const installIo = createMemoryIo();
  const doctorIo = createMemoryIo();
  await runCli(['init', '--target', target, '--runtime', 'copilot', '--apply', '--yes'], installIo);
  await fs.writeFile(
    path.join(target, '.github/instructions/ai-workflow.instructions.md'),
    '# invalid\n',
    'utf8'
  );

  const code = await runCli(['doctor', '--target', target, '--runtime', 'copilot'], doctorIo);

  assert.equal(code, 1);
  assert.match(doctorIo.output.stdout, /\[copilot\/missing-apply-to\]/);
  assert.match(doctorIo.output.stdout, /\.github\/instructions\/ai-workflow\.instructions\.md/);
});

test('doctor reports locally modified managed files as warnings', async () => {
  const target = await makeTempRepo();
  const installIo = createMemoryIo();
  const doctorIo = createMemoryIo();
  await runCli(['init', '--target', target, '--runtime', 'antigravity', '--apply', '--yes'], installIo);
  await fs.appendFile(path.join(target, 'ANTIGRAVITY.md'), '\nlocal rule\n', 'utf8');

  const code = await runCli(['doctor', '--target', target, '--runtime', 'antigravity'], doctorIo);

  assert.equal(code, 0);
  assert.match(doctorIo.output.stdout, /\[managed\/content-drift\]/);
  assert.match(doctorIo.output.stdout, /warning/i);
});

test('doctor warns when target was last applied with a different toolkit version', async () => {
  const target = await makeTempRepo();
  const installIo = createMemoryIo();
  const doctorIo = createMemoryIo();
  await runCli(['init', '--target', target, '--runtime', 'codex', '--apply', '--yes'], installIo);

  const statePath = path.join(target, '.agents/workflow-kit/install-state.json');
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  state.toolkitVersion = '0.0.1-older';
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  const code = await runCli(['doctor', '--target', target, '--runtime', 'codex'], doctorIo);

  assert.equal(code, 0);
  assert.match(doctorIo.output.stdout, /\[managed\/toolkit-version-mismatch\]/);
});
