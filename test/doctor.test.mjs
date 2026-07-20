import assert from 'node:assert/strict';
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
