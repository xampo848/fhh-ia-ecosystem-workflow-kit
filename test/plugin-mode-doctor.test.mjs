// Doctor in plugin mode (PRD plugin-mode-pilot 2.5): installs come from the
// real `init --mode plugin` in temporary repositories; the `claude` binary is
// always an executor double, so no test runs a runtime CLI.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import packageJson from '../package.json' with { type: 'json' };
import { applyJournalRelativePath } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { formatDoctorResult, runDoctor } from '../src/doctor.mjs';
import { installStateRelativePath } from '../src/planner.mjs';
import { createMemoryIo, hashTree, makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const kitTemplate = (relativePath) => fs.readFile(path.join(root, 'templates', 'repo-overlay-fhh-ia-ecosystem-full', relativePath), 'utf8');
const pluginId = 'fhh@fhh-ia-ecosystem';
const claudeInstall = 'claude plugin install fhh@fhh-ia-ecosystem --scope project';
const pluginList = ['claude', ['plugin', 'list', '--json']];
const sha = (content) => createHash('sha256').update(content, 'utf8').digest('hex');
const read = (target, relativePath) => fs.readFile(path.join(target, relativePath), 'utf8');
async function write(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}
async function cli(args) {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, ...io.output };
}
async function install(runtime, mode = 'plugin') {
  const target = await makeTempRepo();
  const init = await cli(['init', '--target', target, ...(mode === 'plugin' ? ['--mode', 'plugin'] : []), '--runtime', runtime, '--apply', '--yes']);
  assert.equal(init.code, 0, init.stderr);
  return target;
}

// The executor double records every call; `respond` gives its outcome.
function executorDouble(respond) {
  const calls = [];
  return { calls, executor: (file, args) => { calls.push([file, args]); return respond(); } };
}
const answers = (stdout, code = 0) => () => Promise.resolve({ code, stdout });
const installed = (version) => answers(JSON.stringify([
  { id: 'other@elsewhere', version: '1.0.0', scope: 'user', enabled: true },
  ...(version ? [{ id: pluginId, version, scope: 'project', enabled: true }] : [])
]));
const doctor = (target, executor, extra = {}) => runDoctor({ targetPath: target, commandExecutor: executor, ...extra });
const findings = (result, prefix) => result.diagnostics.filter((item) => item.code.startsWith(prefix));
function assertFinding(result, code, relativePath, messages, severity) {
  const finding = result.diagnostics.find((item) => item.code === code && item.path === relativePath);
  assert.ok(finding, `${code} ${relativePath} not in ${JSON.stringify(result.diagnostics, null, 2)}`);
  assert.equal(finding.severity, severity, code);
  for (const message of messages) assert.ok(finding.message.includes(message), `${code}: "${message}" not in "${finding.message}"`);
  return finding;
}

// AC-17: only the plugin-plan files are expected, the adapters pass their
// contract, and a shadow is compared with the kit file this CLI ships.
test('AC-17: a healthy plugin install passes doctor, prints the install mode and the Copilot line, and checks shadows against the CLI kit file', async () => {
  const target = await install('claude,copilot');
  const kitPath = '.agents/skills/02-implement/validation-runner/SKILL.md';
  const shadows = {
    current: { skill: 'validation-runner', kit_path: kitPath, base_sha256: sha(await kitTemplate(kitPath)) },
    outdated: { skill: 'validation-runner', kit_path: kitPath, base_sha256: sha('older kit version\n') }
  };
  const rows = Object.keys(shadows).map((name) => `| \`${name}\` | \`.agents/project/shadows/${name}/\` |`);
  await write(target, '.agents/project/index.md', `# Project Catalog\n\n## Shadows\n\n| Kit skill | Shadow directory |\n| --- | --- |\n${rows.join('\n')}\n`);
  for (const [name, manifest] of Object.entries(shadows)) {
    await write(target, `.agents/project/shadows/${name}/SKILL.md`, '---\nname: shadow\n---\n');
    await write(target, `.agents/project/shadows/${name}/shadow.json`, JSON.stringify(manifest));
  }
  // The block of CLAUDE.md is this CLI's plugin block while the state recorded
  // an older one: someone took the new block by hand, not an edit.
  const state = JSON.parse(await read(target, installStateRelativePath));
  state.files['CLAUDE.md'].sha256 = sha('an older block');
  await write(target, installStateRelativePath, `${JSON.stringify(state, null, 2)}\n`);
  const { calls, executor } = executorDouble(installed(packageJson.version));

  const result = await doctor(target, executor);

  assert.deepEqual(result.missing, []);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics, null, 2));
  assert.deepEqual(result.diagnostics.filter((item) => item.severity === 'error'), []);
  assert.deepEqual(findings(result, 'mode/'), []);
  assertFinding(result, 'boundary/shadow-outdated', '.agents/project/shadows/outdated/shadow.json', ['changed since this shadow was made'], 'warning');
  assert.equal(result.diagnostics.some((item) => item.path.startsWith('.agents/project/shadows/current/')), false);
  assert.equal(result.diagnostics.some((item) => item.code === 'boundary/adapter-block-edited'), false);
  assert.deepEqual(calls, [pluginList]);
  const output = formatDoctorResult(result).split('\n');
  assert.ok(output.includes('Install mode: plugin'), output.join('\n'));
  assert.ok(output.includes('Doctor: ok'));
  const copilotLine = output.find((line) => line.includes('copilot plugin list'));
  assert.ok(copilotLine?.includes(`copilot plugin install ${pluginId}`), output.join('\n'));
});

// AC-15 (and the edge-case row: a kit file kept by the switch is reported).
test('AC-15: state plugin with a kit file in the repository is mode/repo-and-plugin, and doctor fails naming the command', async () => {
  const target = await install('claude');
  await write(target, '.agents/instructions.md', await kitTemplate('.agents/instructions.md'));
  const { executor } = executorDouble(installed(packageJson.version));

  const result = await doctor(target, executor);

  assertFinding(result, 'mode/repo-and-plugin', installStateRelativePath, ['.agents/instructions.md', 'workflow-kit update --mode repo'], 'error');
  assert.equal(result.ok, false);
  assert.ok(formatDoctorResult(result).split('\n').includes('Doctor: failed'));

  // A whole tree back is one finding that names the first files and counts the rest.
  const skills = ['validation-runner', 'backend-phase-implementer', 'frontend-phase-implementer', 'implement-prd', 'implement-change', 'contract-verifier']
    .map((name) => `.agents/skills/02-implement/${name}/SKILL.md`);
  const kitFiles = ['.agents/delegation/quality-gate.md', '.agents/delegation/delegate-contract.md', '.agents/skills/index.md', '.agents/kit-boundary.md', ...skills];
  for (const relativePath of kitFiles) await write(target, relativePath, await kitTemplate(relativePath));
  const tree = await doctor(target, executor);
  assert.equal(findings(tree, 'mode/repo-and-plugin').length, 1);
  assertFinding(tree, 'mode/repo-and-plugin', installStateRelativePath, [`and ${kitFiles.length + 1 - 10} more`], 'error');
});

test('AC-15: the backups and the apply journal a switch to plugin mode leaves are not a mix of modes', async () => {
  const target = await install('claude', 'repo');
  const switched = await cli(['update', '--target', target, '--mode', 'plugin', '--apply', '--yes']);
  assert.equal(switched.code, 0, switched.stderr);
  const tree = await hashTree(target);
  assert.ok(Object.keys(tree).some((key) => key.startsWith('.agents/instructions.md.workflow-kit-backup-')), 'the switch left a backup');
  assert.ok(tree[applyJournalRelativePath], 'the switch left the apply journal');
  const { executor } = executorDouble(installed(packageJson.version));

  const result = await doctor(target, executor);

  assert.deepEqual(findings(result, 'mode/'), []);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics, null, 2));
});

test('AC-15: state repo with a settings file that enables the plugin is mode/repo-and-plugin naming update --mode plugin', async () => {
  const target = await install('claude', 'repo');
  await write(target, '.claude/settings.json', `${JSON.stringify({ enabledPlugins: { [pluginId]: true } }, null, 2)}\n`);
  const { calls, executor } = executorDouble(installed(packageJson.version));

  const result = await doctor(target, executor);

  assertFinding(result, 'mode/repo-and-plugin', '.claude/settings.json', [pluginId, 'workflow-kit update --mode plugin'], 'error');
  assert.equal(result.ok, false);
  assert.ok(formatDoctorResult(result).split('\n').includes('Doctor: failed'));
  assert.deepEqual(calls, [], 'repo mode never runs the claude binary');
});

// AC-16: every outcome of `claude plugin list --json` is a warning with its
// command; none makes doctor fail or hang, and doctor only lists plugins.
test('AC-16: what claude plugin list answers becomes a warning with its command, never a failure or a hang', async () => {
  const target = await install('claude,copilot');
  const enoent = Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' });
  const timeoutMs = 200;
  const cases = [
    { name: 'plugin absent', respond: installed(null), code: 'mode/plugin-not-installed', messages: [claudeInstall, '`plugin` branch'] },
    { name: 'other version', respond: installed('0.0.1'), code: 'mode/plugin-version-mismatch', messages: [`claude plugin update ${pluginId}`, '0.0.1', packageJson.version] },
    { name: 'binary missing', respond: () => Promise.reject(enoent), code: 'mode/plugin-install-unverified', messages: ['claude plugin list', claudeInstall] },
    { name: 'hang', respond: () => new Promise(() => {}), code: 'mode/plugin-install-unverified', messages: ['claude plugin list', claudeInstall] },
    { name: 'not JSON', respond: answers('Plugins:\n- fhh'), code: 'mode/plugin-install-unverified', messages: ['claude plugin list', claudeInstall] },
    { name: 'non-zero exit', respond: answers('', 1), code: 'mode/plugin-install-unverified', messages: ['claude plugin list', claudeInstall] },
    { name: 'JSON that is not a list', respond: answers('{"plugins":[]}'), code: 'mode/plugin-install-unverified', messages: ['claude plugin list', claudeInstall] },
    { name: 'cannot run', respond: () => Promise.reject(Object.assign(new Error('spawn claude EACCES'), { code: 'EACCES' })), code: 'mode/plugin-install-unverified', messages: ['EACCES', claudeInstall] }
  ];
  for (const { name, respond, code, messages } of cases) {
    const { calls, executor } = executorDouble(respond);
    const started = Date.now();

    const result = await doctor(target, executor, { pluginCheckTimeoutMs: timeoutMs });

    assert.ok(Date.now() - started < timeoutMs + 3000, `${name}: doctor returns within the timeout`);
    assert.deepEqual(findings(result, 'mode/').map((item) => item.code), [code], name);
    assertFinding(result, code, '.claude/settings.json', messages, 'warning');
    assert.equal(result.ok, true, name);
    assert.deepEqual(calls, [pluginList], `${name}: one list call, never an install or an update`);
  }
});

test('AC-16: a recorded plugin runtime whose settings lack the declaration, or are not JSON, is mode/plugin-not-declared', async () => {
  const target = await install('claude,copilot');
  await write(target, '.claude/settings.json', `${JSON.stringify({ permissions: { allow: [] } }, null, 2)}\n`);
  await write(target, '.github/copilot/settings.json', '{ not json');
  const { executor } = executorDouble(installed(packageJson.version));

  const result = await doctor(target, executor);

  assertFinding(result, 'mode/plugin-not-declared', '.claude/settings.json', ['workflow-kit update --apply --yes'], 'warning');
  assertFinding(result, 'mode/plugin-not-declared', '.github/copilot/settings.json', ['"enabledPlugins"', pluginId], 'warning');
  assert.equal(result.ok, true);

  await fs.rm(path.join(target, '.claude/settings.json'));
  assertFinding(await doctor(target, executor), 'mode/plugin-not-declared', '.claude/settings.json', ['the file is missing', 'workflow-kit update --apply --yes'], 'warning');
});

test('AC-16: Copilot alone gets the informational line, no diagnostic and no command run', async () => {
  const target = await install('copilot');
  const { calls, executor } = executorDouble(installed(packageJson.version));

  const result = await doctor(target, executor);

  assert.deepEqual(findings(result, 'mode/'), []);
  assert.deepEqual(calls, []);
  const output = formatDoctorResult(result);
  assert.match(output, /^Install mode: plugin$/m);
  assert.ok(output.includes(`copilot plugin install ${pluginId}`) && output.includes('copilot plugin list'), output);
});

// The Copilot quality-gate wrapper of a plugin install is generated from the
// quality gate this CLI ships; a wrapper that is really stale is still reported.
test('a plugin install gets no wrapper-stale for the quality-gate wrapper, and a stale wrapper is still reported', async () => {
  const target = await install('claude,copilot');
  const { executor } = executorDouble(installed(packageJson.version));
  const wrapperStale = (result) => result.diagnostics.filter((item) => item.code === 'project-instructions/wrapper-stale');

  assert.deepEqual(wrapperStale(await doctor(target, executor)), []);

  await write(target, '.agents/project/quality-gate.md', '# Project quality gate\n\n- Run the contract tests before closing a slice.\n');
  assert.deepEqual(wrapperStale(await doctor(target, executor)).map((item) => item.path), ['.github/instructions/quality-gate.instructions.md']);
});

// AC-19 part: repo mode never runs the binary and prints what it printed
// before plugin mode existed.
test('AC-19: doctor on a repo-mode install runs no command and prints no install mode', async () => {
  const target = await install('claude', 'repo');
  const { calls, executor } = executorDouble(installed(packageJson.version));

  const result = await doctor(target, executor);

  assert.deepEqual(calls, []);
  assert.equal(result.ok, true);
  assert.deepEqual(formatDoctorResult(result).split('\n').slice(0, 8), [
    `Target: ${target}`,
    `Toolkit version: ${packageJson.version}`,
    'Runtimes: claude',
    'Overlay: fhh-ia-ecosystem-full',
    'Model profiles: claude=calidad',
    'Stack pack: none',
    'Doctor: ok',
    'Diagnostics:'
  ]);
  assert.deepEqual(result.diagnostics.map((item) => item.code), ['project-context/not-initialized']);
});
