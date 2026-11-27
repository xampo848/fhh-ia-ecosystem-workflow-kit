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

const stackBias = /```(?:ruby|rb|erb)\b|\b[\w/]+\.rb\b|\badd_column\b|CaptureExceptionService|Columnas BD|Campo BD|\[TableName\]|siguen importando|RowProcessor|N\+1|Analytics::|must still import|importer-only/;

test('decision 6: the PRD template and its rules name no stack, and persistence is a conditional section', async () => {
  for (const name of ['PRD_TEMPLATE.md', 'reference/architecture-rules.md', 'reference/quality-bar.md', 'SKILL.md']) {
    for (const file of bothCopies(`${createPrd}/${name}`)) {
      const hit = (await read(file)).split('\n').find((line) => stackBias.test(line));
      assert.equal(hit, undefined, `${file}: ${hit}`);
    }
  }
  for (const file of bothCopies(`${createPrd}/PRD_TEMPLATE.md`)) {
    const template = await read(file);
    assert.match(template, /## 3\. Diseno Tecnico/, file);
    assert.match(template, /### 3\.1 Datos y Persistencia/, file);
    assert.match(template, /template-sections\/data-model\.md/, file);
    assert.match(template, /`Persistencia: no aplica`/, file);
  }
  for (const file of bothCopies(`${createPrd}/template-sections/data-model.md`)) {
    const sectionText = await read(file);
    assert.match(sectionText.split('\n').slice(0, 4).join('\n'), /only when the PRD creates or changes persisted data/, file);
    for (const heading of ['Estado actual de los datos', 'Campos nuevos o modificados', 'Migracion requerida', 'Ciclo de vida', 'Aislamiento entre tenants']) {
      assert.match(sectionText, new RegExp(`#### ${heading}`), `${file}: ${heading}`);
    }
    assert.match(sectionText, /Aislamiento entre tenants _\(solo si el proyecto es multi-tenant\)_/, file);
  }
  for (const file of bothCopies(`${createPrd}/reference/architecture-rules.md`)) {
    const rules = await read(file);
    assert.match(rules, /PRDs that create or change persisted entities/, file);
    assert.match(rules, /when the project is multi-tenant/, file);
  }
  for (const file of bothCopies(`${createPrd}/SKILL.md`)) {
    const skill = await read(file);
    assert.match(skill, /`data-model\.md` \(the PRD creates or changes persisted data\)/, file);
    assert.ok(skill.replace(/\n$/, '').split('\n').length <= 200, `${file} must stay at or under 200 lines`);
  }
});

test('decision 6: the neutrality check catches stack-specific code in a core skill, and the Rails pack keeps what left the template', async () => {
  const { validateStackNeutrality } = await import('../scripts/validate-stack-neutrality.mjs');
  const { makeTempRepo } = await import('./helpers.mjs');
  const fixture = await makeTempRepo('workflow-kit-neutral-');
  await fs.cp(path.join(root, '.agents'), path.join(fixture, '.agents'), { recursive: true });
  await fs.cp(path.join(root, 'templates/stack-packs'), path.join(fixture, 'templates/stack-packs'), { recursive: true });
  await fs.mkdir(path.join(fixture, 'scripts'));
  await fs.copyFile(path.join(root, 'scripts/stack-rule-inventory.json'), path.join(fixture, 'scripts/stack-rule-inventory.json'));
  assert.deepEqual((await validateStackNeutrality({ root: fixture })).failures, []);

  const template = path.join(fixture, `${createPrd}/PRD_TEMPLATE.md`);
  await fs.appendFile(template, '\n```ruby\nadd_column :orders, :due_on, :date\n```\n\n| Service | app/services/orders/create.rb |\n\n- Errors go through `Errors::CaptureExceptionService`.\n- For example, a path such as app/models/order.rb.\n');
  const failures = (await validateStackNeutrality({ root: fixture })).failures.filter((failure) => failure.includes('PRD_TEMPLATE.md'));
  assert.equal(failures.length, 4, failures.join('\n'));
  assert.ok(failures.some((failure) => failure.includes('ruby code fence')), failures.join('\n'));
  assert.ok(failures.some((failure) => failure.includes('"add_column"')), failures.join('\n'));
  assert.ok(failures.some((failure) => failure.includes('.rb"')), failures.join('\n'));
  assert.ok(failures.some((failure) => failure.includes('CaptureExceptionService')), failures.join('\n'));

  const pack = await read('templates/stack-packs/rails-react/stack.md');
  assert.match(pack, /PRD data sections write the migration as Rails migration pseudo-code/);
  assert.match(pack, /Errors::CaptureExceptionService/);
  const inventory = JSON.parse(await read('scripts/stack-rule-inventory.json'));
  for (const id of ['prd-rails-migration', 'prd-error-capture']) {
    assert.ok(inventory.rules.some((rule) => rule.id === id && /create-prd/.test(rule.movedFrom)), id);
  }
});

test('decision 7: a compact PRD is proportional, and its class diagram is required only when classes change', async () => {
  for (const file of bothCopies(`${createPrd}/SKILL.md`)) {
    const skill = await read(file);
    const compact = section(skill, '### Compact Path Gate');
    assert.doesNotMatch(compact, /do not omit use cases, test strategy, edge-case matrix, class diagram, or slice ownership/, file);
    assert.match(compact, /do not omit acceptance criteria, use cases, test strategy, or the edge-case matrix/, file);
    assert.match(compact, /`No aplica: <reason>`/, file);
    assert.match(compact, /one line per slice/, file);
    assert.match(compact, /80 to 120 lines/, file);
    const gate = section(skill, '### Hard Gate: Class Diagram Is Non-Optional');
    assert.match(gate, /introduces or changes classes, entities, value objects, services, or interfaces/, file);
    assert.match(gate, /compact PRD that only adds or changes functions[^\n]*signature list/, file);
    assert.match(gate, /Do not substitute a flowchart/, file);
  }
  for (const file of bothCopies(`${createPrd}/PRD_TEMPLATE.md`)) {
    const template = await read(file);
    assert.match(template, /lista de firmas/, file);
    assert.match(template, /una linea por slice/, file);
  }
  for (const file of bothCopies(`${createPrd}/reference/self-audit.md`)) {
    assert.match(await read(file), /class diagram \(or the signature list of a compact PRD without class changes\)/, file);
  }
  for (const file of bothCopies(`${createPrd}/reference/quality-bar.md`)) {
    const bar = await read(file);
    assert.match(bar, /Padding a compact PRD/, file);
    assert.match(bar, /Omitting the Mermaid class diagram when classes change/, file);
  }
  for (const file of bothCopies('.agents/skills/02-implement/prd-readiness-review/SKILL.md')) {
    assert.match(await read(file), /compact PRD[^\n]*one line per slice[^\n]*signature list/, file);
  }
});

test('third pilot: every section create-prd requires has a heading in the template or one of its sections', async () => {
  for (const file of bothCopies(`${createPrd}/template-sections/data-model.md`)) {
    const text = await read(file);
    assert.match(text, /#### Ubicacion en el dominio/, file);
    assert.match(text, /#### Enumeraciones/, file);
    assert.match(text, /dependencias entre contextos/i, file);
  }
  for (const file of bothCopies(`${createPrd}/SKILL.md`)) {
    assert.match(await read(file), /"Ubicacion en el dominio"[^\n]*"Enumeraciones"[^\n]*"Ciclo de vida"/, file);
  }
});

test('third pilot: the slice fields the rule asks for match what the template holds', async () => {
  const columns = ['ID', 'Outcome', 'Depends on', 'Scope / likely files', 'Acceptance criteria', 'Use cases', 'Tests', 'Edge cases', 'Validation', 'Evidence'];
  for (const file of bothCopies(`${createPrd}/PRD_TEMPLATE.md`)) {
    const template = await read(file);
    assert.ok(template.includes(`| ${columns.join(' | ')} |`), file);
    for (const label of ['**Fuera de alcance**', '**Chequeos de calidad**', '**Slice stop conditions**', '**Activacion**']) assert.ok(template.includes(label), `${file}: ${label}`);
  }
  for (const file of bothCopies(`${createPrd}/reference/execution-granularity.md`)) {
    const rule = await read(file);
    assert.match(rule, /ten columns of the slice table/, file);
    assert.match(rule, /once per phase, below the table[^\n]*Out of scope, Quality checks, Stop conditions, and Activation/, file);
    assert.match(rule, /on the slice only when it differs/, file);
    const fields = rule.split('\n').filter((line) => /^\| (?!Field|---)[^|]+\| (?:Slice table|Phase block)/.test(line));
    assert.equal(fields.filter((line) => /\| Slice table/.test(line)).length, 10, file);
    assert.equal(fields.filter((line) => /\| Phase block/.test(line)).length, 4, file);
  }
});

test('third pilot: a feature flag is asked about only when the change carries rollout risk', async () => {
  for (const file of bothCopies(`${createPrd}/reference/quality-bar.md`)) {
    const bar = await read(file);
    assert.doesNotMatch(bar, /feature flag is not needed — \*\*always ask\*\*/, file);
    assert.match(bar, /feature flag[^\n]*`ambiguity-detection\.md`/, file);
  }
  for (const file of bothCopies(`${createPrd}/reference/ambiguity-detection.md`)) {
    const text = await read(file);
    assert.match(text, /Feature flag: ask only when the change alters behavior existing users already see, touches existing data, or needs a gradual rollout/, file);
    assert.match(text, /otherwise record `sin feature flag` as an assumption/, file);
  }
});
