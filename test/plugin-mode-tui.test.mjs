import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { installStateRelativePath } from '../src/planner.mjs';
import { pluginInstallCommand } from '../src/plugin-mode.mjs';
import { runTui } from '../src/tui.mjs';
import { installModeQuestion } from '../src/tui/model.mjs';
import { makeTempRepo } from './helpers.mjs';

// PRD plugin-mode-pilot 2.6 and AC-18: the TUI asks the install mode only in an
// interactive install, and only when every chosen runtime has a plugin.

const modeQuestionTitle = installModeQuestion('claude').title;
const claudeInstallCommand = pluginInstallCommand('claude');
// F9: the closing line of a repo-mode install, which a plugin-mode install
// must not print (the kit is not in the repository).
const repoInstalledLine = 'The target repository now has the complete FHH IA Ecosystem workflow package installed.';
const pluginReadyLine = 'The repository is set up for the plugin fhh; install the plugin with the command printed above.';

// The interactive prompter answers like inquirer does: a value per question.
// An answer is a value, or a function of the question; a question without an
// answer takes its default. Every title or message asked is recorded.
function interactivePrompter(answers = {}) {
  const asked = [];
  const answerFor = (key, question, fallback) => {
    asked.push(key);
    if (!(key in answers)) return fallback;
    const answer = answers[key];
    return typeof answer === 'function' ? answer(question) : answer;
  };
  return {
    asked,
    async promptText(message, fallback) {
      return answerFor(message, { message }, fallback);
    },
    async chooseOption(question) {
      const fallback = question.defaultValue ?? question.options[question.defaultIndex ?? 0].value;
      return answerFor(question.title, question, fallback);
    },
    async chooseOptions(question) {
      return answerFor(question.title, question, question.defaultValues ?? []);
    },
    async confirm(message, defaultValue = false) {
      return answerFor(message, { message }, defaultValue);
    }
  };
}

const allBut = (...deselected) => ({ options }) => options
  .map((option) => option.value)
  .filter((value) => !deselected.includes(value));

async function stateOnDisk(target) {
  return JSON.parse(await fs.readFile(path.join(target, installStateRelativePath), 'utf8'));
}

// Doctor runs after every apply; in plugin mode it lists the installed Claude
// plugins. Tests never run the real binary: this double records each call.
const doctorCalls = [];
const commandExecutor = async (command, args) => {
  doctorCalls.push([command, ...args].join(' '));
  return { code: 0, stdout: '[]' };
};

async function runInteractive(answers) {
  const prompter = interactivePrompter(answers);
  let output = '';
  const result = await runTui({
    prompter,
    commandExecutor,
    animate: false,
    color: false,
    env: {},
    write: (message) => { output += message; }
  });
  return { result, output, asked: prompter.asked };
}

test('installModeQuestion is asked only when every chosen runtime has a plugin, with repo first and default', () => {
  for (const runtimeList of ['neutral', 'codex', 'claude,codex']) {
    assert.equal(installModeQuestion(runtimeList), null, runtimeList);
  }
  for (const runtimeList of ['claude', 'copilot', 'claude,copilot']) {
    const question = installModeQuestion(runtimeList);
    assert.deepEqual(question.options.map((option) => option.value), ['repo', 'plugin'], runtimeList);
    assert.equal(question.defaultIndex, 0, runtimeList);
    assert.ok(question.options.every((option) => option.label && option.description), runtimeList);
  }
});

test('AC-18: an interactive plugin install and a TUI update, both with a partial selection, keep mode plugin on disk', async () => {
  const target = await makeTempRepo();

  const install = await runInteractive({
    'Elige una opción': 'install',
    'Target path': target,
    'Select one or more runtimes': ['claude'],
    [modeQuestionTitle]: 'plugin',
    'Select files to modify': allBut('.agents/project/backend.md', '.agents/project/frontend.md'),
    'Apply these changes now?': true
  });

  assert.equal(install.result.applied, true);
  assert.ok(install.asked.includes(modeQuestionTitle), 'the install mode is asked');
  const exists = (relativePath) => fs.access(path.join(target, relativePath)).then(() => true, () => false);
  assert.equal(await exists('.agents/project/frontend.md'), false, 'the deselected file is not written');
  assert.equal((await stateOnDisk(target)).mode, 'plugin');
  assert.ok(install.output.includes(claudeInstallCommand), 'the install command is printed');
  assert.ok(install.output.includes(pluginReadyLine), install.output.slice(-600));
  assert.equal(install.output.includes(repoInstalledLine), false, 'a plugin install does not say the package is in the repository');
  assert.ok(install.output.indexOf(claudeInstallCommand) < install.output.indexOf(pluginReadyLine), 'the closing line comes after the install command');

  const update = await runInteractive({
    'Elige una opción': 'update',
    'Target path': target,
    'Select files to modify': allBut('.agents/project/frontend.md'),
    'Apply these changes now?': true
  });

  assert.equal(update.result.applied, true);
  assert.equal(update.result.mode, 'update');
  assert.ok(!update.asked.includes(modeQuestionTitle), 'update never asks the install mode');
  assert.equal(await exists('.agents/project/backend.md'), true, 'the selected file is written');
  assert.equal(await exists('.agents/project/frontend.md'), false, 'the deselected file is not written');
  assert.equal((await stateOnDisk(target)).mode, 'plugin');
  assert.ok(update.output.includes(claudeInstallCommand), 'the install command is printed after the update');
});

test('an interactive install with codex is not asked the install mode and plans repo mode', async () => {
  const target = await makeTempRepo();

  const { result, asked, output } = await runInteractive({
    'Elige una opción': 'install',
    'Target path': target,
    'Select one or more runtimes': ['codex']
  });

  assert.equal(result.applied, false);
  assert.ok(!asked.includes(modeQuestionTitle));
  assert.equal(result.plan.nextInstallState.mode, 'repo');
  assert.ok(!output.includes(claudeInstallCommand));
});

test('a scripted install with claude is not asked the install mode and records repo mode on disk', async () => {
  const target = await makeTempRepo();
  let output = '';
  const answers = ['', target, '4', '', '', '', 'yes'];

  const result = await runTui({
    ask: async () => answers.shift() ?? '',
    color: false,
    env: {},
    write: (message) => { output += message; }
  });

  assert.equal(result.applied, true);
  assert.ok(!output.includes(modeQuestionTitle));
  assert.equal((await stateOnDisk(target)).mode, 'repo');
  assert.ok(!output.includes(claudeInstallCommand));
  assert.ok(output.includes(repoInstalledLine), 'a repo install keeps its closing line');
  assert.equal(output.includes(pluginReadyLine), false);
});

test('the TUI passes its command executor to doctor, so a plugin-mode apply never runs the real claude binary in tests', () => {
  assert.ok(doctorCalls.length > 0, 'doctor ran through the injected executor after a plugin-mode apply');
  assert.ok(doctorCalls.every((call) => call === 'claude plugin list --json'), doctorCalls.join(' | '));
});
