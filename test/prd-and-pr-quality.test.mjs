import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { evaluatePrdSize, measurePrd } from '../.agents/skills/01-product/create-prd/scripts/prd-size-signals.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');
const createPrd = '.agents/skills/01-product/create-prd';

test('PRD size signals: one signal warns, two propose a split, length never counts alone', () => {
  const rows = (prefix, count) => Array.from({ length: count }, (_, index) => `| ${prefix}${index + 1} | x |`).join('\n');
  const small = `${rows('AC-', 12)}\n${rows('P1-S', 4)}\n### Fase 1 - A\n`;
  assert.equal(evaluatePrdSize(measurePrd(small)).verdict, 'ok');

  const long = `${small}${'linea\n'.repeat(700)}`;
  assert.equal(evaluatePrdSize(measurePrd(long)).verdict, 'ok', 'length alone is not a signal');

  const manyCriteria = `${rows('AC-', 23)}\n${rows('P1-S', 4)}\n### Fase 1 - A\n`;
  const warning = evaluatePrdSize(measurePrd(manyCriteria));
  assert.equal(warning.verdict, 'warning');
  assert.equal(warning.signals.length, 1);

  const large = `${rows('AC-', 23)}\n${rows('P1-S', 9)}\n### Fase 1 - A\n### Fase 2 - B\n### Fase Futura - C\n`;
  const measures = measurePrd(large, { hazards: 4 });
  assert.deepEqual({ slices: measures.slices, acceptanceCriteria: measures.acceptanceCriteria, phases: measures.phases }, { slices: 9, acceptanceCriteria: 23, phases: 2 });
  const split = evaluatePrdSize(measures);
  assert.equal(split.verdict, 'propose-split');
  assert.equal(split.signals.length, 3);

  assert.equal(evaluatePrdSize(measurePrd(manyCriteria, { questionRounds: 4 })).verdict, 'propose-split');
});

test('create-prd asks better questions, tracks assumptions and lists what becomes obsolete', async () => {
  const [template, ambiguity, calibration, audit, skill] = await Promise.all([
    read(`${createPrd}/PRD_TEMPLATE.md`),
    read(`${createPrd}/reference/ambiguity-detection.md`),
    read(`${createPrd}/reference/calibration.md`),
    read(`${createPrd}/reference/self-audit.md`),
    read(`${createPrd}/SKILL.md`)
  ]);
  assert.match(template, /### 2\.8 Supuestos e integraciones/);
  assert.match(template, /\| Supuesto \| Fuente \| Estado \| Evidencia \| Que pasa si es falso \|/);
  assert.match(template, /### 2\.9 Que queda obsoleto/);
  assert.match(template, /Busqueda de verificacion/);
  assert.match(template, /\| Iteraciones y causa \|/);
  assert.match(ambiguity, /## Edge-Case Confirmation Round/);
  assert.match(ambiguity, /At most 3 rounds/);
  assert.match(ambiguity, /about 10 questions per round/);
  assert.match(calibration, /## Unknowns Inventory/);
  assert.match(calibration, /never uses production credentials unless the\s+user says so/);
  assert.match(calibration, /## Obsolescence Scan/);
  assert.match(calibration, /two sources of truth/);
  assert.match(audit, /## Size Signals/);
  assert.match(audit, /\*\*2 or more:\*\* propose splitting/);
  assert.match(skill, /Supuestos e integraciones table/);
  assert.match(skill, /Que queda obsoleto table/);
});

test('obsolete items and assumptions are carried through discovery, slicing and QA', async () => {
  const [discovery, slicing, qa, inputs] = await Promise.all([
    read('.agents/skills/02-implement/codebase-discovery/SKILL.md'),
    read('.agents/skills/02-implement/implementation-slicing/SKILL.md'),
    read('.agents/skills/02-implement/qa-handoff-review/SKILL.md'),
    read('.agents/skills/02-implement/implement-change/reference/input-types.md')
  ]);
  assert.match(discovery, /`Que queda obsoleto` table[^\n]*Never widen scope silently/);
  assert.match(slicing, /`Que queda obsoleto` table: every row belongs to a slice/);
  assert.match(qa, /run the verification search of every row/);
  assert.match(inputs, /`hueco del PRD`, `error de\s+implementación`, `entorno`, or `cambio de requisito`/);
});

test('UI sketch is optional, offered on entry, and bridges to the Contrato Visual', async () => {
  const [skill, ui, template] = await Promise.all([
    read('.agents/skills/01-product/solution-sketch/SKILL.md'),
    read('.agents/skills/01-product/solution-sketch/references/ui-sketch.md'),
    read('.agents/skills/01-product/solution-sketch/references/sketch-template.md')
  ]);
  assert.match(skill, /## UI sketches \(optional, offered on entry\)/);
  assert.match(skill, /Nothing\s+visual starts on its own/);
  assert.match(ui, /\*\*c\) Use the team's design\*\*/);
  assert.match(ui, /ui-path: shape \| critique \| team-design \| skipped/);
  assert.match(ui, /docs\/design\/<slug>-mockups\//);
  assert.match(ui, /\*\*maximum of 3\*\*/);
  assert.match(ui, /Fake data only/);
  assert.match(ui, /Never use `craft`, `live`/);
  assert.match(template, /## 7\. Visual _\(opcional/);
});

test('PR comments are evaluated critically before any option is offered', async () => {
  const [skill, templates, stance] = await Promise.all([
    read('.agents/skills/04-crosscutting/pr-comments-resolution/SKILL.md'),
    read('.agents/skills/04-crosscutting/pr-comments-resolution/reference/comment-response-templates.md'),
    read('.agents/skills/01-product/shared/critical-stance.md')
  ]);
  assert.match(skill, /### 2\.0 Evaluate Before Explaining \(mandatory\)/);
  for (const verdict of ['valid', 'partially valid', 'obsolete', 'not applicable', 'incorrect']) {
    assert.match(skill, new RegExp(`\\*\\*${verdict}\\*\\*`), verdict);
  }
  assert.match(skill, /Never accept a comment by default/);
  assert.match(skill, /do\s+not close their thread: the reviewer resolves it/);
  assert.match(skill, /wait for the user's\s+approval before posting it/);
  assert.match(skill, /### 1\.4 Triage For Many Comments/);
  assert.match(templates, /## Grounded Replies \(no code change\)/);
  assert.match(stance, /## Evaluating external claims/);
  assert.match(stance, /\*\*Symmetry\.\*\*/);
  assert.match(stance, /`pr-comments-resolution`/);
});
