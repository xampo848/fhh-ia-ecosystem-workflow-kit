import assert from 'node:assert/strict';
import test from 'node:test';
import { colorizeFullPlanPreview, createPainter, renderChip, renderStageHeader } from '../src/tui/view.mjs';

function recordingPaint() {
  const tones = ['bold', 'dim', 'cyan', 'magenta', 'green', 'yellow', 'red', 'blue', 'white'];
  const paint = { rgb: (_r, _g, _b, value) => value };
  for (const tone of tones) {
    paint[tone] = (value) => `<${tone}>${value}</${tone}>`;
  }
  return paint;
}

test('renderChip wraps the label with the requested tone', () => {
  const paint = recordingPaint();

  assert.equal(renderChip(paint, 'STEP 1', 'magenta'), '<magenta>[ STEP 1 ]</magenta>');
});

test('renderChip falls back to cyan when the tone is unknown', () => {
  const paint = recordingPaint();

  assert.equal(renderChip(paint, 'LABEL', 'not-a-tone'), '<cyan>[ LABEL ]</cyan>');
});

test('renderStageHeader writes chip, progress bar and subtitle', () => {
  let output = '';
  const paint = createPainter(false);

  renderStageHeader((message) => { output += message; }, paint, {
    step: 2,
    total: 5,
    title: 'Runtime adapters',
    subtitle: 'Select runtime surfaces.'
  });

  assert.match(output, /STEP 2/);
  assert.match(output, /Runtime adapters/);
  assert.match(output, /2\/5/);
  assert.match(output, /Select runtime surfaces\./);
});

test('renderStageHeader omits subtitle line when none is provided', () => {
  let output = '';
  const paint = createPainter(false);

  renderStageHeader((message) => { output += message; }, paint, {
    step: 1,
    total: 3,
    title: 'Target selection'
  });

  assert.match(output, /STEP 1/);
  assert.match(output, /Target selection/);
  assert.match(output, /1\/3/);
  assert.equal((output.match(/\n/g) ?? []).length, 3);
});

test('colorizeFullPlanPreview recolors key/value, operation and summary lines', () => {
  const paint = recordingPaint();
  const formattedPlan = [
    'Target: /tmp/repo',
    'Mode: init',
    'Runtimes: codex,copilot',
    'Overlay: fhh-ia-ecosystem-full',
    'Operations:',
    '- create: AGENTS.md',
    '- unchanged: .agents/instructions.md',
    'Summary: create=1, unchanged=1, overwrite_with_backup=0, skip_modified=0, skip_unmanaged=0, adopt_existing=0'
  ].join('\n');

  const result = colorizeFullPlanPreview(paint, formattedPlan);
  const lines = result.split('\n');

  assert.equal(lines[0], '<cyan>Target:</cyan> <white>/tmp/repo</white>');
  assert.equal(lines[1], '<cyan>Mode:</cyan> <magenta>init</magenta>');
  assert.equal(lines[2], '<cyan>Runtimes:</cyan> <blue>codex,copilot</blue>');
  assert.equal(lines[3], '<cyan>Overlay:</cyan> <magenta>fhh-ia-ecosystem-full</magenta>');
  assert.equal(lines[4], '<cyan>Operations:</cyan>');
  assert.equal(lines[5], '- <green>create</green>: <white>AGENTS.md</white>');
  assert.equal(lines[6], '- <blue>unchanged</blue>: <white>.agents/instructions.md</white>');
  assert.equal(
    lines[7],
    '<cyan>Summary:</cyan> <green>create</green>=<bold>1</bold>, <blue>unchanged</blue>=<bold>1</bold>, <yellow>overwrite_with_backup</yellow>=<bold>0</bold>, <yellow>skip_modified</yellow>=<bold>0</bold>, <yellow>skip_unmanaged</yellow>=<bold>0</bold>, <cyan>adopt_existing</cyan>=<bold>0</bold>'
  );
});

test('colorizeFullPlanPreview dims unrecognized lines and preserves blank lines', () => {
  const paint = recordingPaint();
  const formattedPlan = ['Some free-form note', ''].join('\n');

  const result = colorizeFullPlanPreview(paint, formattedPlan);

  assert.equal(result, '<dim>Some free-form note</dim>\n');
});
