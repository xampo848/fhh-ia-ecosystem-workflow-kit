import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArgs, printHelp } from '../src/cli/args.mjs';

test('parseArgs applies defaults when no flags are given', () => {
  const options = parseArgs(['init']);

  assert.equal(options.command, 'init');
  assert.equal(options.dryRun, true);
  assert.equal(options.apply, false);
  assert.equal(options.yes, false);
  assert.equal(options.runtime, 'neutral');
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
  assert.match(help, /workflow-kit export/);
  assert.match(help, /workflow-kit doctor/);
  assert.match(help, /workflow-kit tui/);
});
