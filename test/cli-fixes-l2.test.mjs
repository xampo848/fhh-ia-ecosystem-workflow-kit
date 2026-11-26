import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { runCli } from '../src/cli.mjs';
import { parseArgs, printHelp } from '../src/cli/args.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

const execFileAsync = promisify(execFile);
const cliBin = path.resolve('bin/workflow-kit.mjs');

// Stub package managers first on PATH, and a BUN_INSTALL inside a temp dir:
// no test runs a real one or reaches the user's global install.
async function withStubManagers(body) {
  const dir = await makeTempRepo('workflow-kit-pm-stubs-');
  const log = path.join(dir, 'calls.log');
  for (const name of ['npm', 'pnpm', 'yarn', 'bun']) {
    await fs.writeFile(path.join(dir, name), `#!/bin/sh\necho "${name} $*" >> "${log}"\nexit 0\n`, { mode: 0o755 });
  }
  const previous = { PATH: process.env.PATH, BUN_INSTALL: process.env.BUN_INSTALL };
  process.env.PATH = `${dir}${path.delimiter}${previous.PATH}`;
  process.env.BUN_INSTALL = path.join(dir, 'bun-home');
  try {
    return await body(async () => (await fs.readFile(log, 'utf8').catch(() => '')).split('\n').filter(Boolean));
  } finally {
    process.env.PATH = previous.PATH;
    if (previous.BUN_INSTALL === undefined) delete process.env.BUN_INSTALL;
    else process.env.BUN_INSTALL = previous.BUN_INSTALL;
  }
}

test('upgrade rejects an unsupported package manager the same way in a dry run and with --apply', async () => {
  await withStubManagers(async (calls) => {
    for (const value of ['npm', 'pnpm', 'yarn', 'bun;ls']) {
      for (const extra of [[], ['--apply', '--yes']]) {
        const io = createMemoryIo();
        const code = await runCli(['upgrade', '--package-manager', value, ...extra], io);
        const label = `${value} ${extra.join(' ')}`;
        assert.equal(code, 2, label);
        assert.match(io.output.stderr, new RegExp(`Unsupported package manager: ${value.replace(';', '\;')}\\. workflow-kit upgrade supports: bun\\. Nothing was run\\.`), label);
        assert.equal(io.output.stdout, '', `${label}: no plan is printed`);
      }
    }
    assert.deepEqual(await calls(), [], 'no package manager ran');
  });
});

test('upgrade keeps a supported manager that is not installed as a dry-run note', async () => {
  const dir = await makeTempRepo('workflow-kit-pm-empty-');
  const previous = { PATH: process.env.PATH, BUN_INSTALL: process.env.BUN_INSTALL };
  process.env.PATH = dir;
  process.env.BUN_INSTALL = path.join(dir, 'bun-home');
  try {
    const io = createMemoryIo();
    assert.equal(await runCli(['upgrade'], io), 0);
    assert.match(io.output.stdout, /Package manager: bun/);
    assert.match(io.output.stdout, /Note: bun is required in PATH/);
  } finally {
    process.env.PATH = previous.PATH;
    if (previous.BUN_INSTALL === undefined) delete process.env.BUN_INSTALL;
    else process.env.BUN_INSTALL = previous.BUN_INSTALL;
  }
});

test('tui --help names only what the menu offers', async () => {
  const help = createMemoryIo();
  await runCli(['tui', '--help'], help);
  assert.match(help.output.stdout, /^tui: Guided menu for install, update, export, doctor, upgrade and optional tools\.$/m);
  // The menu definition is not exported (the TUI imports its terminal at load),
  // so read its values from the source: the help must not name a command it lacks.
  const source = await fs.readFile(path.resolve('src/tui.mjs'), 'utf8');
  const menu = source.slice(source.indexOf('const TUI_MODE_OPTIONS'), source.indexOf('];', source.indexOf('const TUI_MODE_OPTIONS')));
  const offered = [...menu.matchAll(/value: '([^']+)'/g)].map((match) => match[1]);
  for (const command of ['init', 'update', 'export', 'doctor', 'rollback', 'upgrade']) {
    const inMenu = offered.some((value) => value.includes(command) || (command === 'init' && value === 'install'));
    const inHelp = new RegExp(`Guided menu for [^.]*\\b${command === 'init' ? 'install' : command}\\b`).test(help.output.stdout);
    assert.equal(inHelp, inMenu, `${command}: help and menu agree`);
  }
  assert.doesNotMatch(printHelp(), /Guided menu for [^\n]*rollback/);
});

test('a command a stop message prints stays unambiguous when the target holds a backtick', () => {
  const target = '/tmp/odd`dir';
  assert.throws(() => parseArgs(['doctor', '--target', target, '--mode', 'plugin']), (error) => {
    assert.match(error.message, /Run `` workflow-kit doctor --target '\/tmp\/odd`dir' `` without it\./);
    return true;
  });
  assert.throws(() => parseArgs(['doctor', '--target', '/tmp/plain', '--mode', 'plugin']), /Run `workflow-kit doctor --target \/tmp\/plain` without it\./);
});

async function brokenInstall() {
  const target = await makeTempRepo('workflow-kit-doctor advice-');
  await execFileAsync('git', ['init', '-q'], { cwd: target });
  const init = createMemoryIo();
  assert.equal(await runCli(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes'], init), 0);
  // Without the level pre-filter block, and with an unignored workspace.
  const adapter = path.join(target, 'CLAUDE.md');
  const text = await fs.readFile(adapter, 'utf8');
  const start = text.indexOf('<!-- workflow-kit:level-prefilter:start -->');
  const endMarker = '<!-- workflow-kit:level-prefilter:end -->';
  await fs.writeFile(adapter, text.slice(0, start) + text.slice(text.indexOf(endMarker) + endMarker.length));
  await fs.mkdir(path.join(target, '.ai-work/x'), { recursive: true });
  await fs.writeFile(path.join(target, '.gitignore'), '');
  return target;
}

test('doctor prints its update advice as a runnable command with the target, and the command runs from another cwd', async () => {
  const target = await brokenInstall();
  const io = createMemoryIo();
  await runCli(['doctor', '--target', target], io);
  const out = io.output.stdout;
  const quoted = `'${target}'`;
  const expected = /^[\w@%+=:,./-]+$/.test(target) ? target : quoted;
  const command = `workflow-kit update --target ${expected}`;
  assert.ok(out.includes(`Accept the updated adapter from \`${command}\`, or copy`), out);
  assert.ok(out.includes(`Run \`${command}\`, or add ".ai-work/" to .gitignore.`), out);
  assert.doesNotMatch(out, /(?<!`)workflow-kit update(?! --target)/);

  // The printed command, verbatim, from another directory: a dry run of this target.
  const elsewhere = await makeTempRepo('workflow-kit-elsewhere-');
  const { stdout } = await execFileAsync('/bin/sh', ['-c', command.replace(/^workflow-kit/, `node ${JSON.stringify(cliBin)}`)], { cwd: elsewhere });
  assert.match(stdout, new RegExp(`Target: ${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(stdout, /dry-run plan/i);
});

test('kit validation without a target keeps its advice generic', async () => {
  const { validateAdapterContracts } = await import('../src/workflow-contract/adapters.mjs');
  const root = await makeTempRepo('workflow-kit-generic-');
  await fs.writeFile(path.join(root, 'CLAUDE.md'), 'Do not reuse or cache the previous workflow decision across turns.\n');
  const diagnostics = await validateAdapterContracts({ root, runtimes: ['claude'] });
  const stale = diagnostics.find((item) => /Run workflow-kit update to accept/.test(item.message));
  assert.ok(stale, JSON.stringify(diagnostics));
  assert.doesNotMatch(stale.message, /--target/);
});

test('no printed text says "toolkit": upgrade dry run, plan header and doctor', async () => {
  await withStubManagers(async () => {
    const io = createMemoryIo();
    assert.equal(await runCli(['upgrade', '--package-manager', 'bun'], io), 0);
    assert.doesNotMatch(io.output.stdout + io.output.stderr, /toolkit/i);
    const guard = createMemoryIo();
    assert.equal(await runCli(['upgrade', '--apply'], guard), 2);
    assert.doesNotMatch(guard.output.stderr, /toolkit/i);
  });
  const target = await makeTempRepo();
  const plan = createMemoryIo();
  assert.equal(await runCli(['init', '--target', target, '--runtime', 'claude'], plan), 0);
  assert.match(plan.output.stdout, /^workflow-kit version: /m);
  assert.doesNotMatch(plan.output.stdout, /toolkit version/i);
  const doctor = createMemoryIo();
  await runCli(['doctor', '--target', target], doctor);
  assert.match(doctor.output.stdout, /^workflow-kit version: /m);
  assert.doesNotMatch(doctor.output.stdout, /toolkit/i);
});
