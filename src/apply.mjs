import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { rollbackCommand } from './plugin-mode.mjs';
import { assertNoSymlinkWrites, checksumOf, findSymlinkInPath, readFileNamed, temporaryFileMarker, temporaryPathFor, writeFileAtomic } from './fs-safety.mjs';

// Record of the last apply that wrote something. `workflow-kit rollback` reads
// it to undo exactly that run: restore backups (deleted files included),
// remove created files and folders and put the previous install-state back.
// It is written before the first write, with every file the run is about to
// touch, and marked completed at the end: a run stopped at any point (an
// error, Ctrl-C, SIGTERM or SIGKILL) leaves `completed: false`, which stops
// the next init or update until rollback undoes it. Each entry carries the
// checksum the file had before the run (`previousChecksum`), so rollback can
// tell a file the run never reached from one it wrote.
export const applyJournalRelativePath = '.agents/workflow-kit/last-apply.json';
export const applyJournalSchemaVersion = '2.0.0';
// Journal versions this CLI can read back (rollback, and the init/update gate).
export const readableApplyJournalVersions = new Set(['1.0.0', applyJournalSchemaVersion]);
const journalActions = new Set(['created', 'overwritten', 'deleted']);
const stringOrNull = (value) => value === null || typeof value === 'string';
// A journal path stays inside the target: relative, without a `..` segment.
const insideTarget = (value) => typeof value === 'string' && value !== '' && !/^([\\/]|[A-Za-z]:)/.test(value) && !value.split(/[\\/]+/).includes('..');

// Why rollback cannot trust a parsed journal: `version` (a format this CLI
// does not read), `entries` (files entries it cannot act on), or null.
// Shared by rollback and the init/update gate.
export function applyJournalProblem(journal) {
  if (journal === null || typeof journal !== 'object' || !readableApplyJournalVersions.has(journal.schemaVersion)) return 'version';
  const usable = Array.isArray(journal.files) && journal.files.every((entry) => entry !== null && typeof entry === 'object'
    && insideTarget(entry.relativePath) && journalActions.has(entry.action)
    && (entry.backup == null || insideTarget(entry.backup)) && stringOrNull(entry.writtenChecksum ?? null)
    && stringOrNull(entry.previousChecksum ?? null))
    // Written since 0.23.2: the folders the run created and its process id.
    && (journal.createdDirectories === undefined || (Array.isArray(journal.createdDirectories) && journal.createdDirectories.every(insideTarget)))
    && (journal.pid === undefined || Number.isInteger(journal.pid))
    && stringOrNull(journal.stateChecksum ?? null)
    && stringOrNull(journal.rollbackStartedAt ?? null);
  return usable ? null : 'entries';
}

// A retired kit file is removed only after a copy is kept next to it, even
// with --backup-mode none: the delete is what rollback has to undo.
const deleteOperations = new Set(['delete_with_backup']);
const writeWithBackupOperations = new Set(['overwrite_with_backup', 'merge_with_backup']);
const writeWithoutBackupOperations = new Set(['create', 'overwrite_no_backup', 'merge_no_backup']);
const nonWriteOperations = new Set(['unchanged', 'skip_modified', 'skip_unmanaged', 'adopt_existing']);

// One run at a time per target: a second apply or rollback on the same
// repository stops instead of interleaving its writes and backups. A lock
// left by a process that no longer runs (killed) is taken over.
export const applyLockRelativePath = '.agents/workflow-kit/apply.lock';
const lockRunKinds = new Set(['apply', 'rollback']);

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
}

async function exists(file) {
  try {
    await fs.lstat(file);
    return true;
  } catch {
    return false;
  }
}

// Two runs inside the same second would otherwise overwrite each other's
// backups. Move the stamp forward until no backup name of these files is taken.
export async function freeBackupStamp(targets, suffix = '') {
  const date = new Date();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const stamp = timestamp(date);
    const taken = await Promise.all(targets.map((target) => exists(`${target}.workflow-kit-backup-${stamp}${suffix}`)));
    if (!taken.some(Boolean)) return stamp;
    date.setSeconds(date.getSeconds() + 1);
  }
  throw new Error('Could not find a free backup name. Remove old *.workflow-kit-backup-* files and run again.');
}

// A path under a file (ENOTDIR) does not exist either; the write that needs
// that folder fails when it gets there, after the journal lists the run.
async function readIfPresent(file) {
  try {
    return await readFileNamed(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

const toRelative = (targetPath, absolute) => path.relative(targetPath, absolute).split(path.sep).join('/');

// The folders above `directory` (inside the target, the target excluded) that
// do not exist yet, outermost first, as "/" paths.
export async function missingDirectories(targetPath, directory) {
  const root = path.resolve(targetPath);
  const missing = [];
  let current = path.resolve(directory);
  while (current.startsWith(`${root}${path.sep}`)) {
    if (await exists(current)) break;
    missing.unshift(toRelative(root, current));
    current = path.dirname(current);
  }
  return missing;
}

// Removes the folders a run created, deepest first, when they are empty
// (never recursive, never through a symbolic link).
export async function removeCreatedDirectories(targetPath, relativeDirectories) {
  const deepestFirst = [...new Set(relativeDirectories)].sort((a, b) => b.split('/').length - a.split('/').length || b.localeCompare(a));
  for (const relativeDirectory of deepestFirst) {
    try {
      if (await findSymlinkInPath(targetPath, relativeDirectory)) continue;
      await fs.rmdir(path.join(targetPath, relativeDirectory));
    } catch {
      // Not empty (or already gone): it stays.
    }
  }
}

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

// When this process started (milliseconds since the epoch), recorded in the
// lock so a later run can tell the holder from another process that reused
// its id.
const processStartedAt = () => Math.round(Date.now() - process.uptime() * 1000);

// When a running process started, by `ps` (macOS, Linux, BSD), or null when
// that cannot be read (Windows, no ps).
function startOfRunningProcess(pid) {
  if (process.platform === 'win32') return null;
  const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C', LANG: 'C' } });
  if (result.status !== 0) return null;
  const started = Date.parse(String(result.stdout).trim());
  return Number.isNaN(started) ? null : started;
}

// The folders a lock says its run created (`createdDirectories`): relative
// "/" paths without an empty, `.` or `..` segment, and no more than a journal
// would list. An apply lock can only have created the folders above the lock
// file before its journal exists, so it may name no others. A rollback lock
// also names the folders of the journal it is removing; it never names `.git`.
// Anything else makes the whole list empty: the lock stays usable, but
// nothing it names is ever removed.
const lockedKinds = new Set(['apply', 'rollback']);
const lockAncestors = (() => {
  const segments = path.posix.dirname(applyLockRelativePath).split('/');
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'));
})();
function lockedDirectories(value, kind) {
  const valid = lockedKinds.has(kind) && Array.isArray(value) && value.length <= 200 && value.every((entry) => typeof entry === 'string' && entry.length <= 500
    && !/[\\\0]/.test(entry) && entry.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
    && (kind === 'apply' ? lockAncestors.includes(entry) : entry.split('/')[0].toLowerCase() !== '.git'));
  return valid ? [...new Set(value)] : [];
}

// The lock as a trusted holder, or null when it cannot be read or is not
// valid: the process id must be a positive integer and the start time, when
// present, a date. Nothing else of the file is ever repeated in a message (a
// stale or hand-written lock may hold anything), so the start time is
// returned normalized.
async function readLock(lockPath) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(lockPath, 'utf8'));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || !Number.isSafeInteger(parsed.pid) || parsed.pid <= 0) return null;
  const holder = { pid: parsed.pid, createdDirectories: lockedDirectories(parsed.createdDirectories, parsed.kind) };
  if (lockedKinds.has(parsed.kind)) holder.kind = parsed.kind;
  if (Number.isFinite(parsed.processStartedAt)) holder.processStartedAt = parsed.processStartedAt;
  if (parsed.startedAt !== undefined) {
    const startedAt = typeof parsed.startedAt === 'string' ? new Date(parsed.startedAt) : null;
    if (startedAt === null || Number.isNaN(startedAt.getTime())) return null;
    holder.startedAt = startedAt.toISOString();
  }
  return holder;
}

// A folder where the lock file goes. The kit never deletes it, even when it
// is empty: it is not something the kit made.
async function lockPathIsFolder(targetPath) {
  try {
    return (await fs.lstat(path.join(targetPath, applyLockRelativePath))).isDirectory();
  } catch {
    return false;
  }
}
export const lockFolderMessage = (targetPath) => `There is a folder where the lock file goes (${path.join(targetPath, applyLockRelativePath)}). workflow-kit does not delete it: remove that folder by hand, then run this command again. Nothing was written.`;
const lockFolderError = (targetPath) => Object.assign(new Error(lockFolderMessage(targetPath)), { code: 'WORKFLOW_KIT_LOCK_IS_FOLDER' });

// Stops when the lock path is a folder.
export async function assertLockIsNotFolder(targetPath) {
  if (await lockPathIsFolder(targetPath)) throw lockFolderError(targetPath);
}

// The lock, its temporary files and the folders above it are never reached
// through a symbolic link: the kit would delete inside another folder.
export async function assertLockPathNotSymlinked(targetPath) {
  const link = await findSymlinkInPath(targetPath, applyLockRelativePath);
  if (link) throw Object.assign(new Error(`${link} is a symbolic link, and workflow-kit will not write or delete through symbolic links (the lock and the files a stopped run left would be changed behind it). Replace the link with a real folder, then run this command again. Nothing was changed.`), { code: 'WORKFLOW_KIT_LOCK_SYMLINK' });
}

// A lock is stale when what it names cannot be a running workflow-kit: it
// cannot be read (the lock is written whole, so only a crash of an older
// version leaves it so), its process is gone, or the process with that id
// started at another time (the id was reused).
function lockIsStale(holder) {
  if (!holder || !Number.isInteger(holder.pid)) return true;
  if (!processIsRunning(holder.pid)) return true;
  if (!Number.isFinite(holder.processStartedAt)) return false;
  const started = startOfRunningProcess(holder.pid);
  // ps shows whole seconds.
  return started !== null && Math.abs(started - holder.processStartedAt) > 2000;
}

// The way out when the user knows no workflow-kit runs (the lock cannot be
// proved stale: an older lock without its process start time, or a system
// where that time cannot be read).
export const clearLockAdvice = `If you are sure no workflow-kit command is running on this repository (for example after a crash), remove ${applyLockRelativePath} and run again.`;
const lockedError = (holder) => Object.assign(new Error(`Another workflow-kit run is changing this repository (process ${holder.pid}, started ${holder.startedAt ?? 'at an unknown time'}; ${applyLockRelativePath} exists). Wait for it to finish, then run this command again. ${clearLockAdvice} Nothing was written.`), { code: 'WORKFLOW_KIT_LOCKED' });

// What doctor reports about the lock: null without one; otherwise its
// process id, when it was taken, its age in seconds and whether it is stale
// (the next run takes a stale lock over by itself).
export async function describeTargetLock(targetPath, now = Date.now()) {
  const lockPath = path.join(targetPath, applyLockRelativePath);
  if (!(await exists(lockPath))) return null;
  if (await lockPathIsFolder(targetPath)) {
    return { relativePath: applyLockRelativePath, pid: null, startedAt: null, ageSeconds: null, stale: false, folder: true, message: lockFolderMessage(targetPath) };
  }
  const holder = await readLock(lockPath);
  const takenAt = Date.parse(holder?.startedAt ?? '');
  const ageSeconds = Number.isNaN(takenAt) ? null : Math.max(0, Math.round((now - takenAt) / 1000));
  const stale = lockIsStale(holder);
  return {
    relativePath: applyLockRelativePath,
    pid: holder?.pid ?? null,
    startedAt: holder?.startedAt ?? null,
    ageSeconds,
    stale,
    message: stale
      ? (holder && lockRunKinds.has(holder.kind)
        ? `${applyLockRelativePath} was left by a workflow-kit ${holder.kind} run that was stopped before it finished (process ${holder.pid}). To clean it up, run ${rollbackCommand(path.resolve(targetPath))}: it removes what that run left behind and does not undo an apply that finished. The next apply takes the lock over by itself.`
        : `${applyLockRelativePath} ${holder ? `was left by a workflow-kit run that no longer runs (process ${holder.pid})` : 'cannot be read or is not valid (no usable process id or start time)'}; the next apply or rollback takes it over.`)
      : `${applyLockRelativePath} is held by process ${holder.pid}${ageSeconds === null ? '' : `, taken ${ageSeconds} s ago`}: a workflow-kit run is changing this repository. ${clearLockAdvice}`
  };
}

// The run that holds the target right now, or null (no lock, or a stale one).
export async function targetLockHolder(targetPath) {
  const lockPath = path.join(targetPath, applyLockRelativePath);
  if (!(await exists(lockPath))) return null;
  const holder = await readLock(lockPath);
  return lockIsStale(holder) ? null : holder;
}

// The lock a run that no longer runs left, as far as it is a trusted record
// of an unfinished run: { kind, pid, startedAt, createdDirectories }, or null
// (no lock, a lock still held, or one that does not say what run made it).
// Rollback uses it to clean up after a run that was killed.
export async function staleLockRecord(targetPath) {
  const lockPath = path.join(targetPath, applyLockRelativePath);
  if (!(await exists(lockPath)) || await lockPathIsFolder(targetPath)) return null;
  const holder = await readLock(lockPath);
  if (!holder || !holder.kind || typeof holder.startedAt !== 'string' || !lockIsStale(holder)) return null;
  return { kind: holder.kind, pid: holder.pid, startedAt: holder.startedAt, createdDirectories: holder.createdDirectories };
}

// Whether `journal` was written by the run that took the lock `record`: the
// same process, after it took the lock. A journal of an earlier run (the
// previous finished apply) is not, and a lock whose run died before its first
// journal write left nothing to undo.
export function journalBelongsToLock(journal, record) {
  const appliedAt = Date.parse(journal?.appliedAt ?? '');
  return journal?.pid === record.pid && !Number.isNaN(appliedAt) && appliedAt >= Date.parse(record.startedAt);
}

// Stops when a run that is still going holds the target.
export async function assertTargetNotLocked(targetPath) {
  await assertLockIsNotFolder(targetPath);
  const holder = await targetLockHolder(targetPath);
  if (holder) throw lockedError(holder);
}

const lockWriteError = (error) => new Error(`Cannot write ${applyLockRelativePath} (${error.code ?? error.message}): workflow-kit writes there while it changes the repository. Make .agents/workflow-kit/ writable, then run this command again. Nothing was written.`);

// Takes the target's lock or stops. The lock is written to a temporary file
// and linked into place, so it is never seen half-written; a stale one is
// taken over. The lock records what kind of run holds it and the folders that
// run made (and, for a rollback, the ones it is about to remove: `record`), so
// a run killed before its journal exists, or after the journal is gone, can
// still be cleaned up by the next rollback. A stale lock's own record is
// adopted, so the next run cleans those folders too. Returns the folders made
// for it and the function that releases it (and removes those folders, when
// they stay empty).
export async function acquireTargetLock(targetPath, { kind = 'apply', record = [] } = {}) {
  const lockPath = path.join(targetPath, applyLockRelativePath);
  await assertLockPathNotSymlinked(targetPath);
  const own = await missingDirectories(targetPath, path.dirname(lockPath));
  const recorded = new Set([...own, ...lockedDirectories(record, 'rollback')]);
  const temporary = temporaryPathFor(lockPath);
  const startedAt = new Date().toISOString();
  const lockContent = () => `${JSON.stringify({ pid: process.pid, processStartedAt: processStartedAt(), startedAt, kind, createdDirectories: [...recorded].sort() })}\n`;
  await assertLockIsNotFolder(targetPath);
  try {
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await fs.writeFile(temporary, lockContent());
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    if (error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'EROFS') throw lockWriteError(error);
    throw error;
  }
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await linkExclusive(temporary, lockPath);
        const createdDirectories = [...recorded].sort();
        const release = async () => {
          await fs.rm(lockPath, { force: true });
          await removeCreatedDirectories(targetPath, createdDirectories);
        };
        return { release, createdDirectories };
      } catch (error) {
        if (error.code !== 'EEXIST') {
          if (error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'EROFS') throw lockWriteError(error);
          throw error;
        }
        await assertLockIsNotFolder(targetPath);
        const holder = await readLock(lockPath);
        if (!lockIsStale(holder)) throw lockedError(holder);
        // What the dead run made is this run's to clean up now.
        // Only an apply lock's folders (the ones above the lock file) are
        // adopted here; a rollback's own record is passed in by the rollback.
        if (holder?.kind === 'apply') {
          for (const folder of holder.createdDirectories) recorded.add(folder);
          await fs.writeFile(temporary, lockContent());
        }
        await fs.rm(lockPath, { force: true });
      }
    }
    throw new Error(`Could not take ${applyLockRelativePath}. Run this command again. Nothing was written.`);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

// Exclusive create of `target` with the content of `source`: a hard link
// fails when the target exists. A file system without hard links gets an
// exclusive copy instead.
async function linkExclusive(source, target) {
  try {
    await fs.link(source, target);
  } catch (error) {
    if (!['EPERM', 'ENOTSUP', 'EXDEV', 'ENOSYS'].includes(error.code)) throw error;
    await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL);
  }
}

// The temporary files a killed run left in .agents/workflow-kit/ (its
// journal, its state, its lock). Called under the lock, so no other run is
// writing them.
export async function findTemporaryLeftovers(targetPath, folders = [path.dirname(applyLockRelativePath)]) {
  const found = [];
  for (const folder of new Set(folders)) {
    let names;
    try {
      names = await fs.readdir(path.join(targetPath, folder));
    } catch {
      continue;
    }
    for (const name of names) {
      if (!/^\d+$/.test(name.slice(temporaryFileMarker.length)) || !name.startsWith(temporaryFileMarker) || name === `${temporaryFileMarker}${process.pid}`) continue;
      if ((await fs.lstat(path.join(targetPath, folder, name))).isFile()) found.push(path.posix.join(folder.split(path.sep).join('/'), name));
    }
  }
  return found;
}

export async function removeTemporaryLeftovers(targetPath, folders = [path.dirname(applyLockRelativePath)]) {
  for (const relative of await findTemporaryLeftovers(targetPath, folders)) await fs.rm(path.join(targetPath, relative), { force: true });
}

// The state as the apply writes it, or null when it would only change
// `generatedAt`: a run with nothing else to change leaves the file as it is.
function stateContentToWrite(nextInstallState, previousRaw) {
  const fresh = `${JSON.stringify(nextInstallState, null, 2)}\n`;
  if (previousRaw === null) return fresh;
  let previous;
  try {
    previous = JSON.parse(previousRaw);
  } catch {
    return fresh;
  }
  if (typeof previous?.generatedAt !== 'string') return fresh;
  const unchanged = `${JSON.stringify({ ...nextInstallState, generatedAt: previous.generatedAt }, null, 2)}\n`;
  return unchanged === previousRaw ? null : fresh;
}

// Raised between two files when the run was asked to stop (Ctrl-C, SIGTERM).
export const interruptedCode = 'WORKFLOW_KIT_INTERRUPTED';

// Under the lock, the target must still be what the plan read: another run
// that planned before this one, or applied (or rolled back) in between, would
// otherwise have its journal replaced or undone from an old plan, and could
// no longer be rolled back. `observed` holds the checksums of install-state
// and of the journal as planning read them (plans built by hand carry none).
export async function assertObservedUnchanged(observed, targetPath, stateFilePath) {
  if (!observed) return;
  const changed = (relative) => Object.assign(new Error(`${relative} changed after this plan was made: another workflow-kit run changed this repository in between. Run this command again to plan from the repository as it is now. Nothing was written.`), { code: 'WORKFLOW_KIT_PLAN_STALE' });
  const checksumOrNull = (raw) => (raw === null ? null : checksumOf(raw));
  if (checksumOrNull(await readIfPresent(path.join(targetPath, applyJournalRelativePath))) !== observed.journal) throw changed(applyJournalRelativePath);
  if (stateFilePath && checksumOrNull(await readIfPresent(stateFilePath)) !== observed.installState) throw changed(path.relative(targetPath, stateFilePath).split(path.sep).join('/'));
}

// A journal whose run did not finish, or whose rollback started and did not
// finish: what the next init or update has to stop on (shared with the
// planner gate and doctor through lastApplyProblem). Null for a finished run.
export function unfinishedJournalMessage(journal, targetPath) {
  const rollbackAgain = rollbackCommand(targetPath);
  if (typeof journal?.rollbackStartedAt === 'string') {
    return `A workflow-kit rollback of the apply of ${journal.appliedAt ?? 'unknown date'} started (${journal.rollbackStartedAt}) and did not finish, so the repository is partly rolled back. Run ${rollbackAgain} again to finish it`;
  }
  if (journal?.completed === false) return `The last workflow-kit apply did not finish (${journal.appliedAt ?? 'unknown date'}). Run ${rollbackAgain} first`;
  return null;
}

async function assertTargetAsPlanned(plan, journalPath) {
  if (plan.targetPath) await assertObservedUnchanged(plan.observed, path.resolve(plan.targetPath), plan.stateFilePath);
  if (!journalPath) return;
  let journal;
  try {
    journal = JSON.parse(await readIfPresent(journalPath));
  } catch {
    return;
  }
  const unfinished = unfinishedJournalMessage(journal, plan.targetPath ? path.resolve(plan.targetPath) : undefined);
  if (unfinished) throw new Error(`${unfinished}, then run this command again. Nothing was written.`);
}

// What planning read of install-state and the journal, for the check above.
export async function observeTarget(targetPath, stateFilePath) {
  const checksumOrNull = (raw) => (raw === null ? null : checksumOf(raw));
  return {
    installState: checksumOrNull(await readIfPresent(stateFilePath)),
    journal: checksumOrNull(await readIfPresent(path.join(targetPath, applyJournalRelativePath)))
  };
}

const backupNameOf = (targetFile, stamp) => `${targetFile}.workflow-kit-backup-${stamp}`;

async function copyBackup(source, backupPath, targetPath) {
  try {
    await fs.copyFile(source, backupPath, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`${backupPath} appeared while this run was writing, so it was not overwritten. Another program is writing to this repository: stop it, then run ${rollbackCommand(targetPath)} and run this command again.`);
  }
}

// `signal` (an AbortSignal) stops the run between two files.
export async function applyInstallPlan(plan, { signal } = {}) {
  const knownOperations = [nonWriteOperations, writeWithBackupOperations, writeWithoutBackupOperations, deleteOperations];
  for (const item of plan.operations) {
    if (!knownOperations.some((operations) => operations.has(item.operation))) {
      throw new Error(`Unsupported operation: ${item.operation}`);
    }
  }

  // The plan was checked when it was built; the repository may have changed
  // since, so check again right before writing.
  if (plan.targetPath) {
    await assertNoSymlinkWrites(plan.targetPath, plan.operations);
  }

  const targetPath = plan.targetPath ? path.resolve(plan.targetPath) : null;
  const journaled = plan.recordJournal !== false && targetPath !== null;
  const journalPath = targetPath ? path.join(targetPath, applyJournalRelativePath) : null;
  const stateChanges = (previousRaw) => (plan.stateFilePath && plan.nextInstallState ? stateContentToWrite(plan.nextInstallState, previousRaw) : null);
  // Nothing the plan could write: no lock, no journal, the previous journal stays.
  if (plan.operations.every((item) => nonWriteOperations.has(item.operation))
    && stateChanges(plan.stateFilePath ? await readIfPresent(plan.stateFilePath) : null) === null) {
    return plan.operations.map((item) => ({ ...item, applied: false }));
  }

  // Everything below runs under the target's lock: what the plan read is
  // checked again, then every file is read and the journal written before
  // the first write.
  const lock = targetPath ? await acquireTargetLock(targetPath) : { release: async () => {}, createdDirectories: [] };
  try {
    if (targetPath) await removeTemporaryLeftovers(targetPath);
    await assertTargetAsPlanned(plan, journalPath);

    // What each write does, decided before the first one, so the journal can
    // list it first. A write planned without a backup replaces only what the
    // plan saw: content that appeared or changed since then is kept as a
    // backup. A delete happens only while the file still has the content the
    // plan chose to delete.
    const steps = [];
    for (const item of plan.operations) {
      if (nonWriteOperations.has(item.operation)) {
        steps.push({ item, kind: 'skip' });
        continue;
      }
      const current = await readIfPresent(item.targetFile);
      const previousChecksum = current === null ? null : checksumOf(current);
      if (deleteOperations.has(item.operation)) {
        steps.push({ item, kind: previousChecksum === item.recordedChecksum ? 'delete' : 'changed', previousChecksum });
        continue;
      }
      const changedSincePlan = Object.hasOwn(item, 'planChecksum') && current !== null && previousChecksum !== item.planChecksum;
      // A file a backup write expected and someone removed since: written as new.
      const backup = current !== null && (writeWithBackupOperations.has(item.operation) || changedSincePlan);
      steps.push({ item, kind: 'write', backup, previousChecksum });
    }
    for (const step of steps.filter((entry) => entry.kind === 'changed')) markChangedSincePlan(plan, step.item, step.previousChecksum === null);

    const writes = steps.filter((step) => step.kind === 'write' || step.kind === 'delete');
    const previousStateRaw = plan.stateFilePath ? await readIfPresent(plan.stateFilePath) : null;
    const results = () => steps.map((step) => step.result ?? { ...step.item, applied: false, ...(step.kind === 'changed' ? { reason: 'changed_since_plan' } : {}) });
    if (writes.length === 0 && stateChanges(previousStateRaw) === null) return results();

    const backupStamp = await freeBackupStamp(writes.map((step) => step.item.targetFile));
    const createdDirectories = new Set(lock.createdDirectories);
    if (targetPath) {
      const folders = [...writes.filter((step) => step.kind === 'write').map((step) => path.dirname(step.item.targetFile)), ...(plan.stateFilePath ? [path.dirname(plan.stateFilePath)] : []), ...(journaled ? [path.dirname(journalPath)] : [])];
      for (const folder of new Set(folders)) for (const relative of await missingDirectories(targetPath, folder)) createdDirectories.add(relative);
    }

    const entryOf = (step) => {
      const { item } = step;
      step.backupPath = step.kind === 'delete' || step.backup ? backupNameOf(item.targetFile, backupStamp) : null;
      return {
        relativePath: item.relativePath,
        action: step.kind === 'delete' ? 'deleted' : step.previousChecksum === null ? 'created' : 'overwritten',
        backup: step.backupPath && targetPath ? toRelative(targetPath, step.backupPath) : null,
        writtenChecksum: step.kind === 'delete' ? null : checksumOf(item.content),
        previousChecksum: step.previousChecksum
      };
    };
    for (const step of writes) step.entry = entryOf(step);
    const journal = {
      schemaVersion: applyJournalSchemaVersion,
      appliedAt: new Date().toISOString(),
      backupStamp,
      mode: plan.mode ?? 'init',
      toolkitVersion: plan.toolkitVersion ?? null,
      completed: false,
      // Set (and saved) right before the state is written.
      stateWritten: false,
      previousInstallState: previousStateRaw,
      pid: process.pid,
      createdDirectories: [...createdDirectories].sort(),
      files: writes.map((step) => step.entry)
    };
    const saveJournal = async () => {
      if (!journaled) return;
      await fs.mkdir(path.dirname(journalPath), { recursive: true });
      await writeFileAtomic(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    };
    await saveJournal();

    for (const step of writes) {
      if (signal?.aborted) {
        throw Object.assign(new Error(`Interrupted before ${step.item.relativePath}: the run stopped between two files. Run ${rollbackCommand(targetPath)} to undo what it wrote.`), { code: interruptedCode });
      }
      const { item } = step;
      if (step.kind === 'delete') {
        // Changed since the run started: it stays, and leaves the journal.
        const current = await readIfPresent(item.targetFile);
        if (current === null || checksumOf(current) !== item.recordedChecksum) {
          journal.files = journal.files.filter((entry) => entry !== step.entry);
          await saveJournal();
          markChangedSincePlan(plan, item, current === null);
          step.result = { ...item, applied: false, reason: 'changed_since_plan' };
          continue;
        }
        // The backup stays next to the deleted file, so its directory stays.
        await copyBackup(item.targetFile, step.backupPath, targetPath);
        await fs.rm(item.targetFile);
        step.result = { ...item, applied: true, backupPath: step.backupPath };
        continue;
      }

      await fs.mkdir(path.dirname(item.targetFile), { recursive: true });
      if (!step.backup) {
        // Content that appeared or changed since the run started is kept too.
        const current = await readIfPresent(item.targetFile);
        if (current !== null && checksumOf(current) !== step.previousChecksum) {
          step.backup = true;
          step.previousChecksum = checksumOf(current);
          Object.assign(step.entry, entryOf(step));
          await saveJournal();
        }
      }
      if (step.backup) await copyBackup(item.targetFile, step.backupPath, targetPath);
      await writeFileAtomic(item.targetFile, item.content);
      // A moved file keeps its permission bits (an executable script stays executable).
      if (item.mode !== undefined) await fs.chmod(item.targetFile, item.mode);
      step.result = { ...item, applied: true, backupPath: step.backupPath };
    }

    const stateContent = stateChanges(previousStateRaw);
    if (stateContent !== null) {
      journal.stateWritten = true;
      // What rollback expects to find there: a state edited after the run is
      // kept as a copy before the previous one comes back.
      journal.stateChecksum = checksumOf(stateContent);
      await saveJournal();
      await fs.mkdir(path.dirname(plan.stateFilePath), { recursive: true });
      await writeFileAtomic(plan.stateFilePath, stateContent);
    } else if (plan.nextInstallState && previousStateRaw !== null) {
      // Kept as it is: the plan describes the state on disk.
      plan.nextInstallState.generatedAt = JSON.parse(previousStateRaw).generatedAt;
    }
    journal.completed = true;
    await saveJournal();
    return results();
  } finally {
    await lock.release();
  }
}

// Edited since the plan: it is no longer the unedited kit file the plan
// chose to delete, so it stays and, when it is a retired kit file, is
// recorded as retired (a moved project file never is). Gone since the plan:
// only its record goes away.
function markChangedSincePlan(plan, item, gone) {
  if (!item.retired || !plan.nextInstallState?.files) return;
  if (gone) delete plan.nextInstallState.files[item.relativePath];
  else plan.nextInstallState.files[item.relativePath] = { sha256: item.recordedChecksum, class: item.class, retired: true };
}
