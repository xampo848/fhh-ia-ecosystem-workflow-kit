// Two CLI fixes found by a pilot: the install steps no longer claim the plugin
// branch is unpublished, and the backups the CLI keeps next to user files are
// ignored by Git. Backups are real files in a real git repository.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runDoctor } from '../src/doctor.mjs';
import { backupFileMarker } from '../src/migration.mjs';
import { backupIgnoreEntry } from '../src/planner.mjs';
import { formatPluginInstallSteps } from '../src/plugin-mode.mjs';
import { beforeRollbackSuffix } from '../src/rollback.mjs';
import { makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'workflow-kit.mjs');
const wk = (args, cwd = root) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });
const git = (target, ...args) => spawnSync('git', ['-C', target, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' });
const read = (target, relativePath) => fs.readFile(path.join(target, relativePath), 'utf8');
const backupsIn = async (target) => (await fs.readdir(target)).filter((name) => name.includes(backupFileMarker));
const porcelain = (target) => git(target, 'status', '--porcelain').stdout.trim();

// A repository with hand-written entrypoints, so init keeps backups of them.
async function installedRepo() {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, 'AGENTS.md'), 'my own agents file\n');
  await fs.writeFile(path.join(target, '.gitignore'), 'node_modules/\ndist/\n');
  const init = wk(['init', '--target', target, '--runtime', 'claude,codex', '--apply', '--yes']);
  assert.equal(init.status, 0, init.stderr);
  assert.ok((await backupsIn(target)).length > 0, 'init kept a backup of AGENTS.md');
  git(target, 'init', '-q');
  return target;
}

test('fix 2: init leaves no backup for git add -A, and the user lines stay', async () => {
  const target = await installedRepo();
  const gitignore = await read(target, '.gitignore');
  assert.ok(gitignore.startsWith('node_modules/\ndist/\n'));
  assert.ok(gitignore.includes(backupIgnoreEntry));
  git(target, 'add', '-A');
  assert.doesNotMatch(git(target, 'status', '--porcelain').stdout, /workflow-kit-backup/);
  assert.equal(git(target, 'check-ignore', '-q', `AGENTS.md${backupFileMarker}20260101T000000Z`).status, 0);
});

test('fix 2: an update that creates a backup keeps the working tree clean after a commit', async () => {
  const target = await installedRepo();
  git(target, 'add', '-A');
  assert.equal(git(target, 'commit', '-qm', 'install').status, 0);
  // A hand edit of a kit file: update decides it and keeps a backup.
  await fs.appendFile(path.join(target, '.agents', 'instructions.md'), '\nmy hand edit\n');
  const update = wk(['update', '--target', target, '--apply', '--yes', '--edited', 'all=discard']);
  assert.equal(update.status, 0, update.stdout + update.stderr);
  assert.ok((await backupsIn(path.join(target, '.agents'))).length > 0, 'the update kept a backup');
  assert.doesNotMatch(porcelain(target), /workflow-kit-backup/);
});

test('fix 2: an install made without the entry gets it once on update; user lines kept; idempotent; rollback restores .gitignore', async () => {
  const target = await installedRepo();
  const withEntry = await read(target, '.gitignore');
  const old = withEntry.split('\n').filter((line) => line !== backupIgnoreEntry).join('\n');
  const userLine = '# my own line\n*.log\n';
  await fs.writeFile(path.join(target, '.gitignore'), `${userLine}${old}`);
  const before = await read(target, '.gitignore');
  assert.doesNotMatch(before, /workflow-kit-backup/);

  const dry = wk(['update', '--target', target]);
  assert.match(dry.stdout, new RegExp(backupIgnoreEntry.replace(/[*.]/g, '\\$&')), 'the plan names the new entry');

  const update = wk(['update', '--target', target, '--apply', '--yes']);
  assert.equal(update.status, 0, update.stdout + update.stderr);
  const after = await read(target, '.gitignore');
  assert.ok(after.startsWith(before.trimEnd()), 'the user lines stay untouched');
  assert.equal(after.split('\n').filter((line) => line === backupIgnoreEntry).length, 1);

  const again = wk(['update', '--target', target, '--apply', '--yes']);
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.equal(await read(target, '.gitignore'), after, 'a second update changes nothing');

  // The journal now describes the second run (a no-op), so reinstate the first.
  await fs.writeFile(path.join(target, '.gitignore'), before);
  const third = wk(['update', '--target', target, '--apply', '--yes']);
  assert.equal(third.status, 0, third.stderr);
  assert.equal(await read(target, '.gitignore'), after);
  const rollback = wk(['rollback', '--target', target, '--apply', '--yes']);
  assert.equal(rollback.status, 0, rollback.stdout + rollback.stderr);
  assert.equal(await read(target, '.gitignore'), before, 'rollback returns .gitignore to its previous content');
});

test('fix 2: a line the user removed comes back on the next update (same rule as the other entries)', async () => {
  const target = await installedRepo();
  const gitignore = await read(target, '.gitignore');
  await fs.writeFile(path.join(target, '.gitignore'), gitignore.split('\n').filter((line) => line !== '.ai-work/' && line !== backupIgnoreEntry).join('\n'));
  assert.equal(wk(['update', '--target', target, '--apply', '--yes']).status, 0);
  const after = await read(target, '.gitignore');
  assert.ok(after.includes('.ai-work/') && after.includes(backupIgnoreEntry));
});

test('fix 2: doctor notices the missing backup pattern, with --target', async () => {
  const target = await installedRepo();
  assert.ok(!(await runDoctor({ targetPath: target })).diagnostics.some((item) => item.code === 'workspace/backups-not-ignored'));
  const gitignore = await read(target, '.gitignore');
  await fs.writeFile(path.join(target, '.gitignore'), gitignore.split('\n').filter((line) => line !== backupIgnoreEntry).join('\n'));
  const finding = (await runDoctor({ targetPath: target })).diagnostics.find((item) => item.code === 'workspace/backups-not-ignored');
  assert.ok(finding);
  assert.match(finding.message, /workflow-kit update --target \S+/);
});

test('fix 2: every backup and temporary name the CLI builds is covered by an ignore pattern', async () => {
  const manifest = JSON.parse(await read(root, '.agents/workflow-kit/manifest.json'));
  assert.deepEqual(manifest.ignore_entries, JSON.parse(await read(root, 'templates/repo-overlay-fhh-ia-ecosystem-full/.agents/workflow-kit/manifest.json')).ignore_entries);
  assert.ok(manifest.ignore_entries.includes(backupIgnoreEntry));
  // The names, built from the constants the code names them with.
  const stamp = '20260101T000000Z';
  const names = [`a.md${backupFileMarker}${stamp}`, `a.md${backupFileMarker}${stamp}${beforeRollbackSuffix}`, `a.md${backupFileMarker}${stamp}-2`];
  const target = await makeTempRepo();
  git(target, 'init', '-q');
  await fs.writeFile(path.join(target, '.gitignore'), `${manifest.ignore_entries.join('\n')}\n`);
  for (const name of names) assert.equal(git(target, 'check-ignore', '-q', name).status, 0, `${name} is ignored`);

  // Any ".workflow-kit-<word>-" name fragment in src needs a pattern: a new
  // kind of leftover file cannot ship without one.
  const fragments = new Set();
  for (const file of (await fs.readdir(path.join(root, 'src'), { recursive: true })).filter((name) => name.endsWith('.mjs'))) {
    for (const match of (await read(root, `src/${file}`)).matchAll(/\.workflow-kit-[a-z]+-/g)) fragments.add(match[0]);
  }
  assert.ok(fragments.has(backupFileMarker));
  for (const fragment of fragments) {
    const covered = [`${fragment}1`, `x${fragment}1`].every((name) => git(target, 'check-ignore', '-q', name).status === 0);
    assert.ok(covered || git(target, 'check-ignore', '-q', `${fragment}1`).status === 0, `${fragment} has an ignore pattern in the manifest`);
  }
});

test('fix 1: the install steps no longer say the commands fail and point to doctor with --target', async () => {
  const target = '/tmp/some repo';
  const text = formatPluginInstallSteps(['claude'], target);
  assert.doesNotMatch(text, /until then|these commands fail|only after/);
  assert.match(text, /may be older than this CLI until the maintainer publishes again/);
  assert.ok(text.includes("`workflow-kit doctor --target '/tmp/some repo'`"));
});

test('fix 1: init --mode plugin prints a doctor command that runs as printed from another folder', async () => {
  const target = await makeTempRepo();
  const init = wk(['init', '--target', target, '--mode', 'plugin', '--runtime', 'claude', '--apply', '--yes'], os.tmpdir());
  assert.equal(init.status, 0, init.stderr);
  assert.doesNotMatch(init.stdout, /until then these commands fail/);
  const printed = init.stdout.match(/run `workflow-kit doctor (--target \S+)` to check it/);
  assert.ok(printed, init.stdout);
  // The bare command name is not installed in the test; the arguments are the printed ones.
  const doctor = spawnSync(process.execPath, [bin, 'doctor', ...printed[1].split(' ')], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.ok(doctor.status === 0 || doctor.status === 1, doctor.stderr);
  assert.doesNotMatch(doctor.stderr, /unknown|required|usage/i);
});
