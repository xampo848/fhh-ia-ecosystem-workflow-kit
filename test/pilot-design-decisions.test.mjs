// Design decisions the maintainer took after the pilot: when a plain yes
// authorizes a route, what an N1 file limit counts, what "explicit PRD" and
// "public contract" mean, which naming language a PRD follows, a stack-neutral
// PRD template, and a proportional compact PRD. Structural checks over the kit
// tree and its overlay mirror.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { extractPrefilterBlock } from '../scripts/sync-level-prefilter.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const overlay = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
// A kit file in both copies: the repository tree and the overlay that init installs.
const bothCopies = (file) => [file, `${overlay}/${file}`];
const router = '.agents/skills/00-router/workflow-router/SKILL.md';
const routerEvals = '.agents/skills/00-router/workflow-router/reference/router-evals.md';
const routeGates = '.agents/skills/00-router/workflow-router/reference/route-gates.md';
const instructions = '.agents/instructions.md';
const levelN1 = '.agents/skills/02-implement/implement-change/reference/level-n1.md';

const section = (text, heading) => {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, `missing section ${heading}`);
  const next = text.slice(start + heading.length).search(/\n#{2,4} /);
  return next < 0 ? text.slice(start) : text.slice(start, start + heading.length + next);
};

test('decision 1: a plain yes authorizes the single proposed route, and a bare yes to a menu of several authorizes none', async () => {
  for (const file of bothCopies(router)) {
    const gate = section(await read(file), '## Execution authorization gate');
    assert.doesNotMatch(gate, /names no route, ask the user to confirm the route by name/, file);
    assert.match(gate, /affirmative reply authorizes[^\n]*proposed exactly one/, file);
    assert.match(gate, /by number, skill name, label, or an unmistakable description/, file);
    assert.match(gate, /bare yes to a menu of several[^\n]*authorizes none/, file);
  }
  for (const file of bothCopies(instructions)) {
    const gate = section(await read(file), 'Execution authorization gate:');
    assert.match(gate, /plain yes authorizes the single route proposed in the previous turn/, file);
  }
  for (const file of bothCopies(routerEvals)) {
    const evals = await read(file);
    assert.match(evals, /\| L27 \|[^\n]*"sí, avanza"[^\n]*one route proposed[^\n]*\|[^\n]*no second confirmation/, file);
    assert.match(evals, /\| L28 \|[^\n]*"sí"[^\n]*menu of several[^\n]*\|[^\n]*asks which option/, file);
  }
});

test('decision 3: the router defines the explicit PRD trigger, and High confidence loads a writing skill only after authorization', async () => {
  for (const file of bothCopies(router)) {
    const text = await read(file);
    const trigger = section(text, '#### Explicit PRD hard trigger');
    assert.match(trigger, /path of an existing PRD|path to an existing PRD/, file);
    assert.match(trigger, /`implement-change`/, file);
    assert.match(trigger, /request to write a PRD is not this trigger/, file);
    const high = text.split('\n').find((line) => line.startsWith('- High:'));
    assert.doesNotMatch(high, /Emit the COMPACT trace and load the skill;/, file);
    assert.match(high, /proceed when the route is read-only or the imperative names the work/, file);
    assert.match(high, /route that writes[^\n]*load the skill only after the user authorizes it/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 200, `${file} must stay at or under 200 lines`);
  }
  for (const file of bothCopies(routerEvals)) {
    assert.match(await read(file), /\| L29 \|[^\n]*create-prd[^\n]*not loaded before/, file);
  }
});

test('decision 2: an N1 limit counts production files, the test goes with its file, and a bounded lookup may precede the yes', async () => {
  for (const file of bothCopies(levelN1)) {
    const text = await read(file);
    assert.match(text, /one or two production files/, file);
    assert.match(text, /test file[^.\n]*counts as a target file[^.\n]*not toward the one-or-two-file limit/i, file);
    assert.match(text, /bounded read-only lookup[^\n]*before the yes|Before the yes[^\n]*bounded read-only lookup/, file);
  }
  for (const file of bothCopies(routeGates)) {
    const offer = section(await read(file), '## N1 surgical offer');
    assert.match(offer, /one or two production files/, file);
    assert.match(offer, /does not count toward that limit/, file);
    assert.match(offer, /bounded read-only lookup/, file);
  }
  for (const file of bothCopies(instructions)) {
    const text = await read(file);
    const rules = section(text, 'Level rules:');
    assert.match(rules, /N1 file limit counts production files/, file);
    assert.match(rules, /bounded read-only lookup/, file);
    // The generated block is frozen (the `split` decision of old installs
    // depends on it), so the clarification lives outside its markers.
    assert.doesNotMatch(extractPrefilterBlock(text), /production files|read-only lookup/, file);
  }
});

const createPrd = '.agents/skills/01-product/create-prd';
const contractGloss = /public contract \(an interface consumed outside the repository or across a deployment boundary; `\.agents\/instructions\.md`, "Level rules"\)/;

test('decision 4: one definition of contract, and every gate that says "public contract" points at it', async () => {
  for (const file of bothCopies(instructions)) {
    const rules = section(await read(file), 'Level rules:');
    assert.match(rules, /A contract[^.]*is an interface consumed outside the repository or across a\s+deployment boundary/, file);
    assert.match(rules, /exported and used only inside the\s+repository is not a contract/, file);
  }
  const gates = [
    `${createPrd}/SKILL.md`,
    `${createPrd}/reference/execution-granularity.md`,
    '.agents/skills/02-implement/prd-readiness-review/SKILL.md',
    '.agents/skills/02-implement/implementation-slicing/SKILL.md'
  ];
  for (const gate of gates) {
    for (const file of bothCopies(gate)) {
      const text = await read(file);
      const mentions = text.split('\n').filter((line) => /public contract/.test(line));
      assert.ok(mentions.length > 0, file);
      for (const line of mentions) assert.match(line, contractGloss, `${file}: ${line}`);
    }
  }
});

test('decision 5: identifiers follow the project rules, then the existing code, then English', async () => {
  for (const file of bothCopies(`${createPrd}/SKILL.md`)) {
    const text = await read(file);
    assert.doesNotMatch(text, /use English, even if the domain language is Spanish/, file);
    assert.match(text, /6\. \*\*Identifiers follow the project\*\*[^\n]*project's rules[^\n]*existing code[^\n]*English/, file);
  }
  for (const file of bothCopies(`${createPrd}/reference/calibration.md`)) {
    assert.match(await read(file), /- `identifier_language`: [^\n]*`project-rules \| existing-code \| default`/, file);
  }
  for (const file of bothCopies(`${createPrd}/reference/pattern-locking.md`)) {
    const text = await read(file);
    assert.match(text, /`identifier_language`/, file);
    assert.match(text, /offer once to record it in the project's rules/, file);
  }
  for (const file of bothCopies(`${createPrd}/reference/quality-bar.md`)) {
    assert.doesNotMatch(await read(file), /Using Spanish names for code identifiers/, file);
  }
  for (const file of bothCopies(`${createPrd}/reference/self-audit.md`)) {
    assert.match(await read(file), /identifiers follow the `identifier_language` recorded/, file);
  }
});
