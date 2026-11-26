import assert from 'node:assert/strict';
import test from 'node:test';
import packageJson from '../package.json' with { type: 'json' };

// CI runs only `check:workflow` for these validators, so removing one from the
// script must fail a test: the whole ordered list is pinned here.
const checkWorkflowCommands = [
  'node scripts/sync-skill-registry.mjs --check',
  'node scripts/sync-delegate-runtime-adapters.mjs --check',
  'node scripts/sync-level-prefilter.mjs',
  'node scripts/sync-claude-skills.mjs',
  'node scripts/build-plugin.mjs',
  'node scripts/validate-delegate-contract.mjs',
  'node scripts/validate-neutral-paths.mjs',
  'node scripts/validate-stack-neutrality.mjs',
  'node scripts/validate-skill-size.mjs',
  'node scripts/validate-kit-boundary.mjs',
  'node scripts/validate-template-packs.mjs'
];

test('check:workflow runs every validator it must, in order', () => {
  assert.deepEqual(packageJson.scripts['check:workflow'].split(' && '), checkWorkflowCommands);
});

test('the gates the workflow and CI call exist', () => {
  for (const name of ['check', 'check:security', 'check:workflow', 'check:templates', 'check:docs', 'check:legal', 'check:release', 'test']) {
    assert.equal(typeof packageJson.scripts[name], 'string', name);
    assert.notEqual(packageJson.scripts[name].trim(), '', name);
  }
});
