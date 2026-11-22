import assert from 'node:assert/strict';
import test from 'node:test';
import { colorizeFullPlanPreview, createPainter, renderChip, renderStageHeader, renderSummary } from '../src/tui/view.mjs';

function recordingPaint() {
  const tones = [
    'bold',
    'dim',
    'copper',
    'copperInk',
    'indigo',
    'indigoDeep',
    'cream',
    'slate',
    'cyan',
    'magenta',
    'green',
    'yellow',
    'red',
    'blue',
    'white'
  ];
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
    'Summary: create=1, unchanged=1, merge_with_backup=0, overwrite_with_backup=0, skip_modified=0, skip_unmanaged=0, adopt_existing=0'
  ].join('\n');

  const result = colorizeFullPlanPreview(paint, formattedPlan);
  const lines = result.split('\n');

  assert.equal(lines[0], '<indigo>Target:</indigo> <cream>/tmp/repo</cream>');
  assert.equal(lines[1], '<indigo>Mode:</indigo> <copper>init</copper>');
  assert.equal(lines[2], '<indigo>Runtimes:</indigo> <indigo>codex,copilot</indigo>');
  assert.equal(lines[3], '<indigo>Overlay:</indigo> <copper>fhh-ia-ecosystem-full</copper>');
  assert.equal(lines[4], '<indigo>Operations:</indigo>');
  assert.equal(lines[5], '- <copper>create</copper>: <cream>AGENTS.md</cream>');
  assert.equal(lines[6], '- <indigo>unchanged</indigo>: <cream>.agents/instructions.md</cream>');
  assert.equal(
    lines[7],
    '<indigo>Summary:</indigo> <copper>create</copper>=<bold>1</bold>, <indigo>unchanged</indigo>=<bold>1</bold>, <copperInk>merge_with_backup</copperInk>=<bold>0</bold>, <copperInk>overwrite_with_backup</copperInk>=<bold>0</bold>, <copperInk>skip_modified</copperInk>=<bold>0</bold>, <copperInk>skip_unmanaged</copperInk>=<bold>0</bold>, <indigo>adopt_existing</indigo>=<bold>0</bold>'
  );
});

test('colorizeFullPlanPreview dims unrecognized lines and preserves blank lines', () => {
  const paint = recordingPaint();
  const formattedPlan = ['Some free-form note', ''].join('\n');

  const result = colorizeFullPlanPreview(paint, formattedPlan);

  assert.equal(result, '<dim>Some free-form note</dim>\n');
});

test('renderSummary groups the layout migration with its pending files and notes, and counts deletes', () => {
  let output = '';
  const summary = { create: 1, unchanged: 0, merge_with_backup: 0, merge_no_backup: 0, overwrite_with_backup: 0, overwrite_no_backup: 0, skip_modified: 2, skip_unmanaged: 0, adopt_existing: 0, delete_with_backup: 2 };
  const plan = {
    mode: 'update',
    targetPath: '/tmp/repo',
    runtimes: ['claude'],
    overlay: 'fhh-ia-ecosystem-full',
    summary,
    operations: [{ operation: 'delete_with_backup', relativePath: '.agents/skills/old/SKILL.md', retired: true }],
    migrations: [
      {
        id: '0.22.0-kit-overlay-layout',
        summary: 'Move to the kit and project overlay layout.',
        pending: [
          { relativePath: '.agents/instructions.md', reason: 'edited_kit_file', decisions: ['keep', 'discard'] },
          { relativePath: '.agents/skills/06-patterns/local/router-copy/', reason: 'kit_skill_name' }
        ],
        notes: ['`retry-policy` row: class written as Pattern']
      }
    ]
  };

  renderSummary((message) => { output += message; }, createPainter(false), plan);

  const lines = output.split('\n');
  const header = lines.findIndex((line) => line.includes('Move to the kit and project overlay layout.'));
  assert.ok(header > -1, output);
  assert.deepEqual(lines.slice(header + 1, header + 4), [
    '    - pending .agents/instructions.md (edited_kit_file): keep | discard',
    '    - pending .agents/skills/06-patterns/local/router-copy/ (kit_skill_name)',
    '    - note: `retry-policy` row: class written as Pattern'
  ]);
  assert.match(output, /Delete \(backup kept\) +: 2/);
  assert.match(output, /\[ 2 backup delete \]/);
});

test('colorizeFullPlanPreview tones a delete like the other writes', () => {
  const paint = recordingPaint();

  assert.equal(
    colorizeFullPlanPreview(paint, '- delete_with_backup: old.md (no longer shipped)'),
    '- <copperInk>delete_with_backup</copperInk>: <cream>old.md (no longer shipped)</cream>'
  );
});
