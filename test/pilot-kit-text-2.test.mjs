// Second round of kit text fixes found by the pilot: the standards pointer in
// create-prd, the N1 trace example and the check-naming demand, the Philosophy
// list numbering, and the behavior when project files are still templates.
// Structural checks over the kit tree and its overlay mirror.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeTempRepo } from './helpers.mjs';
import { validateInstalledPaths } from '../scripts/validate-installed-paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const overlay = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const manifestFile = '.agents/workflow-kit/manifest.json';
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
// A kit file in both copies: the repository tree and the overlay that init installs.
const bothCopies = (file) => [file, `${overlay}/${file}`];
const legacyMap = 'docs/workflow/migration/legacy-docs-map.md';

async function walkMarkdown(directory) {
  const files = [];
  for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    const child = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await walkMarkdown(child));
    else if (entry.name.endsWith('.md')) files.push(child);
  }
  return files;
}

test('create-prd calibration does not send the agent to the setup guides as if they held standards', async () => {
  for (const file of bothCopies('.agents/skills/01-product/create-prd/reference/calibration.md')) {
    const lines = (await read(file)).split('\n').filter((line) => /docs\/workflow\/standards\/(backend|frontend)\.md/.test(line));
    for (const line of lines) {
      assert.match(line, /setup guide/, `${file}: ${line}`);
      assert.doesNotMatch(line, /touched surfaces|installed by the kit/, `${file}: ${line}`);
    }
  }
});

test('the standards setup guides cite the legacy docs map only as something init may have created', async () => {
  for (const guide of ['backend', 'frontend']) {
    for (const file of bothCopies(`docs/workflow/standards/${guide}.md`)) {
      const lines = (await read(file)).split('\n').filter((line) => line.includes(legacyMap));
      assert.ok(lines.length > 0, file);
      for (const line of lines) assert.match(line, /only when `init` created it/, `${file}: ${line}`);
    }
  }
});

// A disposable kit source: the real manifest plus one installed doc.
async function legacyMapFailures(body) {
  const dir = await makeTempRepo('legacy-map-guard-');
  await fs.mkdir(path.join(dir, '.agents/workflow-kit'), { recursive: true });
  await fs.copyFile(path.join(root, manifestFile), path.join(dir, manifestFile));
  const targets = { [`${overlay}/${manifestFile}`]: await read(manifestFile), [`${overlay}/docs/workflow/standards/demo.md`]: `# Demo\n\n${body}\n` };
  for (const [relative, content] of Object.entries(targets)) {
    const target = path.join(dir, relative.replace(`${overlay}/`, 'templates/repo-overlay-fhh-ia-ecosystem-full/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
  return (await validateInstalledPaths({ root: dir, sets: [['claude']] })).failures;
}

test('the installed-paths guard requires an optionality marker on a citation of the legacy docs map', async () => {
  const failures = await legacyMapFailures(`Locate candidates in \`${legacyMap}\`.`);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /legacy-docs-map\.md/);
  assert.deepEqual(await legacyMapFailures(`Locate candidates in \`${legacyMap}\`, which exists only when \`init\` created it.`), []);
  assert.deepEqual(await legacyMapFailures(`Open \`${legacyMap}\` if it was generated.`), []);
});

test('the N1 row of the level table shows the real trace format with file names', async () => {
  for (const file of bothCopies('.agents/instructions.md')) {
    const row = (await read(file)).split('\n').find((line) => line.startsWith('| N1 Surgical'));
    assert.ok(row, file);
    assert.doesNotMatch(row, /touches X/, file);
    assert.match(row, /`N1 · surgical · [\w/.-]+\.mjs, [\w/.-]+\.test\.mjs`/, file);
  }
});

test('no N1 proposal has to name the focused check in words; the test file counts as a target file', async () => {
  for (const kitRoot of ['.agents', `${overlay}/.agents`]) {
    for (const file of await walkMarkdown(kitRoot)) {
      const text = await read(file);
      assert.doesNotMatch(text, /say in words which focused check|naming in words the one focused check/, file);
    }
  }
  for (const file of bothCopies('.agents/skills/02-implement/implement-change/reference/level-n1.md')) {
    assert.match(await read(file), /test file[^.\n]*counts as a target file/i, file);
  }
});

test('create-prd Philosophy is a plain ordered list with no 2.5 marker and no Spanish sentence', async () => {
  for (const file of bothCopies('.agents/skills/01-product/create-prd/SKILL.md')) {
    const text = await read(file);
    assert.doesNotMatch(text, /^\d+\.\d+\./m, file);
    assert.doesNotMatch(text, /Después de aprobar/, file);
    const section = text.split('## 🎯 Philosophy')[1].split('\n---')[0];
    const numbers = [...section.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]));
    assert.ok(numbers.length > 0, file);
    assert.deepEqual(numbers, numbers.map((_, index) => index + 1), file);
  }
});

test('create-prd calibration says what to do when a project file is still a template', async () => {
  for (const file of bothCopies('.agents/skills/01-product/create-prd/reference/calibration.md')) {
    const text = await read(file);
    assert.match(text, /\[TODO/, file);
    assert.match(text, /not filled in/, file);
    assert.match(text, /## Calibration/, file);
    assert.match(text, /initial Discovery/, file);
    assert.match(text, /do not block/i, file);
  }
});
