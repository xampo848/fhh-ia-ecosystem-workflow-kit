import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSkillRegistryArtifacts,
  checkSkillRegistry
} from '../scripts/sync-skill-registry.mjs';

test('skill registry generator emits deterministic Node-owned artifacts', async () => {
  const first = await buildSkillRegistryArtifacts();
  const second = await buildSkillRegistryArtifacts();
  assert.equal(first.registryJson, second.registryJson);
  assert.equal(first.cacheJson, second.cacheJson);

  const registry = JSON.parse(first.registryJson);
  assert.equal(registry.generated_by, 'scripts/sync-skill-registry.mjs');
  assert.ok(registry.skills.some((entry) => entry.name === 'workflow-router'));
  assert.ok(registry.pattern_skills.some((entry) => entry.name === 'add-project-pattern'));
});

test('checked-in registry artifacts match canonical Markdown', async () => {
  const result = await checkSkillRegistry();
  assert.equal(result.ok, true, result.failures.join('\n'));
});
