import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';
import { applyInstallPlan, applyJournalRelativePath } from '../src/apply.mjs';
import { buildInstallPlan, buildUpdatePlan } from '../src/planner.mjs';
import { runTui } from '../src/tui.mjs';
import { buildUpgradePlan, runUpgradePlan } from '../src/upgrade.mjs';
import packageJson from '../package.json' with { type: 'json' };
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

const statePath = '.agents/workflow-kit/install-state.json';

async function listFiles(root) {
  const found = [];
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else found.push(path.relative(root, absolute));
    }
  }
  await walk(root);
  return found.sort();
}

async function run(args) {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, ...io.output };
}

test('--dry-run together with --apply is rejected and writes nothing', async () => {
  const target = await makeTempRepo();

  for (const args of [['--apply', '--yes', '--dry-run'], ['--dry-run', '--apply', '--yes']]) {
    const result = await run(['init', '--target', target, ...args]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /either --dry-run or --apply/);
  }
  assert.deepEqual(await listFiles(target), []);
});

test('top-level help and version work and exit 0', async () => {
  for (const flag of ['--help', '-h', 'help']) {
    const result = await run([flag]);
    assert.equal(result.code, 0, flag);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /workflow-kit rollback/);
  }
  for (const flag of ['--version', '-v', 'version']) {
    const result = await run([flag]);
    assert.equal(result.code, 0, flag);
    assert.equal(result.stdout.trim(), packageJson.version);
  }
});

test('a flag without its value is an error instead of a silent default', async () => {
  const missing = await run(['init', '--apply', '--yes', '--target']);
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /Missing value for --target/);

  const swallowed = await run(['init', '--target', '--apply', '--yes']);
  assert.equal(swallowed.code, 2);
  assert.match(swallowed.stderr, /Missing value for --target/);

  const unknown = await run(['init', '--bogus']);
  assert.equal(unknown.code, 2, 'usage errors share exit code 2');
});

test('init refuses to write through a symlinked directory', async () => {
  const target = await makeTempRepo();
  const elsewhere = await makeTempRepo();
  await fs.symlink(elsewhere, path.join(target, '.agents'));

  const result = await run(['init', '--target', target, '--apply', '--yes']);

  assert.equal(result.code, 2);
  assert.match(result.stderr, /symbolic link/);
  assert.match(result.stderr, /- \.agents/);
  assert.deepEqual(await listFiles(elsewhere), [], 'nothing leaks outside the target');
});

test('init refuses to write one adapter through a symlink to another', async () => {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, 'AGENTS.md'), 'team rules\n', 'utf8');
  await fs.symlink('AGENTS.md', path.join(target, 'CLAUDE.md'));

  const result = await run(['init', '--target', target, '--runtime', 'codex,claude', '--apply', '--yes']);

  assert.equal(result.code, 2);
  assert.match(result.stderr, /- CLAUDE\.md/);
  assert.equal(await fs.readFile(path.join(target, 'AGENTS.md'), 'utf8'), 'team rules\n');
});

test('doctor warns about a managed path that is a symlink', async () => {
  const target = await makeTempRepo();
  await run(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes']);
  await fs.rename(path.join(target, 'CLAUDE.md'), path.join(target, 'REAL.md'));
  await fs.symlink('REAL.md', path.join(target, 'CLAUDE.md'));

  const result = await run(['doctor', '--target', target]);

  assert.match(result.stdout, /managed\/symlink\] CLAUDE\.md/);
});

test('apply leaves no temporary files and records a journal of the run', async () => {
  const target = await makeTempRepo();
  await run(['init', '--target', target, '--apply', '--yes']);

  const files = await listFiles(target);
  assert.equal(files.some((file) => file.includes('.workflow-kit-tmp-')), false);
  const journal = JSON.parse(await fs.readFile(path.join(target, applyJournalRelativePath), 'utf8'));
  assert.equal(journal.previousInstallState, null);
  assert.equal(journal.stateWritten, true);
  assert.ok(journal.files.every((entry) => entry.action === 'created' && !path.isAbsolute(entry.relativePath)));
});

test('export does not leave a rollback journal in the output', async () => {
  const output = await makeTempRepo();
  await run(['export', '--output', output, '--apply', '--yes']);

  await assert.rejects(fs.access(path.join(output, applyJournalRelativePath)), { code: 'ENOENT' });
});

test('rollback of a first install removes everything that install created', async () => {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, 'app.js'), 'console.log(1)\n', 'utf8');
  await run(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes']);

  const dryRun = await run(['rollback', '--target', target]);
  assert.match(dryRun.stdout, /remove CLAUDE\.md \(created by the last apply\)/);
  assert.ok((await listFiles(target)).length > 50, 'dry run removes nothing');

  const result = await run(['rollback', '--target', target, '--apply', '--yes']);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Restored files: 0/);
  assert.deepEqual(await listFiles(target), ['app.js'], 'created files, .gitignore, install-state and empty directories are gone');
});

test('rollback of an update restores files, .gitignore and the previous install-state, once', async () => {
  const target = await makeTempRepo();
  await run(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes']);
  const stateBefore = await fs.readFile(path.join(target, statePath), 'utf8');
  const skill = '.agents/skills/00-router/workflow-router/SKILL.md';
  const original = await fs.readFile(path.join(target, skill), 'utf8');

  // Simulate an older install: the state records the old content of a managed
  // file, and the workspace entry is missing from .gitignore.
  const state = JSON.parse(stateBefore);
  await fs.writeFile(path.join(target, skill), 'old skill body\n', 'utf8');
  const { createHash } = await import('node:crypto');
  state.files[skill] = { sha256: createHash('sha256').update('old skill body\n', 'utf8').digest('hex'), class: 'kit' };
  const olderState = `${JSON.stringify(state, null, 2)}\n`;
  await fs.writeFile(path.join(target, statePath), olderState, 'utf8');
  await fs.writeFile(path.join(target, '.gitignore'), 'node_modules/\n', 'utf8');

  await run(['update', '--target', target, '--apply', '--yes']);
  assert.equal(await fs.readFile(path.join(target, skill), 'utf8'), original);

  const result = await run(['rollback', '--target', target, '--apply', '--yes']);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Restored files: 2/);
  assert.equal(await fs.readFile(path.join(target, skill), 'utf8'), 'old skill body\n');
  assert.equal(await fs.readFile(path.join(target, '.gitignore'), 'utf8'), 'node_modules/\n');
  assert.equal(await fs.readFile(path.join(target, statePath), 'utf8'), olderState);
  assert.equal((await listFiles(target)).some((file) => file.includes('.workflow-kit-backup-')), false, 'used backups are removed');

  const doctor = await run(['doctor', '--target', target]);
  assert.doesNotMatch(doctor.stdout, /boundary\/pending-edited_kit_file/);

  const again = await run(['rollback', '--target', target, '--apply', '--yes']);
  assert.match(again.stdout, /Nothing to roll back/);
});

test('rollback keeps a file that was edited after the apply', async () => {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, 'AGENTS.md'), 'existing local instructions\n', 'utf8');
  await run(['init', '--target', target, '--runtime', 'codex', '--apply', '--yes']);
  await fs.writeFile(path.join(target, 'AGENTS.md'), 'edited after install\n', 'utf8');

  const result = await run(['rollback', '--target', target, '--apply', '--yes']);

  assert.match(result.stdout, /Kept \(edited after the apply\): 1/);
  assert.equal(await fs.readFile(path.join(target, 'AGENTS.md'), 'utf8'), 'edited after install\n');
});

test('rollback never acts on install-state keys that point outside the target', async () => {
  const parent = await makeTempRepo();
  const target = path.join(parent, 'repo');
  await fs.mkdir(path.join(target, '.agents/workflow-kit'), { recursive: true });
  await fs.writeFile(path.join(parent, 'victim.txt'), 'keep me\n', 'utf8');
  await fs.writeFile(path.join(parent, 'victim.txt.workflow-kit-backup-20260101T000000Z'), 'overwritten\n', 'utf8');
  await fs.writeFile(path.join(target, statePath), JSON.stringify({
    schemaVersion: '1.0.0', runtimes: ['neutral'], files: { '../victim.txt': 'x' }
  }), 'utf8');

  const result = await run(['rollback', '--target', target, '--apply', '--yes']);

  // The key is dropped when the state is read, so nothing outside is restored.
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Nothing to roll back/);
  assert.equal(await fs.readFile(path.join(parent, 'victim.txt'), 'utf8'), 'keep me\n');
});

test('adopt-existing keeps the text of a customized adapter on later updates', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  await fs.rm(path.join(target, statePath));
  await fs.rm(path.join(target, applyJournalRelativePath));
  await fs.writeFile(path.join(target, 'CLAUDE.md'), '# Our own Claude rules\n', 'utf8');

  await applyInstallPlan(await buildUpdatePlan({ targetPath: target, runtime: 'claude', adoptExisting: true }));
  const next = await buildUpdatePlan({ targetPath: target });

  // The kit owns only its block; the team's text stays outside it and the next update has nothing to write.
  assert.equal(next.operations.find((item) => item.relativePath === 'CLAUDE.md').operation, 'unchanged');
  assert.ok((await fs.readFile(path.join(target, 'CLAUDE.md'), 'utf8')).endsWith('<!-- workflow-kit:managed:end -->\n\n# Our own Claude rules\n'));
});

test('an unusable install-state is reported, never treated as a missing install', async () => {
  const target = await makeTempRepo();
  await run(['init', '--target', target, '--apply', '--yes']);
  const state = JSON.parse(await fs.readFile(path.join(target, statePath), 'utf8'));

  for (const content of ['{ not json', JSON.stringify({ ...state, runtimes: ['runtime-from-the-future'] })]) {
    await fs.writeFile(path.join(target, statePath), content, 'utf8');

    const update = await run(['update', '--target', target]);
    assert.equal(update.code, 2);
    assert.match(update.stderr, /install-state\.json/);
    assert.doesNotMatch(update.stderr, /adopt-existing/);

    const doctor = await run(['doctor', '--target', target]);
    assert.equal(doctor.code, 1);
    assert.match(doctor.stdout, /managed\/install-state-unusable/);
  }
});

test('a registry.json that is not an object does not crash the plan', async () => {
  const target = await makeTempRepo();
  await fs.mkdir(path.join(target, '.agents/skills'), { recursive: true });
  await fs.writeFile(path.join(target, '.agents/skills/registry.json'), 'null', 'utf8');

  const result = await run(['init', '--target', target]);

  assert.equal(result.code, 0);
});

test('tui update keeps the runtimes recorded at install when defaults are accepted', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude,codex' }));

  const answers = ['2', target, '', '', '', 'yes'];
  const result = await runTui({
    ask: async () => answers.shift() ?? '',
    color: false,
    write: () => {}
  });

  assert.equal(result.mode, 'update');
  assert.deepEqual([...result.plan.runtimes].sort(), ['claude', 'codex']);
  const state = JSON.parse(await fs.readFile(path.join(target, statePath), 'utf8'));
  assert.deepEqual([...state.runtimes].sort(), ['claude', 'codex']);
});

test('upgrade rejects a malformed ref before building a package spec', () => {
  assert.throws(() => buildUpgradePlan({ ref: '--registry=http://evil' }), /Invalid --ref/);
  assert.throws(() => buildUpgradePlan({ ref: 'main; rm -rf ~' }), /Invalid --ref/);
  assert.equal(buildUpgradePlan({ ref: 'v0.17.0-audit-hardening' }).ref, 'v0.17.0-audit-hardening');
});

test('upgrade stops before removing the installed toolkit when the ref cannot be verified', async () => {
  const sandbox = await makeTempRepo();
  const marker = path.join(sandbox, 'ran');
  const io = createMemoryIo();
  const plan = {
    packageManager: 'bun',
    repository: 'example/repo',
    ref: 'does-not-exist',
    command: 'node',
    args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, '1')`]
  };
  const probes = [];

  const result = await runUpgradePlan(plan, {
    cwd: sandbox,
    ...io,
    verifyRef: async (command, args) => { probes.push([command, ...args].join(' ')); return { ok: false, code: 2 }; }
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'ref-not-verified');
  assert.match(probes[0], /^git ls-remote --exit-code https:\/\/github\.com\/example\/repo\.git does-not-exist$/);
  assert.match(io.output.stderr, /was not found.*Nothing was changed/);
  await assert.rejects(fs.access(marker), { code: 'ENOENT' });
});
