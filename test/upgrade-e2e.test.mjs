import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { runDoctor } from '../src/doctor.mjs';
import { lineDiff, renderPlanDiffs } from '../src/plan-insight.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan, installStateRelativePath } from '../src/planner.mjs';
import { stackPackQuestion } from '../src/tui/model.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

const read = (target, relativePath) => fs.readFile(path.join(target, relativePath), 'utf8');
async function write(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}
const exists = (target, relativePath) => fs.access(path.join(target, relativePath)).then(() => true, () => false);

const ownBackendRules = '# Backend Instructions\n\n- Regla propia: los servicios devuelven un Result.\n';
const ownClaudeNote = '\n# Nota del equipo: usar siempre la rama develop.\n';

// Turns a fresh install into the shape a repository had before the roadmap:
// no neutral project files, no delegate contract, PRD-local _meta, hand-written
// Copilot instructions, agents that inherit the model, a customized adapter,
// and an install-state without profiles or stack pack.
async function downgradeToLegacyLayout(target, runtimes) {
  for (const relativePath of ['.agents/project', '.agents/delegation', '.agents/project-context.md', '.agents/skills/02-implement/implement-change', '.claude/skills', '.gitignore']) {
    await fs.rm(path.join(target, relativePath), { recursive: true, force: true });
  }
  await write(target, '.github/instructions/backend.instructions.md', `---\napplyTo: "backend/**/*.rb"\n---\n\n${ownBackendRules}`);
  await write(target, 'docs/prd/area/2026-10-01-old/_meta/orchestration.md', '# notas\n');
  await write(target, 'docs/prd/area/2026-10-01-old/old.md', '# PRD\n\n| AC-1 | x |\n');
  if (runtimes.includes('claude')) {
    // A legacy adapter had no level pre-filter, and the team customized it.
    const claude = await fs.readFile(path.join(target, 'CLAUDE.md'), 'utf8');
    const legacyClaude = claude.replace(/<!-- workflow-kit:level-prefilter:start -->[\s\S]*<!-- workflow-kit:level-prefilter:end -->\n/, '');
    await fs.writeFile(path.join(target, 'CLAUDE.md'), `${legacyClaude}${ownClaudeNote}`, 'utf8');
    const agent = path.join(target, '.claude/agents/turbo-backend.md');
    await fs.writeFile(agent, (await fs.readFile(agent, 'utf8')).replace(/^model: .*$/m, 'model: inherit'), 'utf8');
  }
  const statePath = path.join(target, installStateRelativePath);
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  // The old kit installed the agent with `model: inherit`, so that content is
  // what install-state recorded: it is managed and unmodified, not a local edit.
  if (runtimes.includes('claude')) {
    const legacyAgent = await fs.readFile(path.join(target, '.claude/agents/turbo-backend.md'), 'utf8');
    state.files['.claude/agents/turbo-backend.md'] = createHash('sha256').update(legacyAgent).digest('hex');
  }
  delete state.modelProfiles;
  delete state.stackPack;
  state.toolkitVersion = '0.7.40-contextual-model-selection';
  for (const key of Object.keys(state.files)) {
    if (key.startsWith('.agents/project') || key.startsWith('.agents/delegation') || key.startsWith('.claude/skills') || key.includes('implement-change')) delete state.files[key];
  }
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

for (const runtime of ['claude', 'codex', 'copilot', 'antigravity', 'claude,codex,copilot']) {
  test(`upgrade from the legacy layout keeps project content and ends healthy (${runtime})`, async () => {
    const runtimes = runtime.split(',');
    const target = await makeTempRepo();
    await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime }));
    await downgradeToLegacyLayout(target, runtimes);

    const plan = await buildUpdatePlan({ targetPath: target });
    assert.deepEqual(plan.runtimes, runtimes, 'runtimes come from install-state');
    const migrationIds = plan.migrations.map((item) => item.id);
    assert.ok(migrationIds.includes('0.11.0-ai-workspace'));
    assert.ok(migrationIds.includes('0.15.0-neutral-project-instructions'));
    assert.ok(migrationIds.includes('0.15.0-stack-pack'));
    assert.equal(migrationIds.includes('0.9.0-model-profiles'), runtimes.some((item) => ['claude', 'codex', 'copilot'].includes(item)));
    assert.match(formatPlan(plan), /Migrations \(applied once, idempotent\):/);
    // The update never deletes anything.
    assert.equal(plan.operations.some((item) => /delete|remove/.test(item.operation)), false);

    await applyInstallPlan(plan);

    // Project content survives: own backend rules moved to the neutral file.
    assert.equal(await read(target, '.agents/project/backend.md'), ownBackendRules);
    assert.match(await read(target, '.agents/project/stack.md'), /Use Minitest, not RSpec/);
    assert.match(await read(target, '.agents/project/quality-gate.md'), /# Quality Gate/);
    assert.match(await read(target, '.gitignore'), /^\.ai-work\/$/m);
    assert.ok(await exists(target, '.agents/delegation/delegate-contract.md'));
    assert.ok(await exists(target, '.agents/skills/02-implement/implement-change/SKILL.md'));
    assert.ok(await exists(target, '.agents/skills/02-implement/implement-prd/SKILL.md'), 'the alias stays');
    assert.ok(await exists(target, 'docs/prd/area/2026-10-01-old/_meta/orchestration.md'), 'legacy workspace is never deleted');

    if (runtimes.includes('copilot')) {
      const wrapper = await read(target, '.github/instructions/backend.instructions.md');
      assert.match(wrapper, /^---\napplyTo: "backend\/\*\*\/\*\.rb"\n---\n/);
      assert.ok(wrapper.endsWith(ownBackendRules));
    } else {
      assert.ok((await read(target, '.github/instructions/backend.instructions.md')).includes(ownBackendRules), 'untouched without Copilot');
    }
    if (runtimes.includes('claude')) {
      assert.ok((await read(target, 'CLAUDE.md')).endsWith(ownClaudeNote), 'customized adapter is protected');
      assert.match(await read(target, '.claude/agents/turbo-backend.md'), /^model: opus$/m);
      assert.ok(await exists(target, '.claude/skills/implement-change/SKILL.md'));
    }

    const doctor = await runDoctor({ targetPath: target });
    assert.deepEqual(doctor.diagnostics.filter((item) => item.severity === 'error'), []);
    assert.equal(doctor.ok, true);
    const warningCodes = new Set(doctor.diagnostics.map((item) => item.code));
    assert.ok(warningCodes.has('workspace/legacy-meta'));
    assert.ok(warningCodes.has('project-context/not-initialized'));
    if (runtimes.includes('claude')) assert.ok(warningCodes.has('adapter/missing-level-prefilter'), 'the protected adapter is reported, not overwritten');

    // Idempotent: a second update writes nothing and carries no migration.
    const again = await buildUpdatePlan({ targetPath: target });
    const writes = again.operations.filter((item) => !['unchanged', 'skip_unmanaged', 'skip_modified'].includes(item.operation));
    assert.deepEqual(writes.map((item) => `${item.operation}:${item.relativePath}`), []);
    assert.deepEqual(again.migrations, []);
  });
}

test('update --diff shows what would change, including a protected local edit', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  await downgradeToLegacyLayout(target, ['claude']);

  const io = createMemoryIo();
  assert.equal(await runCli(['update', '--target', target, '--diff'], io), 0);
  assert.match(io.output.stdout, /Diff of files that would change:/);
  assert.match(io.output.stdout, /--- skip_modified: CLAUDE\.md/);
  assert.match(io.output.stdout, /^- # Nota del equipo: usar siempre la rama develop\.$/m);
  assert.match(io.output.stdout, /--- overwrite_with_backup: \.claude\/agents\/turbo-backend\.md/);
  assert.match(io.output.stdout, /^- model: inherit$/m);
  assert.match(io.output.stdout, /^\+ model: opus$/m);
  // A dry-run with --diff writes nothing.
  assert.match(await read(target, '.claude/agents/turbo-backend.md'), /^model: inherit$/m);

  const plan = await buildUpdatePlan({ targetPath: target });
  assert.match(await renderPlanDiffs(plan, { maxLines: 5 }), /more diff lines\)/);
});

test('lineDiff reports additions, removals and context; the stack question defaults to none', () => {
  const diff = lineDiff('a\nb\nc\nd\ne\nf', 'a\nb\nX\nd\ne\nf\ng', { context: 1 });
  assert.equal(diff.added, 2);
  assert.equal(diff.removed, 1);
  assert.deepEqual(diff.lines, ['  b', '- c', '+ X', '  d', '  ...', '  f', '+ g']);
  assert.deepEqual(lineDiff('same', 'same'), { added: 0, removed: 0, lines: [] });

  const question = stackPackQuestion();
  assert.equal(question.options[question.defaultIndex].value, 'none');
  assert.ok(question.options.some((option) => option.value === 'rails-react'));
});
