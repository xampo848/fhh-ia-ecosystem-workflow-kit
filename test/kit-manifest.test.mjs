import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  blockMarkers,
  classifyPath,
  currentPathFor,
  extractManagedBlock,
  isProjectPath,
  legacyPathFor,
  loadKitManifest,
  replaceManagedBlock,
  supersededSeedHashes
} from '../src/kit-manifest.mjs';
import { makeTempRepo } from './helpers.mjs';

const minimalManifest = {
  schema_version: '2.0.0',
  project_root: '.agents/project/',
  paths: [{ path: 'AGENTS.md', class: 'adapter' }]
};

async function writeManifest(content) {
  const file = path.join(await makeTempRepo('kit-manifest-'), 'manifest.json');
  await fs.writeFile(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

test('the package manifest classifies each path by its most specific entry', async () => {
  const manifest = await loadKitManifest();

  assert.equal(classifyPath(manifest, '.agents/skills/index.md').class, 'derived');
  assert.equal(classifyPath(manifest, '.agents/skills/x/SKILL.md').class, 'kit');
  assert.equal(classifyPath(manifest, 'CLAUDE.md').class, 'adapter');
  assert.deepEqual(classifyPath(manifest, 'docs/README.md'), { path: 'docs/README.md', class: 'adapter', block: 'workflow-kit:docs-workflow' });
  assert.equal(classifyPath(manifest, 'unknown-root-file.txt'), null);
  assert.equal(isProjectPath(manifest, '.agents/project/skills/x/SKILL.md'), true);
  assert.equal(isProjectPath(manifest, '.agents/skills/x/SKILL.md'), false);
});

test('loadKitManifest names the file and the problem of an invalid manifest', async () => {
  const missing = path.join(await makeTempRepo('kit-manifest-'), 'absent.json');
  const cases = [
    ['unreadable', missing, /Cannot read the kit manifest .*absent\.json/],
    ['invalid JSON', await writeManifest('{ not json'), /manifest\.json is not valid JSON/],
    ['schema_version', await writeManifest({ ...minimalManifest, schema_version: '1.0.0' }), /manifest\.json has schema_version 1\.0\.0; this CLI reads 2\.0\.0/],
    ['empty paths', await writeManifest({ ...minimalManifest, paths: [] }), /manifest\.json must list its paths in a non-empty array/],
    ['entry without path', await writeManifest({ ...minimalManifest, paths: [{ class: 'kit' }] }), /manifest\.json has a path entry without a string path/],
    ['unknown class', await writeManifest({ ...minimalManifest, paths: [{ path: 'AGENTS.md', class: 'owned' }] }), /manifest\.json gives AGENTS\.md the unknown class owned/],
    ['no project_root', await writeManifest({ ...minimalManifest, project_root: undefined }), /manifest\.json has no project_root/],
    ['project_root without a trailing slash', await writeManifest({ ...minimalManifest, project_root: '.agents/project' }), /manifest\.json has no project_root/]
  ];
  for (const [label, file, message] of cases) {
    await assert.rejects(loadKitManifest({ file }), message, label);
  }
});

test('loadKitManifest defaults the optional keys', async () => {
  const manifest = await loadKitManifest({ file: await writeManifest(minimalManifest) });

  assert.deepEqual(
    [manifest.legacy_paths, manifest.not_shadowable, manifest.ignore_entries, manifest.superseded_seeds],
    [{}, [], [], {}]
  );
});

test('replaceManagedBlock swaps only the block and keeps the outside text byte-identical', () => {
  const { start, end } = blockMarkers('workflow-kit:managed');
  const before = '# Project title\r\n\n  local notes  \n';
  const after = '\n\nTrailing project text without newline';
  const existing = `${before}${start}\nold kit text\n${end}${after}`;
  const template = `template header\n${start}\nnew kit text\n${end}\ntemplate footer\n`;

  assert.equal(replaceManagedBlock(existing, template), `${before}${start}\nnew kit text\n${end}${after}`);
});

test('extractManagedBlock reports a missing, duplicate, or unordered block', () => {
  const { start, end } = blockMarkers('workflow-kit:managed');
  const cases = [
    ['missing', `${start}\nonly a start\n`],
    ['duplicate', `${start}\na\n${end}\n${start}\nb\n${end}\n`],
    ['unordered', `${end}\nreversed\n${start}\n`]
  ];
  for (const [error, content] of cases) {
    assert.deepEqual(extractManagedBlock(content), { error }, error);
  }
});

test('replaceManagedBlock returns null for unmarked content and throws for a template without a block', () => {
  const { start, end } = blockMarkers('workflow-kit:docs-workflow');
  const template = `${start}\nkit\n${end}\n`;

  assert.equal(replaceManagedBlock('# Hand-written docs\n', template, 'workflow-kit:docs-workflow'), null);
  assert.throws(() => replaceManagedBlock(template, '# No markers\n', 'workflow-kit:docs-workflow'), /template has no valid workflow-kit:docs-workflow block \(missing\)/);
});

test('supersededSeedHashes lists the known hashes of a seed, or none', async () => {
  const manifest = await loadKitManifest({ file: await writeManifest({
    ...minimalManifest,
    superseded_seeds: { '.agents/project/quality-gate.md': ['a'.repeat(64), 'b'.repeat(64)] }
  }) });

  assert.deepEqual(supersededSeedHashes(manifest, '.agents/project/quality-gate.md'), new Set(['a'.repeat(64), 'b'.repeat(64)]));
  assert.deepEqual(supersededSeedHashes(manifest, '.agents/project/backend.md'), new Set());
});

test('legacy and current paths map both ways through legacy_paths', async () => {
  const manifest = await loadKitManifest();

  assert.equal(currentPathFor(manifest, '.agents/project-context.md'), '.agents/project/context.md');
  assert.equal(legacyPathFor(manifest, '.agents/project/context.md'), '.agents/project-context.md');
  assert.equal(currentPathFor(manifest, '.agents/project/context.md'), null);
  assert.equal(legacyPathFor(manifest, '.agents/project-context.md'), null);
});
