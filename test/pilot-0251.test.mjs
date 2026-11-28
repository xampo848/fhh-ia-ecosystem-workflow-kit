// Findings the pilot run on 0.25.0 left for later: a kit text that appears
// twice, block markers quoted inside a code fence, what the plan says about
// `discard` and about an edit inside the block, a byte-order mark after split,
// a temporary file after a killed run, and smaller text alignments.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyInstallPlan } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { extractManagedBlock, replaceManagedBlock } from '../src/kit-manifest.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan, kitBody, splitUnmarkedAdapter } from '../src/planner.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const overlay = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const blockName = 'workflow-kit:managed';
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
const bothCopies = (file) => [file, `${overlay}/${file}`];
const claudeTemplate = () => read('templates/runtime-adapters/claude/CLAUDE.md');
const cli = async (...args) => {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, ...io.output };
};
async function installed() {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  return target;
}

test('D1: split removes every whole copy of the kit text, not only the first', async () => {
  const template = await claudeTemplate();
  const { block } = extractManagedBlock(template, blockName);
  const body = kitBody(template, blockName);
  const twice = `Intro del equipo\n\n${body}\n\nNota entre copias.\n\n${body}\n\nNota final.\n`;
  const split = splitUnmarkedAdapter(twice, template, blockName, []);
  assert.equal(split.content, `${block}\n\nIntro del equipo\n\nNota entre copias.\n\nNota final.\n`);
  assert.equal((split.content.match(/Level pre-filter \(apply to every new user prompt/g) ?? []).length, 1);
  // However many copies there are.
  const many = `${Array.from({ length: 12 }, (_, index) => `Nota ${index}.\n\n${body}`).join('\n\n')}\n`;
  const all = splitUnmarkedAdapter(many, template, blockName, []);
  assert.equal((all.content.match(/Level pre-filter \(apply to every new user prompt/g) ?? []).length, 1);
  assert.equal((all.content.match(/^Nota \d+\.$/gm) ?? []).length, 12);
});

test('D2: with a real block and a quoted one, the real block is found; a file that worked before works the same', async () => {
  const template = await claudeTemplate();
  const { block } = extractManagedBlock(template, blockName);
  const quoted = '```md\n<!-- workflow-kit:managed:start -->\nexample\n<!-- workflow-kit:managed:end -->\n```\n';
  // A real block and a quoted one: the real one is found, the quote stays.
  for (const eol of ['\n', '\r\n']) {
    const both = `${block}\n\n# Notes\n\n${quoted}`.replace(/\n/g, eol);
    const found = extractManagedBlock(both, blockName);
    assert.equal(found.error, undefined, JSON.stringify(eol));
    assert.equal(found.start, 0, JSON.stringify(eol));
  }
  const both = `${block}\n\n# Notes\n\n${quoted}`;
  const older = both.replace('1–2 production files', '1–2 files');
  assert.equal(replaceManagedBlock(older, template, blockName), both);
  // Two real blocks are still a duplicate.
  assert.equal(extractManagedBlock(`${block}\n\n${block}\n`, blockName).error, 'duplicate');

  // Never a regression: whatever a single pair of markers is next to, it is
  // the block, exactly as before fences were looked at.
  const single = [
    `\`\`\`npm test\`\`\` runs the tests\n\n${block}\n\n\`\`\`bash\nnpm test\n\`\`\`\n`,
    `\`\`\`\nan unclosed fence\n\n${block}\n\n\`\`\`bash\nnpm test\n\`\`\`\n`,
    `# Notes\n\n\`\`\`md\n${block}\n\`\`\`\n`,
    `    \`\`\`\n${block}\n`
  ];
  for (const content of single) {
    const found = extractManagedBlock(content, blockName);
    assert.equal(found.block, block, content.slice(0, 40));
    assert.equal(replaceManagedBlock(content.replace('1–2 production files', '1–2 files'), template, blockName), content, content.slice(0, 40));
  }
  // The inline-code line and the unclosed fence do not turn a real block into a quote when a quote is there too.
  const tricky = `\`\`\`npm test\`\`\` runs the tests\n\n${block}\n\n${quoted}`;
  assert.equal(extractManagedBlock(tricky, blockName).block, block);
  const unclosed = `\`\`\`\nan unclosed fence\n\n${block}\n\n${quoted}`;
  assert.equal(extractManagedBlock(unclosed, blockName).error, 'duplicate', 'nothing is guessed when no pair is clearly outside a fence');
});

test('D3: a plan with pending decisions says what each decision does', async () => {
  const target = await installed();
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nedited\n');
  const text = formatPlan(await buildUpdatePlan({ targetPath: target }));
  assert.match(text, /^Decisions \(each file lists the ones that apply to it\): keep leaves the file as it is \(the next update lists it again\); discard takes the kit version, or removes a file the kit no longer ships, and moves your version to a backup file next to it; split keeps your own text and puts the kit block in place of the kit text, or next to your text when the file holds none; shadow moves your edit to a project shadow\. Pass one with --edited <path>=<decision>\.$/m);
  // A plan with nothing pending has no such line.
  const clean = await installed();
  assert.doesNotMatch(formatPlan(await buildUpdatePlan({ targetPath: clean })), /^Decisions:/m);
});

test('D4: the plan says that an edit inside the kit block is replaced, also when the kit block changed too', async () => {
  const target = await installed();
  const adapter = path.join(target, 'CLAUDE.md');
  const statePath = path.join(target, '.agents/workflow-kit/install-state.json');
  const { checksumOf } = await import('../src/fs-safety.mjs');
  const current = await fs.readFile(adapter, 'utf8');
  // The install recorded an older kit block; the team then edited a line inside it.
  const olderKit = current.replace('1–2 production files', '1–2 files');
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  state.files['CLAUDE.md'].sha256 = checksumOf(extractManagedBlock(olderKit, blockName).block);
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  await fs.writeFile(adapter, olderKit.replace('| N0 |', '| N0 (edited by the team) |'));
  const text = formatPlan(await buildUpdatePlan({ targetPath: target }));
  assert.match(text, /^- overwrite_with_backup: CLAUDE\.md \(its kit block was edited; the kit version replaces it and the backup keeps the edit\)$/m);
  // Not edited, only older: the block-only note.
  await fs.writeFile(adapter, olderKit);
  assert.match(formatPlan(await buildUpdatePlan({ targetPath: target })), /CLAUDE\.md \(only its kit block changes; the rest of the file stays\)$/m);
});

test('D5: a byte-order mark stays at the start of the file after split, and doctor names a temporary file a killed run left', async () => {
  const template = await claudeTemplate();
  const bom = '﻿';
  const split = splitUnmarkedAdapter(`${bom}# CLAUDE.md\n\nReglas propias del equipo.\n`, template, blockName, []);
  assert.ok(split.content.startsWith(`${bom}<!-- workflow-kit:managed:start -->`), JSON.stringify(split.content.slice(0, 50)));
  assert.equal(split.content.indexOf(bom, 1), -1, 'no byte-order mark in the middle');
  // A file that starts with the mark and the kit text is still split.
  const { block } = extractManagedBlock(template, blockName);
  const withKit = splitUnmarkedAdapter(`${bom}${kitBody(template, blockName)}\n\nNota del equipo.\n`, template, blockName, []);
  assert.equal(withKit.content, `${bom}${block}\n\nNota del equipo.\n`);

  const target = await installed();
  await fs.writeFile(path.join(target, '.agents/workflow-kit/.workflow-kit-tmp-99999'), 'x');
  await fs.writeFile(path.join(target, '.agents/skills/.workflow-kit-tmp-4242'), 'x');
  const doctor = await cli('doctor', '--target', target, '--runtime', 'claude');
  assert.doesNotMatch(doctor.stdout, /boundary\/unowned-path\] [^\n]*\.workflow-kit-tmp-/);
  assert.match(doctor.stdout, /\[workspace\/temporary-leftover\] \.agents\/skills\/\.workflow-kit-tmp-4242: A temporary file a stopped workflow-kit run left\. It is safe to delete by hand\. \(warning\)/);
  // The finding never sends anyone to rollback, which would undo the install.
  assert.doesNotMatch(doctor.stdout.split('\n').filter((line) => line.includes('temporary-leftover')).join('\n'), /rollback/);
});

test('D6 and D8: the rules name which Estado they mean, a named feature has one router row, and N1 says what it appends to section 10', async () => {
  for (const file of bothCopies('.agents/skills/02-implement/implement-change/SKILL.md')) {
    const text = await read(file);
    assert.match(text, /If the `Estado` in the PRD header is not `Aprobado`/, file);
    assert.match(text, /the `Estado` of section 10 is the closure state, not the approval/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 200, file);
  }
  for (const file of bothCopies('.agents/skills/01-product/create-prd/SKILL.md')) {
    assert.match(await read(file), /delivers the PRD with `Estado: En revisión` in its header/, file);
  }
  for (const file of bothCopies('.agents/skills/00-router/workflow-router/SKILL.md')) {
    const text = await read(file);
    const row = text.split('\n').find((line) => line.startsWith('| Product ambiguity |'));
    assert.match(row, /a request that names the feature \("quiero agregar X"\) is "Feature specification"/, file);
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 199, file);
  }
  for (const file of bothCopies('.agents/skills/02-implement/implement-change/reference/level-n1.md')) {
    const text = await read(file);
    assert.doesNotMatch(text, /as described for the input type/, file);
    assert.match(text, /a first implementation fills the table of its section 10; an iteration adds an "Iteración N" entry there, with the cause of the iteration, the delta, the acceptance criteria added or changed, the tests executed and the change reference/, file);
  }
});

test('the delegate prompts are in English, with the delegate names and every rule kept', async () => {
  const directory = '.agents/skills/02-implement/implement-prd/agents';
  const names = ['arquitecta-fases', 'capitana-alcance', 'guardia-contrato', 'lint-ranger', 'pixel-ninja', 'qa-relampago', 'sherlock-estructura', 'testinator-5000', 'turbo-backend'];
  const spanish = /\b(Actua|Usa esta|Contexto|Reglas|Lee la|No edites|Reporta|Edita solo|Implementa,|Verifica|Ejecuta|Corrige|Revisa como|Lidera|Mapea|Carga|Objetivo|Datos disponibles|No estas|No aceptes|Define un)\b/;
  for (const name of names) {
    for (const file of bothCopies(`${directory}/${name}.md`)) {
      const text = await read(file);
      const hit = text.split('\n').find((line) => spanish.test(line));
      assert.equal(hit, undefined, `${file}: ${hit}`);
      assert.match(text, /^Act as [A-Z]/m, file);
      assert.match(text, /^Use this skill:$/m, file);
      assert.match(text, /^Rules:$/m, file);
      // Same number of rules as before the translation.
      assert.ok((text.match(/^\d+\. /gm) ?? []).length >= 3, file);
    }
  }
  const rules = async (name) => ((await read(`${directory}/${name}.md`)).match(/^\d+\. /gm) ?? []).length;
  assert.deepEqual(await Promise.all(names.map(rules)), [4, 3, 4, 4, 6, 4, 4, 4, 4]);
  for (const file of bothCopies(`${directory}/pixel-ninja.md`)) {
    const text = await read(file);
    assert.match(text, /If it is missing or unlocked, return `blocked`\. Do not invent the screen\./, file);
    assert.match(text, /a clash the table does not decide is `blocked`/, file);
  }
  for (const file of bothCopies(`${directory}/testinator-5000.md`)) {
    assert.match(await read(file), /each rule at its owning layer \(`Capa dueña`\); look for existing tests of the same rule and extend them before creating others/, file);
  }
});

// Repair round after the pilot run on this branch.
test('repair R1: with more than one pair, nothing is written unless the pair left outside is a block on its own lines', async () => {
  const template = await claudeTemplate();
  const { block } = extractManagedBlock(template, blockName);
  const start = '<!-- workflow-kit:managed:start -->';
  const end = '<!-- workflow-kit:managed:end -->';
  const sentence = `To disable it, remove everything between ${start} and ${end} by hand.\n`;
  // The pilot's case: the real block inside a closed fence, and the markers
  // quoted in a sentence outside it.
  const fencedReal = `\`\`\`md\n${block}\n\`\`\`\n\n${sentence}`;
  assert.equal(extractManagedBlock(fencedReal, blockName).error, 'duplicate');
  assert.equal(replaceManagedBlock(fencedReal, template, blockName), null);
  // A real block on its own lines and the same sentence: also not guessed.
  assert.equal(extractManagedBlock(`${block}\n\n${sentence}`, blockName).error, 'duplicate');
  // The real block inside a fence and a short example pair on its own lines outside.
  assert.equal(extractManagedBlock(`\`\`\`md\n${block}\n\`\`\`\n\n${start}\nexample\n${end}\n`, blockName).error, 'duplicate');
  // A marker pair outside with text on the marker lines.
  assert.equal(extractManagedBlock(`> ${start}\nx\n> ${end}\n\n\`\`\`\n${start}\ny\n${end}\n\`\`\`\n`, blockName).error, 'duplicate');
  // Still resolved: the block on its own lines, and a quoted copy or example in a closed fence.
  for (const quoted of [`\`\`\`md\n${start}\nexample\n${end}\n\`\`\`\n`, `\`\`\`md\n${block}\n\`\`\`\n`]) {
    assert.equal(extractManagedBlock(`${block}\n\n${quoted}`, blockName).block, block);
    assert.equal(extractManagedBlock(`${quoted}\n${block}\n`, blockName).block, block);
  }

  // End to end: update leaves the pilot's file pending and writes nothing to it.
  const target = await installed();
  const adapter = path.join(target, 'CLAUDE.md');
  const original = await fs.readFile(adapter, 'utf8');
  const content = `\`\`\`md\n${original}\`\`\`\n\n${sentence}`;
  await fs.writeFile(adapter, content);
  const update = await cli('update', '--target', target, '--apply', '--yes');
  assert.equal(await fs.readFile(adapter, 'utf8'), content, update.stdout.slice(-400));
});

test('repair R2 and R3: no false "edited" note under an install-state that records whole files, and only a pid-named file is a leftover', async () => {
  const { installLegacy0181 } = await import('./fixtures/legacy-0.18.1/install.mjs');
  const legacy = await makeTempRepo();
  await installLegacy0181(legacy, { runtimes: ['claude'] });
  const text = formatPlan(await buildUpdatePlan({ targetPath: legacy, edited: { all: 'discard' } }));
  assert.doesNotMatch(text, /its kit block was edited/, text.split('\n').filter((line) => /kit block/.test(line)).join('\n'));

  const target = await installed();
  await fs.writeFile(path.join(target, '.agents/skills/.workflow-kit-tmp-notes.md'), 'own notes\n');
  await fs.writeFile(path.join(target, '.agents/skills/.workflow-kit-tmp-4242'), 'x');
  const doctor = await cli('doctor', '--target', target, '--runtime', 'claude');
  assert.doesNotMatch(doctor.stdout, /temporary-leftover\] \.agents\/skills\/\.workflow-kit-tmp-notes\.md/);
  assert.match(doctor.stdout, /boundary\/unowned-path\] \.agents\/skills\/\.workflow-kit-tmp-notes\.md/);
  assert.match(doctor.stdout, /temporary-leftover\] \.agents\/skills\/\.workflow-kit-tmp-4242: A temporary file a stopped workflow-kit run left\. It is safe to delete by hand\. \(warning\)/);
  assert.doesNotMatch(doctor.stdout, /no workflow-kit command removes it/);
});
