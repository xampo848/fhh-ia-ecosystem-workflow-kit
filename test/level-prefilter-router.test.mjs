import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  extractPrefilterBlock,
  prefilterEndMarker,
  prefilterStartMarker,
  prefilterTargets,
  replacePrefilterBlock,
  validateLevelPrefilter
} from '../scripts/sync-level-prefilter.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routerDir = '.agents/skills/00-router/workflow-router';

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

test('instructions define task levels N0-N3 with a single-source pre-filter', async () => {
  const instructions = await read('.agents/instructions.md');
  assert.match(instructions, /## Task levels \(N0–N3\)/);
  for (const level of ['N0 Operational', 'N1 Surgical', 'N2 Standard', 'N3 High risk']) {
    assert.match(instructions, new RegExp(`\\| ${level} \\|`));
  }
  const block = extractPrefilterBlock(instructions);
  assert.match(block, /every new user prompt/);
  assert.match(block, /\| Non-semantic edit .* \| N0 \|/);
  assert.match(block, /N1: emit one line/);
  assert.match(instructions, /in N0 the user's intent is enough; in N1 a short "yes"/);
});

test('every always-loaded runtime adapter carries the identical generated pre-filter', async () => {
  const result = await validateLevelPrefilter({ root });
  assert.deepEqual(result.failures, []);
  const block = extractPrefilterBlock(await read('.agents/instructions.md'));
  for (const target of prefilterTargets) {
    const content = await read(target);
    assert.equal(extractPrefilterBlock(content, target), block, target);
  }
});

test('pre-filter helpers detect missing markers and replace only the marked block', () => {
  assert.throws(() => extractPrefilterBlock('no markers here', 'sample'), /markers/);
  const adapter = `intro\n${prefilterStartMarker}\nold\n${prefilterEndMarker}\noutro\n`;
  const block = `${prefilterStartMarker}\nnew\n${prefilterEndMarker}`;
  assert.equal(replacePrefilterBlock(adapter, block, 'sample'), `intro\n${block}\noutro\n`);
});

test('router core stays under 200 lines and declares when each reference is read', async () => {
  const core = await read(`${routerDir}/SKILL.md`);
  assert.ok(core.split('\n').length <= 200, 'workflow-router SKILL.md must stay at or under 200 lines');
  for (const reference of ['route-menus.md', 'route-gates.md', 'router-evals.md']) {
    assert.match(core, new RegExp(`reference/${reference.replace('.', '\\.')}\\]\\(reference/${reference.replace('.', '\\.')}\\) \\| \\S`), reference);
    await fs.access(path.join(root, routerDir, 'reference', reference));
  }
  assert.doesNotMatch(core, /ai-cost-efficiency-policy\.md/);
  assert.match(core, /`\.agents\/model-routing\/README\.md`/);
});

test('router evals list level test prompts covering every level', async () => {
  const evals = await read(`${routerDir}/reference/router-evals.md`);
  const start = evals.indexOf('<!-- router-evals:level-prompts:start -->');
  const end = evals.indexOf('<!-- router-evals:level-prompts:end -->');
  assert.ok(start >= 0 && end > start, 'level prompt markers are required');
  const rows = evals.slice(start, end).split('\n').filter((line) => /^\| L\d+ \|/.test(line));
  assert.ok(rows.length >= 10, 'at least 10 level test prompts are required');
  const ids = new Set();
  const levels = new Set();
  for (const row of rows) {
    const [id, prompt, level, route] = row.split('|').slice(1, -1).map((cell) => cell.trim());
    assert.ok(!ids.has(id), `duplicate eval id ${id}`);
    ids.add(id);
    assert.ok(prompt.length > 0, `${id} needs a prompt`);
    assert.match(level, /^N[0-3]$/, `${id} has an invalid level`);
    assert.ok(route.length > 0, `${id} needs an expected route`);
    levels.add(level);
  }
  assert.deepEqual([...levels].sort(), ['N0', 'N1', 'N2', 'N3']);
  assert.ok(rows.some((row) => row.includes('pr-comments-resolution')), 'a hard-trigger prompt is required');
});

test('router evals keep contiguous ids through L26 and the levels the PRDs pin', async () => {
  const copies = [
    `${routerDir}/reference/router-evals.md`,
    `templates/repo-overlay-fhh-ia-ecosystem-full/${routerDir}/reference/router-evals.md`
  ];
  for (const file of copies) {
    const evals = await read(file);
    const block = evals.slice(evals.indexOf('<!-- router-evals:level-prompts:start -->'), evals.indexOf('<!-- router-evals:level-prompts:end -->'));
    const levelOf = new Map();
    for (const row of block.split('\n').filter((line) => /^\| L\d+[a-z]? \|/.test(line))) {
      const [id, , level] = row.split('|').slice(1, -1).map((cell) => cell.trim());
      levelOf.set(id, level);
    }
    const numbers = [...levelOf.keys()].map((id) => Number.parseInt(id.slice(1), 10));
    const last = Math.max(...numbers);
    // PRD project-runbooks AC-12 ("L21–L26 son válidas") and the section "Evals L21–L26".
    assert.ok(last >= 26, `${file}: the last eval id must be at least L26`);
    for (let n = 1; n <= last; n += 1) assert.ok(levelOf.has(`L${String(n).padStart(2, '0')}`), `${file}: eval L${n} is missing`);
    // PRD project-runbooks, section "Evals L21–L26": every one of them is N3.
    for (let n = 21; n <= 26; n += 1) assert.equal(levelOf.get(`L${n}`), 'N3', `${file}: L${n} must stay N3`);
    // PRD kit-overlay-contract, section "Evidencia de Implementación" (AC-5): L16 carries a PRD and is N3 by the hazards rule.
    assert.equal(levelOf.get('L16'), 'N3', `${file}: L16 must stay N3`);
  }
});
