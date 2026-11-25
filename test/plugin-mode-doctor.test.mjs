// Doctor in plugin mode (PRD plugin-mode-pilot 2.5): installs come from the
// real `init --mode plugin` in temporary repositories; the `claude` binary is
// always an executor double, so no test runs a runtime CLI.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import packageJson from '../package.json' with { type: 'json' };
import { applyJournalRelativePath } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { formatDoctorResult, runDoctor } from '../src/doctor.mjs';
import { installStateRelativePath } from '../src/planner.mjs';
import { kitLocationBlockName, pluginAdapterContent, pluginListTimeoutMs } from '../src/plugin-mode.mjs';
import { createMemoryIo, hashTree, makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adapterTemplate = (relativePath) => fs.readFile(path.join(root, 'templates', 'runtime-adapters', relativePath), 'utf8');
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
const kitMarketplace = { source: { source: 'github', repo: packageJson.workflowKit.repository } };
const settingsJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
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

  assertFinding(result, 'mode/repo-and-plugin', installStateRelativePath, ['.agents/instructions.md', `\`workflow-kit update --target ${target} --mode repo\``], 'error');
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

// AC-15 and F7: the command named is one that works for the recorded
// runtimes; when there is none, the finding names the key to remove by hand.
// The test runs whichever it names.
test('AC-15: state repo with a settings file that enables the plugin is mode/repo-and-plugin, naming a command that works or the key to remove by hand', async () => {
  const exportFolder = async () => {
    const target = await makeTempRepo();
    const exported = await cli(['export', '--output', target, '--runtime', 'claude', '--apply', '--yes']);
    assert.equal(exported.code, 0, exported.stderr);
    return target;
  };
  const cases = [
    { name: 'claude', setup: () => install('claude', 'repo'), command: (target) => `workflow-kit update --target ${target} --mode plugin` },
    { name: 'claude,codex (codex has no plugin)', setup: () => install('claude,codex', 'repo'), command: null },
    { name: 'export (a copy of the kit)', setup: exportFolder, command: null }
  ];
  const key = `enabledPlugins["${pluginId}"]`;
  for (const { name, setup, command } of cases) {
    const target = await setup();
    await write(target, '.claude/settings.json', settingsJson({ permissions: { allow: [] }, enabledPlugins: { [pluginId]: true } }));
    const { calls, executor } = executorDouble(installed(packageJson.version));

    const result = await doctor(target, executor);

    const finding = assertFinding(result, 'mode/repo-and-plugin', '.claude/settings.json', [pluginId, key], 'error');
    assert.equal(result.ok, false, name);
    assert.deepEqual(calls, [], `${name}: repo mode never runs the claude binary`);
    if (command) {
      assert.ok(finding.message.includes(`\`${command(target)}\``), `${name}: ${finding.message}`);
      const switched = await cli([...command(target).replace(/^workflow-kit /, '').split(' '), '--apply', '--yes']);
      assert.equal(switched.code, 0, `${name}: ${switched.stderr}`);
    } else {
      assert.equal(finding.message.includes('update --mode plugin'), false, `${name}: ${finding.message}`);
      const settings = JSON.parse(await read(target, '.claude/settings.json'));
      delete settings.enabledPlugins[pluginId];
      await write(target, '.claude/settings.json', settingsJson(settings));
    }
    assert.deepEqual(findings(await doctor(target, executor), 'mode/repo-and-plugin'), [], `${name}: settled`);
  }
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
    { name: 'cannot run', respond: () => Promise.reject(Object.assign(new Error('spawn claude EACCES'), { code: 'EACCES' })), code: 'mode/plugin-install-unverified', messages: ['EACCES', claudeInstall] },
    { name: 'installed but turned off', respond: answers(JSON.stringify([{ id: pluginId, version: packageJson.version, scope: 'project', enabled: false }])), code: 'mode/plugin-disabled', messages: [`claude plugin enable ${pluginId}`] }
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

  assertFinding(result, 'mode/plugin-not-declared', '.claude/settings.json', [`\`workflow-kit update --target ${target} --apply --yes\``], 'warning');
  assertFinding(result, 'mode/plugin-not-declared', '.github/copilot/settings.json', ['"enabledPlugins"', pluginId], 'warning');
  assert.equal(result.ok, true);

  await fs.rm(path.join(target, '.claude/settings.json'));
  assertFinding(await doctor(target, executor), 'mode/plugin-not-declared', '.claude/settings.json', ['the file is missing', `\`workflow-kit update --target ${target} --apply --yes\``], 'warning');
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

// QA-3 (D16, AC-19): in repo mode an entrypoint with the kit's block whose
// runtime is not recorded is what 558e9fb leaves for a dropped runtime, so
// doctor reports exactly what it reported before; only one that still carries
// the kit-location block (a mixed state) is mode/adapter-not-tracked.
test('AC-19: in repo mode an untracked adapter is mode/adapter-not-tracked only when it carries the kit-location block', async () => {
  const template = await adapterTemplate('agents-md/AGENTS.md');
  const cases = [
    { name: 'the kit managed block, no kit-location', content: template, warned: false },
    { name: 'a kit-location block', content: pluginAdapterContent(template, 'workflow-kit:managed'), warned: true }
  ];
  for (const { name, content, warned } of cases) {
    const target = await install('claude', 'repo');
    const { calls, executor } = executorDouble(installed(packageJson.version));
    const baseline = await doctor(target, executor);
    await write(target, 'AGENTS.md', content);
    assert.equal(content.includes(kitLocationBlockName), warned, name);

    const result = await doctor(target, executor);

    assert.deepEqual(calls, [], name);
    if (!warned) {
      assert.equal(formatDoctorResult(result), formatDoctorResult(baseline), name);
      continue;
    }
    const finding = assertFinding(result, 'mode/adapter-not-tracked', 'AGENTS.md', ['does not track or refresh it', `\`workflow-kit update --target ${target} --runtime claude,codex\``, 'delete the file'], 'warning');
    assert.equal(finding.message.includes('no longer'), false, finding.message);
    assert.deepEqual(result.diagnostics.filter((item) => item !== finding), baseline.diagnostics, name);
  }
});

// D15: a value the project chose in its settings file is reported as that
// choice, with what to change for the kit's value, not as a missing declaration.
test('D15: a plugin the project turned off or its own marketplace entry is named as the project\'s choice, not as mode/plugin-not-declared', async () => {
  const fork = { source: { source: 'github', repo: 'fork/kit' } };
  const disabled = ['mode/plugin-disabled-by-project', [`enabledPlugins["${pluginId}"]`, 'true']];
  const customized = ['mode/marketplace-customized', ['extraKnownMarketplaces["fhh-ia-ecosystem"]', JSON.stringify(kitMarketplace)]];
  const cases = [
    { name: 'plugin turned off', settings: { extraKnownMarketplaces: { 'fhh-ia-ecosystem': kitMarketplace }, enabledPlugins: { [pluginId]: false } }, expected: [disabled] },
    { name: 'own marketplace', settings: { extraKnownMarketplaces: { 'fhh-ia-ecosystem': fork }, enabledPlugins: { [pluginId]: true } }, expected: [customized] },
    { name: 'both', settings: { extraKnownMarketplaces: { 'fhh-ia-ecosystem': fork }, enabledPlugins: { [pluginId]: false } }, expected: [customized, disabled] }
  ];
  const target = await install('claude');
  const { executor } = executorDouble(installed(packageJson.version));
  for (const { name, settings, expected } of cases) {
    await write(target, '.claude/settings.json', settingsJson(settings));

    const result = await doctor(target, executor);

    assert.deepEqual(findings(result, 'mode/').map((item) => item.code).sort(), expected.map(([code]) => code).sort(), name);
    for (const [code, messages] of expected) assertFinding(result, code, '.claude/settings.json', messages, 'warning');
    assert.equal(result.ok, true, name);
  }
});

// R11: in plugin mode a file under the agents folders is a second copy of the
// kit only when it is a repo-mode agent, which carries the generator marker.
test('R11: in plugin mode only an agent with the repo-mode generator marker is mode/repo-and-plugin', async () => {
  const cases = [
    { name: 'repo-mode Claude agent', setup: async (target) => write(target, '.claude/agents/turbo-backend.md', await adapterTemplate('claude/.claude/agents/turbo-backend.md')), mixed: ['.claude/agents/turbo-backend.md'] },
    { name: 'repo-mode Copilot agent', setup: async (target) => write(target, '.github/agents/turbo-backend.agent.md', await adapterTemplate('copilot/.github/agents/turbo-backend.agent.md')), mixed: ['.github/agents/turbo-backend.agent.md'] },
    { name: 'project agent with a kit slug', setup: (target) => write(target, '.claude/agents/turbo-backend.md', '---\nname: turbo-backend\ndescription: Our own backend agent.\n---\nOur rules.\n'), mixed: [] },
    {
      name: 'edited plugin-variant agent kept when the profile went back to the default',
      setup: async (target) => {
        assert.equal((await cli(['update', '--target', target, '--profile', 'claude=costo', '--apply', '--yes'])).code, 0);
        await fs.appendFile(path.join(target, '.claude/agents/turbo-backend.md'), '\nOur extra rule.\n');
        assert.equal((await cli(['update', '--target', target, '--profile', 'claude=calidad', '--apply', '--yes'])).code, 0);
      },
      mixed: [],
      pending: '.claude/agents/turbo-backend.md'
    }
  ];
  const { executor } = executorDouble(installed(packageJson.version));
  for (const { name, setup, mixed, pending } of cases) {
    const target = await install('claude,copilot');
    await setup(target);

    const result = await doctor(target, executor);

    const mix = findings(result, 'mode/repo-and-plugin');
    if (mixed.length === 0) {
      assert.deepEqual(mix, [], name);
      assert.equal(result.ok, true, `${name}: ${JSON.stringify(result.diagnostics, null, 2)}`);
    } else {
      assert.equal(mix.length, 1, name);
      for (const relativePath of mixed) assert.ok(mix[0].message.includes(relativePath), `${name}: ${mix[0].message}`);
    }
    if (pending) assertFinding(result, 'boundary/pending-retired_edited', pending, [], 'warning');
  }
});

// F5: the default executor, against a `claude` that ignores SIGTERM and keeps
// a child holding its output open. The CLI runs as a separate process so a
// hang shows up as a process that does not exit.
test('F5: with the real command executor, doctor exits soon after its timeout when claude ignores SIGTERM', { timeout: pluginListTimeoutMs + 20000 }, async () => {
  const target = await install('claude');
  const bin = await makeTempRepo('workflow-kit-fake-claude-');
  const callLog = path.join(bin, 'calls.log');
  await fs.writeFile(path.join(bin, 'claude'), `#!/bin/sh\necho "$*" >> '${callLog}'\ntrap '' TERM\nwhile true; do sleep 30; done\n`, { mode: 0o755 });
  const limit = pluginListTimeoutMs + 5000;
  const started = Date.now();
  const child = spawn(process.execPath, [path.join(root, 'bin', 'workflow-kit.mjs'), 'doctor', '--target', target], {
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  const exited = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), limit);
    child.on('close', (code) => { clearTimeout(timer); resolve(code); });
  });
  const elapsed = Date.now() - started;
  // The whole process group: the CLI if it hangs, and the fake claude.
  try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }

  assert.notEqual(exited, false, `doctor still running after ${limit} ms`);
  assert.equal(exited, 0, stdout);
  assert.ok(elapsed >= pluginListTimeoutMs && elapsed < limit, `${elapsed} ms`);
  assert.match(stdout, /\[mode\/plugin-install-unverified\]/);
  assert.equal((await read(bin, 'calls.log')).trim(), 'plugin list --json');
});

// F4: in repo mode the settings files are read only to find the plugin turned
// on; one doctor cannot read adds nothing to the result. `.github` as a file
// also blocks the Copilot wrapper path the project-instructions check reads:
// those two findings are what doctor of 558e9fb (before plugin mode) reports
// for that tree, checked by running it on the same repository.
test('F4: in repo mode a plugin settings file doctor cannot read adds nothing to the result, as before plugin mode', async () => {
  const cases = [
    {
      name: 'settings without read permission',
      setup: async (target) => {
        await write(target, '.claude/settings.json', settingsJson({ enabledPlugins: { [pluginId]: true } }));
        await fs.chmod(path.join(target, '.claude/settings.json'), 0o000);
      },
      before: []
    },
    { name: 'a folder at the settings path', setup: (target) => fs.mkdir(path.join(target, '.claude/settings.json'), { recursive: true }), before: [] },
    {
      name: '.github is a file',
      setup: (target) => write(target, '.github', 'not a folder\n'),
      before: [['boundary/update-plan-failed', installStateRelativePath], ['managed/path-unreadable', '.github/instructions/quality-gate.instructions.md']]
    }
  ];
  const codeAndPath = (items) => items.map((item) => [item.code, item.path]).sort();
  for (const { name, setup, before } of cases) {
    const target = await install('claude', 'repo');
    const { calls, executor } = executorDouble(installed(packageJson.version));
    const baseline = await doctor(target, executor);
    await setup(target);

    const result = await doctor(target, executor);

    assert.deepEqual(codeAndPath(result.diagnostics), codeAndPath([...baseline.diagnostics, ...before.map(([code, relativePath]) => ({ code, path: relativePath }))]), name);
    assert.deepEqual(result.missing, baseline.missing, name);
    assert.equal(result.ok, before.length === 0, name);
    if (before.length === 0) assert.equal(formatDoctorResult(result), formatDoctorResult(baseline), name);
    assert.deepEqual(calls, [], name);
  }
});

// Final review, round 2 (M3, M7, M9, N4): what doctor says about a plugin that
// is off next to a project marketplace, a kit-location marker a hand edit left
// alone, a plugin newer than the CLI, and a runtime the install does not
// record.
test('M3: the project\'s own marketplace without a plugin entry says the plugin is not enabled', async () => {
  const target = await install('claude');
  const { executor } = executorDouble(installed(packageJson.version));
  await write(target, '.claude/settings.json', settingsJson({ extraKnownMarketplaces: { 'fhh-ia-ecosystem': { source: { source: 'github', repo: 'fork/kit' } } } }));

  const result = await doctor(target, executor);

  assertFinding(result, 'mode/marketplace-customized', '.claude/settings.json', [`enabledPlugins["${pluginId}"] is missing`, 'not enabled', 'true'], 'warning');
  assert.deepEqual(findings(result, 'mode/').map((item) => item.code), ['mode/marketplace-customized']);
});

test('M7: in repo mode a kit-location marker left without its pair is still mode/adapter-not-tracked', async () => {
  const template = await adapterTemplate('agents-md/AGENTS.md');
  const withoutEnd = pluginAdapterContent(template, 'workflow-kit:managed').replace(`<!-- ${kitLocationBlockName}:end -->\n`, '');
  assert.equal(withoutEnd.includes(`<!-- ${kitLocationBlockName}:end -->`), false);
  const target = await install('claude', 'repo');
  const { calls, executor } = executorDouble(installed(packageJson.version));
  await write(target, 'AGENTS.md', withoutEnd);

  const result = await doctor(target, executor);

  assert.deepEqual(calls, []);
  assertFinding(result, 'mode/adapter-not-tracked', 'AGENTS.md', ['does not track or refresh it', 'delete the file'], 'warning');
});

test('M9: a plugin newer than this CLI asks for a CLI upgrade; an older one for a plugin update', async () => {
  const target = await install('claude');
  const [major, minor] = packageJson.version.split('.').map(Number);
  const cases = [
    { version: `${major}.${minor + 1}.0-later`, says: 'workflow-kit upgrade --apply --yes', not: `claude plugin update ${pluginId}` },
    { version: '0.0.1', says: `claude plugin update ${pluginId}`, not: 'workflow-kit upgrade' }
  ];
  for (const { version, says, not } of cases) {
    const { executor } = executorDouble(installed(version));
    const finding = assertFinding(await doctor(target, executor), 'mode/plugin-version-mismatch', '.claude/settings.json', [version, packageJson.version, says], 'warning');
    assert.equal(finding.message.includes(not), false, `${version}: ${finding.message}`);
  }
});

test('N4: doctor --runtime copilot on a claude plugin install names the update that adds copilot, and that update works', async () => {
  const target = await install('claude');
  const { executor } = executorDouble(installed(packageJson.version));

  const result = await doctor(target, executor, { runtime: 'claude,copilot' });

  const finding = assertFinding(result, 'mode/plugin-not-declared', '.github/copilot/settings.json', [`\`workflow-kit update --target ${target} --runtime claude,copilot --apply --yes\``], 'warning');
  const [, command] = finding.message.match(/`(workflow-kit update [^`]+)`/);
  const update = await cli(command.replace(/^workflow-kit /, '').split(' '));
  assert.equal(update.code, 0, update.stderr);
  assert.equal(findings(await doctor(target, executor, { runtime: 'claude,copilot' }), 'mode/plugin-not-declared').length, 0);
});

// P11: a named pipe at a settings path is never opened, so nothing waits on it.
test('P11: a named pipe at .claude/settings.json does not hang doctor in repo mode or in plugin mode, nor init --mode plugin', { skip: process.platform === 'win32' && 'no mkfifo', timeout: 60000 }, async () => {
  const withPipe = async (target) => {
    await fs.rm(path.join(target, '.claude/settings.json'), { force: true });
    await fs.mkdir(path.join(target, '.claude'), { recursive: true });
    const made = spawnSync('mkfifo', [path.join(target, '.claude/settings.json')]);
    assert.equal(made.status, 0, String(made.stderr));
  };
  const { calls, executor } = executorDouble(installed(packageJson.version));

  const repo = await install('claude', 'repo');
  const repoBaseline = await doctor(repo, executor);
  await withPipe(repo);
  assert.equal(formatDoctorResult(await doctor(repo, executor)), formatDoctorResult(repoBaseline));
  assert.deepEqual(calls, []);

  const plugin = await install('claude');
  await withPipe(plugin);
  const pluginResult = await doctor(plugin, executor);
  assertFinding(pluginResult, 'managed/path-unreadable', '.claude/settings.json', ['EFTYPE'], 'error');

  const target = await makeTempRepo();
  await withPipe(target);
  const init = await cli(['init', '--target', target, '--mode', 'plugin', '--runtime', 'claude']);
  assert.notEqual(init.code, 0);
  assert.match(init.stderr, /\.claude\/settings\.json: it is not a regular file/);
});

// Item 5: in plugin mode the kit-location block is the only text that tells
// the agent where the kit is; losing it is a plugin-mode failure, with the
// command that restores it, and that command works as printed.
test('plugin mode: an adapter whose block lost the kit-location block is mode/kit-location-missing, and the printed update restores it', async () => {
  const target = await install('claude,copilot');
  const { executor } = executorDouble(installed(packageJson.version));
  const { start, end } = { start: `<!-- ${kitLocationBlockName}:start -->`, end: `<!-- ${kitLocationBlockName}:end -->` };
  const original = await read(target, 'CLAUDE.md');
  const cut = original.slice(0, original.indexOf(start)) + original.slice(original.indexOf(end) + end.length + 1);
  await write(target, 'CLAUDE.md', cut);

  const result = await doctor(target, executor);

  const finding = assertFinding(result, 'mode/kit-location-missing', 'CLAUDE.md', ['no workflow-kit:kit-location block', 'never told where the kit is', `\`workflow-kit update --target ${target} --apply --yes\``], 'error');
  assert.equal(result.ok, false);
  assert.deepEqual(findings(result, 'mode/kit-location-missing').map((item) => item.path), ['CLAUDE.md'], 'the other adapters keep it');
  const [, command] = finding.message.match(/`(workflow-kit [^`]+)`/);
  const update = await cli(command.replace(/^workflow-kit /, '').split(' '));
  assert.equal(update.code, 0, update.stderr);
  assert.ok((await read(target, 'CLAUDE.md')).includes(start));
  const after = await doctor(target, executor);
  assert.equal(after.ok, true, JSON.stringify(after.diagnostics, null, 2));
  assert.deepEqual(findings(after, 'mode/kit-location-missing'), []);
});

test('plugin mode: a plugin entry that is null or a string next to the project marketplace is reported as not enabled, in doctor and in the plan', async () => {
  const fork = { source: { source: 'github', repo: 'fork/kit' } };
  const target = await install('claude');
  const { executor } = executorDouble(installed(packageJson.version));
  for (const value of [null, 'yes']) {
    await write(target, '.claude/settings.json', settingsJson({ extraKnownMarketplaces: { 'fhh-ia-ecosystem': fork }, enabledPlugins: { [pluginId]: value } }));
    const result = await doctor(target, executor);
    assertFinding(result, 'mode/marketplace-customized', '.claude/settings.json', [`enabledPlugins["${pluginId}"] is ${JSON.stringify(value)}, not true, so the plugin is not enabled: set it to true to load it.`], 'warning');
    const plan = await cli(['update', '--target', target]);
    assert.match(plan.stdout, new RegExp(`enabledPlugins\\["${pluginId}"\\] is ${JSON.stringify(value).replace(/"/g, '"')}, not true, so the plugin is not enabled`), String(value));
  }
});

test('plugin mode: a plugin with the same version number and another suffix does not get a plugin update as the only advice', async () => {
  const target = await install('claude');
  const core = packageJson.version.match(/^\d+\.\d+\.\d+/)[0];
  const { executor } = executorDouble(installed(`${core}-another-build`));
  const finding = assertFinding(await doctor(target, executor), 'mode/plugin-version-mismatch', '.claude/settings.json', [`Both are ${core} with another suffix, so doctor cannot tell which build is newer`, `claude plugin update ${pluginId}`, 'workflow-kit upgrade --apply --yes'], 'warning');
  assert.ok(finding.message.includes(`\`cd ${target} && claude plugin update ${pluginId}\``), finding.message);
});

// Claude's project-scope commands act on the folder they run in.
test('plugin mode: the claude commands doctor prints run in the target', async () => {
  const target = await install('claude');
  const absent = assertFinding(await doctor(target, executorDouble(installed(null)).executor), 'mode/plugin-not-installed', '.claude/settings.json', [`\`cd ${target} && ${claudeInstall}\``], 'warning');
  assert.ok(absent);
  assertFinding(await doctor(target, executorDouble(answers('', 1)).executor), 'mode/plugin-install-unverified', '.claude/settings.json', [`\`cd ${target} && claude plugin list\``, `\`cd ${target} && ${claudeInstall}\``], 'warning');
  assertFinding(await doctor(target, executorDouble(answers(JSON.stringify([{ id: pluginId, version: packageJson.version, enabled: false }]))).executor), 'mode/plugin-disabled', '.claude/settings.json', [`\`cd ${target} && claude plugin enable ${pluginId}\``], 'warning');
});

test('plugin mode: an empty or blank settings file is filled with the declaration (with a backup), not reported as invalid', async () => {
  for (const content of ['', '  \n\t\n']) {
    const target = await install('claude');
    await write(target, '.claude/settings.json', content);
    const { executor } = executorDouble(installed(packageJson.version));
    const result = await doctor(target, executor);
    assertFinding(result, 'mode/plugin-not-declared', '.claude/settings.json', ['is not declared in this file', `\`workflow-kit update --target ${target} --apply --yes\``], 'warning');
    assert.equal(result.diagnostics.find((item) => item.code === 'mode/plugin-not-declared').message.includes('Not a JSON object'), false);
    const update = await cli(['update', '--target', target, '--apply', '--yes']);
    assert.equal(update.code, 0, update.stderr);
    assert.deepEqual(JSON.parse(await read(target, '.claude/settings.json')), { extraKnownMarketplaces: { 'fhh-ia-ecosystem': kitMarketplace }, enabledPlugins: { [pluginId]: true } }, JSON.stringify(content));
    assert.equal((await fs.readdir(path.join(target, '.claude'))).some((name) => name.startsWith('settings.json.workflow-kit-backup-')), true, 'the empty file has a backup');
    assert.equal(findings(await doctor(target, executor), 'mode/plugin-not-declared').length, 0);
  }
});

test('plugin mode: a settings file with a repeated key is never rewritten, and plan and doctor name the key', async () => {
  const target = await install('claude');
  const content = `{\n  "enabledPlugins": { "other@market": true },\n  "enabledPlugins": { "${pluginId}": false }\n}\n`;
  await write(target, '.claude/settings.json', content);
  const { executor } = executorDouble(installed(packageJson.version));

  const result = await doctor(target, executor);
  assertFinding(result, 'mode/plugin-not-declared', '.claude/settings.json', ['The key enabledPlugins appears more than once', 'keep only the last one', `\`workflow-kit update --target ${target} --apply --yes\``], 'warning');
  const update = await cli(['update', '--target', target, '--apply', '--yes']);
  assert.equal(update.code, 0, update.stderr);
  assert.match(update.stdout, /\.claude\/settings\.json \(duplicate_settings_key\): the key enabledPlugins appears more than once/);
  assert.equal(await read(target, '.claude/settings.json'), content, 'other@market stays');
});

test('a claude plugin list above 1 MB is read, not reported as a failure to run', async () => {
  const { runCommand, inspectInstalledPlugins } = await import('../src/plugin-mode.mjs');
  // About 6 MB, written by the child itself (an argument that size is too long).
  const script = `process.stdout.write('[' + Array(200000).fill('{"id":"x@y","version":"1.0.0"}').join(',') + ',{"id":"${pluginId}","version":"${packageJson.version}","enabled":true}]')`;
  const executor = (file, args, options) => runCommand(process.execPath, ['-e', script], options);
  assert.deepEqual(await inspectInstalledPlugins({ targetPath: process.cwd(), executor, timeoutMs: 20000 }), { status: 'installed', version: packageJson.version, enabled: true });
});

test('init --mode plugin --apply says the install commands fail until the plugin branch is published', async () => {
  const target = await makeTempRepo();
  const init = await cli(['init', '--target', target, '--mode', 'plugin', '--runtime', 'claude', '--apply', '--yes']);
  assert.equal(init.code, 0, init.stderr);
  assert.match(init.stdout, new RegExp(`- Claude Code: cd ${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} && ${claudeInstall}\\nEach person runs it once per clone of this repository; the repository only declares the plugin\\.\\nThe marketplace serves the plugin only after the kit's \`plugin\` branch is published; until then these commands fail\\.\\n`));
});
