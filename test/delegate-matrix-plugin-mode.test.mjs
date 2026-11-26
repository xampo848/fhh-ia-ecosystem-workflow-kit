import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

// The matrix lists the adapter files repo mode writes. In plugin mode those
// files are not in the repository, so the matrix has to say how the agents are
// reached there (PRD plugin-mode-pilot, risk R8).
const copies = [
  '.agents/skills/02-implement/implement-prd/reference/delegate-skill-matrix.md',
  'templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/02-implement/implement-prd/reference/delegate-skill-matrix.md'
];

for (const copy of copies) {
  test(`${copy} says where the agents are in plugin mode`, async () => {
    const content = await fs.readFile(new URL(`../${copy}`, import.meta.url), 'utf8');
    assert.match(content, /In plugin mode the adapter files below are not in the repository/);
    assert.match(content, /`fhh:<slug>`/);
  });
}
