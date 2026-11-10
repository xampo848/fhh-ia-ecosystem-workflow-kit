import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const changeDir = '.agents/skills/02-implement/implement-change';

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

test('implement-change core stays under 200 lines and declares when each reference is read', async () => {
  const core = await read(`${changeDir}/SKILL.md`);
  assert.ok(core.split('\n').length <= 200, 'implement-change SKILL.md must stay at or under 200 lines');
  assert.match(core, /^name: implement-change$/m);
  for (const reference of ['level-n1.md', 'level-n2.md', 'level-n3.md', 'input-types.md', 'modifiers.md']) {
    assert.match(core, new RegExp(`\\[reference/${reference.replace('.', '\\.')}\\]\\(reference/${reference.replace('.', '\\.')}\\) \\| \\S`), reference);
    await fs.access(path.join(root, changeDir, 'reference', reference));
  }
});

test('one classification: former modes map to levels and modifiers', async () => {
  const core = await read(`${changeDir}/SKILL.md`);
  assert.match(core, /\| N1 \| `small\/local` \|/);
  assert.match(core, /\| N2 \| `controlled-lite`, `controlled-implementation` \|/);
  assert.match(core, /\| N3 \| `standard` \|/);
  assert.match(core, /`autonomous-safe` and `resume` are no longer modes: they are modifiers/);
  assert.match(core, /two or more listed hazards MUST run at N3/);
  for (const type of ['PRD', 'Bug', 'Ticket', 'Iteration']) {
    assert.match(core, new RegExp(`^\\| ${type} \\|`, 'm'), type);
  }
});

test('invariants and closure by level live in the core so no level skips them', async () => {
  const core = await read(`${changeDir}/SKILL.md`);
  const invariants = core.slice(core.indexOf('## Invariants'), core.indexOf('## Closure by level'));
  for (const rule of ['Authorization', 'Escalation', 'Tests of the delta and regression', 'Quality gate', 'Stop conditions', 'No closure without evidence']) {
    assert.match(invariants, new RegExp(rule), rule);
  }
  assert.match(core, /\| N1 \| delta tests, regression of the touched area/);
  assert.match(core, /\| N3 \| the 12-point Mandatory Closure Contract/);
});

test('iteration and bug inputs keep quality while dropping ceremony', async () => {
  const inputs = await read(`${changeDir}/reference/input-types.md`);
  assert.match(inputs, /The map is the PRD and its `## 10\. Evidencia de Implementacion`/);
  assert.match(inputs, /Freshness is measured by changes, not time/);
  assert.match(inputs, /git diff <ref>\.\.HEAD/);
  assert.match(inputs, /regression of the original feature by running the existing tests that\s+section 10 lists/);
  assert.match(inputs, /"Iteración N" subsection/);
  assert.match(inputs, /No reproduction possible[\s\S]*do not fix blindly[\s\S]*explicitly authorizes/);
});

test('autonomous execution is an explicit per-run choice that never removes brakes', async () => {
  const modifiers = await read(`${changeDir}/reference/modifiers.md`);
  assert.match(modifiers, /\*\*Supervised\*\* \(default\)/);
  assert.match(modifiers, /never stored as a project\s+preference/);
  assert.match(modifiers, /Autonomy\s+removes pauses, not brakes/);
  assert.match(modifiers, /exhausts its repair rounds, stop there/);
});

test('implement-prd stays as a permanent alias and the router binds to implement-change', async () => {
  const [alias, registry, router, gates] = await Promise.all([
    read('.agents/skills/02-implement/implement-prd/SKILL.md'),
    read('.agents/skills/registry.md'),
    read('.agents/skills/00-router/workflow-router/SKILL.md'),
    read('.agents/skills/00-router/workflow-router/reference/route-gates.md')
  ]);
  assert.match(alias, /permanent alias of `implement-change`/);
  assert.match(alias, /\.\.\/implement-change\/SKILL\.md/);
  assert.match(registry, /\| `implement-change` \| Workflow \| `\.agents\/skills\/02-implement\/implement-change\/SKILL\.md`/);
  assert.match(registry, /\| `implement-prd` \| Workflow \| `\.agents\/skills\/02-implement\/implement-prd\/SKILL\.md` \|[^\n]*Permanent alias of `implement-change`/);
  assert.match(router, /"implementa este\s+PRD" runs `implement-change` \(alias `implement-prd`\)/);
  assert.match(gates, /load `\.agents\/skills\/02-implement\/implement-change\/SKILL\.md`/);
});
