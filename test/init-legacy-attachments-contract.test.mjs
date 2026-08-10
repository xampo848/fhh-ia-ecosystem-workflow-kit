import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const canonicalPath = path.join(
  root,
  '.agents/skills/06-patterns/authoring/init-legacy-attachments/SKILL.md'
);
const overlayPath = path.join(
  root,
  'templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/06-patterns/authoring/init-legacy-attachments/SKILL.md'
);

test('init-legacy-attachments enforces functional readiness gate for attached candidates', async () => {
  const skill = await fs.readFile(canonicalPath, 'utf8');

  assert.match(skill, /## Functional readiness gate \(mandatory\)/);
  assert.match(skill, /`discoverable`/);
  assert.match(skill, /`addressable`/);
  assert.match(skill, /`contract-aligned`/);
  assert.match(skill, /`workflow-compatible`/);
  assert.match(skill, /`behavior-smoke`/);
  assert.match(skill, /mark candidate as `not-ready` and do not report successful incorporation/);
  assert.match(skill, /Minimum behavioral smoke evidence format:/);
  assert.match(skill, /- candidate key/);
  assert.match(skill, /- smoke prompt used/);
  assert.match(skill, /- expected route\/selection/);
  assert.match(skill, /- observed route\/selection/);
  assert.match(skill, /- verdict: pass \| fail/);
  assert.match(skill, /- ready count,/);
  assert.match(skill, /- not-ready count,/);
});

test('init-legacy-attachments overlay mirror matches canonical skill contract', async () => {
  const [canonical, overlay] = await Promise.all([
    fs.readFile(canonicalPath, 'utf8'),
    fs.readFile(overlayPath, 'utf8')
  ]);

  assert.equal(overlay, canonical);
});
