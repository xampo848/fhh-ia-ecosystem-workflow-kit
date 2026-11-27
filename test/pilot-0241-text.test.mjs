// Kit text findings of the pilots run on 0.23.9 and 0.24.0, and the
// maintainer's decisions on them: a layer the project lacks, one template for
// the project files, the project context setup route, a PRD template in one
// language with a shorter compact form, and smaller alignments.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const overlay = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
const bothCopies = (file) => [file, `${overlay}/${file}`];
const router = '.agents/skills/00-router/workflow-router/SKILL.md';
const createPrd = '.agents/skills/01-product/create-prd';
const standards = 'docs/workflow/standards';
const lineOf = (text, pattern) => text.split('\n').find((line) => pattern.test(line)) ?? '';

test('a layer the project lacks keeps its file with one line; no kit text says to delete it', async () => {
  for (const layer of ['backend', 'frontend']) {
    for (const file of bothCopies(`.agents/project/${layer}.md`)) {
      const text = await read(file);
      assert.doesNotMatch(text, /delete the file/, file);
      assert.match(text, new RegExp(`has no ${layer}, do not delete this file`), file);
      assert.match(text, new RegExp(`This project has no ${layer}\\.`), file);
    }
  }
  for (const file of bothCopies(`${standards}/setup-and-migration.md`)) {
    const text = await read(file);
    assert.doesNotMatch(text, /marked as N\/A/, file);
    assert.match(text, /one line that says so; the file is never deleted/, file);
  }
  for (const file of bothCopies(router)) {
    assert.match(lineOf(await read(file), /^\| Project context setup \|/), /a layer the project lacks keeps its file with one line that says so/, file);
  }
});

test('the kit has one template for the project files: the guide carries no second copy', async () => {
  for (const file of bothCopies(`${standards}/project-instructions-template.md`)) {
    const text = await read(file);
    assert.doesNotMatch(text, /```/, `${file} must not carry a fenced template`);
    assert.doesNotMatch(text, /copy\/paste|<node\|ruby|Create `\.agents\/project\/(backend|frontend)\.md`:/, file);
    assert.match(text, /`init` creates/, file);
    assert.match(text, /<!-- workflow-kit:project-instructions:template -->/, file);
  }
  for (const name of ['backend.md', 'frontend.md', 'setup-and-migration.md']) {
    for (const file of bothCopies(`${standards}/${name}`)) {
      assert.doesNotMatch(await read(file), /as a starter|copy\/paste starter/, file);
    }
  }
  for (const file of bothCopies(`${standards}/setup-and-migration.md`)) {
    const text = await read(file);
    assert.doesNotMatch(text, /does not auto-generate project-specific runtime instructions/, file);
    assert.match(text, /`init` creates them as templates/, file);
  }
  for (const file of ['docs/README.md', `${overlay}/docs/README.md`]) {
    assert.doesNotMatch(await read(file), /backend\/frontend standards and setup guidance/, file);
  }
});

test('the project context setup route has a level, a trace form and a rule for what stays undetermined', async () => {
  for (const file of bothCopies(router)) {
    const text = await read(file);
    const row = lineOf(text, /^\| Project context setup \|/);
    assert.match(row, /N2/, file);
    assert.match(row, /`direct-edit`/, file);
    for (const part of ['structure map', 'validation commands', 'test conventions', 'environment quirks', 'pointers']) assert.match(row, new RegExp(part), `${file}: ${part}`);
    assert.match(row, /`not determined: <reason>`, never `\[TODO`/, file);
    assert.match(row, /marker and the template notice go only when no `\[TODO` is left/, file);
    assert.match(text, /- COMPACT: `\[skill \| direct-answer \| direct-edit \| direct-action\] · /, file);
    assert.match(text, /- Selected workflow: `\[skill \| direct-answer \| direct-edit \| direct-action\]`/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 199, `${file} must stay within the router line budget`);
  }
  for (const file of bothCopies('.agents/skills/00-router/workflow-router/reference/router-evals.md')) {
    assert.match(await read(file), /\| L30 \|[^\n]*Discovery inicial[^\n]*\| N2 \| direct-edit/, file);
  }
  for (const name of ['context.md', 'backend.md', 'frontend.md']) {
    for (const file of bothCopies(`.agents/project/${name}`)) {
      assert.match(await read(file), /`not determined: <reason>`/, file);
    }
  }
});

test('router: explicit invocation is the exception to never auto-load, Medium is not a menu, and one route needs no menu file', async () => {
  for (const file of bothCopies(router)) {
    const text = await read(file);
    assert.match(text, /Without such an explicit invocation, never auto-load/, file);
    assert.match(lineOf(text, /^- Medium:/), /alternative in the trace is not a second offer/, file);
    assert.match(lineOf(text, /route-menus\.md\]\(reference\/route-menus\.md\) \|/), /two or more route options/, file);
  }
});

test('implement-change detects the template by its marker, sets the level for an explicit PRD, and N2 names the Discovery exception', async () => {
  for (const file of bothCopies('.agents/skills/02-implement/implement-change/SKILL.md')) {
    const text = await read(file);
    assert.doesNotMatch(text, /`\[TODO\]` placeholders|project context: no configurado/, file);
    assert.match(text, /<!-- workflow-kit:project-context:template -->/, file);
    assert.match(text, /With an explicit PRD[^.]*this skill sets the level/, file);
  }
  for (const file of bothCopies('.agents/skills/02-implement/implement-change/reference/level-n2.md')) {
    assert.match(await read(file), /only at closure, except for the initial\s+Discovery of the project/, file);
  }
});

test('create-prd loads the architecture rules only when they apply', async () => {
  for (const file of bothCopies(`${createPrd}/SKILL.md`)) {
    const line = lineOf(await read(file), /reference\/architecture-rules\.md\]\(reference\/architecture-rules\.md\)/);
    assert.doesNotMatch(line, /or tests$/, file);
    assert.match(line, /parent epic, creates or changes persisted entities, or defines enumerations/, file);
  }
});

test('the PRD template is in one language and carries no stack-shaped example', async () => {
  const english = /\| Given \||\| Outcome \||Depends on|Scope \/ likely files|Evidence expected|Slice stop conditions|Acceptance criterion \||Test evidence|Validation evidence|\[One small result\]|\[Precondition\]|Every slice is|Repeat the complete phase|\[Feature Name\]|\[Clear statement|AggregateRoot|UUID|Entrada HTTP|entrada HTTP/;
  for (const file of bothCopies(`${createPrd}/PRD_TEMPLATE.md`)) {
    const hit = (await read(file)).split('\n').find((line) => english.test(line));
    assert.equal(hit, undefined, `${file}: ${hit}`);
    const template = await read(file);
    assert.ok(template.includes('| ID | Resultado | Depende de | Alcance / archivos probables | Criterios de aceptación | Casos de uso | Tests | Edge cases | Validación | Evidencia |'), file);
    assert.ok(template.includes('| ID | Dado | Cuando | Entonces | Evidencia esperada |'), file);
    assert.ok(template.includes('**Condiciones de parada**'), file);
  }
  for (const file of bothCopies(`${createPrd}/reference/execution-granularity.md`)) {
    assert.match(await read(file), /The template names these columns in Spanish, in the same order/, file);
  }
  for (const file of bothCopies('.agents/skills/02-implement/backend-phase-implementer/agents/openai.yaml')) {
    assert.doesNotMatch(await read(file), /Rails/, file);
  }
});

test('a compact PRD drops the traceability matrix and keeps only the Definition of Done items that apply', async () => {
  for (const file of bothCopies(`${createPrd}/SKILL.md`)) {
    const text = await read(file);
    assert.match(text, /omit section 9 \(the traceability matrix\)/, file);
    assert.match(text, /section 8 keeps only the items that apply/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 200, file);
  }
  for (const file of bothCopies(`${createPrd}/PRD_TEMPLATE.md`)) {
    const template = await read(file);
    assert.match(template.split('## 9. Matriz de Trazabilidad')[1].split('\n## ')[0], /PRD compacto: omitir esta sección/, file);
    assert.match(template.split('## 8. Definition of Done Global')[1].split('\n## ')[0], /PRD compacto: dejar solo los items que aplican/, file);
  }
  for (const file of bothCopies('.agents/skills/02-implement/prd-readiness-review/SKILL.md')) {
    assert.match(await read(file), /no traceability matrix \(section 9\)/, file);
  }
});

test('review: the slice fields are listed in the order of the template columns, and no English placeholder is left', async () => {
  for (const file of bothCopies(`${createPrd}/reference/execution-granularity.md`)) {
    const fields = (await read(file)).split('\n').filter((line) => /\| Slice table \|/.test(line)).map((line) => line.split('|')[1].trim());
    assert.deepEqual(fields, ['ID', 'Outcome', 'Depends on', 'Scope', 'Acceptance criteria', 'Use cases', 'Tests', 'Edge cases', 'Validation', 'Evidence'], file);
  }
  for (const file of bothCopies(`${createPrd}/PRD_TEMPLATE.md`)) {
    const hit = (await read(file)).split('\n').find((line) => /Test\/contract\/smoke|\[`command`/.test(line));
    assert.equal(hit, undefined, `${file}: ${hit}`);
  }
});
