import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { parseArgs, printHelp } from '../src/cli/args.mjs';
import { buildInstallPlan } from '../src/planner.mjs';
import { parseProfileOption } from '../src/model-profiles.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

test('parseArgs applies defaults when no flags are given', () => {
  const options = parseArgs(['init']);

  assert.equal(options.command, 'init');
  assert.equal(options.dryRun, true);
  assert.equal(options.apply, false);
  assert.equal(options.yes, false);
  assert.equal(options.runtime, undefined, 'init/export default to neutral; update/doctor reuse stored runtimes');
  assert.equal(options.overlay, 'fhh-ia-ecosystem-full');
});

test('parseArgs parses target, runtime, overlay and apply/yes flags', () => {
  const options = parseArgs(['update', '--target', '/tmp/repo', '--runtime', 'codex,copilot', '--overlay', 'fhh-ia-ecosystem-full', '--apply', '--yes']);

  assert.equal(options.targetPath, '/tmp/repo');
  assert.equal(options.runtime, 'codex,copilot');
  assert.equal(options.overlay, 'fhh-ia-ecosystem-full');
  assert.equal(options.apply, true);
  assert.equal(options.dryRun, false);
  assert.equal(options.yes, true);
});

// --adopt-existing is read only by update (export never adopted anything).
test('parseArgs parses export output path and adopt-existing flag', () => {
  const options = parseArgs(['export', '--output', '/tmp/out']);
  const update = parseArgs(['update', '--adopt-existing']);

  assert.equal(options.outputPath, '/tmp/out');
  assert.equal(update.adoptExisting, true);
});

test('parseArgs parses upgrade ref and package manager flags', () => {
  const options = parseArgs(['upgrade', '--ref', 'v0.7.1', '--package-manager', 'bun', '--apply', '--yes']);

  assert.equal(options.ref, 'v0.7.1');
  assert.equal(options.packageManager, 'bun');
  assert.equal(options.apply, true);
  assert.equal(options.yes, true);
});

test('parseArgs parses backup mode for install and update flows', () => {
  const initOptions = parseArgs(['init', '--backup-mode', 'none']);
  const updateOptions = parseArgs(['update', '--backup-mode', 'required']);

  assert.equal(initOptions.backupMode, 'none');
  assert.equal(updateOptions.backupMode, 'required');
});

test('parseArgs collects repeatable --edited decisions by path, all= included', () => {
  const options = parseArgs(['update', '--edited', 'CLAUDE.md=split', '--edited', 'all=discard', '--edited', '.agents/skills/a/SKILL.md=shadow']);

  assert.deepEqual(options.edited, { 'CLAUDE.md': 'split', all: 'discard', '.agents/skills/a/SKILL.md': 'shadow' });
  assert.equal(parseArgs(['update']).edited, undefined);
});

test('parseArgs rejects a malformed --edited value or an unknown decision', () => {
  const cases = [
    { args: ['--edited'], error: /Missing value for --edited/ },
    { args: ['--edited', '--apply'], error: /Missing value for --edited/ },
    { args: ['--edited', 'CLAUDE.md'], error: /Invalid --edited CLAUDE\.md: use --edited <path>=<decision> or --edited all=<decision>\./ },
    { args: ['--edited', '=keep'], error: /Invalid --edited =keep: use --edited <path>=<decision>/ },
    { args: ['--edited', 'CLAUDE.md='], error: /Invalid --edited CLAUDE\.md=: use --edited <path>=<decision>/ },
    { args: ['--edited', 'CLAUDE.md=merge'], error: /Invalid --edited CLAUDE\.md=merge: unknown decision merge\. Use one of: keep, discard, shadow, split\./ },
    { args: ['--edited', 'all=keep', '--edited', 'all=discard'], error: /--edited all is given more than once/ }
  ];
  for (const item of cases) assert.throws(() => parseArgs(['update', ...item.args]), item.error, item.args.join(' '));
});

// Wiring: the planner proves which decisions apply (migration.test.mjs).
test('update with an --edited decision that does not apply exits 2 and writes nothing', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const instructions = path.join(target, '.agents/instructions.md');
  await fs.appendFile(instructions, '\nLocal edit.\n');
  const watched = ['.agents/instructions.md', '.agents/workflow-kit/install-state.json', '.agents/workflow-kit/last-apply.json'].map((relativePath) => path.join(target, relativePath));
  const before = await Promise.all(watched.map((file) => fs.readFile(file, 'utf8')));
  const entriesBefore = await fs.readdir(path.dirname(instructions));
  const io = createMemoryIo();

  const code = await runCli(['update', '--target', target, '--edited', '.agents/instructions.md=shadow', '--apply', '--yes'], io);

  assert.equal(code, 2);
  assert.match(io.output.stderr, /^Invalid --edited \.agents\/instructions\.md=shadow: shadow does not apply to this file\. Valid decisions: keep \| discard\. Nothing was written\.$/m);
  assert.deepEqual(await Promise.all(watched.map((file) => fs.readFile(file, 'utf8'))), before);
  assert.deepEqual(await fs.readdir(path.dirname(instructions)), entriesBefore, 'no backup file appears');
});

test('parseArgs marks help flag for --help and -h', () => {
  assert.equal(parseArgs(['init', '--help']).help, true);
  assert.equal(parseArgs(['init', '-h']).help, true);
});

test('parseArgs throws on unknown argument', () => {
  assert.throws(() => parseArgs(['init', '--bogus']), /Unknown argument: --bogus/);
});

test('printHelp documents all commands', () => {
  const help = printHelp();

  assert.match(help, /workflow-kit init/);
  assert.match(help, /workflow-kit update/);
  assert.match(help, /workflow-kit upgrade/);
  assert.match(help, /workflow-kit export/);
  assert.match(help, /workflow-kit doctor/);
  assert.match(help, /workflow-kit tui/);
  assert.match(help, /--backup-mode required\|none/);
  assert.match(help, /--profile <runtime>=<calidad\|equilibrado\|costo>/);
  assert.match(help, /workflow-kit update .*\[--edited <path>=<decision>\]\.\.\. \[--edited all=<decision>\]/);
});

test('printHelp says which commands act on a project and which one updates workflow-kit itself', () => {
  const help = printHelp();

  assert.match(help, /^Commands:$/m);
  assert.match(help, /^  update +Update the workflow installed in a project/m);
  assert.match(help, /^  upgrade +Update workflow-kit itself \(this tool\) on this machine; projects are not changed$/m);
  for (const command of ['init', 'export', 'doctor', 'rollback', 'tui']) {
    assert.match(help, new RegExp(`^  ${command} +\\S`, 'm'));
  }
});

// Runs the CLI from `cwd`, so a flag that fell back to the current folder
// would write there.
async function runIn(cwd, args) {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    const io = createMemoryIo();
    const code = await runCli(args, io);
    return { code, ...io.output };
  } finally {
    process.chdir(previous);
  }
}

test('a flag the command does not read exits 2 naming flag and command, and nothing is written', async () => {
  const cwd = await makeTempRepo();
  const other = await makeTempRepo();
  const cases = [
    { args: ['init', '--output', other, '--runtime', 'claude', '--apply', '--yes'], flag: '--output', command: 'init', hint: /use --target <path>/ },
    { args: ['doctor', '--apply', '--yes'], flag: '--apply', command: 'doctor' },
    { args: ['doctor', '--dry-run'], flag: '--dry-run', command: 'doctor' },
    { args: ['rollback', '--runtime', 'x'], flag: '--runtime', command: 'rollback' },
    { args: ['init', '--ref', 'main'], flag: '--ref', command: 'init' },
    { args: ['init', '--edited', 'a=keep'], flag: '--edited', command: 'init' },
    { args: ['tui', '--target', 'foo'], flag: '--target', command: 'tui' },
    { args: ['rollback', '--overlay', 'fhh-ia-ecosystem-full'], flag: '--overlay', command: 'rollback' },
    { args: ['upgrade', '--target', other], flag: '--target', command: 'upgrade' },
    { args: ['export', '--output', other, '--diff'], flag: '--diff', command: 'export' },
    { args: ['export', '--target', other, '--apply', '--yes'], flag: '--target', command: 'export', hint: /writes into --output <path>/ }
  ];
  for (const item of cases) {
    const result = await runIn(cwd, item.args);
    assert.equal(result.code, 2, item.args.join(' '));
    assert.match(result.stderr, new RegExp(`^${item.flag} does not apply to ${item.command}\\.`, 'm'), item.args.join(' '));
    assert.match(result.stderr, new RegExp(`see workflow-kit ${item.command} --help\\)\\. Nothing was written\\.`), item.args.join(' '));
    if (item.hint) assert.match(result.stderr, item.hint);
    assert.equal(result.stdout, '', item.args.join(' '));
  }
  assert.deepEqual(await fs.readdir(cwd), []);
  assert.deepEqual(await fs.readdir(other), []);
});

test('the flags each command reads still parse', () => {
  const valid = [
    ['init', '--target', 't', '--runtime', 'claude', '--overlay', 'fhh-ia-ecosystem-full', '--profile', 'claude=costo', '--stack', 'none', '--mode', 'repo', '--diff', '--backup-mode', 'none', '--dry-run'],
    ['update', '--target', 't', '--adopt-existing', '--edited', 'all=keep', '--diff', '--apply', '--yes'],
    ['upgrade', '--ref', 'v1', '--package-manager', 'bun', '--apply', '--yes'],
    ['export', '--output', 'o', '--runtime', 'codex', '--backup-mode', 'required', '--apply', '--yes'],
    ['doctor', '--target', 't', '--runtime', 'codex', '--overlay', 'fhh-ia-ecosystem-full'],
    ['rollback', '--target', 't', '--apply', '--yes'],
    ['tui']
  ];
  for (const args of valid) assert.doesNotThrow(() => parseArgs(args), args.join(' '));
});

test('an empty value for any value flag is an error decided by the parser, never a default', async () => {
  const cwd = await makeTempRepo();
  const flags = {
    init: ['--target', '--runtime', '--overlay', '--profile', '--stack', '--mode', '--backup-mode'],
    export: ['--output'],
    upgrade: ['--ref', '--package-manager'],
    update: ['--edited']
  };
  for (const [command, names] of Object.entries(flags)) {
    for (const flag of names) {
      for (const empty of ['', ' ']) {
        assert.throws(() => parseArgs([command, flag, empty]), new RegExp(`^Error: Empty value for ${flag}: give it a value or leave the flag out\\. Nothing was written\\.$`), `${command} ${flag} '${empty}'`);
      }
    }
  }
  const initEmpty = await runIn(cwd, ['init', '--target', '', '--apply', '--yes']);
  assert.equal(initEmpty.code, 2);
  assert.equal(initEmpty.stdout, '', 'no plan of the current folder is printed');
  assert.match(initEmpty.stderr, /^Empty value for --target/m);
  assert.deepEqual(await fs.readdir(cwd), []);
});

test('--runtime with an empty entry or an unknown runtime exits 2 instead of becoming neutral', async () => {
  for (const value of [',', 'claude,', ',claude', 'claude,,copilot']) {
    assert.throws(() => parseArgs(['doctor', '--runtime', value]), /Invalid --runtime ".*": the list has an empty entry\. Use a comma-separated list of: codex, copilot, claude, antigravity, opencode, neutral\./, value);
  }
  assert.throws(() => parseArgs(['init', '--runtime', 'claude,cursor']), /^Error: Unsupported runtime: cursor\. Use a comma-separated list of: codex, copilot, claude, antigravity, opencode, neutral\./);
  const target = await makeTempRepo();
  const io = createMemoryIo();
  assert.equal(await runCli(['doctor', '--target', target, '--runtime', ''], io), 2);
  assert.doesNotMatch(io.output.stdout, /Doctor: ok|Runtimes: neutral/);
});

test('a value flag given twice exits 2 instead of keeping the last value', () => {
  for (const args of [
    ['init', '--target', 'a', '--target', 'b'],
    ['init', '--runtime', 'claude', '--runtime', 'codex'],
    ['update', '--profile', 'claude=costo', '--profile', 'claude=calidad'],
    ['upgrade', '--ref', 'a', '--ref', 'b']
  ]) {
    assert.throws(() => parseArgs(args), new RegExp(`^Error: ${args[1]} is given more than once; give it once\\. Nothing was written\\.$`), args.join(' '));
  }
});

test('--profile rejects a repeated runtime, a malformed entry and a runtime the command line does not install', async () => {
  assert.throws(() => parseProfileOption('claude=calidad,claude=costo'), /--profile gives claude more than one profile \(calidad and costo\); give one\./);
  assert.throws(() => parseProfileOption('claude=calidad=x'), /Invalid --profile entry "claude=calidad=x": use <runtime>=<calidad\|equilibrado\|costo>/);
  assert.throws(() => parseProfileOption('claude=calidad,'), /Invalid --profile entry ""/);
  for (const profile of ['claude=calidad,claude=costo', 'claude=calidad=x']) {
    const target = await makeTempRepo();
    const io = createMemoryIo();
    assert.equal(await runCli(['init', '--target', target, '--runtime', 'claude', '--profile', profile, '--apply', '--yes'], io), 2, profile);
    assert.match(io.output.stderr, /--profile/, profile);
    assert.deepEqual(await fs.readdir(target), [], profile);
  }
  assert.throws(() => parseArgs(['init', '--runtime', 'claude', '--profile', 'codex=calidad']), /^Error: --profile names codex, which this init does not install \(--runtime is claude\), so the profile would be ignored\./);
  assert.throws(() => parseArgs(['init', '--profile', 'claude=costo']), /--profile names claude, which this init does not install \(init without --runtime installs neutral\)/);
  assert.throws(() => parseArgs(['update', '--runtime', 'codex', '--profile', 'claude=costo']), /--profile names claude, which this update does not install \(--runtime is codex\)/);
  assert.doesNotThrow(() => parseArgs(['update', '--profile', 'claude=costo']), 'update without --runtime checks against the recorded runtimes later');
});

test('update --profile for a runtime the install does not record exits 2 and writes nothing', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'codex' }));
  const statePath = path.join(target, '.agents/workflow-kit/install-state.json');
  const before = await fs.readFile(statePath, 'utf8');
  const io = createMemoryIo();

  const code = await runCli(['update', '--target', target, '--profile', 'claude=costo', '--apply', '--yes'], io);

  assert.equal(code, 2);
  assert.match(io.output.stderr, /^--profile names claude, but the runtimes are codex, so that profile would be ignored\. Add the runtime with --runtime or drop it from --profile\. Nothing was written\.$/m);
  assert.equal(await fs.readFile(statePath, 'utf8'), before);
});

test('help lists the valid --runtime values, and <command> --help prints that command only', async () => {
  assert.match(printHelp(), /--runtime takes a comma-separated list of: codex, copilot, claude, antigravity, opencode, neutral/);
  for (const command of ['init', 'update', 'upgrade', 'export', 'doctor', 'rollback', 'tui']) {
    const io = createMemoryIo();
    assert.equal(await runCli([command, '--help'], io), 0, command);
    assert.match(io.output.stdout, new RegExp(`^Usage:\\n  workflow-kit ${command}( |\\n)`), command);
    const others = ['init', 'update', 'upgrade', 'export', 'doctor', 'rollback', 'tui'].filter((item) => item !== command);
    for (const other of others) assert.doesNotMatch(io.output.stdout, new RegExp(`workflow-kit ${other}\\b`), `${command} --help names ${other}`);
  }
  const doctorHelp = createMemoryIo();
  await runCli(['doctor', '--help'], doctorHelp);
  assert.match(doctorHelp.output.stdout, /--runtime takes a comma-separated list of/);
});

test('init --mode plugin --profile without --runtime gets the plugin-mode stop, and tui --help names what the menu does', async () => {
  const target = await makeTempRepo();
  const io = createMemoryIo();
  assert.equal(await runCli(['init', '--target', target, '--mode', 'plugin', '--profile', 'claude=costo'], io), 2);
  assert.match(io.output.stderr, /plugin mode needs --runtime/);
  assert.doesNotMatch(io.output.stderr, /installs neutral/);
  assert.throws(() => parseArgs(['init', '--profile', 'claude=costo']), /init without --runtime installs neutral/, 'repo mode keeps its message');

  const help = createMemoryIo();
  await runCli(['tui', '--help'], help);
  assert.match(help.output.stdout, /^tui: Guided menu for init, update, export, doctor, rollback and upgrade\.$/m);
  assert.doesNotMatch(help.output.stdout + printHelp(), /all of the above/);
});

// A stop message names a command to run; the stricter parser must accept every
// one of them. The commands that carry flags are found in the source of the
// modules that print them (doctor's are run as printed in doctor.test.mjs).
test('every command a stop message or summary prints with flags is accepted by the parser', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const files = (await fs.readdir(path.join(root, 'src'), { recursive: true })).filter((file) => file.endsWith('.mjs') && !['cli/args.mjs', 'doctor.mjs'].includes(file));
  const commands = new Set();
  for (const file of files) {
    const source = await fs.readFile(path.join(root, 'src', file), 'utf8');
    for (const match of source.matchAll(/workflow-kit (init|update|upgrade|export|doctor|rollback)( --[^`'"\\\n]*)?/g)) {
      const filled = match[0]
        .replace(/<runtime>=<[^>]*>/g, 'claude=calidad').replace(/\$\{[^}]*\}/g, 'claude').replace(/<list>|<lista>/g, 'claude')
        .replace(/<repo>|<ruta>/g, '/tmp/r').replace(/<path>/g, 'a.md').replace(/<decision>/g, 'keep')
        .replace(/ \(.*$/, '').replace(/ (again|next|to|in|failed|stopped|para)\b.*$/, '').trim();
      commands.add(filled);
    }
  }
  assert.ok(commands.size >= 8, [...commands].join('\n'));
  for (const command of commands) {
    const [, name, ...args] = command.split(/\s+/);
    assert.doesNotThrow(() => parseArgs([name, ...args]), command);
  }
});
