import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const overlay = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');
const createPrd = '.agents/skills/01-product/create-prd';
const rulePath = `${createPrd}/reference/visual-lock.md`;
const evalsPath = `${createPrd}/reference/visual-lock-evals.md`;

// Skills that create, gate, slice, implement, or review a prototype lock.
const ownerSkills = [
  `${createPrd}/SKILL.md`,
  `${createPrd}/reference/ambiguity-detection.md`,
  `${createPrd}/reference/self-audit.md`,
  '.agents/skills/02-implement/prd-readiness-review/SKILL.md',
  '.agents/skills/02-implement/implementation-slicing/SKILL.md',
  '.agents/skills/02-implement/frontend-phase-implementer/SKILL.md',
  '.agents/skills/02-implement/qa-handoff-review/SKILL.md',
  '.agents/skills/02-implement/implement-change/reference/input-types.md',
  '.agents/skills/02-implement/implement-prd/reference/validation-and-stop-conditions.md'
];

test('the visual lock rule splits ownership, resolves clashes in the PRD, and defines both levels', async () => {
  const rule = await read(rulePath);
  for (const heading of [
    '## 1. Who owns what',
    '## 2. Default',
    '## 3. Conflicts are resolved in the PRD, never in implementation',
    '## 4. Intentional new style',
    '## 5. Map every element to a component',
    '## 6. Lock levels and the PRD block',
    '## 7. Consumers'
  ]) assert.ok(rule.includes(heading), `missing section: ${heading}`);
  assert.match(rule.split('\n').slice(0, 12).join('\n'), /Read it in Phase 2/, 'the rule must say when to read it');
  assert.match(rule, /\| Structure and content \| Prototype \(locked\) \| layout, hierarchy, sections and their order, texts, fields, states, interactions \|/);
  assert.match(rule, /\| Visual language \| Project patterns \| colors, typography, spacing, radii, shadows, existing components \|/);
  assert.match(rule, /The pattern wins on visual language and the prototype wins on structure/);
  assert.match(rule, /only when the user says so explicitly/);
  assert.match(rule, /Ask once/);
  assert.match(rule, /The implementer never resolves a clash/);
  assert.match(rule, /Propose updating the pattern or design system\s+first/);
  assert.match(rule, /`componente nuevo`/);
  assert.match(rule, /Never create a loose variant/);
  assert.match(rule, /`estructura` \(default\)/);
  assert.match(rule, /`pixel`: only when the user asks for it explicitly/);
  assert.match(rule, /validate against the table, not against the raw HTML/);
  assert.match(rule, /`playwright-testing`/);
  assert.equal(rule, await read(`${overlay}/${rulePath}`), 'overlay copy must match');
});

test('the PRD carries a minimal Lock visual block inside the Contrato Visual', async () => {
  const section = await read(`${createPrd}/template-sections/visual-contract.md`);
  assert.match(section, /#### Lock visual \(prototipo\)/);
  assert.match(section, /\*\*Lock visual\*\*: N\/A \| estructura \| pixel/);
  assert.match(section, /\*\*Fuente\*\*: \[ruta del HTML o la imagen\]/);
  assert.ok(section.includes('| Elemento | Fuente | Componente | Decision |'), 'the table header is fixed');
  assert.match(section, /reference\/visual-lock\.md/);
  const template = await read(`${createPrd}/PRD_TEMPLATE.md`);
  const contract = template.slice(template.indexOf('### 2.7 Contrato Visual'), template.indexOf('### 2.8'));
  assert.match(contract, /`Lock visual: N\/A`/, 'the template says what to write without a prototype');
  assert.match(template, /- \[ \] Si hay prototipo, cada choque con los patterns tiene decision en el `Lock visual`/);
});

test('owning skills point to the visual lock rule and adapters do not carry it', async () => {
  for (const skill of ownerSkills) {
    const content = await read(skill);
    assert.match(content, /visual-lock\.md/, `${skill} must point to the visual lock rule`);
    assert.equal(content, await read(`${overlay}/${skill}`), `${skill} overlay copy must match`);
  }
  assert.match(await read('.agents/skills/02-implement/implementation-slicing/SKILL.md'), /assign every row to exactly one frontend slice/);
  assert.match(await read('.agents/skills/02-implement/qa-handoff-review/SKILL.md'), /validate against the table, not the raw prototype/);
  assert.match(await read('.agents/skills/02-implement/frontend-phase-implementer/SKILL.md'), /Never add a loose variant to match the prototype/);
  for (const adapter of ['CLAUDE.md', 'AGENTS.md', 'templates/runtime-adapters/claude/CLAUDE.md', 'templates/runtime-adapters/agents-md/AGENTS.md']) {
    assert.doesNotMatch(await read(adapter), /visual-lock|Lock visual|prototip/i, `${adapter} is an adapter: rules belong in the skills`);
  }
});

test('visual lock evals cover the pattern-wins, new-component, and pixel cases', async () => {
  const evals = await read(evalsPath);
  assert.match(evals.split('\n').slice(0, 12).join('\n'), /Never load this file during execution/);
  const start = evals.indexOf('<!-- visual-lock-evals:start -->');
  const end = evals.indexOf('<!-- visual-lock-evals:end -->');
  assert.ok(start >= 0 && end > start, 'eval markers are required');
  const rows = evals.slice(start, end).split('\n').filter((line) => /^\| V\d+ \|/.test(line));
  assert.ok(rows.length >= 3, 'at least 3 visual lock evals are required');
  const ids = new Set();
  for (const row of rows) {
    const [id, scenario, expected, rule] = row.split('|').slice(1, -1).map((cell) => cell.trim());
    assert.ok(!ids.has(id), `duplicate eval id ${id}`);
    ids.add(id);
    assert.ok(scenario.length > 0 && expected.length > 0, `${id} needs a scenario and an expected decision`);
    assert.match(rule, /^[1-7](, [1-7])*$/, `${id} must name the rule sections it exercises`);
  }
  const text = rows.join('\n');
  assert.match(text, /green[^|]*purple[^|]*\|[^|]*the pattern wins and the row records `pattern gana/, 'a green prototype against a purple pattern');
  assert.match(text, /no such component[^|]*\|[^|]*`componente nuevo`/, 'a prototype element without a component');
  assert.match(text, /explicitly asks for a `pixel` lock[^|]*\|[^|]*`Lock visual: pixel`/, 'an explicit pixel request');
  assert.equal(evals, await read(`${overlay}/${evalsPath}`), 'overlay copy must match');
});

test('React visual-lock examples live in the stack pack, not in the neutral core', async () => {
  const pack = await read('templates/stack-packs/rails-react/stack.md');
  for (const example of ['### Visual lock in React', '<Button variant="primary">', 'var(--color-primary)', 'GreenButton', 'toHaveScreenshot']) {
    assert.ok(pack.includes(example), `stack pack must carry the React example: ${example}`);
  }
  const rule = await read(rulePath);
  for (const term of ['className', 'JSX', 'var(--', 'toHaveScreenshot', 'React']) {
    assert.ok(!rule.includes(term), `neutral rule must not name the stack term ${term}`);
  }
});
