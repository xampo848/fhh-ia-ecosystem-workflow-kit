import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
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
    ask: scriptedAsk([target, '2', '', '']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.code, 0);
  assert.equal(result.applied, false);
  assert.match(output, /FHH workflow/);
  assert.match(output, /complete All Metrics flow/);
  assert.match(output, /Plan summary/);
  assert.match(output, /Aborted\. No files were written\./);
  await assert.rejects(fs.access(path.join(target, '.agents/instructions.md')), { code: 'ENOENT' });
});

test('tui confirmed apply writes selected files through planner apply', async () => {
  const target = await makeTempRepo();
  let output = '';

  const result = await runTui({
    ask: scriptedAsk([target, '5', '', 'yes']),
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
