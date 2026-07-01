import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

test('init defaults to dry-run and writes nothing', async () => {
  const target = await makeTempRepo();
  const io = createMemoryIo();

  const code = await runCli(['init', '--target', target, '--runtime', 'codex'], io);

  assert.equal(code, 0);
  assert.match(io.output.stdout, /Dry-run plan/);
  await assert.rejects(fs.access(path.join(target, '.agents/instructions.md')), { code: 'ENOENT' });
});

test('init apply requires --yes', async () => {
  const target = await makeTempRepo();
  const io = createMemoryIo();

  const code = await runCli(['init', '--target', target, '--apply'], io);

  assert.equal(code, 2);
  assert.match(io.output.stderr, /Refusing to apply without --yes/);
});

test('init --apply --yes writes selected templates', async () => {
  const target = await makeTempRepo();
  const io = createMemoryIo();

  const code = await runCli(['init', '--target', target, '--runtime', 'codex,copilot', '--overlay', 'starter', '--apply', '--yes'], io);

  assert.equal(code, 0);
  assert.match(io.output.stdout, /Applied writes:/);
  await fs.access(path.join(target, '.agents/instructions.md'));
  await fs.access(path.join(target, 'AGENTS.md'));
  await fs.access(path.join(target, '.github/copilot-instructions.md'));
  await fs.access(path.join(target, '.agents/skills/06-patterns/README.md'));
});

test('init apply creates backup before overwriting changed file', async () => {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, 'AGENTS.md'), 'existing local instructions\n', 'utf8');
  const io = createMemoryIo();

  const code = await runCli(['init', '--target', target, '--runtime', 'codex', '--apply', '--yes'], io);

  assert.equal(code, 0);
  assert.match(io.output.stdout, /Backups created: 1/);
  const entries = await fs.readdir(target);
  assert.ok(entries.some((entry) => entry.startsWith('AGENTS.md.workflow-kit-backup-')));
});


test('init --apply --yes writes all runtime adapter packs', async () => {
  const target = await makeTempRepo();
  const io = createMemoryIo();

  const code = await runCli(['init', '--target', target, '--runtime', 'codex,copilot,claude', '--overlay', 'starter', '--apply', '--yes'], io);

  assert.equal(code, 0);
  await fs.access(path.join(target, 'AGENTS.md'));
  await fs.access(path.join(target, '.codex/README.md'));
  await fs.access(path.join(target, '.github/copilot-instructions.md'));
  await fs.access(path.join(target, '.github/instructions/ai-workflow.instructions.md'));
  await fs.access(path.join(target, 'CLAUDE.md'));
  await fs.access(path.join(target, '.agents/capabilities/registry.md'));
});

test('export defaults to dry-run and writes nothing', async () => {
  const target = await makeTempRepo('workflow-kit-export-');
  const io = createMemoryIo();

  const code = await runCli(['export', '--output', target, '--runtime', 'codex'], io);

  assert.equal(code, 0);
  assert.match(io.output.stdout, /Export dry-run plan/);
  await assert.rejects(fs.access(path.join(target, '.agents/instructions.md')), { code: 'ENOENT' });
});

test('export --apply --yes writes selected templates', async () => {
  const target = await makeTempRepo('workflow-kit-export-');
  const io = createMemoryIo();

  const code = await runCli(['export', '--output', target, '--runtime', 'codex', '--overlay', 'starter', '--apply', '--yes'], io);

  assert.equal(code, 0);
  assert.match(io.output.stdout, /Exported files:/);
  await fs.access(path.join(target, '.agents/instructions.md'));
  await fs.access(path.join(target, 'AGENTS.md'));
  await fs.access(path.join(target, '.agents/skills/06-patterns/README.md'));
});
