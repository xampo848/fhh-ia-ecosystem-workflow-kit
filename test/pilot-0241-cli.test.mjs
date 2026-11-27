// CLI findings of the pilot run on 0.24.0: doctor's missing-path false
// positive, rollback without a journal (exit code, repeated run, .gitignore
// backup), files removed by hand after an apply, and an edited adapter block.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan, applyJournalRelativePath } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan } from '../src/planner.mjs';
import { buildRollbackPlan, formatRollbackPlan } from '../src/rollback.mjs';
import { projectContextDiagnostics, projectContextPath } from '../src/workspace-diagnostics.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

async function installed(runtime = 'claude') {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, '.gitignore'), 'node_modules\n');
  await fs.writeFile(path.join(target, 'CLAUDE.md'), '# Own rules\n\nKeep this line.\n');
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime }));
  return target;
}

const cli = async (...args) => {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, ...io.output };
};

test('doctor does not report a path relative to another file as missing from the repository', async () => {
  const target = await makeTempRepo();
  await fs.mkdir(path.join(target, 'src'), { recursive: true });
  await fs.writeFile(path.join(target, 'src/index.mjs'), '');
  const context = path.join(target, projectContextPath);
  await fs.mkdir(path.dirname(context), { recursive: true });
  await fs.writeFile(context, '# Project context\n\nTests import with `../src/index.mjs` and `../src`.\nEntry point: `./src/index.mjs`. Gone: `./src/gone.mjs` and `lib/missing.mjs`.\n');
  const codes = (await projectContextDiagnostics({ targetPath: target })).map((item) => item.message);
  assert.equal(codes.filter((message) => /\.\.\/src/.test(message)).length, 0, codes.join('\n'));
  assert.equal(codes.filter((message) => /Points to `\.\/src\/index\.mjs`/.test(message)).length, 0, codes.join('\n'));
  assert.ok(codes.some((message) => /Points to `\.\/src\/gone\.mjs`, which does not exist/.test(message)), codes.join('\n'));
  assert.ok(codes.some((message) => /Points to `lib\/missing\.mjs`, which does not exist/.test(message)), codes.join('\n'));
});

test('rollback without a journal: apply exits 3 when backups exist and none is restored; the dry run and "nothing to roll back" stay 0', async () => {
  const target = await installed();
  await fs.rm(path.join(target, applyJournalRelativePath));

  const dry = await cli('rollback', '--target', target);
  assert.equal(dry.code, 0, dry.stderr);
  const apply = await cli('rollback', '--target', target, '--apply', '--yes');
  assert.equal(apply.code, 3, apply.stdout);
  assert.match(apply.stdout, /Nothing is restored\./);
  assert.match(apply.stderr, /Exit code 3: backups exist and none was restored\. Add --from-backups to restore them\./);

  const empty = await makeTempRepo();
  const nothing = await cli('rollback', '--target', empty, '--apply', '--yes');
  assert.equal(nothing.code, 0, nothing.stderr);
  assert.match(nothing.stdout, /Nothing to roll back\./);
});

test('rollback without a journal lists the backup of .gitignore, and --from-backups restores it', async () => {
  const target = await installed();
  await fs.rm(path.join(target, applyJournalRelativePath));
  const listed = formatRollbackPlan(await buildRollbackPlan({ targetPath: target }));
  assert.match(listed, /^- \.gitignore <- \.gitignore\.workflow-kit-backup-\d{8}T\d{6}Z /m);
  assert.match(listed, /^- CLAUDE\.md <- /m);

  const restored = await cli('rollback', '--target', target, '--from-backups', '--apply', '--yes');
  assert.equal(restored.code, 0, restored.stderr);
  assert.equal(await fs.readFile(path.join(target, '.gitignore'), 'utf8'), 'node_modules\n');
});

test('a second rollback --from-backups says the files already match their backups, not that there are no backups', async () => {
  const target = await installed();
  await fs.rm(path.join(target, applyJournalRelativePath));
  assert.equal((await cli('rollback', '--target', target, '--from-backups', '--apply', '--yes')).code, 0);

  for (const args of [['--from-backups', '--apply', '--yes'], ['--from-backups'], ['--apply', '--yes'], []]) {
    const again = await cli('rollback', '--target', target, ...args);
    assert.equal(again.code, 0, `${args.join(' ')}: ${again.stderr}`);
    assert.doesNotMatch(again.stdout, /no \*\.workflow-kit-backup-\* file sits next to/, args.join(' '));
    assert.match(again.stdout, /Nothing to restore: \d+ backup file\(s\) of earlier runs sit next to managed files, and each managed file already has the content of its newest backup\./, args.join(' '));
  }
});

test('rollback says which files of the last apply were removed by hand instead of counting them as unchanged', async () => {
  const target = await installed();
  const created = '.agents/skills/00-router/workflow-router/SKILL.md';
  await fs.rm(path.join(target, '.agents/skills'), { recursive: true });
  const plan = await buildRollbackPlan({ targetPath: target });
  const gone = plan.operations.filter((item) => item.action === 'keep_modified' && item.gone);
  assert.ok(gone.some((item) => item.relativePath === created));
  assert.equal(plan.operations.filter((item) => item.action === 'untouched').length, 0);
  const text = formatRollbackPlan(plan);
  assert.doesNotMatch(text, /file\(s\) the last apply did not change stay as they are/);
  assert.match(text, new RegExp(`^${gone.length} file\\(s\\) the last apply created were removed after it; nothing to remove for them\\.$`, 'm'));
  assert.doesNotMatch(text, new RegExp(`^keep ${created.replace(/[.]/g, '\\.')} `, 'm'));
});

test('the update plan says when it replaces a kit block that was edited in place', async () => {
  for (const mode of ['repo', 'plugin']) {
    const target = await makeTempRepo();
    await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude', mode }));
    const adapter = path.join(target, 'CLAUDE.md');
    const original = await fs.readFile(adapter, 'utf8');
    assert.doesNotMatch(formatPlan(await buildUpdatePlan({ targetPath: target })), /kit block was edited/, mode);
    await fs.writeFile(adapter, original.replace('| N0 |', '| N0 (edited by the team) |'));
    const text = formatPlan(await buildUpdatePlan({ targetPath: target }));
    assert.match(text, /^- overwrite_with_backup: CLAUDE\.md \(its kit block was edited; the kit version replaces it and the backup keeps the edit\)$/m, mode);
  }
});

// Findings of the independent review of 0.24.1.
test('review: a resumed rollback does not call the files it already removed "removed by hand", and the summary counts hand-removed files apart', async () => {
  const target = await installed();
  const journalPath = path.join(target, applyJournalRelativePath);
  const created = '.agents/skills/00-router/workflow-router/SKILL.md';
  await fs.rm(path.join(target, created));

  const io = createMemoryIo();
  const { summarizeRollback, applyRollbackPlan } = await import('../src/rollback.mjs');
  const firstPlan = await buildRollbackPlan({ targetPath: target });
  assert.equal(firstPlan.operations.filter((item) => item.createdGone).length, 1);

  const journal = JSON.parse(await fs.readFile(journalPath, 'utf8'));
  await fs.writeFile(journalPath, `${JSON.stringify({ ...journal, rollbackStartedAt: new Date().toISOString() }, null, 2)}\n`);
  const resumed = await buildRollbackPlan({ targetPath: target });
  assert.equal(resumed.operations.filter((item) => item.createdGone).length, 0, 'a rollback that already started removed it itself');
  assert.doesNotMatch(formatRollbackPlan(resumed), /were removed after it/);

  await fs.writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
  const summary = summarizeRollback(await applyRollbackPlan(await buildRollbackPlan({ targetPath: target })));
  assert.equal(summary.keptModified, 0);
  assert.equal(summary.alreadyGone, 1);
  assert.equal(io.output.stderr, '');
});

test('review: the rollback summary line names files removed by hand', async () => {
  const target = await installed();
  await fs.rm(path.join(target, '.agents/skills/00-router/workflow-router/SKILL.md'));
  const result = await cli('rollback', '--target', target, '--apply', '--yes');
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /^Kept \(edited after the apply\): 0$/m);
  assert.match(result.stdout, /^Already removed by hand: 1$/m);
});

test('review: a symbolic link at .gitignore does not stop a rollback without a journal, and the file count is the one install-state lists', async () => {
  const target = await makeTempRepo();
  const elsewhere = await makeTempRepo();
  await fs.writeFile(path.join(elsewhere, 'shared-ignore'), 'node_modules\n');
  await fs.symlink(path.join(elsewhere, 'shared-ignore'), path.join(target, '.gitignore'));
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  await fs.rm(path.join(target, applyJournalRelativePath));

  const dry = await cli('rollback', '--target', target);
  assert.equal(dry.code, 0, dry.stderr);
  assert.match(dry.stdout, /Nothing to roll back\./);
  const state = JSON.parse(await fs.readFile(path.join(target, '.agents/workflow-kit/install-state.json'), 'utf8'));
  assert.match(dry.stdout, new RegExp(`next to the ${Object.keys(state.files).length} managed file\\(s\\) install-state lists`));
  assert.equal(await fs.readFile(path.join(elsewhere, 'shared-ignore'), 'utf8'), 'node_modules\n');
});
