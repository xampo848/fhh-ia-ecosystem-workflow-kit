// Kit text findings of the pilot run on 0.24.1 and the maintainer's decisions:
// the PRD state field, a realistic compact target, accents in the PRD
// template, and smaller alignments.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const overlay = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
const bothCopies = (file) => [file, `${overlay}/${file}`];
const createPrd = '.agents/skills/01-product/create-prd';
const implementChange = '.agents/skills/02-implement/implement-change/SKILL.md';
const router = '.agents/skills/00-router/workflow-router/SKILL.md';

test('the PRD state has an owner: create-prd delivers it in review, and implement-change asks before implementing one that is not approved', async () => {
  for (const file of bothCopies(`${createPrd}/SKILL.md`)) {
    assert.match(await read(file), /delivers the PRD with `Estado: En revisión`[^\n]*only the user moves it to `Aprobado`/, file);
  }
  for (const file of bothCopies(implementChange)) {
    const text = await read(file);
    assert.match(text, /`Estado` is not `Aprobado`[^\n]*say so and ask for a yes before any edit[^\n]*set `Estado: Aprobado`/, file);
    assert.match(text, /A PRD without the field[^\n]*is not blocked/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 200, file);
  }
  for (const file of bothCopies(router)) {
    const text = await read(file);
    assert.doesNotMatch(text, /the PRD is the input and the authorization/, file);
    assert.match(text, /`implement-change` checks the PRD's `Estado`/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 199, file);
  }
});

test('the compact PRD target is what the mandatory tables allow, and its numbering and phase checklist are defined', async () => {
  for (const file of bothCopies(`${createPrd}/SKILL.md`)) {
    const text = await read(file);
    assert.doesNotMatch(text, /80 to 120 lines/, file);
    assert.match(text, /at most about 170 lines/, file);
    assert.match(text, /section numbers do not shift/, file);
    assert.match(text, /each phase's Definition of Done keeps only the lines that apply/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 200, file);
  }
});

test('implement-change maps an explicit PRD to a level and does not ask twice', async () => {
  for (const file of bothCopies(implementChange)) {
    const text = await read(file);
    assert.match(text, /N3 when the PRD names a hazard[^\n]*N1 when it is compact with one slice[^\n]*N2 otherwise/, file);
    assert.match(text, /"implementa este PRD" is that authorization; offering the execution mode is not a second confirmation/, file);
  }
});

test('smaller alignments: unanswered questions, the template notice, the route in the instructions, and folders init does not create', async () => {
  for (const file of bothCopies(`${createPrd}/reference/ambiguity-detection.md`)) {
    assert.match(await read(file), /If the user replies without answering a blocking question, ask again once, naming the ones that remain/, file);
  }
  for (const file of bothCopies('.agents/project/context.md')) {
    assert.match(await read(file), /Remove the template marker above and this paragraph when no `\[TODO` is left/, file);
  }
  for (const file of bothCopies(router)) {
    assert.match((await read(file)).split('\n').find((line) => line.startsWith('| Project context setup |')), /template marker and the template notice go only when no `\[TODO` is left/, file);
  }
  for (const file of bothCopies('.agents/instructions.md')) {
    assert.match(await read(file), /initial Discovery of the project[\s\S]{0,120}"Project context setup" route/, file);
  }
  for (const file of ['docs/README.md', `${overlay}/docs/README.md`, 'docs/workflow/README.md', `${overlay}/docs/workflow/README.md`]) {
    const text = await read(file);
    for (const line of text.split('\n').filter((entry) => /handoffs\//.test(entry))) {
      assert.match(line, /not created by `init`|create (it|the folder) when/, `${file}: ${line}`);
    }
  }
});
