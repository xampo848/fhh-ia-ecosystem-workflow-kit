import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { runDoctor } from '../src/doctor.mjs';
import { lineDiff, renderPlanDiffs } from '../src/plan-insight.mjs';
import { buildInstallPlan, buildUpdatePlan, installStateRelativePath } from '../src/planner.mjs';
import { applyRollbackPlan, buildRollbackPlan } from '../src/rollback.mjs';
import { stackPackQuestion } from '../src/tui/model.mjs';
import { installLegacy0181 } from './fixtures/legacy-0.18.1/install.mjs';
import { createMemoryIo, makeTempRepo, hashTree } from './helpers.mjs';

const read = (target, relativePath) => fs.readFile(path.join(target, relativePath), 'utf8');
async function write(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}
const exists = (target, relativePath) => fs.access(path.join(target, relativePath)).then(() => true, () => false);

const migrationId = '0.22.0-kit-overlay-layout';
const projectIndexPath = '.agents/project/index.md';
const nonWriting = new Set(['unchanged', 'skip_unmanaged', 'skip_modified', 'adopt_existing']);

async function legacyRepo(options) {
  const target = await makeTempRepo();
  return { target, legacy: await installLegacy0181(target, options) };
}

// AC-10, AC-11 (UC-3, UC-4, UC-7): the whole upgrade flow from a real 0.18.1
// install, per runtime. The rule variants of each migration group are proven
// in migration.test.mjs; this test proves the flow ends healthy and reversible.
for (const runtime of ['claude', 'codex', 'copilot', 'antigravity', 'claude,codex,copilot']) {
  test(`upgrade from a 0.18.1 install keeps project content, updates again with no write, and rolls back byte for byte (${runtime})`, async () => {
    const runtimes = runtime.split(',');
    const { target, legacy } = await legacyRepo({ runtimes });
    const before = await hashTree(target);
    const rawState = await read(target, installStateRelativePath);

    // Dry-run: the plan carries the layout migration and writes nothing.
    const plan = await buildUpdatePlan({ targetPath: target });
    assert.deepEqual(plan.runtimes, runtimes, 'runtimes come from install-state');
    assert.ok(plan.migrations.some((item) => item.id === migrationId));
    assert.deepEqual(await hashTree(target), before);

    await applyInstallPlan(plan);

    // Own skill moved whole and listed in the project index.
    for (const file of legacy.localSkill.files) {
      assert.equal(await read(target, `${legacy.localSkill.newDir}/${file}`), legacy.localSkill.contents[file]);
    }
    // The catalog rows the team wrote, with their own text, in the project index.
    const rows = (await read(target, projectIndexPath)).split('\n').filter((line) => line.startsWith('| `'));
    assert.deepEqual(rows, legacy.projectIndexRows);
    // Own context moved; no template context anywhere.
    assert.equal(await read(target, legacy.ownContext.newPath), legacy.ownContext.content);
    assert.equal(await exists(target, legacy.ownContext.path), false);
    // Own backend rules untouched.
    assert.equal(await read(target, legacy.ownBackend.path), legacy.ownBackend.content);

    const state = JSON.parse(await read(target, installStateRelativePath));
    assert.equal(state.schemaVersion, '2.0.0');
    assert.equal(state.mode, 'repo');

    const doctor = await runDoctor({ targetPath: target });
    assert.deepEqual(doctor.diagnostics.filter((item) => item.severity === 'error'), []);

    // AC-10: a second update writes nothing and carries no migration.
    const again = await buildUpdatePlan({ targetPath: target });
    assert.deepEqual(again.operations.filter((item) => !nonWriting.has(item.operation)).map((item) => `${item.operation}:${item.relativePath}`), []);
    assert.deepEqual(again.migrations, []);

    // AC-11: rollback restores the 0.18.1 tree and the raw 1.0.0 state.
    await applyRollbackPlan(await buildRollbackPlan({ targetPath: target }));
    assert.equal(await read(target, installStateRelativePath), rawState);
    assert.deepEqual(await hashTree(target), before);
  });
}

// Edge case Rollout/rollback with Windows state keys: after the apply every
// file the kit still ships is on disk; only the retired file and the moved
// project files left their old paths.
test('upgrading a 0.18.1 install with Windows state keys deletes no live kit file', async () => {
  const { target, legacy } = await legacyRepo({ windowsKeys: true });
  const before = Object.keys(await hashTree(target));

  await applyInstallPlan(await buildUpdatePlan({ targetPath: target }));

  const after = new Set(Object.keys(await hashTree(target)));
  const gone = before.filter((relativePath) => !after.has(relativePath));
  const moved = [legacy.ownContext.path, ...legacy.localSkill.files.map((file) => `${legacy.localSkill.oldDir}/${file}`)];
  assert.deepEqual(gone.sort(), [legacy.retiredPath, ...moved].sort());
  const state = JSON.parse(await read(target, installStateRelativePath));
  const missing = [];
  for (const relativePath of Object.keys(state.files)) {
    if (!(await exists(target, relativePath))) missing.push(relativePath);
  }
  assert.deepEqual(missing, [], 'every recorded kit file is on disk');
});

test('update --diff on a 0.18.1 install prints the diff section and writes nothing', async () => {
  const { target } = await legacyRepo({ runtimes: ['claude'] });
  const before = await hashTree(target);

  const io = createMemoryIo();
  assert.equal(await runCli(['update', '--target', target, '--diff'], io), 0);

  assert.match(io.output.stdout, /Diff of files that would change:/);
  // The catalog replaced whole shows the own skill's old entry leaving.
  assert.match(io.output.stdout, /^--- overwrite_with_backup: \.agents\/skills\/registry\.json /m);
  assert.match(io.output.stdout, /^- +"path": "\.agents\/skills\/06-patterns\/local\/retry-policy\/SKILL\.md",$/m);
  assert.deepEqual(await hashTree(target), before);

  const plan = await buildUpdatePlan({ targetPath: target });
  assert.match(await renderPlanDiffs(plan, { maxLines: 5 }), /more diff lines\)/);
});

// Found rehearsing the update on a real repository: its implement-prd/SKILL.md
// was edited locally, so update protects it. Taking the new version by hand
// must end the protection instead of reporting the file as modified forever.
test('a protected file that already matches the new version is no longer reported as modified', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  const relativePath = '.agents/skills/02-implement/implement-prd/SKILL.md';
  const shipped = await read(target, relativePath);
  const statePath = path.join(target, installStateRelativePath);
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  // The state remembers an older shipped version; the file holds the new one.
  state.files[relativePath] = { sha256: createHash('sha256').update('older shipped version\n').digest('hex'), class: 'kit' };
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  const plan = await buildUpdatePlan({ targetPath: target });
  assert.equal(plan.operations.find((item) => item.relativePath === relativePath).operation, 'unchanged');
  await applyInstallPlan(plan);

  const updated = JSON.parse(await fs.readFile(statePath, 'utf8'));
  assert.equal(updated.files[relativePath].sha256, createHash('sha256').update(shipped).digest('hex'));
  const doctor = await runDoctor({ targetPath: target });
  assert.equal(doctor.diagnostics.some((item) => item.code === 'boundary/pending-edited_kit_file' && item.path === relativePath), false);

  // A real local edit is still protected.
  await write(target, relativePath, `${shipped}\nedicion local\n`);
  const protectedPlan = await buildUpdatePlan({ targetPath: target });
  assert.equal(protectedPlan.operations.find((item) => item.relativePath === relativePath).operation, 'skip_modified');
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
  const detected = stackPackQuestion({ detected: 'rails-react' });
  assert.equal(detected.options[detected.defaultIndex].value, 'rails-react', 'the detected stack is preselected');
});
