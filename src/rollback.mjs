import fs from 'node:fs/promises';
import path from 'node:path';
import { applyJournalProblem, applyJournalRelativePath, freeBackupStamp } from './apply.mjs';
import { checksumOf, findSymlinkInPath, resolveInsideTarget, writeFileAtomic } from './fs-safety.mjs';
import { installStateRelativePath, readManagedInstallState } from './planner.mjs';

const backupSuffixPattern = /\.workflow-kit-backup-(\d{8}T\d{6}Z)$/;
// Copies a rollback without a journal keeps; never picked as a backup to restore.
const beforeRollbackSuffix = '-before-rollback';
// 1.0.0 journals only hold `created` and `overwritten` entries; 2.0.0 adds
// `deleted` (a retired kit file removed with a backup).

async function readIfPresent(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
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
  const journal = await readJournal(targetPath);
  if (!journal) return buildLegacyRollbackPlan(targetPath);

  const operations = [];
  for (const entry of journal.files) {
    const targetFile = await safeTargetFile(targetPath, entry.relativePath);
    const current = await readIfPresent(targetFile);
    const deleted = entry.action === 'deleted';
    // A deleted path that exists again was recreated after the apply.
    const editedSinceApply = current !== null && (deleted || checksumOf(current) !== entry.writtenChecksum);
    const base = { relativePath: entry.relativePath, targetFile, ...(deleted ? { deleted: true } : {}) };

    if (editedSinceApply) {
      operations.push({ ...base, action: 'keep_modified' });
    } else if (entry.action === 'created') {
      if (current !== null) operations.push({ ...base, action: 'remove' });
    } else if (entry.backup) {
      const backupPath = await safeTargetFile(targetPath, entry.backup);
      const backupExists = (await readIfPresent(backupPath)) !== null;
      operations.push(backupExists
        ? { ...base, action: 'restore', backupPath }
        : { ...base, action: 'no_backup', reason: 'backup file is missing' });
    } else {
      operations.push({ ...base, action: 'no_backup', reason: 'applied with --backup-mode none' });
    }
  }

  return {
    targetPath,
    source: 'journal',
    appliedAt: journal.appliedAt ?? null,
    stateWritten: journal.stateWritten !== false,
    previousInstallState: typeof journal.previousInstallState === 'string' ? journal.previousInstallState : null,
    operations
  };
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
  const results = [];
  const copyStamp = plan.source === 'backups'
    ? await freeBackupStamp(plan.operations.filter((item) => item.action === 'restore').map((item) => item.targetFile))
    : null;
  for (const item of plan.operations) {
    if (item.action === 'restore') {
      const keptCopy = copyStamp && item.keepsCopy ? await keepCurrentContent(item, copyStamp) : null;
      await fs.copyFile(item.backupPath, item.targetFile);
      if (plan.source === 'journal') await fs.rm(item.backupPath, { force: true });
      results.push({ ...item, restored: true, ...(keptCopy ? { keptCopy } : {}) });
    } else if (item.action === 'remove') {
      await fs.rm(item.targetFile, { force: true });
      await removeEmptyParents(plan.targetPath, item.targetFile);
      results.push({ ...item, removed: true });
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
    const journalPath = path.join(plan.targetPath, applyJournalRelativePath);
    await fs.rm(journalPath, { force: true });
    await removeEmptyParents(plan.targetPath, journalPath);
  }

  return results;
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
  if (plan.operations.length === 0) {
    return `${header}\nNo applied run or workflow-kit backup files found for managed paths. Nothing to roll back.`;
  }

  const lines = plan.operations.map((item) => {
    if (item.action === 'restore') return `restore ${item.relativePath} <- ${path.basename(item.backupPath)}${item.deleted ? ' (deleted by the last apply)' : ''}${item.keepsCopy ? ` (its current content is kept first as a ${beforeRollbackSuffix} copy)` : ''}`;
    if (item.action === 'remove') return `remove ${item.relativePath} (created by the last apply)`;
    if (item.action === 'keep_modified') return `keep ${item.relativePath} (${item.deleted ? 'recreated' : 'edited'} after the last apply; not touched)`;
    return `cannot restore ${item.relativePath} (${item.reason})`;
  });
  const scope = plan.source === 'journal'
    ? `Undoes the apply of ${plan.appliedAt ?? 'unknown date'}; install-state returns to its previous content.`
    : `No apply journal found: restoring the newest backup of each managed file; the current content of each file it replaces is kept first as a ${beforeRollbackSuffix} copy. Created and moved files and install-state stay as they are, so run workflow-kit doctor next. To return to this kit version, run \`workflow-kit update\` (dry run first) and decide each pending file with --edited; \`--edited all=discard\` would also drop every kept edit and the own text of adapters (left in backups).`;
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
