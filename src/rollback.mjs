import fs from 'node:fs/promises';
import path from 'node:path';
import { acquireTargetLock, applyJournalProblem, assertTargetNotLocked, applyJournalRelativePath, freeBackupStamp, removeCreatedDirectories } from './apply.mjs';
import { checksumOf, findSymlinkInPath, resolveInsideTarget, temporaryPathFor, writeFileAtomic } from './fs-safety.mjs';
import { installStateRelativePath, readManagedInstallState } from './planner.mjs';

const backupSuffixPattern = /\.workflow-kit-backup-(\d{8}T\d{6}Z)$/;
// Copies a rollback without a journal keeps; never picked as a backup to restore.
const beforeRollbackSuffix = '-before-rollback';
// 1.0.0 journals only hold `created` and `overwritten` entries; 2.0.0 adds
// `deleted` (a retired kit file removed with a backup).

// A path under a folder that became a file (ENOTDIR) is not there either.
async function readIfPresent(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

async function readJournal(targetPath) {
  let raw;
  try {
    raw = await readIfPresent(path.join(targetPath, applyJournalRelativePath));
  } catch (readError) {
    throw new Error(`${applyJournalRelativePath} cannot be read (${readError.code ?? readError.message}). Fix it by hand; Git does not track it. Nothing was changed.`);
  }
  if (raw === null) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${applyJournalRelativePath} is not valid JSON, so rollback cannot tell what the last apply wrote. Fix the file by hand; Git does not track it. Nothing was changed.`);
  }
  const problem = applyJournalProblem(parsed);
  if (problem === 'version') {
    throw new Error(`${applyJournalRelativePath} has an unsupported format. Run rollback with the workflow-kit version that wrote it.`);
  }
  if (problem === 'entries') {
    throw new Error(`${applyJournalRelativePath} has entries rollback cannot act on. Fix it by hand (Git does not track it). Nothing was changed.`);
  }
  return parsed;
}

// Paths in the journal and in install-state come from the target repository:
// keep them inside the target and never follow a symbolic link.
async function safeTargetFile(targetPath, relativePath) {
  const absolute = resolveInsideTarget(targetPath, relativePath);
  const link = await findSymlinkInPath(targetPath, relativePath);
  if (link) throw new Error(`Refusing to roll back through a symbolic link: ${link}`);
  return absolute;
}

export async function buildRollbackPlan(options = {}) {
  const targetPath = path.resolve(options.targetPath ?? process.cwd());
  await assertTargetFolder(targetPath);
  await assertTargetNotLocked(targetPath);
  const journal = await readJournal(targetPath);
  if (!journal) return buildLegacyRollbackPlan(targetPath);

  const operations = [];
  // Entries written after 0.23.0 carry the checksum the file had before the
  // run, so a file an interrupted run never reached is told apart from one
  // it wrote and one edited after it.
  const knowsPrevious = journal.files.every((entry) => Object.hasOwn(entry, 'previousChecksum'));
  for (const entry of journal.files) {
    const targetFile = await safeTargetFile(targetPath, entry.relativePath);
    const current = await readIfPresent(targetFile);
    const currentChecksum = current === null ? null : checksumOf(current);
    const deleted = entry.action === 'deleted';
    const base = { relativePath: entry.relativePath, targetFile, ...(deleted ? { deleted: true } : {}) };
    const backupPath = entry.backup ? await safeTargetFile(targetPath, entry.backup) : null;
    const backupExists = backupPath !== null && (await readIfPresent(backupPath)) !== null;
    const restoreOrExplain = () => (backupPath === null
      ? { ...base, action: 'no_backup', reason: 'applied with --backup-mode none' }
      : backupExists ? { ...base, action: 'restore', backupPath } : { ...base, action: 'no_backup', reason: 'backup file is missing' });

    if (knowsPrevious) {
      const wroteIt = deleted ? current === null : currentChecksum === entry.writtenChecksum;
      if (wroteIt) {
        operations.push(entry.action === 'created' ? { ...base, action: 'remove' } : restoreOrExplain());
      } else if (currentChecksum === entry.previousChecksum) {
        // Not reached by the run (or already undone): its backup, when the
        // run made one before stopping, holds this same content.
        operations.push({ ...base, action: 'untouched', ...(backupExists ? { backupPath } : {}) });
      } else {
        operations.push({ ...base, action: 'keep_modified' });
      }
      continue;
    }

    // A deleted path that exists again was recreated after the apply.
    const editedSinceApply = current !== null && (deleted || currentChecksum !== entry.writtenChecksum);
    if (editedSinceApply) {
      operations.push({ ...base, action: 'keep_modified' });
    } else if (entry.action === 'created') {
      if (current !== null) operations.push({ ...base, action: 'remove' });
    } else {
      operations.push(restoreOrExplain());
    }
  }

  return {
    targetPath,
    source: 'journal',
    appliedAt: journal.appliedAt ?? null,
    completed: journal.completed !== false,
    stateWritten: journal.stateWritten !== false,
    previousInstallState: typeof journal.previousInstallState === 'string' ? journal.previousInstallState : null,
    pid: Number.isInteger(journal.pid) ? journal.pid : null,
    createdDirectories: Array.isArray(journal.createdDirectories) ? journal.createdDirectories : null,
    operations
  };
}

// --target must name a folder that exists: anything else would only give a
// message about the journal or install-state inside it.
async function assertTargetFolder(targetPath) {
  let stat;
  try {
    stat = await fs.stat(targetPath);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`The target ${targetPath} does not exist. Check --target. Nothing was changed.`);
    throw error;
  }
  if (!stat.isDirectory()) throw new Error(`The target ${targetPath} is a file, not a folder. Check --target. Nothing was changed.`);
}

// Installs applied before the journal existed: restore the newest backup of
// each managed file. Created files and install-state cannot be undone here.
// Nothing says whether a file changed after its backup, so the apply keeps a
// copy of the content it replaces (see applyRollbackPlan).
async function buildLegacyRollbackPlan(targetPath) {
  const state = await readManagedInstallState(targetPath);
  const operations = [];
  for (const relativePath of Object.keys(state?.files ?? {})) {
    const targetFile = await safeTargetFile(targetPath, relativePath);
    const latestBackup = await findLatestBackup(targetFile);
    if (!latestBackup) continue;
    const current = await readBufferIfPresent(targetFile);
    const backup = await fs.readFile(latestBackup.backupPath);
    // Already the backup's content: nothing to restore (a second run is a no-op).
    if (current !== null && current.equals(backup)) continue;
    operations.push({ relativePath, targetFile, action: 'restore', backupPath: latestBackup.backupPath, ...(current !== null ? { keepsCopy: true } : {}) });
  }
  return { targetPath, source: 'backups', operations };
}

// Journals of 0.23.0 and before do not record the folders their run created:
// the empty folders above a removed file go, as those versions did.
async function removeEmptyParents(targetPath, file) {
  let directory = path.dirname(file);
  while (directory.startsWith(`${targetPath}${path.sep}`)) {
    try {
      await fs.rmdir(directory);
    } catch {
      return;
    }
    directory = path.dirname(directory);
  }
}

export async function applyRollbackPlan(plan) {
  const restores = plan.operations.filter((item) => item.action === 'restore');
  const journalPath = path.join(plan.targetPath, applyJournalRelativePath);
  const release = await acquireTargetLock(plan.targetPath);
  const results = [];
  try {
    const copyStamp = plan.source === 'backups' && restores.length > 0
      ? await freeBackupStamp(restores.map((item) => item.targetFile), beforeRollbackSuffix)
      : null;
    for (const item of plan.operations) {
      if (item.action === 'restore') {
        const keptCopy = copyStamp && item.keepsCopy ? await keepCurrentContent(item, copyStamp) : null;
        await fs.mkdir(path.dirname(item.targetFile), { recursive: true });
        await fs.copyFile(item.backupPath, item.targetFile);
        if (plan.source === 'journal') await fs.rm(item.backupPath, { force: true });
        results.push({ ...item, restored: true, ...(keptCopy ? { keptCopy } : {}) });
      } else if (item.action === 'remove') {
        await fs.rm(item.targetFile, { force: true });
        if (!plan.createdDirectories) await removeEmptyParents(plan.targetPath, item.targetFile);
        results.push({ ...item, removed: true });
      } else if (item.action === 'untouched') {
        // The backup an interrupted run took of a file it never wrote.
        if (item.backupPath) await fs.rm(item.backupPath, { force: true });
        results.push({ ...item });
      } else {
        results.push({ ...item });
      }
    }

    if (plan.source === 'journal') {
      const statePath = path.join(plan.targetPath, installStateRelativePath);
      if (plan.stateWritten) {
        if (plan.previousInstallState === null) await fs.rm(statePath, { force: true });
        else await writeFileAtomic(statePath, plan.previousInstallState);
      }
      // The temporary file of the write an interrupted run was doing.
      if (plan.pid !== null) {
        const touched = [...plan.operations.map((item) => item.targetFile), statePath, journalPath];
        for (const file of new Set(touched.map((item) => temporaryPathFor(item, plan.pid)))) await rmFileIfPresent(file);
      }
      await fs.rm(journalPath, { force: true });
      if (!plan.createdDirectories) await removeEmptyParents(plan.targetPath, journalPath);
    }
  } finally {
    await release();
  }
  // After the lock is gone: the folders the run created, when empty.
  if (plan.createdDirectories) await removeCreatedDirectories(plan.targetPath, plan.createdDirectories);

  return results;
}

async function rmFileIfPresent(file) {
  try {
    if ((await fs.lstat(file)).isFile()) await fs.rm(file);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
  }
}

// Without a journal: the content a restore replaces is kept first as a
// -before-rollback copy. Returns its path, or null when the file is gone.
async function keepCurrentContent(item, stamp) {
  if (await readBufferIfPresent(item.targetFile) === null) return null;
  const copyPath = `${item.targetFile}.workflow-kit-backup-${stamp}${beforeRollbackSuffix}`;
  await fs.copyFile(item.targetFile, copyPath, fs.constants.COPYFILE_EXCL);
  return copyPath;
}

async function readBufferIfPresent(file) {
  try {
    return await fs.readFile(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function summarizeRollback(results) {
  return {
    restored: results.filter((item) => item.restored).length,
    removed: results.filter((item) => item.removed).length,
    keptModified: results.filter((item) => item.action === 'keep_modified').length,
    withoutBackup: results.filter((item) => item.action === 'no_backup').length
  };
}

export function formatRollbackPlan(plan) {
  const header = `Target: ${plan.targetPath}`;
  const listed = plan.operations.filter((item) => item.action !== 'untouched');
  // A journal always has something to undo: at least the journal itself and,
  // when the run wrote it, install-state.
  if (plan.source !== 'journal' && listed.length === 0) {
    return `${header}\nNo applied run or workflow-kit backup files found for managed paths. Nothing to roll back.`;
  }

  const lines = listed.map((item) => {
    if (item.action === 'restore') return `restore ${item.relativePath} <- ${path.basename(item.backupPath)}${item.deleted ? ' (deleted by the last apply)' : ''}${item.keepsCopy ? ` (its current content is kept first as a ${beforeRollbackSuffix} copy)` : ''}`;
    if (item.action === 'remove') return `remove ${item.relativePath} (created by the last apply)`;
    if (item.action === 'keep_modified') return `keep ${item.relativePath} (${item.deleted ? 'recreated' : 'edited'} after the last apply; not touched)`;
    return `cannot restore ${item.relativePath} (${item.reason})`;
  });
  const untouched = plan.operations.filter((item) => item.action === 'untouched').length;
  if (untouched > 0) lines.push(`${untouched} file(s) the last apply did not change stay as they are${plan.operations.some((item) => item.action === 'untouched' && item.backupPath) ? '; the backups it took of them are removed' : ''}.`);
  let scope;
  if (plan.source === 'journal') {
    const state = plan.stateWritten ? 'install-state returns to its previous content' : 'install-state stays as it is (the apply did not write it)';
    const run = plan.completed ? `the apply of ${plan.appliedAt ?? 'unknown date'}` : `the apply of ${plan.appliedAt ?? 'unknown date'}, which did not finish`;
    scope = `Undoes ${run}; ${state}${listed.length === 0 ? '; no file needs restoring or removing' : ''}. The record of that apply is removed.`;
  } else {
    scope = `No apply journal found: restoring the newest backup of each managed file; the current content of each file it replaces is kept first as a ${beforeRollbackSuffix} copy. Created and moved files and install-state stay as they are, so run workflow-kit doctor next. To return to this kit version, run \`workflow-kit update\` (dry run first) and decide each pending file with --edited; \`--edited all=discard\` would also drop every kept edit and the own text of adapters (left in backups).`;
  }
  return [header, scope, ...lines].join('\n');
}

async function findLatestBackup(targetFile) {
  const dir = path.dirname(targetFile);
  const baseName = path.basename(targetFile);

  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }

  const backups = entries
    .filter((entry) => entry.startsWith(`${baseName}.workflow-kit-backup-`))
    .map((entry) => {
      const match = entry.slice(baseName.length).match(backupSuffixPattern);
      return match ? { backupPath: path.join(dir, entry), backupStamp: match[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.backupStamp.localeCompare(a.backupStamp));

  return backups[0] ?? null;
}
