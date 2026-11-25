import fs from 'node:fs/promises';
import path from 'node:path';
import { assertNoSymlinkWrites, checksumOf, writeFileAtomic } from './fs-safety.mjs';

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
    // Written by versions after 0.23.0: the folders the run created and its process id.
    && (journal.createdDirectories === undefined || (Array.isArray(journal.createdDirectories) && journal.createdDirectories.every(insideTarget)))
    && (journal.pid === undefined || Number.isInteger(journal.pid));
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
    return await fs.readFile(file, 'utf8');
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

// Removes the folders a run created, deepest first, when they are empty.
export async function removeCreatedDirectories(targetPath, relativeDirectories) {
  const deepestFirst = [...new Set(relativeDirectories)].sort((a, b) => b.split('/').length - a.split('/').length || b.localeCompare(a));
  for (const relativeDirectory of deepestFirst) {
    try {
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

async function readLock(lockPath) {
  try {
    const parsed = JSON.parse(await fs.readFile(lockPath, 'utf8'));
    return parsed !== null && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

const lockedError = (holder) => {
  const who = holder ? `process ${holder.pid}, started ${holder.startedAt ?? 'at an unknown time'}` : 'its lock is being written';
  return Object.assign(new Error(`Another workflow-kit run is changing this repository (${who}; ${applyLockRelativePath} exists). Wait for it to finish, then run this command again. If no workflow-kit command is running, remove ${applyLockRelativePath} and run again. Nothing was written.`), { code: 'WORKFLOW_KIT_LOCKED' });
};

// Stops when a run that is still going holds the target. Planning checks it
// first, so a second run is not told to roll back a run that is still
// writing (its journal says it did not finish yet).
export async function assertTargetNotLocked(targetPath) {
  const lockPath = path.join(targetPath, applyLockRelativePath);
  if (!(await exists(lockPath))) return;
  const holder = await readLock(lockPath);
  if (holder && !processIsRunning(holder.pid)) return;
  throw lockedError(holder);
}

// Takes the target's lock or stops. Returns the function that releases it
// (and removes the folders made only for it, when they stay empty).
export async function acquireTargetLock(targetPath) {
  const lockPath = path.join(targetPath, applyLockRelativePath);
  const createdDirectories = await missingDirectories(targetPath, path.dirname(lockPath));
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  const content = `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await fs.writeFile(lockPath, content, { flag: 'wx' });
      return async () => {
        await fs.rm(lockPath, { force: true });
        await removeCreatedDirectories(targetPath, createdDirectories);
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const holder = await readLock(lockPath);
      if (holder && !processIsRunning(holder.pid)) {
        await fs.rm(lockPath, { force: true });
        continue;
      }
      throw lockedError(holder);
    }
  }
  throw new Error(`Could not take ${applyLockRelativePath}. Run this command again. Nothing was written.`);
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

// An apply journal that says its run did not finish, read under the lock: a
// run that started after this one planned and was stopped halfway.
async function assertNoUnfinishedJournal(journalPath) {
  let journal;
  try {
    journal = JSON.parse(await readIfPresent(journalPath));
  } catch {
    return;
  }
  if (journal?.completed === false) {
    throw new Error(`The last workflow-kit apply did not finish (${journal.appliedAt ?? 'unknown date'}). Run \`workflow-kit rollback --apply --yes\` first, then run this command again. Nothing was written.`);
  }
}

const backupNameOf = (targetFile, stamp) => `${targetFile}.workflow-kit-backup-${stamp}`;

async function copyBackup(source, backupPath) {
  try {
    await fs.copyFile(source, backupPath, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`${backupPath} appeared while this run was writing, so it was not overwritten. Another program is writing to this repository: stop it, then run \`workflow-kit rollback --apply --yes\` and run this command again.`);
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
  const stateChanges = () => (plan.stateFilePath && plan.nextInstallState ? stateContentToWrite(plan.nextInstallState, previousStateRaw) : null);
  const results = () => steps.map((step) => step.result ?? { ...step.item, applied: false, ...(step.kind === 'changed' ? { reason: 'changed_since_plan' } : {}) });
  // Nothing to write: no lock, no journal, the previous journal stays.
  if (writes.length === 0 && stateChanges() === null) return results();

  const targetPath = plan.targetPath ? path.resolve(plan.targetPath) : null;
  const journaled = plan.recordJournal !== false && targetPath !== null;
  const journalPath = targetPath ? path.join(targetPath, applyJournalRelativePath) : null;
  const backupStamp = await freeBackupStamp(writes.map((step) => step.item.targetFile));
  const createdDirectories = new Set();
  if (targetPath) {
    const folders = [...writes.filter((step) => step.kind === 'write').map((step) => path.dirname(step.item.targetFile)), ...(plan.stateFilePath ? [path.dirname(plan.stateFilePath)] : []), ...(journaled ? [path.dirname(journalPath)] : [])];
    for (const folder of new Set(folders)) for (const relative of await missingDirectories(targetPath, folder)) createdDirectories.add(relative);
  }

  const release = targetPath ? await acquireTargetLock(targetPath) : async () => {};
  try {
    if (journaled) await assertNoUnfinishedJournal(journalPath);
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
        throw Object.assign(new Error(`Interrupted before ${step.item.relativePath}: the run stopped between two files. Run \`workflow-kit rollback --apply --yes\` to undo what it wrote.`), { code: interruptedCode });
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
        await copyBackup(item.targetFile, step.backupPath);
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
      if (step.backup) await copyBackup(item.targetFile, step.backupPath);
      await writeFileAtomic(item.targetFile, item.content);
      // A moved file keeps its permission bits (an executable script stays executable).
      if (item.mode !== undefined) await fs.chmod(item.targetFile, item.mode);
      step.result = { ...item, applied: true, backupPath: step.backupPath };
    }

    const stateContent = stateChanges();
    if (stateContent !== null) {
      journal.stateWritten = true;
      await saveJournal();
      await fs.mkdir(path.dirname(plan.stateFilePath), { recursive: true });
      await writeFileAtomic(plan.stateFilePath, stateContent);
    } else if (plan.nextInstallState && previousStateRaw !== null) {
      // Kept as it is: the plan describes the state on disk.
      plan.nextInstallState.generatedAt = JSON.parse(previousStateRaw).generatedAt;
    }
    journal.completed = true;
    await saveJournal();
  } finally {
    await release();
  }

  return results();
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
