import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateTemplatePacks } from '../scripts/validate-template-packs.mjs';
import manifest from '../templates/template-manifest.json' with { type: 'json' };

test('template manifest declares expected packs', () => {
  const ids = manifest.packs.map((pack) => pack.id).sort();
  assert.deepEqual(ids, ['adapter-claude', 'adapter-codex', 'adapter-copilot', 'portable-core', 'repo-overlay-all-metrics-full', 'repo-overlay-starter']);
});

test('validateTemplatePacks passes for bundled packs', async () => {
  const result = await validateTemplatePacks();
  assert.equal(result.ok, true, result.failures.join('\n'));
});

test('validateTemplatePacks catches forbidden portable terms', async () => {
  const root = await copyFixturePackage();
  const target = path.join(root, 'templates/portable-core/.agents/instructions.md');
  await fs.appendFile(target, '\nAll Metrics measures DORA with backend/ rules.\n', 'utf8');

  const result = await validateTemplatePacks({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('Forbidden portable/adapter term')));
});

test('validateTemplatePacks catches adapters that do not reference neutral instructions', async () => {
  const root = await copyFixturePackage();
  const target = path.join(root, 'templates/runtime-adapters/codex/AGENTS.md');
  await fs.writeFile(target, '# AGENTS.md\n\nRuntime-only rules with no neutral reference.\n', 'utf8');

  const result = await validateTemplatePacks({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('Adapter file must reference .agents/instructions.md')));
});

async function copyFixturePackage() {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-template-pack-'));
  await fs.cp(path.join(sourceRoot, 'templates'), path.join(targetRoot, 'templates'), { recursive: true });
  return targetRoot;
}
