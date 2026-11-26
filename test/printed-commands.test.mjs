// A command a stop or an error message prints names its target: the absolute
// path, quoted for a shell, so pasting it in another folder acts on the
// project the message is about and never on the folder it is pasted in.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyJournalRelativePath } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { kitCommand, code, shellWord } from '../src/plugin-mode.mjs';
import { createMemoryIo, hashTree, makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'workflow-kit.mjs');
const interruptPreload = pathToFileURL(path.join(root, 'test/fixtures/apply-recovery/interrupt.mjs')).href;

// A folder whose name needs quoting: a space and a single quote.
const projectFolder = (label) => makeTempRepo(`wk ${label} it's `);

async function cli(args) {
  const io = createMemoryIo();
  const exitCode = await runCli(args, io);
  return { code: exitCode, ...io.output };
}

function child(args, env = {}) {
  return new Promise((resolve) => {
    const run = spawn(process.execPath, ['--import', interruptPreload, bin, ...args], { env: { ...process.env, NODE_NO_WARNINGS: '1', ...env } });
    const output = { stdout: '', stderr: '' };
    run.stdout.on('data', (chunk) => { output.stdout += chunk; });
    run.stderr.on('data', (chunk) => { output.stderr += chunk; });
    run.on('close', (exitCode, signal) => resolve({ code: exitCode, signal, ...output }));
  });
}

// The command a message prints, between backticks, as the user would copy it.
function printed(message, subcommand) {
  const commands = [...message.matchAll(/`([^`]+)`/g)].map((match) => match[1]).filter((command) => command.startsWith(`workflow-kit ${subcommand}`));
  assert.equal(commands.length >= 1, true, `no \`workflow-kit ${subcommand}\` command in: ${message}`);
  return commands[0];
}

// Runs the printed command through a real shell, from a folder that is not the
// project, so the quoting is the shell's and the target is only the --target.
async function runPrintedFromElsewhere(command) {
  const elsewhere = await makeTempRepo();
  const run = spawnSync('/bin/sh', ['-c', command.replace(/^workflow-kit /, `${shellWord(process.execPath)} ${shellWord(bin)} `)], { cwd: elsewhere, encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
  return { code: run.status, stdout: run.stdout, stderr: run.stderr, elsewhere };
}

const targetFlag = (target) => `--target ${shellWord(target)}`;

test('kitCommand and code: the target is quoted, a backtick wraps the command in double backticks, a missing target adds none', () => {
  assert.equal(kitCommand("/tmp/a b/it's", 'rollback', '--apply'), "workflow-kit rollback --target '/tmp/a b/it'\\''s' --apply");
  assert.equal(code('workflow-kit update'), '`workflow-kit update`');
  assert.equal(code(kitCommand('/tmp/a`b', 'update')), "`` workflow-kit update --target '/tmp/a`b' ``");
  assert.equal(kitCommand(undefined, 'rollback', '--apply', '--yes'), 'workflow-kit rollback --apply --yes');
});

test('init over an installed project names update with the absolute target, and that command runs from another folder', async () => {
  const target = await projectFolder('init');
  assert.equal((await cli(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes'])).code, 0);
  const refused = await cli(['init', '--target', target, '--runtime', 'claude']);
  assert.equal(refused.code, 2);
  assert.ok(refused.stderr.includes(`Run \`workflow-kit update ${targetFlag(target)}\` instead`), refused.stderr);
  const ran = await runPrintedFromElsewhere(printed(refused.stderr, 'update'));
  assert.equal(ran.code, 0, ran.stderr);
  assert.ok(ran.stdout.includes(target), `the dry run names the project: ${ran.stdout}`);
  assert.deepEqual(await fs.readdir(ran.elsewhere), [], 'nothing written in the folder it ran from');
});

test('update with no install names the adopt command with the absolute target and a readable <list>', async () => {
  const target = await projectFolder('adopt');
  const refused = await cli(['update', '--target', target]);
  assert.equal(refused.code, 2);
  assert.ok(refused.stderr.includes(`\`workflow-kit update --adopt-existing --runtime <list> ${targetFlag(target)}\``) || refused.stderr.includes(`\`workflow-kit update ${targetFlag(target)} --adopt-existing --runtime <list>\``), refused.stderr);
  assert.match(refused.stderr, /--runtime <list>/);
});

test('init over a 0.18.1 install names update with the absolute target', async () => {
  const target = await projectFolder('legacy');
  const { installLegacy0181 } = await import('./fixtures/legacy-0.18.1/install.mjs');
  await installLegacy0181(target, { runtimes: ['claude'] });
  const refused = await cli(['init', '--target', target, '--runtime', 'claude']);
  assert.equal(refused.code, 2);
  assert.ok(refused.stderr.includes(`Run \`workflow-kit update ${targetFlag(target)}\` to migrate`), refused.stderr);
});

test('an interrupted apply: the stop, the planner gate and the printed rollback all carry the target, and the printed rollback undoes that project from another folder', async () => {
  const target = await projectFolder('apply');
  assert.equal((await cli(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes'])).code, 0);
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOur team rule.\n');
  const delegation = (await fs.readdir(path.join(target, '.agents/delegation'))).sort().slice(0, 4);
  for (const name of delegation) await fs.rm(path.join(target, '.agents/delegation', name), { recursive: true });
  const before = await hashTree(target);
  delete before[applyJournalRelativePath];

  const stopped = await child(['update', '--target', target, '--edited', '.agents/instructions.md=discard', '--apply', '--yes'], {
    WORKFLOW_KIT_TEST_INTERRUPT_AFTER: '2',
    WORKFLOW_KIT_TEST_INTERRUPT_SIGNAL: 'SIGINT'
  });
  assert.equal(stopped.code, 130, stopped.stderr);
  const rollbackFlags = `rollback ${targetFlag(target)} --apply --yes`;
  assert.ok(stopped.stderr.includes(`\`workflow-kit ${rollbackFlags}\``), stopped.stderr);

  const gate = await cli(['update', '--target', target]);
  assert.equal(gate.code, 2);
  assert.ok(gate.stderr.includes(`Run \`workflow-kit ${rollbackFlags}\` first`), gate.stderr);

  // Verbatim, from another folder.
  const ran = await runPrintedFromElsewhere(printed(gate.stderr, 'rollback'));
  assert.equal(ran.code, 0, ran.stderr);
  assert.deepEqual(await hashTree(target), before, 'the named project is back to before the run');
  assert.deepEqual(await fs.readdir(ran.elsewhere), [], 'the folder it ran from is untouched');
});

test('a rollback stopped halfway names rollback with the target, in its own stop and in the next run\'s gate', async () => {
  const target = await projectFolder('rollback');
  assert.equal((await cli(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes'])).code, 0);
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nOur team rule.\n');
  for (const name of (await fs.readdir(path.join(target, '.agents/delegation'))).sort().slice(0, 2)) {
    await fs.appendFile(path.join(target, '.agents/delegation', name), '\nOur edit.\n');
  }
  assert.equal((await cli(['update', '--target', target, '--edited', 'all=discard', '--apply', '--yes'])).code, 0);
  const stoppedRollback = await child(['rollback', '--target', target, '--apply', '--yes'], {
    WORKFLOW_KIT_TEST_INTERRUPT_AFTER: '1',
    WORKFLOW_KIT_TEST_INTERRUPT_SIGNAL: 'SIGINT'
  });
  assert.equal(stoppedRollback.code, 130, stoppedRollback.stderr);
  const flags = `rollback ${targetFlag(target)} --apply --yes`;
  assert.ok(stoppedRollback.stderr.includes(`\`workflow-kit ${flags}\` again to finish it`), stoppedRollback.stderr);
  const gate = await cli(['update', '--target', target]);
  assert.equal(gate.code, 2);
  assert.ok(gate.stderr.includes(`\`workflow-kit ${flags}\` again to finish it`), gate.stderr);
  const ran = await runPrintedFromElsewhere(printed(gate.stderr, 'rollback'));
  assert.equal(ran.code, 0, ran.stderr);
  await assert.rejects(fs.lstat(path.join(target, applyJournalRelativePath)));
});
