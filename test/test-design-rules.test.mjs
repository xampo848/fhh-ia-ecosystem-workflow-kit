import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const overlay = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');
const implementPrd = '.agents/skills/02-implement/implement-prd';
const rulesPath = `${implementPrd}/reference/test-design-rules.md`;

// Every place that used to carry the "one test per new file/method" gate.
const gateSites = [
  `${implementPrd}/reference/validation-and-stop-conditions.md`,
  `${implementPrd}/reference/orchestration-flow-execution.md`,
  '.agents/skills/02-implement/implement-change/reference/level-n3.md',
  '.agents/skills/02-implement/qa-handoff-review/SKILL.md'
];

// Skills that own a test-writing or test-reviewing step and must point to the rules.
const ownerSkills = [
  '.agents/skills/02-implement/acceptance-test-engineer/SKILL.md',
  '.agents/skills/02-implement/backend-phase-implementer/SKILL.md',
  '.agents/skills/02-implement/frontend-phase-implementer/SKILL.md',
  '.agents/skills/02-implement/implementation-slicing/SKILL.md',
  '.agents/skills/02-implement/implement-change/SKILL.md',
  '.agents/skills/02-implement/qa-handoff-review/SKILL.md',
  '.agents/skills/01-product/create-prd/reference/traceability-tables.md'
];

test('the per-method coverage gate is gone and every gate site uses the owning-layer branch gate', async () => {
  for (const base of ['', `${overlay}/`]) {
    for (const site of gateSites) {
      const content = await read(`${base}${site}`);
      assert.doesNotMatch(content, /newly added method|newly created production file|edge-case assertion/i, `${base}${site} still carries the per-method gate`);
      assert.match(content, /new or changed branch/, `${base}${site} must state the branch gate`);
      assert.match(content, /owning layer/, `${base}${site} must name the owning layer`);
      assert.match(content, /test-design-rules\.md/, `${base}${site} must point to the test design rules`);
    }
  }
});

test('test design rules hold the nine rules and the review checklist', async () => {
  const rules = await read(rulesPath);
  const headings = [
    '## 1. Owning layer',
    '## 2. Coverage gate: every new branch in its owning layer',
    '## 3. Edge-case matrix layer',
    '## 4. Search before writing',
    '## 5. Parametrize variants',
    '## 6. Migration test lifecycle',
    '## 7. Behavior, not implementation',
    '## 8. Cheap setup by default',
    '## 9. Obsolete tests'
  ];
  for (const heading of headings) assert.ok(rules.includes(heading), `missing rule: ${heading}`);
  assert.match(rules, /tenancy and authorization are always tested at the entry\s+point/, 'tenancy exception is required');
  assert.match(rules, /method that only delegates is covered by the test of the layer above or\s+below/);
  assert.match(rules, /delete it once the migration is on the main branch/);
  assert.match(rules, /## Checklist \(implementer before writing, QA when reviewing\)/);
  assert.equal(rules, await read(`${overlay}/${rulesPath}`), 'overlay copy must match');
});

test('owning skills point to the test design rules and adapters do not carry them', async () => {
  for (const skill of ownerSkills) {
    assert.match(await read(skill), /test-design-rules\.md/, `${skill} must point to the test design rules`);
  }
  for (const adapter of ['CLAUDE.md', 'AGENTS.md', 'templates/runtime-adapters/claude/CLAUDE.md', 'templates/runtime-adapters/agents-md/AGENTS.md']) {
    assert.doesNotMatch(await read(adapter), /test-design-rules|owning layer/i, `${adapter} is an adapter: rules belong in the skills`);
  }
});

test('the PRD edge-case matrix has an owning-layer column that slicing and QA validate', async () => {
  const template = await read('.agents/skills/01-product/create-prd/PRD_TEMPLATE.md');
  const section = template.slice(template.indexOf('### 2.6 Matriz de Edge Cases'), template.indexOf('### 2.7'));
  const header = section.split('\n').find((line) => line.startsWith('| Categoria'));
  assert.equal(header, '| Categoria | Descripcion | Caso de uso vinculado | Capa duena | Validacion | Estado |');
  const rows = section.split('\n').filter((line) => /^\| (Datos vacios|Limites|Errores|Permisos\/tenancy|Concurrencia\/orden|Rollout\/rollback) \|/.test(line));
  assert.equal(rows.length, 6);
  for (const row of rows) assert.equal(row.split('|').slice(1, -1).length, 6, `row has the wrong cell count: ${row}`);
  assert.match(template, /### 2\.9 Que queda obsoleto[\s\S]*Incluye los tests que dejan de tener sentido/);
  const slicing = await read('.agents/skills/02-implement/implementation-slicing/SKILL.md');
  assert.match(slicing, /slice that owns its `Capa duena` layer/);
  assert.match(slicing, /Rows of type `test`[^\n]*are deleted by their slice/);
  assert.match(await read('.agents/skills/02-implement/qa-handoff-review/SKILL.md'), /`Capa duena` column\. A row proven only at another layer is a `gap`/);
});

test('test design evals cover the entry-point, job, and migration cases', async () => {
  const evals = await read(`${implementPrd}/reference/test-design-evals.md`);
  assert.match(evals.split('\n').slice(0, 12).join('\n'), /Never load this file during execution/);
  const start = evals.indexOf('<!-- test-design-evals:start -->');
  const end = evals.indexOf('<!-- test-design-evals:end -->');
  assert.ok(start >= 0 && end > start, 'eval markers are required');
  const rows = evals.slice(start, end).split('\n').filter((line) => /^\| T\d+ \|/.test(line));
  assert.ok(rows.length >= 3, 'at least 3 test design evals are required');
  const ids = new Set();
  for (const row of rows) {
    const [id, scenario, expected, rule] = row.split('|').slice(1, -1).map((cell) => cell.trim());
    assert.ok(!ids.has(id), `duplicate eval id ${id}`);
    ids.add(id);
    assert.ok(scenario.length > 0 && expected.length > 0, `${id} needs a scenario and an expected decision`);
    assert.match(rule, /^\d(, \d)*$/, `${id} must name the rule it exercises`);
  }
  const text = rows.join('\n');
  assert.match(text, /request test[^|]*\|[^|]*does not repeat/, 'an entry point that does not re-test a query rule');
  assert.match(text, /job[^|]*\|[^|]*Re-proving the service rules in the job test is a duplicate/, 'a job that does not re-test its service');
  assert.match(text, /migration[^|]*\|[^|]*deleted once the migration is on the main branch/, 'a migration test deleted once on main');
});

test('Rails test-design examples live in the stack pack, not in the neutral core', async () => {
  const pack = await read('templates/stack-packs/rails-react/stack.md');
  for (const example of ['### Test design in Rails', 'batch_size: 2', 'TracePoint', 'test/migrations/', 'db/migrate', 'instance_variable_get', 'test/models/', 'use_transactional_tests']) {
    assert.ok(pack.includes(example), `stack pack must carry the Rails example: ${example}`);
  }
  const rules = await read(rulesPath);
  for (const term of ['batch_size', 'TracePoint', 'test/migrations', 'db/migrate', 'instance_variable_get', 'test/models']) {
    assert.ok(!rules.includes(term), `neutral rules must not name the Rails term ${term}`);
  }
});
