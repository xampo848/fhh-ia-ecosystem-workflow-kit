import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { buildInstallPlan } from '../src/planner.mjs';
import { formatPluginInstallSteps, pluginInstallCommand, shellWord } from '../src/plugin-mode.mjs';
import { runTui } from '../src/tui.mjs';
import { installModeQuestion } from '../src/tui/model.mjs';
import { hashTree, makeTempRepo } from './helpers.mjs';

// Lot L9: the guided menu. No real package manager, plugin CLI or network
// command may run: the tools are stubbed first in PATH, BUN_INSTALL points
// into a temp folder, and the last test fails if a stub was ever called.
const stubDirectory = await makeTempRepo('workflow-kit-stubs-');
const stubLog = path.join(stubDirectory, 'calls.log');
for (const name of ['bun', 'brew', 'engram', 'claude', 'git']) {
  await fs.writeFile(path.join(stubDirectory, name), `#!/bin/sh\necho "${name} $@" >> '${stubLog}'\nexit 0\n`, { mode: 0o755 });
}
process.env.PATH = `${stubDirectory}${path.delimiter}${process.env.PATH}`;
process.env.BUN_INSTALL = path.join(stubDirectory, 'bun-home');

// Doctor runs after an apply; its command never reaches a real binary.
const commandExecutor = async () => ({ code: 0, stdout: '[]' });

// An answer is a string, or a function of the question asked.
function scriptedAsk(answers, onAsk, readOutput) {
  const queue = [...answers];
  return async (message) => {
    const special = onAsk ? await onAsk(message, readOutput) : undefined;
    if (special !== undefined) return special;
    return queue.shift() ?? '';
  };
}

class ExitPromptError extends Error {
  constructor() {
    super('User force closed the prompt with SIGINT');
    this.name = 'ExitPromptError';
  }
}
const ctrlC = () => { throw new ExitPromptError(); };

async function run(answers, { onAsk, ...options } = {}) {
  let output = '';
  const result = await runTui({
    ask: scriptedAsk(answers, onAsk, () => output),
    color: false,
    commandExecutor,
    env: {},
    write: (message) => { output += message; },
    ...options
  });
  return { result, text: output };
}

const toolsOnlyAnswers = (folder) => ['6', folder, '1', '1', '2', 'yes'];

test('fix 1: installing optional tools asks no scope and says they are installed globally on this machine', async () => {
  const folder = await makeTempRepo();
  const executed = [];
  const { result, text } = await run(toolsOnlyAnswers(folder), {
    commandExists: async () => true,
    runCommand: async ({ command, args }) => {
      executed.push(`${command} ${args.join(' ')}`);
      return { ok: true, code: 0 };
    }
  });

  assert.equal(result.code, 0);
  assert.deepEqual(executed, ['bun add -g @upstash/context7-mcp']);
  assert.doesNotMatch(text, /alcance de la herramienta|Solo este proyecto|Ambos \(global|Todos mis proyectos/);
  assert.match(text, /Estas herramientas se instalan de forma global en esta máquina, no solo en este proyecto\./);
  assert.equal('scope' in result.capabilitySelections[0], false);
  assert.doesNotMatch(text, /Alcance +:/);
});

test('fix 2: a folder that does not exist or is a file is refused when entered, with a retry, and never blamed on the PATH', async () => {
  const base = await makeTempRepo();
  const missing = path.join(base, 'not-there');
  const aFile = path.join(base, 'a-file');
  await fs.writeFile(aFile, 'x\n');
  const folder = path.join(base, 'ok');
  await fs.mkdir(folder);
  const cwds = [];

  const { result, text } = await run(['6', missing, aFile, folder, '1', '1', '2', 'yes'], {
    commandExists: async () => true,
    runCommand: async ({ cwd }) => {
      cwds.push(cwd);
      return { ok: true, code: 0 };
    }
  });

  assert.equal(result.code, 0);
  assert.ok(text.includes(`La carpeta «${missing}» no existe.`), text);
  assert.ok(text.includes(`«${aFile}» es un archivo, no una carpeta.`), text);
  assert.doesNotMatch(text, /PATH|ENOTDIR|spawn/);
  assert.deepEqual(cwds, [path.resolve(folder)]);
});

test('fix 2: a folder that disappears before the command is not blamed on the PATH and the flow does not end ready', async () => {
  const folder = await makeTempRepo();
  const { result, text } = await run(toolsOnlyAnswers(folder), {
    // The folder goes away after it was accepted and before the command runs.
    commandExists: async () => {
      await fs.rm(folder, { recursive: true, force: true });
      return true;
    }
  });

  assert.doesNotMatch(text, /no está en el PATH/);
  assert.match(text, /la carpeta de trabajo «.+» no existe o no es una carpeta/);
  assert.doesNotMatch(text, /SISTEMA LISTO|Flujo de herramientas completado/);
  assert.equal(result.code, 2);
});

test('fix 2: a failed install step never ends in the success banner', async () => {
  const folder = await makeTempRepo();
  const { result, text } = await run(toolsOnlyAnswers(folder), {
    commandExists: async () => true,
    runCommand: async () => ({ ok: false, code: 1, reason: 'exit-1' })
  });

  assert.equal(result.code, 2);
  assert.match(text, /terminó con comandos fallidos/);
  assert.doesNotMatch(text, /SISTEMA LISTO|Flujo de herramientas completado/);
});

test('fix 3: the adopt-existing question is not covered by the spinner and a cancel prints only the cancel message', async () => {
  const target = await makeTempRepo();
  let seen;
  const first = await run(['2', target, '1'], {
    animate: true,
    onAsk: async (message, readOutput) => {
      if (!message.includes('adopt-existing')) return undefined;
      const before = readOutput();
      await new Promise((resolve) => setTimeout(resolve, 300));
      seen = { before, after: readOutput() };
      return 'yes';
    }
  });

  assert.ok(seen, 'the question was asked');
  assert.doesNotMatch(seen.before, /Armando el plan/, 'no spinner before the question');
  assert.equal(seen.after, seen.before, 'nothing repaints while the question waits');
  assert.equal(first.result.code, 0);

  const cancelled = await run(['2', target, '1'], {
    animate: true,
    onAsk: (message) => (message.includes('adopt-existing') ? ctrlC() : undefined)
  });
  assert.match(cancelled.text, /Cancelado por ti/);
  assert.doesNotMatch(cancelled.text, /Armando el plan falló/);
});

test('fix 4: an install path that does not exist or is a file is refused at the prompt, in Spanish, with a retry, writing nothing', async () => {
  const base = await makeTempRepo();
  const missing = path.join(base, 'not-there');
  const aFile = path.join(base, 'a-file');
  await fs.writeFile(aFile, 'x\n');
  const target = path.join(base, 'repo');
  await fs.mkdir(target);
  const before = await hashTree(base);

  const { result, text } = await run(['', missing, aFile, target, '', '', '', '']);

  assert.equal(result.code, 0);
  assert.equal(result.applied, false);
  assert.ok(text.includes(`La carpeta «${missing}» no existe.`), text);
  assert.ok(text.includes(`«${aFile}» es un archivo, no una carpeta.`), text);
  assert.doesNotMatch(text, /--target|ENOTDIR|install-state\.json: /);
  assert.deepEqual(await hashTree(base), before);
  // The run went on with the valid folder.
  assert.equal(result.plan.targetPath, path.resolve(target));
});

test('fix 4: an update path that is a file is refused at the prompt; an export folder that does not exist yet is allowed', async () => {
  const base = await makeTempRepo();
  const aFile = path.join(base, 'a-file');
  await fs.writeFile(aFile, 'x\n');
  const target = path.join(base, 'repo');
  await fs.mkdir(target);
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'codex' }));

  const update = await run(['2', aFile, target, '1', '', '', '']);
  assert.ok(update.text.includes(`«${aFile}» es un archivo, no una carpeta.`), update.text);
  assert.doesNotMatch(update.text, /ENOTDIR|--target/);
  assert.equal(update.result.plan.targetPath, path.resolve(target));

  const newOutput = path.join(base, 'new-output');
  const exported = await run(['3', newOutput, '1', '', '', '', '']);
  assert.doesNotMatch(exported.text, /no existe/);
  assert.equal(exported.result.plan.targetPath, path.resolve(newOutput));
  await assert.rejects(fs.access(newOutput), { code: 'ENOENT' }, 'a declined export writes nothing');

  const onFile = await run(['3', aFile, newOutput, '1', '', '', '', '']);
  assert.ok(onFile.text.includes(`«${aFile}» es un archivo, no una carpeta.`), onFile.text);
});

// The interactive prompter answers like inquirer does: a value per question.
function interactivePrompter(answers) {
  const answerFor = (key, question, fallback) => {
    if (!(key in answers)) return fallback;
    return typeof answers[key] === 'function' ? answers[key](question) : answers[key];
  };
  return {
    async promptText(message, fallback) { return answerFor(message, { message }, fallback); },
    async chooseOption(question) { return answerFor(question.title, question, question.defaultValue ?? question.options[question.defaultIndex ?? 0].value); },
    async chooseOptions(question) { return answerFor(question.title, question, question.defaultValues ?? []); },
    async confirm(message, defaultValue = false) { return answerFor(message, { message }, defaultValue); }
  };
}

test('fix 5: the plugin install step the menu prints is the runnable one, in the repository, with its path quoted', async () => {
  const base = await makeTempRepo();
  const target = path.join(base, 'my repo');
  await fs.mkdir(target);
  let output = '';
  const result = await runTui({
    prompter: interactivePrompter({
      'Elige una opción': 'install',
      'Ruta del proyecto': target,
      'Elige uno o más runtimes': ['claude'],
      [installModeQuestion('claude').title]: 'plugin',
      '¿Aplicar estos cambios ahora?': true
    }),
    commandExecutor,
    animate: false,
    color: false,
    env: {},
    write: (message) => { output += message; }
  });

  assert.equal(result.applied, true);
  assert.ok(output.includes(`- Claude Code: cd ${shellWord(result.plan.targetPath)} && ${pluginInstallCommand('claude')}\n`), output);
  assert.match(output, /cd '.+my repo' && claude plugin install/);
});

test('fix 5: formatPluginInstallSteps without a target stays as it was, and the target only goes on project-scoped steps', () => {
  const plain = formatPluginInstallSteps(['claude', 'copilot']);
  assert.ok(plain.includes(`- Claude Code: ${pluginInstallCommand('claude')}\n`));
  assert.doesNotMatch(plain, /cd /);
  const located = formatPluginInstallSteps(['claude', 'copilot'], '/tmp/some repo');
  assert.ok(located.includes(`- Claude Code: cd '/tmp/some repo' && ${pluginInstallCommand('claude')}\n`));
  assert.ok(located.includes(`- Copilot: ${pluginInstallCommand('copilot')}\n`), 'a user-scoped step stays as it is');
});

test('fix 6: Ctrl-C in the menu exits 130 and writes nothing; answering no at the confirmation stays 0', async () => {
  const target = await makeTempRepo();
  const before = await hashTree(target);

  const interrupted = await run(['', target, '', '', ''], {
    onAsk: (message) => (message.includes('Aplicar estos cambios') ? ctrlC() : undefined)
  });
  assert.equal(interrupted.result.code, 130);
  assert.equal(interrupted.result.applied, false);
  assert.match(interrupted.text, /Cancelado por ti\. No se escribió ningún archivo\./);

  const early = await run([], { onAsk: ctrlC });
  assert.equal(early.result.code, 130);

  const declined = await run(['', target, '', '', '', 'no']);
  assert.equal(declined.result.code, 0);
  assert.match(declined.text, /Cancelado\. No se escribió ningún archivo\./);
  assert.deepEqual(await hashTree(target), before);
});

test('fix 7: Replace all leaves a kit file reached through a symbolic link as it is, replaces the edited one with a backup and says so', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'codex' }));
  const instructions = '.agents/instructions.md';
  const linked = '.agents/skills/02-implement/validation-runner/SKILL.md';
  await fs.appendFile(path.join(target, instructions), '\nLocal edit.\n');
  const edited = await fs.readFile(path.join(target, instructions), 'utf8');
  const outside = path.join(await makeTempRepo(), 'elsewhere.md');
  await fs.writeFile(outside, 'content that lives outside the repository\n');
  await fs.rm(path.join(target, linked));
  await fs.symlink(outside, path.join(target, linked));

  const { result, text } = await run(['2', target, '', '2', '', '', 'yes']);

  assert.equal(result.applied, true);
  assert.match(text, /\.agents\/skills\/02-implement\/validation-runner\/SKILL\.md queda como está: es un enlace simbólico/);
  assert.doesNotMatch(await fs.readFile(path.join(target, instructions), 'utf8'), /Local edit\./);
  const journal = JSON.parse(await fs.readFile(path.join(target, '.agents/workflow-kit/last-apply.json'), 'utf8'));
  const entry = journal.files.find((file) => file.relativePath === instructions);
  assert.equal(await fs.readFile(path.join(target, entry.backup), 'utf8'), edited);
  assert.ok((await fs.lstat(path.join(target, linked))).isSymbolicLink(), 'the link is still a link');
  assert.equal(await fs.readlink(path.join(target, linked)), outside);
  assert.equal(await fs.readFile(outside, 'utf8'), 'content that lives outside the repository\n');
  assert.equal(result.plan.operations.find((item) => item.relativePath === linked).operation, 'skip_modified');
});

test('no stubbed package manager, plugin CLI or git was ever run by these tests', async () => {
  const calls = await fs.readFile(stubLog, 'utf8').catch(() => '');
  assert.equal(calls, '');
});
