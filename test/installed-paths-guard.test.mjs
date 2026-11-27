// The guard against dangling path references in installed kit text
// (scripts/validate-installed-paths.mjs): installed text may cite a path as
// something to read or run only when the install writes it, the manifest
// declares it the project's, another runtime installs it, or it is marked as a
// legacy fallback. Fixture cases drive each rule; the real kit must pass for
// every runtime set.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeTempRepo } from './helpers.mjs';
import { allowlist, extractReferences, kitWrittenFolders, projectInputFolders, runtimeSets, validateInstalledPaths } from '../scripts/validate-installed-paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const overlay = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const manifestFile = '.agents/workflow-kit/manifest.json';

// A disposable kit source: the real manifest plus the given template files (relative to templates/).
async function kitSource(templateFiles) {
  const dir = await makeTempRepo('installed-paths-');
  const files = { [`repo-overlay-fhh-ia-ecosystem-full/${manifestFile}`]: await fs.readFile(path.join(root, manifestFile), 'utf8'), ...templateFiles };
  await fs.mkdir(path.join(dir, '.agents/workflow-kit'), { recursive: true });
  await fs.copyFile(path.join(root, manifestFile), path.join(dir, manifestFile));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(dir, 'templates', relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
  return dir;
}

const skill = (body) => ({ 'repo-overlay-fhh-ia-ecosystem-full/.agents/skills/demo/SKILL.md': `# Demo\n\n${body}\n` });
const failuresOf = async (body, { sets = [['claude']], extra = {}, allow = [] } = {}) => {
  const dir = await kitSource({ ...skill(body), ...extra });
  const result = await validateInstalledPaths({ root: dir, sets, allow });
  return result.failures;
};

test('a text citing a path no runtime installs fails with file, line, and the path', async () => {
  const failures = await failuresOf('Intro.\n\nRun `scripts/missing-tool.mjs` first.');
  assert.equal(failures.length, 1);
  assert.match(failures[0], /^\.agents\/skills\/demo\/SKILL\.md:5: scripts\/missing-tool\.mjs is not installed/);
  assert.match(failures[0], /allow-listed/);
});

test('rule a: a path the install writes, or a folder holding one, is valid', async () => {
  const extra = { 'repo-overlay-fhh-ia-ecosystem-full/.agents/skills/demo/reference/guide.md': '# Guide\n' };
  assert.deepEqual(await failuresOf('Read `.agents/skills/demo/reference/guide.md` and `.agents/skills/demo/reference/`, in `.agents/skills/demo`.', { extra }), []);
  assert.equal((await failuresOf('Read `.agents/skills/demo/reference/other.md`.', { extra })).length, 1);
});

test('rule b: project-owned, seeded, and generated paths named by the manifest are valid, other project paths are not', async () => {
  assert.deepEqual(await failuresOf('Read `.agents/project/context.md`, `.agents/project/quality-gate.md`, `.agents/project/skills/x/SKILL.md`, `.agents/project/stack.md`, and `.agents/workflow-kit/install-state.json`.'), []);
  const failures = await failuresOf('Read `.agents/project/invented.md`.');
  assert.equal(failures.length, 1);
  assert.match(failures[0], /\.agents\/project\/invented\.md/);
});

test('rule b: product document folders the project owns are valid, an invented one is not', async () => {
  assert.deepEqual(await failuresOf('See `docs/prd/area/x.md`, `docs/epics/e/e.md`, `docs/design/s-sketch.md`, `docs/patterns/`, `docs/foundations/*.md`.'), []);
  assert.equal((await failuresOf('See `docs/invented/x.md`.')).length, 1);
});

test('rule b: a concrete file in a folder the project owns is read, so it needs an ownership marker (the pilot defect)', async () => {
  const planted = await failuresOf('Read `docs/foundations/ARCHITECTURE.md` before anything else.');
  assert.equal(planted.length, 1);
  assert.match(planted[0], /docs\/foundations\/ARCHITECTURE\.md is a file the project owns/);
  for (const folder of projectInputFolders) {
    assert.equal((await failuresOf(`Read \`${folder}something.md\` first.`)).length, 1, folder);
  }
});

test('rule b: each ownership marker, on the same or an adjacent line, or a fenced block, makes the file valid', async () => {
  const file = '`docs/foundations/ARCHITECTURE.md`';
  for (const text of [
    `Read ${file} when it exists.`, `Read ${file} if present.`, `Read ${file} if the project has one.`, `Read ${file} when the project keeps it.`,
    `Read ${file} only when the work is cross-layer.`, `Read ${file} (optional).`, `For example ${file}.`, `Docs (e.g. ${file}).`,
    `Docs such as ${file}.`, `Read your project's ${file}.`, `Read it only when it exists.\n${file}`, `${file}\nOptional reading.`,
    `Template:\n\n\`\`\`md\nSee ${file}\n\`\`\``
  ]) {
    assert.deepEqual(await failuresOf(text), [], text);
  }
  // Two lines away is not adjacent.
  assert.equal((await failuresOf(`Optional.\n\n\n${file}`)).length, 1);
});

test('rule b: files the workflow writes are outputs and valid without a marker', async () => {
  assert.deepEqual(await failuresOf('Write `docs/prd/area/x.md`, `docs/epics/e/e.md`, `docs/internal-documentation/a/guide.md`, `docs/design/s-sketch.md`, and `docs/workflow/handoffs/note.md`.'), []);
  assert.ok(kitWrittenFolders.length <= 2);
});

test('rule c: a placeholder or glob is valid when its fixed folder is, and fails with an uninstalled prefix', async () => {
  const extra = { 'repo-overlay-fhh-ia-ecosystem-full/.agents/skills/demo/reference/guide.md': '# Guide\n' };
  assert.deepEqual(await failuresOf('Use `.agents/skills/<name>/SKILL.md`, `.agents/skills/demo/reference/*.md`, `docs/prd/<feature>/<YYYY-MM-DD>-<slug>/` and `.agents/skills/{a,b}/x.md`.', { extra }), []);
  const bad = await failuresOf('Use `.agents/nothing/<slug>.md` and `scripts/<tool>/run.mjs` and `docs/nowhere/*.md`.');
  assert.equal(bad.length, 3);
  assert.match(bad[0], /fixed folder \.agents\/nothing\//);
});

test('rule d: a path another runtime installs is valid in shared text; a path no runtime installs is not', async () => {
  const extra = {
    'runtime-adapters/codex/.codex/README.md': '# Codex\n',
    'runtime-adapters/claude/CLAUDE.md': '# Claude\n'
  };
  for (const sets of [[['neutral']], [['claude']], [['codex']]]) {
    assert.deepEqual(await failuresOf('See `.codex/README.md` and `CLAUDE.md`.', { sets, extra }), [], sets.join());
  }
  assert.equal((await failuresOf('See `.codex/other.md`.', { sets: [['claude']], extra })).length, 1);
});

test('rule e: a legacy path needs a legacy, older-installs, or fallback marker on the same or an adjacent line', async () => {
  assert.deepEqual(await failuresOf('Read `.agents/project/context.md` (legacy: `.agents/project-context.md`).'), []);
  assert.deepEqual(await failuresOf('Older installs keep the file elsewhere.\n`.agents/project-context.md`'), []);
  assert.deepEqual(await failuresOf('`.agents/project-context.md`\nfallback while the new one is missing.'), []);
  const failures = await failuresOf('Intro.\n\nRead `.agents/project-context.md` for the stack.\n\nMore.\n\nEven more.');
  assert.equal(failures.length, 1);
  assert.match(failures[0], /legacy path of \.agents\/project\/context\.md/);
  assert.equal((await failuresOf('Read `.agents/project-context.md` first.\n\nUnrelated.\n\nLegacy note far away.')).length, 1);
});

test('rule f: an allow-list entry (file, path prefix, reason) makes a reference valid, for that file only', async () => {
  const body = 'Run `scripts/missing-tool.mjs`.';
  const entry = { file: '.agents/skills/demo/SKILL.md', path: 'scripts/missing-tool', reason: 'test' };
  assert.deepEqual(await failuresOf(body, { allow: [entry] }), []);
  assert.equal((await failuresOf(body, { allow: [{ ...entry, file: '.agents/skills/other/SKILL.md' }] })).length, 1);
});

test('provenance markers and brackets around a reference are not dangling paths', async () => {
  assert.deepEqual(await failuresOf('<!-- Generated by scripts/sync-thing.mjs. Do not edit. -->'), []);
  assert.deepEqual(extractReferences('See [docs/prd/x.md] and (`docs/foundations/ARCHITECTURE.md`).').map((item) => item.reference), ['docs/prd/x.md', 'docs/foundations/ARCHITECTURE.md']);
  assert.deepEqual(extractReferences('Folder `docs/design/[slug]-mockups/`.').map((item) => item.reference), ['docs/design/[slug]-mockups/']);
});

test('third-party skills and JSON data are not scanned', async () => {
  const extra = {
    'repo-overlay-fhh-ia-ecosystem-full/.agents/skills/05-caveman/x/SKILL.md': 'Run `scripts/upstream.mjs`.\n',
    'repo-overlay-fhh-ia-ecosystem-full/.agents/skills/data.json': '{"path":"scripts/data.mjs"}\n'
  };
  assert.deepEqual(await failuresOf('Nothing to cite.', { extra }), []);
});

test('the allow-list stays small and every entry says why', () => {
  assert.ok(allowlist.length <= 25, `${allowlist.length} entries: a missing category should replace the extras`);
  for (const entry of allowlist) {
    assert.ok(entry.file && entry.path && entry.reason?.length > 10, JSON.stringify(entry));
  }
});

for (const runtimes of runtimeSets) {
  test(`the real kit installed for ${runtimes.join('+')} cites no dangling path`, async () => {
    const result = await validateInstalledPaths({ root, sets: [runtimes] });
    assert.deepEqual(result.failures, []);
    assert.ok(result.scanned > 500, `scanned ${result.scanned} references`);
  });
}

// The offenders the guard revealed in the first run, each fixed in both copies.
test('the fixed offenders no longer cite paths the install lacks', async () => {
  for (const kitRoot of ['.agents', `${overlay}/.agents`]) {
    const runner = await fs.readFile(path.join(root, kitRoot, 'skills/02-implement/validation-runner/SKILL.md'), 'utf8');
    assert.match(runner, /`\.agents\/skills\/02-implement\/validation-runner\/scripts\/validation-fingerprint\.mjs`/, kitRoot);
    for (const file of ['skills/02-implement/implement-prd/reference/subagent-prompts.md', 'skills/02-implement/implement-prd/reference/delegate-skill-matrix.md']) {
      const text = await fs.readFile(path.join(root, kitRoot, file), 'utf8');
      assert.doesNotMatch(text, /docs\/workflow\/(copilot-subagent-model-routing|cross-runtime-capability-matrix)\.md/, `${kitRoot}/${file}`);
    }
  }
});
