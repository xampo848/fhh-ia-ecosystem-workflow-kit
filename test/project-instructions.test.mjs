import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { runDoctor } from '../src/doctor.mjs';
import { buildInstallPlan, buildUpdatePlan } from '../src/planner.mjs';
import { projectInstructionDiagnostics, renderCopilotWrapper, splitWrapper } from '../src/project-instructions.mjs';
import { validateNeutralPaths } from '../scripts/validate-neutral-paths.mjs';
import { makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

async function write(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}
const read = (target, relativePath) => fs.readFile(path.join(target, relativePath), 'utf8');

test('workflow skills name neutral paths only', async () => {
  const result = await validateNeutralPaths({ root });
  assert.deepEqual(result.failures, []);
});

test('the kit quality gate wrapper is generated from the neutral file', async () => {
  const neutral = await read(root, '.agents/project/quality-gate.md');
  assert.equal(await read(root, '.github/instructions/quality-gate.instructions.md'), renderCopilotWrapper('quality-gate', neutral, '**'));
  const parsed = splitWrapper(renderCopilotWrapper('backend', '# Backend\n', 'backend/**'));
  assert.deepEqual(parsed, { applyTo: 'backend/**', body: '# Backend\n', generated: true });
});

test('fresh install: neutral quality gate for every runtime, Copilot wrapper only with Copilot', async () => {
  const claudeOnly = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: claudeOnly, runtime: 'claude' }));
  assert.match(await read(claudeOnly, '.agents/project/quality-gate.md'), /# Quality Gate/);
  await assert.rejects(fs.access(path.join(claudeOnly, '.github/instructions/quality-gate.instructions.md')));
  assert.deepEqual(await projectInstructionDiagnostics({ targetPath: claudeOnly, runtimes: ['claude'] }), []);

  const withCopilot = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: withCopilot, runtime: 'copilot' }));
  const wrapper = await read(withCopilot, '.github/instructions/quality-gate.instructions.md');
  assert.match(wrapper, /^---\napplyTo: "\*\*"\n---\n/);
  assert.match(wrapper, /Generated from \.agents\/project\/quality-gate\.md/);
  // Template placeholders for backend/frontend do not get a wrapper.
  await assert.rejects(fs.access(path.join(withCopilot, '.github/instructions/backend.instructions.md')));
});

test('update migrates hand-written Copilot instructions to the neutral location without losing content', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'copilot' }));
  // Simulate a project from before the neutral layout: own backend rules in the Copilot folder only.
  await fs.rm(path.join(target, '.agents/project/backend.md'));
  const ownRules = '# Backend Instructions\n\n- Use Minitest, not RSpec.\n- Bullet must be active in tests.\n';
  await write(target, '.github/instructions/backend.instructions.md', `---\napplyTo: "backend/**/*.rb"\n---\n\n${ownRules}`);

  const before = await projectInstructionDiagnostics({ targetPath: target, runtimes: ['copilot'] });
  assert.deepEqual(before.map((item) => item.code), ['project-instructions/not-migrated']);

  const plan = await buildUpdatePlan({ targetPath: target, runtime: 'copilot' });
  const neutral = plan.operations.find((item) => item.relativePath === '.agents/project/backend.md');
  assert.equal(neutral.operation, 'create');
  assert.equal(neutral.content, ownRules);
  const wrapper = plan.operations.find((item) => item.relativePath === '.github/instructions/backend.instructions.md');
  assert.equal(wrapper.operation, 'overwrite_with_backup');
  await applyInstallPlan(plan);

  assert.equal(await read(target, '.agents/project/backend.md'), ownRules);
  const generated = await read(target, '.github/instructions/backend.instructions.md');
  assert.match(generated, /^---\napplyTo: "backend\/\*\*\/\*\.rb"\n---\n/, 'the project applyTo glob is kept');
  assert.ok(generated.endsWith(ownRules));
  const backups = (await fs.readdir(path.join(target, '.github/instructions'))).filter((name) => name.startsWith('backend.instructions.md.workflow-kit-backup-'));
  assert.equal(backups.length, 1);

  // Idempotent: a second update changes nothing and never overwrites the neutral file.
  const again = await buildUpdatePlan({ targetPath: target, runtime: 'copilot' });
  assert.equal(again.operations.find((item) => item.relativePath === '.github/instructions/backend.instructions.md').operation, 'unchanged');
  assert.equal(again.operations.find((item) => item.relativePath === '.agents/project/backend.md').operation, 'skip_unmanaged');
  assert.deepEqual(await projectInstructionDiagnostics({ targetPath: target, runtimes: ['copilot'] }), []);
  // Generated wrappers are tracked, so doctor does not report them as locally modified.
  const doctor = await runDoctor({ targetPath: target, runtime: 'copilot' });
  assert.equal(doctor.diagnostics.some((item) => item.code === 'managed/content-drift'), false);
});

test('doctor reports a stale wrapper and a missing quality gate instead of skipping silently', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'copilot' }));
  await fs.appendFile(path.join(target, '.agents/project/quality-gate.md'), '\n9. New project rule.\n');
  let codes = (await projectInstructionDiagnostics({ targetPath: target, runtimes: ['copilot'] })).map((item) => item.code);
  assert.deepEqual(codes, ['project-instructions/wrapper-stale']);

  await applyInstallPlan(await buildUpdatePlan({ targetPath: target, runtime: 'copilot' }));
  assert.match(await read(target, '.github/instructions/quality-gate.instructions.md'), /9\. New project rule\./);

  await fs.rm(path.join(target, '.agents/project/quality-gate.md'));
  await fs.rm(path.join(target, '.github/instructions/quality-gate.instructions.md'));
  const doctor = await runDoctor({ targetPath: target, runtime: 'copilot' });
  assert.ok(doctor.diagnostics.some((item) => item.code === 'project-instructions/quality-gate-missing'));
});

test('implementation skills never skip a missing quality gate silently', async () => {
  const [core, contract, backend] = await Promise.all([
    read(root, '.agents/skills/02-implement/implement-change/SKILL.md'),
    read(root, '.agents/delegation/delegate-contract.md'),
    read(root, '.agents/skills/02-implement/backend-phase-implementer/SKILL.md')
  ]);
  for (const content of [core, contract, backend]) assert.match(content, /quality gate: no configurado/);
  assert.match(core, /at N3 that is a stop/);
});
