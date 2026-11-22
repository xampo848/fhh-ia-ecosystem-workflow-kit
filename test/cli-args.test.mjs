import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { parseArgs, printHelp } from '../src/cli/args.mjs';
import { buildInstallPlan } from '../src/planner.mjs';
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

test('parseArgs parses export output path and adopt-existing flag', () => {
  const options = parseArgs(['export', '--output', '/tmp/out', '--adopt-existing']);

  assert.equal(options.outputPath, '/tmp/out');
  assert.equal(options.adoptExisting, true);
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
