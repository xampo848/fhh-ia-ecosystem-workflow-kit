import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { runDoctor } from '../src/doctor.mjs';
import { buildInstallPlan, buildUpdatePlan, installStateRelativePath } from '../src/planner.mjs';
import { workspaceDiagnostics } from '../src/workspace-diagnostics.mjs';
import { makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const referenceDir = '.agents/skills/02-implement/implement-prd/reference';

async function write(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

test('install ignores the AI workspace without taking ownership of .gitignore', async () => {
  const target = await makeTempRepo();
  await write(target, '.gitignore', 'node_modules/');
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'neutral' });
  const operation = plan.operations.find((item) => item.relativePath === '.gitignore');
  assert.equal(operation.operation, 'merge_with_backup');
  await applyInstallPlan(plan);

  const gitignore = await fs.readFile(path.join(target, '.gitignore'), 'utf8');
  assert.match(gitignore, /^node_modules\/$/m);
  assert.match(gitignore, /^\.ai-work\/$/m);
  const state = JSON.parse(await fs.readFile(path.join(target, installStateRelativePath), 'utf8'));
  assert.equal('.gitignore' in state.files, false, '.gitignore stays user-owned');

  const again = await buildUpdatePlan({ targetPath: target, runtime: 'neutral' });
  assert.equal(again.operations.some((item) => item.relativePath === '.gitignore'), false);

  const exported = await buildInstallPlan({ targetPath: await makeTempRepo(), runtime: 'neutral', ensureWorkspaceIgnore: false });
  assert.equal(exported.operations.some((item) => item.relativePath === '.gitignore'), false);
});

test('doctor reports leftover, stale, legacy and oversized workspace state as warnings', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const closedPrd = '# PRD\n\n## 10. Evidencia de Implementacion\n\n**Estado**: Cerrada\n\n| Campo | Evidencia durable |\n| --- | --- |\n| Fecha de cierre | 2026-11-01 |\n';
  await write(target, 'docs/prd/area/2026-11-01-closed/closed.md', closedPrd);
  await write(target, '.ai-work/2026-11-01-closed/task_tracker.toon', '# task_tracker\n');
  await write(target, '.ai-work/2026-10-01-open/task_tracker.toon', `${'x\n'.repeat(200)}`);
  await write(target, 'docs/prd/area/2026-09-01-old/_meta/orchestration.md', '# notes\n');
  await write(target, 'docs/prd/area/2026-09-01-old/old.md', `# PRD\n\n## 10. Evidencia de Implementacion\n\n${'- reparacion registrada\n'.repeat(90)}\n## 11. Otro\n`);

  const now = Date.now() + 30 * 86_400_000;
  const diagnostics = await workspaceDiagnostics({ targetPath: target, now });
  const codes = diagnostics.map((item) => `${item.code}:${item.path}`);
  assert.ok(codes.includes('workspace/closed-prd-leftover:.ai-work/2026-11-01-closed'));
  assert.ok(codes.includes('workspace/stale:.ai-work/2026-10-01-open'));
  assert.ok(codes.includes('workspace/tracker-is-a-log:.ai-work/2026-10-01-open/task_tracker.toon'));
  assert.ok(codes.includes('workspace/legacy-meta:docs/prd/area/2026-09-01-old/_meta'));
  assert.ok(codes.includes('prd/section-10-oversized:docs/prd/area/2026-09-01-old/old.md'));
  assert.ok(diagnostics.every((item) => item.severity === 'warning'));

  const doctor = await runDoctor({ targetPath: target });
  assert.equal(doctor.ok, true, 'workspace findings never fail doctor');
  assert.ok(doctor.diagnostics.some((item) => item.code === 'workspace/closed-prd-leftover'));

  await fs.writeFile(path.join(target, '.gitignore'), 'node_modules/\n', 'utf8');
  const unignored = await workspaceDiagnostics({ targetPath: target });
  assert.ok(unignored.some((item) => item.code === 'workspace/not-ignored'));
});

test('execution brakes and compact handoffs are part of the shared contract', async () => {
  const [stops, handoffs, tracker, core] = await Promise.all([
    fs.readFile(path.join(root, referenceDir, 'validation-and-stop-conditions.md'), 'utf8'),
    fs.readFile(path.join(root, referenceDir, 'handoff-schemas.md'), 'utf8'),
    fs.readFile(path.join(root, referenceDir, 'task-tracker-template.md'), 'utf8'),
    fs.readFile(path.join(root, '.agents/skills/02-implement/implement-change/SKILL.md'), 'utf8')
  ]);
  assert.match(stops, /## Repair Rounds And Failure Classes/);
  assert.match(stops, /Repair-round limit: 2 per slice/);
  assert.match(stops, /never lifted by the autonomous\s+modifier/);
  assert.match(stops, /Environment failure: \*\*one\*\* recovery attempt/);
  assert.match(stops, /Flaky: rerun \*\*once\*\*/);
  assert.match(stops, /The\s+full suite runs \*\*once\*\*, at closure or in CI/);
  assert.match(handoffs, /## Compact Handoff Rules/);
  assert.match(handoffs, /Only missing \*\*evidence\*\* blocks/);
  assert.match(handoffs, /at most ~30 relevant lines per\s+failure/);
  assert.match(handoffs, /### Return envelope/);
  assert.match(tracker, /snapshot of the current state/);
  assert.match(tracker, /events\.log/);
  assert.doesNotMatch(tracker, /# handoff_log/);
  assert.match(core, /## Workspace/);
  assert.match(core, /at most 2 repair rounds per slice/);
  for (const legacy of ['small/local', 'controlled-lite', 'autonomous-safe']) {
    assert.doesNotMatch(stops, new RegExp(legacy), `${legacy} must be expressed as a level or modifier`);
  }
});
