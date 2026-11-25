import assert from 'node:assert/strict';
import test from 'node:test';
import { createPainter } from '../src/tui/view.mjs';
import { createInteractivePrompter, createScriptedPrompter, parseYesNo } from '../src/tui/session.mjs';

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
// The real @inquirer prompts of the interactive menu, driven through their
// input and output streams (no terminal needed): what a person types and sees.
async function drive(ask, keys) {
  const { PassThrough } = await import('node:stream');
  const input = new PassThrough();
  const output = new PassThrough();
  let shown = '';
  output.on('data', (chunk) => { shown += chunk; });
  const prompter = createInteractivePrompter({ context: { input, output } });
  const answer = ask(prompter);
  for (const key of keys) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    input.write(key);
  }
  const value = await answer;
  // eslint-disable-next-line no-control-regex
  return { value, shown: shown.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '') };
}

test('parseYesNo reads Spanish and English answers, in any case, with spaces, and a decomposed sí', () => {
  for (const yes of ['sí', 'si', 's', 'SÍ', 'Si', ' s ', 'y', 'yes', 'YES', 's\u0069\u0301']) assert.equal(parseYesNo(yes), true, JSON.stringify(yes));
  for (const no of ['no', 'n', 'NO', ' No ']) assert.equal(parseYesNo(no), false, JSON.stringify(no));
  for (const other of ['', 'quizás', 'sip', 'nop', 'ok']) assert.equal(parseYesNo(other), null, JSON.stringify(other));
});

test('the scripted prompter takes a decomposed sí as yes', async () => {
  const prompter = createScriptedPrompter({ ask: async () => 's\u0069\u0301', write: () => {}, paint: createPainter(false) });
  assert.equal(await prompter.confirm('¿Seguir? [no]: '), true);
});

test('the interactive yes/no question reads sí, s and no, shows (s/N) and echoes Sí or No', async () => {
  const cases = [
    ['sí\r', false, true], ['s\r', false, true], ['SÍ\r', false, true], ['si\r', false, true], ['s\u0069\u0301\r', false, true],
    ['y\r', false, true], ['yes\r', false, true], ['no\r', true, false], ['n\r', true, false], ['\r', false, false], ['\r', true, true]
  ];
  for (const [typed, defaultValue, expected] of cases) {
    const { value, shown } = await drive((prompter) => prompter.confirm('¿Aplicar estos cambios ahora?', defaultValue), [typed]);
    assert.equal(value, expected, `${JSON.stringify(typed)} with default ${defaultValue}`);
    assert.ok(shown.includes(`¿Aplicar estos cambios ahora? ${defaultValue ? '(S/n)' : '(s/N)'}`), shown);
    assert.match(shown, new RegExp(`✔ ¿Aplicar estos cambios ahora\\? \\([sS]/[nN]\\) ${expected ? 'Sí' : 'No'}\\n?$`), JSON.stringify(typed));
  }
  // Anything else is asked again, in Spanish, never taken as the default.
  const retried = await drive((prompter) => prompter.confirm('¿Crear una línea base segura con adopt-existing?', true), ['quizás\r', '\u0015', 'no\r']);
  assert.equal(retried.value, false);
  assert.match(retried.shown, /Responde sí o no\./);
});

test('the interactive select and checkbox show their key hints in Spanish, and the checkbox asks for one choice in Spanish', async () => {
  const options = [{ value: 'a', label: 'Uno' }, { value: 'b', label: 'Dos' }];
  const selected = await drive((prompter) => prompter.chooseOption({ title: 'Elige una opción', options, defaultValue: 'a' }), ['\u001b[B', '\r']);
  assert.equal(selected.value, 'b');
  assert.match(selected.shown, /↑↓ navegar • ⏎ elegir/);
  assert.doesNotMatch(selected.shown, /\b(navigate|select)\b/);

  const checked = await drive((prompter) => prompter.chooseOptions({ title: 'Elige uno o más runtimes', options, defaultValues: [] }), ['\r', ' ', '\r']);
  assert.deepEqual(checked.value, ['a']);
  assert.match(checked.shown, /↑↓ navegar • espacio marcar • a todos • i invertir • ⏎ confirmar/);
  assert.match(checked.shown, /Elige al menos una opción\./);
  assert.doesNotMatch(checked.shown, /\b(navigate|select|submit|invert|all)\b|At least one/);
});
