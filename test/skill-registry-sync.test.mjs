import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildSkillRegistryArtifacts,
  checkSkillRegistry
} from '../scripts/sync-skill-registry.mjs';

test('skill registry generator emits deterministic Node-owned artifacts', async () => {
  const first = await buildSkillRegistryArtifacts();
  const second = await buildSkillRegistryArtifacts();
  assert.equal(first.indexMarkdown, second.indexMarkdown);
  assert.equal(first.patternsIndexMarkdown, second.patternsIndexMarkdown);
  assert.equal(first.registryJson, second.registryJson);
  assert.equal(first.cacheJson, second.cacheJson);

  const registry = JSON.parse(first.registryJson);
  const cache = JSON.parse(first.cacheJson);
  assert.equal(registry.generated_by, 'scripts/sync-skill-registry.mjs');
  assert.match(first.indexMarkdown, /# Compact skill index/);
  assert.match(first.indexMarkdown, /workflow-router/);
  assert.doesNotMatch(first.indexMarkdown, /backend-phase-implementer/);
  assert.match(first.patternsIndexMarkdown, /# Compact pattern index/);
  assert.match(first.patternsIndexMarkdown, /add-project-pattern/);
  assert.match(first.patternsIndexMarkdown, /implementation-skill-matcher/);
  assert.doesNotMatch(first.patternsIndexMarkdown, /workflow-router/);
  assert.equal(cache.compact_pattern_index, '.agents/skills/06-patterns/index.md');
  assert.ok(registry.skills.some((entry) => entry.name === 'workflow-router'));
  assert.ok(registry.pattern_skills.some((entry) => entry.name === 'add-project-pattern'));
});

test('checked-in registry artifacts match canonical Markdown', async () => {
  const result = await checkSkillRegistry();
  assert.equal(result.ok, true, result.failures.join('\n'));
});

test('a kit registry row with the project-only class Runbook fails the check and names the row', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-registry-'));
  const registry = await fs.readFile(path.join(root, '.agents/skills/registry.md'), 'utf8');
  await fs.mkdir(path.join(dir, '.agents/skills'), { recursive: true });
  await fs.writeFile(path.join(dir, '.agents/skills/registry.md'), registry.replace('| `workflow-router` | Workflow |', '| `workflow-router` | Runbook |'));
  await assert.rejects(checkSkillRegistry({ root: dir }), /Kit skill workflow-router uses class Runbook/);
});
