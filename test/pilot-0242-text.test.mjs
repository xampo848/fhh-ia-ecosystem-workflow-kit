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
    assert.match(text, /`Estado` in the PRD header is not `Aprobado`[^\n]*say so and ask for a yes before any edit[^\n]*set `Estado: Aprobado`/, file);
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
    assert.doesNotMatch(text, /80 to 120 lines|at most about \d+ lines/, file);
    assert.match(text, /section numbers do not shift/, file);
    assert.match(text, /each phase's Definition of Done keeps only the lines that apply/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 200, file);
  }
});

test('implement-change maps an explicit PRD to a level and does not ask twice', async () => {
  for (const file of bothCopies(implementChange)) {
    const text = await read(file);
    assert.match(text, /escalation rules below[^\n]*N1 when its header says `Modo: compacto` and it has one slice[^\n]*N2 otherwise/, file);
    assert.match(text, /"implementa este PRD" is that authorization; offering the execution mode is not a second confirmation/, file);
  }
});

test('smaller alignments: unanswered questions, the template notice, the route in the instructions, and folders init does not create', async () => {
  for (const file of bothCopies(`${createPrd}/reference/ambiguity-detection.md`)) {
    assert.match(await read(file), /If the user replies without answering a blocking question, ask again once, naming the ones that remain/, file);
  }
  for (const file of bothCopies('.agents/project/context.md')) {
    assert.match(await read(file), /When no `\[TODO` is left, delete this whole block and the marker line above/, file);
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

test('the PRD template and its sections are written with accents, and the readers of older PRDs are told both spellings are the same', async () => {
  const unaccented = /\b(Diseno|Tecnico|Aceptacion|Implementacion|Descripcion|Validacion|Migracion|Ubicacion|Decision|Condicion|Activacion|Mitigacion|seccion|razon|linea|lineas|vacios|Limites|duena|dueno|Epica|codigo|segun|revision)\b/;
  const files = ['PRD_TEMPLATE.md', 'template-sections/data-model.md', 'template-sections/epic-context.md', 'template-sections/visual-contract.md'];
  for (const name of files) {
    for (const file of bothCopies(`${createPrd}/${name}`)) {
      const hit = (await read(file)).split('\n').find((line) => unaccented.test(line));
      assert.equal(hit, undefined, `${file}: ${hit}`);
    }
  }
  for (const file of bothCopies(`${createPrd}/PRD_TEMPLATE.md`)) {
    const template = await read(file);
    for (const heading of ['## 3. Diseño Técnico', '### 2.3 Criterios de Aceptación', '## 4. Plan de Implementación por Fases', '### 2.9 Qué queda obsoleto', '## 10. Evidencia de Implementación']) assert.ok(template.includes(heading), `${file}: ${heading}`);
  }
  for (const file of bothCopies('.agents/skills/02-implement/implement-change/reference/input-types.md')) {
    assert.match(await read(file), /an older PRD may have its headings without accents: the same sections/, file);
  }
  // The reader in the CLI accepts both spellings of section 10.
  const { workspaceDiagnostics } = await import('../src/workspace-diagnostics.mjs');
  assert.equal(typeof workspaceDiagnostics, 'function');
  assert.match(await read('src/workspace-diagnostics.mjs'), /Evidencia de Implementaci\[oó\]n/);
});

test('review: no unaccented template literal is left behind a line wrap, and the approval rule does not ask twice', async () => {
  for (const file of bothCopies('.agents/skills/02-implement/implement-change/reference/level-n2.md')) {
    assert.doesNotMatch((await read(file)).replace(/\s+/g, ' '), /Evidencia de Implementacion/, file);
  }
  for (const file of bothCopies(`${createPrd}/template-sections/epic-context.md`)) {
    assert.doesNotMatch(await read(file), /Postcondicion\b|Como se prueba|esta implementado|proximo/, file);
  }
  assert.doesNotMatch(await read('src/workspace-diagnostics.mjs'), /"## 10\. Evidencia de Implementacion"/);
  for (const file of bothCopies(implementChange)) {
    assert.match(await read(file), /A request that says the PRD is approved \("el PRD ya está aprobado, avanza"\) is that yes/, file);
  }
  for (const file of bothCopies(`${createPrd}/SKILL.md`)) {
    assert.match(await read(file), /When the user approves the delivered PRD in the conversation, set `Estado: Aprobado`/, file);
  }
  for (const file of bothCopies('.agents/kit-boundary.md')) assert.match(await read(file), /`\.agents\/project\/stack\.md`[^\n]*exception/, file);
});

test('repair: an explicit PRD takes its level from the one hazard rule, and the state rule is where authorization is read first', async () => {
  for (const file of bothCopies(implementChange)) {
    const text = await read(file);
    assert.doesNotMatch(text, /N3 when the PRD names a hazard \(a contract, data or a migration/, file);
    assert.match(text, /this skill sets the level itself with the escalation rules below[^\n]*N1 when its header says `Modo: compacto`[^\n]*N2 otherwise/, file);
    assert.equal((text.match(/two or more listed hazards/g) ?? []).length, 1, file);
  }
  for (const file of bothCopies(router)) {
    const row = (await read(file)).split('\n').find((line) => line.startsWith('| PRD implementation |'));
    assert.match(row, /`Estado` is not `Aprobado`/, file);
  }
  for (const file of bothCopies('.agents/instructions.md')) {
    const text = await read(file);
    assert.match(text, /"implementa este PRD"\): that imperative is the authorization\. For a PRD, `implement-change` still asks once when its `Estado` is not `Aprobado`\./, file);
  }
});

test('repair: no unaccented Spanish word of the reviewed list is left in the PRD template, its sections, or the texts that cite them', async () => {
  const words = /\b(Modulo|modulo|Integracion|integracion|Area|duena|dueno|extiendelos|Implementacion|Aceptacion|Diseno|Tecnico|Descripcion|Validacion|Migracion|Ubicacion|Decision|Condicion|Activacion|Mitigacion|seccion|razon|linea|vacios|Limites|Epica|codigo|segun|revision|Postcondicion|proximo)\b|\besta (`|implementado|locked)/;
  const flat = async (file) => (await read(file)).replace(/\s+/g, ' ');
  const templates = ['PRD_TEMPLATE.md', 'template-sections/data-model.md', 'template-sections/epic-context.md', 'template-sections/visual-contract.md'].map((name) => `${createPrd}/${name}`);
  for (const name of templates) {
    for (const file of bothCopies(name)) {
      const hit = (await read(file)).split('\n').find((line) => words.test(line.replace(/`[^`]*`/g, (span) => (/identifier_language|operacion|\.md|command/.test(span) ? '' : span))));
      assert.equal(hit, undefined, `${file}: ${hit}`);
    }
  }
  const citing = /Evidencia de Implementacion|Diseno Tecnico|Criterios de Aceptacion|[Cc]apa duena|Que queda obsoleto|extiendelos/;
  for (const file of [...bothCopies('docs/workflow/README.md'), ...bothCopies('.agents/skills/02-implement/implement-prd/agents/testinator-5000.md'), ...bothCopies('.agents/skills/02-implement/implement-change/reference/level-n2.md'), ...bothCopies('.agents/skills/02-implement/implement-change/reference/input-types.md')]) {
    assert.doesNotMatch(await flat(file), citing, file);
  }
});

test('0.25.0: no Spanish status literal is left inside English kit text', async () => {
  const literals = /quality gate: no configurado|project context: no configurado|`sin feature flag`|ejecución inline: subagentes|`· autónomo`/;
  const walk = async (directory) => {
    const found = [];
    for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
      const child = `${directory}/${entry.name}`;
      if (entry.isDirectory()) found.push(...await walk(child));
      else if (/\.(md|yaml|json)$/.test(entry.name)) found.push(child);
    }
    return found;
  };
  for (const directory of ['.agents', `${overlay}/.agents`, 'templates/runtime-adapters', '.claude/agents', '.github/agents']) {
    let files;
    try {
      files = await walk(directory);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const file of files) assert.doesNotMatch(await read(file), literals, file);
  }
  for (const file of bothCopies('.agents/delegation/delegate-contract.md')) assert.match(await read(file), /`quality gate: not configured`/, file);
  for (const file of bothCopies(`${createPrd}/reference/ambiguity-detection.md`)) assert.match(await read(file), /record `no feature flag` as an assumption/, file);
});

test('0.25.0 flow findings: a PRD says whether it is compact, one yes covers an N1 PRD, and approval is the state field', async () => {
  for (const file of bothCopies(`${createPrd}/PRD_TEMPLATE.md`)) {
    assert.match(await read(file), /^\*\*Modo\*\*: completo \| compacto$/m, file);
  }
  for (const file of bothCopies(`${createPrd}/SKILL.md`)) {
    const text = await read(file);
    assert.match(text, /record `Modo: compacto` in the PRD header/, file);
    assert.match(text, /section 10 keeps every row of its table/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 200, file);
  }
  for (const file of bothCopies(implementChange)) {
    const text = await read(file);
    assert.match(text, /N1 when its header says `Modo: compacto`/, file);
    assert.match(text, /one yes covers both the approval and the N1 line/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 200, file);
  }
  for (const name of ['prd-readiness-review', 'implementation-slicing']) {
    for (const file of bothCopies(`.agents/skills/02-implement/${name}/SKILL.md`)) {
      assert.match(await read(file), /The PRD is approved \(`Estado: Aprobado`; `implement-change` settles it before this step\)/, file);
    }
  }
  for (const file of bothCopies('.agents/skills/02-implement/implement-change/reference/input-types.md')) {
    const text = await read(file);
    assert.doesNotMatch(text, /written before 0\.24\.2/, file);
    assert.match(text, /an older PRD may have its headings without accents: the same sections/, file);
  }
});

test('0.25.0 flow findings: the template notice is one block to delete, the repeat question has an end, and a feature request has one row', async () => {
  for (const name of ['context.md', 'backend.md', 'frontend.md']) {
    for (const file of bothCopies(`.agents/project/${name}`)) {
      const text = await read(file);
      const notice = text.split('\n\n').filter((paragraph) => paragraph.startsWith('> **Template notice'));
      assert.equal(notice.length, 1, `${file}: one template notice block`);
      assert.match(notice[0], /delete this whole block and the marker line above/, file);
      // Nothing outside the notice talks about being a template.
      assert.doesNotMatch(text.replace(notice[0], ''), /still the template|Remove the template marker/, file);
    }
  }
  for (const file of bothCopies(`${createPrd}/reference/ambiguity-detection.md`)) {
    assert.match(await read(file), /If it is still unanswered, stop and wait: do not ask a third time, and do not count the repeat as a round/, file);
  }
  for (const file of bothCopies(router)) {
    const text = await read(file);
    const row = text.split('\n').find((line) => line.startsWith('| Production code change |'));
    assert.match(row, /a request for a feature with no imperative to build it \("quiero agregar X"\) is "Feature specification"/, file);
    assert.match(text.split('\n').find((line) => line.startsWith('| Project context setup |')), /delete the template notice block and the marker/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 199, file);
  }
});

test('0.25.0 repair: an approved PRD at N1 shows its line and goes on, and no state or status literal is left behind', async () => {
  for (const file of bothCopies(implementChange)) {
    const text = await read(file);
    assert.match(text, /With an approved PRD the imperative is the authorization at every level: at N1, show the N1 line and go on without waiting/, file);
    assert.match(text, /stop only when the change needs a production file outside the scope its slice names/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 200, file);
  }
  for (const file of bothCopies('.agents/instructions.md')) {
    assert.match(await read(file), /With an explicit PRD that is approved, `implement-change` shows the N1 line and goes on/, file);
  }
  for (const file of bothCopies(`${createPrd}/PRD_TEMPLATE.md`)) {
    assert.match(await read(file), /\| Modo de ejecución \| \[supervised \\\| autonomous\] \|/, file);
  }
  for (const name of ['.agents/skills/02-implement/implement-change/reference/level-n3.md', '.agents/skills/02-implement/implementation-skill-matcher/SKILL.md']) {
    for (const file of bothCopies(name)) {
      const text = await read(file);
      assert.doesNotMatch(text, /sin candidatos/, file);
      assert.match(text, /`matching: no candidates for <surface>`/, file);
    }
  }
  for (const name of ['.agents/skills/index.md', '.agents/skills/registry.md']) {
    for (const file of bothCopies(name)) {
      const rows = (await read(file)).split('\n').filter((line) => /^\| `implement-(change|prd)` \|/.test(line));
      assert.equal(rows.length, 2, file);
      for (const row of rows) assert.match(row, /`Estado: Aprobado`/, `${file}: ${row.slice(0, 80)}`);
    }
  }
});

test('0.25.0 repair: a compact PRD is defined by what it leaves out, not by a line count', async () => {
  for (const file of bothCopies(`${createPrd}/SKILL.md`)) {
    const text = await read(file);
    assert.doesNotMatch(text, /at most about \d+ lines|\d+ to \d+ lines/, file);
    assert.match(text, /no `---` separators, none of the template's notes in italics, no section 9, no second phase and no future phase/, file);
    assert.match(text, /Its length is whatever those rules leave/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 200, file);
  }
  for (const file of bothCopies(`${createPrd}/PRD_TEMPLATE.md`)) {
    const template = await read(file);
    assert.ok((template.match(/_Solo PRD completo/g) ?? []).length >= 2, `${file}: the full-only parts are marked`);
    assert.ok(template.replace(/\n$/, '').split('\n').length <= 270, file);
  }
});
