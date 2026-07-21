import assert from 'node:assert/strict';
import test from 'node:test';
import { createPainter } from '../src/tui/view.mjs';
import { createScriptedPrompter } from '../src/tui/session.mjs';

function scriptedAsk(answers) {
  const queue = [...answers];
  return async () => queue.shift() ?? '';
}

test('createScriptedPrompter uses fallback values for empty prompts', async () => {
  let output = '';
  const prompter = createScriptedPrompter({
    ask: scriptedAsk(['']),
    write: (message) => { output += message; },
    paint: createPainter(false)
  });

  const value = await prompter.promptText('Target path [.]: ', '.');

  assert.equal(value, '.');
  assert.equal(output, '');
});

test('createScriptedPrompter selects by numeric index and writes menu text', async () => {
  let output = '';
  const prompter = createScriptedPrompter({
    ask: scriptedAsk(['2']),
    write: (message) => { output += message; },
    paint: createPainter(false)
  });

  const selected = await prompter.chooseOption({
    title: 'Select runtime',
    defaultIndex: 0,
    options: [
      { value: 'neutral', label: 'Neutral core only', description: 'Portable .agents core only.' },
      { value: 'codex', label: 'Codex', description: 'Neutral core + Codex adapter.' }
    ]
  });

  assert.equal(selected, 'codex');
  assert.match(output, /Select runtime/);
  assert.match(output, /2\) Codex/);
});

test('createScriptedPrompter selects multiple options by comma-separated indices', async () => {
  const prompter = createScriptedPrompter({
    ask: scriptedAsk(['2,3']),
    write: () => {},
    paint: createPainter(false)
  });

  const selected = await prompter.chooseOptions({
    title: 'Select runtimes',
    options: [
      { value: 'neutral', label: 'No extra adapters' },
      { value: 'copilot', label: 'GitHub Copilot' },
      { value: 'antigravity', label: 'Antigravity' }
    ]
  });

  assert.deepEqual(selected, ['copilot', 'antigravity']);
});

test('createScriptedPrompter confirms only affirmative answers', async () => {
  const prompter = createScriptedPrompter({
    ask: scriptedAsk(['sí', 'no']),
    write: () => {},
    paint: createPainter(false)
  });

  assert.equal(await prompter.confirm('Apply? [no]: '), true);
  assert.equal(await prompter.confirm('Apply? [no]: '), false);
});