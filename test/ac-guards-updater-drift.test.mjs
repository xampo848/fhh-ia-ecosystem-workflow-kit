import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateOverlayDrift } from '../src/workflow-contract/drift.mjs';
import { makeTempRepo } from './helpers.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seed = '.agents/project/context.md';

// Updater AC-13: the seeds are compared too (kit, derived and seed classes).
test('AC-13: a seed that differs between .agents/ and the installable overlay is overlay/content-drift', async () => {
  const root = await makeTempRepo('workflow-kit-seed-drift-');
  await fs.cp(path.join(repoRoot, '.agents'), path.join(root, '.agents'), { recursive: true });
  await fs.cp(path.join(repoRoot, 'templates/repo-overlay-fhh-ia-ecosystem-full'), path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full'), { recursive: true });
  assert.deepEqual(await validateOverlayDrift({ root }), [], 'the copies start in sync');
  await fs.appendFile(path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full', seed), '\nA divergent seed line.\n', 'utf8');

  const diagnostics = await validateOverlayDrift({ root });

  assert.deepEqual(diagnostics.map((item) => [item.code, item.path]), [['overlay/content-drift', seed]]);
});
