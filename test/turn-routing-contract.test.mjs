import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const overlay = path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full');

async function read(relativePath, base = root) {
  return fs.readFile(path.join(base, relativePath), 'utf8');
}

test('neutral instructions define mandatory per-turn intake', async () => {
  const instructions = await read('.agents/instructions.md');

  assert.match(instructions, /## Mandatory per-turn intake/);
  assert.match(instructions, /\.agents\/skills\/index\.md/);
  assert.match(instructions, /every new user prompt/i);
  assert.match(instructions, /explicitly invokes a skill/i);
  assert.match(instructions, /direct answer/i);
  assert.match(instructions, /non-trivial/i);
  assert.match(instructions, /(?:do|must) not assume.*previous prompt/is);
  assert.match(instructions, /reuse.*context/is);
  assert.match(instructions, /cannot load.*workflow-router/is);
});

test('router distinguishes intake from full routing and visible traces', async () => {
  const router = await read('.agents/skills/00-router/workflow-router/SKILL.md');

  assert.match(router, /intake runs for every new user prompt/i);
  assert.match(router, /full router.*non-trivial/is);
  assert.match(router, /direct answer.*without.*visible.*trace/is);
  assert.match(router, /workflow,[\s\S]*skill,[\s\S]*capability,[\s\S]*cost,[\s\S]*delegation,[\s\S]*risk decision/i);
});

test('canonical instructions and router match the installable overlay', async () => {
  for (const relativePath of [
    '.agents/instructions.md',
    '.agents/skills/00-router/workflow-router/SKILL.md'
  ]) {
    assert.equal(await read(relativePath), await read(relativePath, overlay), relativePath);
  }
});

test('all runtime entrypoints apply the minimum neutral bootstrap', async () => {
  const entrypoints = [
    'templates/runtime-adapters/agents-md/AGENTS.md',
    'templates/runtime-adapters/copilot/.github/copilot-instructions.md',
    'templates/runtime-adapters/claude/CLAUDE.md',
    'templates/runtime-adapters/antigravity/ANTIGRAVITY.md'
  ];

  for (const relativePath of entrypoints) {
    const content = await read(relativePath);
    assert.match(content, /\.agents\/instructions\.md/, relativePath);
    assert.match(content, /\.agents\/skills\/index\.md/, relativePath);
    assert.match(content, /every new user prompt/i, relativePath);
    assert.match(content, /explicitly invokes a skill/i, relativePath);
    assert.match(content, /non-trivial/i, relativePath);
  }
});

test('Copilot scoped instructions apply globally', async () => {
  for (const relativePath of [
    '.github/instructions/ai-workflow.instructions.md',
    'templates/runtime-adapters/copilot/.github/instructions/ai-workflow.instructions.md'
  ]) {
    const content = await read(relativePath);
    assert.match(content, /^---\napplyTo: "\*\*"\n---\n/, relativePath);
    assert.match(content, /routing decision trace/i, relativePath);
  }
});

test('Copilot wrappers require visible routing trace for non-trivial work', async () => {
  for (const relativePath of [
    '.github/copilot-instructions.md',
    'templates/runtime-adapters/copilot/.github/copilot-instructions.md'
  ]) {
    const content = await read(relativePath);
    assert.match(content, /non-trivial/i, relativePath);
    assert.match(content, /routing decision trace/i, relativePath);
    assert.match(content, /trivial informational direct answers/i, relativePath);
  }
});
