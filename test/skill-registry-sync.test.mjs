import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSkillRegistryArtifacts,
  checkSkillRegistry
} from '../scripts/sync-skill-registry.mjs';

test('skill registry generator emits deterministic Node-owned artifacts', async () => {
  const first = await buildSkillRegistryArtifacts();
  const second = await buildSkillRegistryArtifacts();
  assert.equal(first.indexMarkdown, second.indexMarkdown);
  assert.equal(first.registryJson, second.registryJson);
  assert.equal(first.cacheJson, second.cacheJson);

  const registry = JSON.parse(first.registryJson);
  assert.equal(registry.generated_by, 'scripts/sync-skill-registry.mjs');
  assert.match(first.indexMarkdown, /# Compact skill index/);
  assert.match(first.indexMarkdown, /workflow-router/);
  assert.doesNotMatch(first.indexMarkdown, /backend-phase-implementer/);
  assert.ok(registry.skills.some((entry) => entry.name === 'workflow-router'));
  assert.ok(registry.pattern_skills.some((entry) => entry.name === 'add-project-pattern'));
});

test('checked-in registry artifacts match canonical Markdown', async () => {
  const result = await checkSkillRegistry();
  assert.equal(result.ok, true, result.failures.join('\n'));
});
