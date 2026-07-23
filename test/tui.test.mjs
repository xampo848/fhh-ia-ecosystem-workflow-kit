import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { buildInstallPlan } from '../src/planner.mjs';
import { runTui } from '../src/tui.mjs';
import { makeTempRepo } from './helpers.mjs';

function scriptedAsk(answers) {
  const queue = [...answers];
  return async () => queue.shift() ?? '';
}

test('tui previews plan and default decline writes nothing', async () => {
  const target = await makeTempRepo();
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['', target, '', '', '', '']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.code, 0);
  assert.equal(result.applied, false);
  assert.match(output, /FHH IA Ecosystem/);
  assert.match(output, /Full FHH IA Ecosystem flow selected \(recommended\)\./);
  assert.match(output, /Mission control/);
  assert.match(output, /Local skills\s+: 0 auto-discovered/);
  assert.match(output, /Legacy docs are not moved automatically/);
  assert.match(output, /Aborted\. No files were written\./);
  await assert.rejects(fs.access(path.join(target, '.agents/instructions.md')), { code: 'ENOENT' });
});

test('tui confirmed apply writes selected files through planner apply', async () => {
  const target = await makeTempRepo();
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['', target, '6', '', '', 'yes']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.code, 0);
  assert.equal(result.applied, true);
  assert.match(output, /Apply completed successfully\./);
  assert.match(output, /Applied writes:/);
  await fs.access(path.join(target, '.agents/instructions.md'));
  await fs.access(path.join(target, 'AGENTS.md'));
  await fs.access(path.join(target, '.github/copilot-instructions.md'));
  await fs.access(path.join(target, '.agents/skills/06-patterns/README.md'));
});

test('tui combines GitHub Copilot and Antigravity adapters', async () => {
  const target = await makeTempRepo();

  const result = await runTui({
    ask: scriptedAsk(['', target, '3,5', '', '']),
    color: false,
    write: () => {}
  });

  assert.equal(result.applied, false);
  assert.deepEqual(result.plan.runtimes, ['copilot', 'antigravity']);
  assert.ok(result.plan.operations.some((item) => item.relativePath === '.github/copilot-instructions.md'));
});

test('tui can auto-install install+attach optional capabilities in one confirmation using bun', async () => {
  const target = await makeTempRepo();
  const executed = [];

  const result = await runTui({
    ask: scriptedAsk(['', target, '1', '', 'yes', '3', '1', '2', 'yes', 'yes']),
    color: false,
    write: () => {},
    commandExists: async (command) => command === 'bun',
    runCommand: async ({ command, args }) => {
      executed.push(`${command} ${args.join(' ')}`);
      return { ok: true, code: 0 };
    }
  });

  assert.equal(result.applied, true);
  assert.deepEqual(executed, [
    'bun add -g codebase-memory-mcp',
    'codebase-memory-mcp install'
  ]);
  assert.equal(result.capabilityInstallResult.attempted, 2);
  assert.equal(result.capabilityInstallResult.succeeded, 2);
  assert.equal(result.capabilityInstallResult.failed, 0);
});

test('tui auto-installs context7 package and reports manual configuration steps', async () => {
  const target = await makeTempRepo();
  const executed = [];
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['', target, '1', '', 'yes', '1', '1', '2', 'yes', 'yes']),
    color: false,
    write: (message) => { output += message; },
    commandExists: async (command) => command === 'bun',
    runCommand: async ({ command, args }) => {
      executed.push(`${command} ${args.join(' ')}`);
      return { ok: true, code: 0 };
    }
  });

  assert.equal(result.applied, true);
  assert.deepEqual(executed, ['bun add -g @upstash/context7-mcp']);
  assert.equal(result.capabilityInstallResult.attempted, 1);
  assert.equal(result.capabilityInstallResult.succeeded, 1);
  assert.equal(result.capabilityInstallResult.failed, 0);
  assert.match(output, /Manual configuration required:/);
  assert.match(output, /Context7 still requires manual MCP configuration with your API key\./);
});

test('tui capabilities-only mode runs optional capabilities without applying workflow files', async () => {
  const target = await makeTempRepo();
  const executed = [];

  const result = await runTui({
    ask: scriptedAsk(['6', target, '1', '3', '1', '2', 'yes']),
    color: false,
    write: () => {},
    commandExists: async (command) => command === 'bun',
    runCommand: async ({ command, args }) => {
      executed.push(`${command} ${args.join(' ')}`);
      return { ok: true, code: 0 };
    }
  });

  assert.equal(result.mode, 'capabilities-only');
  assert.equal(result.applied, false);
  assert.deepEqual(executed, [
    'bun add -g codebase-memory-mcp',
    'codebase-memory-mcp install'
  ]);
  await assert.rejects(fs.access(path.join(target, '.agents/instructions.md')), { code: 'ENOENT' });
});

test('tui update mode applies managed workflow updates without reinstall flow semantics', async () => {
  const target = await makeTempRepo();
  const installPlan = await buildInstallPlan({ targetPath: target, runtime: 'codex' });
  await applyInstallPlan(installPlan);
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['2', target, '1', '', '', 'yes']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.mode, 'update');
  assert.equal(result.applied, true);
  assert.equal(result.plan.previousToolkitVersion, null);
  assert.match(output, /Protected local edits \(skipped\):/);
  assert.match(output, /Managed target/);
});

test('tui upgrade-toolkit mode runs the global upgrade command and exits without repo writes', async () => {
  const target = await makeTempRepo();
  const executed = [];

  const result = await runTui({
    ask: scriptedAsk(['5', '', 'yes']),
    color: false,
    write: () => {},
    commandExists: async (command) => command === 'bun',
    runCommand: async ({ command, args }) => {
      executed.push(`${command} ${args.join(' ')}`);
      return { ok: true, code: 0 };
    }
  });

  assert.equal(result.mode, 'upgrade-toolkit');
  assert.equal(result.applied, false);
  assert.deepEqual(executed, ['bun add -g github:xampo848/fhh-ia-ecosystem-workflow-kit#main']);
  await assert.rejects(fs.access(path.join(target, '.agents/instructions.md')), { code: 'ENOENT' });
});

test('tui export mode writes workflow files into the selected output directory', async () => {
  const target = await makeTempRepo('workflow-kit-tui-export-');
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['3', target, '2', '', '', 'yes']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.mode, 'export');
  assert.equal(result.applied, true);
  assert.match(output, /Export completed successfully\./);
  assert.match(output, /Exported files:/);
  await fs.access(path.join(target, '.agents/instructions.md'));
  await fs.access(path.join(target, 'AGENTS.md'));
});

test('tui doctor mode reports repository diagnostics without writing files', async () => {
  const target = await makeTempRepo('workflow-kit-tui-doctor-');
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['4', target, '1']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.mode, 'doctor');
  assert.equal(result.applied, false);
  assert.equal(result.code, 1);
  assert.match(output, /Doctor: failed/);
  assert.match(output, /Missing files:/);
  await assert.rejects(fs.access(path.join(target, '.agents/instructions.md')), { code: 'ENOENT' });
});
