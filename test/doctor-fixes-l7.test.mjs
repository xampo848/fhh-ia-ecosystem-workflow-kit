// L7: doctor in plugin mode. An own file at the path of a runtime that is not
// installed is not a kit copy, and kit paths named in project context are not
// missing (the plugin delivers them). The runtime CLI is always an executor
// double.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import packageJson from '../package.json' with { type: 'json' };
import { runCli } from '../src/cli.mjs';
import { runDoctor } from '../src/doctor.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

const pluginId = 'fhh@fhh-ia-ecosystem';
const installedPlugin = () => Promise.resolve({ code: 0, stdout: JSON.stringify([{ id: pluginId, version: packageJson.version, scope: 'project', enabled: true }]) });

async function write(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}
async function install(mode) {
  const target = await makeTempRepo();
  const io = createMemoryIo();
  const code = await runCli(['init', '--target', target, ...(mode === 'plugin' ? ['--mode', 'plugin'] : []), '--runtime', 'claude', '--apply', '--yes'], io);
  assert.equal(code, 0, io.output.stderr);
  return target;
}
const doctor = (target) => runDoctor({ targetPath: target, commandExecutor: installedPlugin });
const codes = (result, code) => result.diagnostics.filter((item) => item.code === code);
const context = (...paths) => `# Project context\n\nReal project notes.\n\n${paths.map((item) => `- \`${item}\``).join('\n')}\n`;

test('an own file at the path of a runtime that is not installed is not mode/repo-and-plugin', async () => {
  const target = await install('plugin');
  await write(target, '.codex/README.md', '# My own notes about codex\n');

  const result = await doctor(target);

  assert.deepEqual(codes(result, 'mode/repo-and-plugin'), [], JSON.stringify(result.diagnostics, null, 2));
});

test('a kit copy left in the repository next to the plugin still fires mode/repo-and-plugin', async () => {
  const target = await install('plugin');
  const kitFile = await fs.readFile(path.join(import.meta.dirname, '..', 'templates', 'repo-overlay-fhh-ia-ecosystem-full', '.agents', 'instructions.md'), 'utf8');
  await write(target, '.agents/instructions.md', kitFile);
  await write(target, '.codex/README.md', '# My own notes about codex\n');

  const [finding, ...rest] = codes(await doctor(target), 'mode/repo-and-plugin');

  assert.equal(rest.length, 0);
  assert.equal(finding.severity, 'error');
  assert.ok(finding.message.includes('.agents/instructions.md'), finding.message);
  assert.equal(finding.message.includes('.codex/README.md'), false, finding.message);
});

test('plugin mode: a kit path in project context is not project-context/missing-path, a bogus path is', async () => {
  const target = await install('plugin');
  await write(target, '.agents/project/context.md', context('.agents/instructions.md', 'src/bogus/nothing.ts'));

  const missing = codes(await doctor(target), 'project-context/missing-path');

  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.ok(missing[0].message.includes('src/bogus/nothing.ts'));
});

test('repo mode: a kit path in project context whose file is gone is still project-context/missing-path', async () => {
  const target = await install('repo');
  await fs.rm(path.join(target, '.agents/instructions.md'));
  await write(target, '.agents/project/context.md', context('.agents/instructions.md'));

  const missing = codes(await doctor(target), 'project-context/missing-path');

  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.ok(missing[0].message.includes('.agents/instructions.md'));
});
