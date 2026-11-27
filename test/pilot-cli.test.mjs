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
import { backupIgnoreEntry, gitignoreHasBackupEntry } from '../src/planner.mjs';
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

const kitHeader = '# workflow-kit local state (stays on this machine)';
const withoutBackupEntry = (text) => text.split('\n').filter((line) => line !== backupIgnoreEntry).join('\n');

test('repair 1: a symbolic-link .gitignore does not stop update; the note names the lines; link and target are never written; doctor still warns', async () => {
  const target = await installedRepo();
  const ignore = path.join(target, '.gitignore');
  await fs.writeFile(path.join(target, 'real-ignore'), withoutBackupEntry(await read(target, '.gitignore')));
  await fs.rm(ignore);
  await fs.symlink('real-ignore', ignore);
  const before = await read(target, 'real-ignore');

  const dry = wk(['update', '--target', target]);
  assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  assert.match(dry.stdout, /^Note: \.gitignore is a symbolic link.*\*\.workflow-kit-backup-\*.*add them/im);
  assert.doesNotMatch(dry.stdout + dry.stderr, /Refusing to write or delete through symbolic links/);

  const apply = wk(['update', '--target', target, '--apply', '--yes']);
  assert.equal(apply.status, 0, apply.stdout + apply.stderr);
  assert.equal(apply.stdout.split('\n').filter((line) => line.startsWith('Note: .gitignore is a symbolic link')).length, 2, 'the plan and the apply summary both carry the note');
  assert.ok((await fs.lstat(ignore)).isSymbolicLink(), 'the link stays a link');
  assert.equal(await fs.readlink(ignore), 'real-ignore');
  assert.equal(await read(target, 'real-ignore'), before, 'its target is not written');

  const finding = (await runDoctor({ targetPath: target })).diagnostics.find((item) => item.code === 'workspace/backups-not-ignored');
  assert.ok(finding, 'doctor keeps reporting the missing entry');
});

test('repair 1: init meets the same linked .gitignore the same way (it was the same raw refusal before)', async () => {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, 'real-ignore'), 'node_modules/\n');
  await fs.symlink('real-ignore', path.join(target, '.gitignore'));
  const init = wk(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes']);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  assert.match(init.stdout, /Note: \.gitignore is a symbolic link.*\.ai-work\//);
  assert.equal(await read(target, 'real-ignore'), 'node_modules/\n');
  assert.ok((await fs.lstat(path.join(target, '.gitignore'))).isSymbolicLink());
});

test('repair 2: an install that has the kit block gets the new entry inside it, with no second header', async () => {
  const target = await installedRepo();
  const installed = await read(target, '.gitignore');
  const old = `${withoutBackupEntry(installed).trimEnd()}\n\n# my own\nfoo/\n`;
  await fs.writeFile(path.join(target, '.gitignore'), old);
  assert.equal(wk(['update', '--target', target, '--apply', '--yes']).status, 0);
  const after = await read(target, '.gitignore');
  assert.equal(after.split('\n').filter((line) => line === kitHeader).length, 1);
  const lines = after.split('\n');
  assert.equal(lines[lines.indexOf('.workflow-kit-tmp-*') + 1], backupIgnoreEntry, 'right after the last line of the block');
  assert.equal(after.replace(`${backupIgnoreEntry}\n`, ''), old, 'nothing else moved');
  assert.equal(wk(['update', '--target', target, '--apply', '--yes']).status, 0);
  assert.equal(await read(target, '.gitignore'), after, 'idempotent');
});

test('repair 2: a CRLF .gitignore gets CRLF lines; a block at the end of a file without a final newline is extended', async () => {
  const target = await installedRepo();
  const crlf = withoutBackupEntry(await read(target, '.gitignore')).replace(/\n/g, '\r\n');
  await fs.writeFile(path.join(target, '.gitignore'), crlf);
  assert.equal(wk(['update', '--target', target, '--apply', '--yes']).status, 0);
  const after = await read(target, '.gitignore');
  assert.ok(after.includes(`${backupIgnoreEntry}\r\n`));
  assert.equal(after.replace(/\r\n/g, '').includes('\n'), false, 'no bare LF in a CRLF file');

  await fs.writeFile(path.join(target, '.gitignore'), withoutBackupEntry(await read(target, '.gitignore')).trimEnd().replace(/\r/g, ''));
  assert.equal(wk(['update', '--target', target, '--apply', '--yes']).status, 0);
  const noFinalNewline = await read(target, '.gitignore');
  assert.ok(noFinalNewline.trimEnd().endsWith(backupIgnoreEntry));
  assert.equal(noFinalNewline.split('\n').filter((line) => line === kitHeader).length, 1);
});

test('repair 2: without the kit header the block is appended as before', async () => {
  const target = await installedRepo();
  await fs.writeFile(path.join(target, '.gitignore'), '*.log\n.ai-work/\n');
  assert.equal(wk(['update', '--target', target, '--apply', '--yes']).status, 0);
  const after = await read(target, '.gitignore');
  assert.ok(after.startsWith(`*.log\n.ai-work/\n\n${kitHeader}\n`));
});

test('repair 5: the backup entry check reads the file as git does', () => {
  assert.equal(gitignoreHasBackupEntry('**/*.workflow-kit-backup-*\n'), true, '**/ form is accepted');
  assert.equal(gitignoreHasBackupEntry('*.workflow-kit-backup-*\n'), true);
  assert.equal(gitignoreHasBackupEntry('/*.workflow-kit-backup-*\n'), false, 'anchored to the root: nested backups are not ignored');
  assert.equal(gitignoreHasBackupEntry('*.workflow-kit-backup-*\n!*.workflow-kit-backup-*\n'), false, 'a later negation takes it back');
  assert.equal(gitignoreHasBackupEntry('!*.workflow-kit-backup-*\n*.workflow-kit-backup-*\n'), true, 'the entry after a negation wins');
});
