import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { buildInstallPlan, parseRuntimeList } from '../src/planner.mjs';
import { validateClaudeSkills } from '../scripts/sync-claude-skills.mjs';
import { skillLineLimit, validateSkillSize } from '../scripts/validate-skill-size.mjs';
import { makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

test('own skill files respect the 200-line limit and references say when to read them', async () => {
  const result = await validateSkillSize({ root });
  assert.deepEqual(result.failures, []);
  assert.equal(skillLineLimit, 200);
});

test('skill size validation fails for an oversized skill and for a reference without a load condition', async () => {
  const fixture = await makeTempRepo('workflow-kit-size-');
  await fs.cp(path.join(root, '.agents'), path.join(fixture, '.agents'), { recursive: true });
  await fs.appendFile(path.join(fixture, '.agents/skills/02-implement/validation-runner/SKILL.md'), '\nline'.repeat(220));
  await fs.writeFile(path.join(fixture, '.agents/skills/02-implement/implement-prd/reference/new-notes.md'), '# Notes\n\nSome content.\n');
  const result = await validateSkillSize({ root: fixture });
  assert.ok(result.failures.some((failure) => failure.includes('validation-runner/SKILL.md has')));
  assert.ok(result.failures.some((failure) => failure.includes('new-notes.md must say in its first lines when to read it')));
});

test('split skills keep their mandatory rules in the core and point to each reference', async () => {
  const [createPrd, epic, handoffs, flow] = await Promise.all([
    read('.agents/skills/01-product/create-prd/SKILL.md'),
    read('.agents/skills/01-product/create-epic/SKILL.md'),
    read('.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md'),
    read('.agents/skills/02-implement/implement-prd/reference/orchestration-flow.md')
  ]);
  assert.match(createPrd, /Hard Gate: Use Cases, Test Strategy, and Edge Cases Are Non-Optional/);
  assert.match(createPrd, /Hard Gate: Class Diagram Is Non-Optional/);
  assert.match(createPrd, /Hard Gate: Visible UI Requires A Visual Contract/);
  for (const reference of ['execution-granularity.md', 'architecture-rules.md', 'traceability-tables.md', 'quality-bar.md']) {
    assert.match(createPrd, new RegExp(`\\(reference/${reference.replace('.', '\\.')}\\) — read it`), reference);
  }
  assert.match(epic, /### 6\. Lock Live Path And Phase Cut\n\nMandatory step\. Load \[references\/live-path-and-phase-cut\.md\]/);
  assert.match(handoffs, /## Compact Handoff Rules/);
  assert.match(handoffs, /handoff-schemas-validation\.md\) — read it/);
  assert.match(flow, /orchestration-flow-execution\.md\) — read it/);
});

test('Claude Code gets native skill wrappers that never auto-invoke', async () => {
  const result = await validateClaudeSkills({ root });
  assert.deepEqual(result.failures, []);
  const wrapper = await read('.claude/skills/create-prd/SKILL.md');
  assert.match(wrapper, /^disable-model-invocation: true$/m);
  assert.match(wrapper, /Load `\.agents\/skills\/01-product\/create-prd\/SKILL\.md` and follow it/);

  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  await fs.access(path.join(target, '.claude/skills/implement-change/SKILL.md'));
  const neutral = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: neutral, runtime: 'codex' }));
  await assert.rejects(fs.access(path.join(neutral, '.claude/skills/implement-change/SKILL.md')));
});

test('OpenCode installs through the shared AGENTS.md bootstrap', async () => {
  assert.deepEqual(parseRuntimeList('opencode'), ['opencode']);
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'opencode' }));
  assert.match(await fs.readFile(path.join(target, 'AGENTS.md'), 'utf8'), /workflow-kit:level-prefilter:start/);
});

test('teaching notes are selective and delegation is explicit in every runtime', async () => {
  const [core, mentor, handoffs, modifiers, n3, router] = await Promise.all([
    read('.agents/skills/02-implement/implement-change/SKILL.md'),
    read('.agents/skills/04-crosscutting/engineering-mentor/SKILL.md'),
    read('.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md'),
    read('.agents/skills/02-implement/implement-change/reference/modifiers.md'),
    read('.agents/skills/02-implement/implement-change/reference/level-n3.md'),
    read('.agents/skills/00-router/workflow-router/SKILL.md')
  ]);
  assert.match(core, /Challenge always, teach selectively/);
  assert.match(core, /`teaching_notes: siempre \| nunca`/);
  assert.match(mentor, /## Selective notes/);
  assert.match(handoffs, /Learning notes are optional/);
  assert.match(router, /teach only for relevant decisions at N2\/N3, never at N0\/N1/);
  assert.match(modifiers, /Never fall back to inline\s+execution silently/);
  assert.match(n3, /## Runtime parity for delegation/);
  assert.match(n3, /never present inline work as delegated/);
});
