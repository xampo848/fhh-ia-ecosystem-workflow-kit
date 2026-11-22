import fs from 'node:fs/promises';
import path from 'node:path';
import { assertNoSymlinkWrites, checksumOf, findSymlinkInPath, writeFileAtomic } from './fs-safety.mjs';

// Record of the last apply that wrote something. `workflow-kit rollback` reads
// it to undo exactly that run: restore backups (deleted files included),
// remove created files and put the previous install-state back.
export const applyJournalRelativePath = '.agents/workflow-kit/last-apply.json';
export const applyJournalSchemaVersion = '2.0.0';

// A retired kit file is removed only after a copy is kept next to it, even
// with --backup-mode none: the delete is what rollback has to undo.
const deleteOperations = new Set(['delete_with_backup']);

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

// Two applies inside the same second would otherwise overwrite each other's
// backups. Move the stamp forward until no planned backup name is taken.
async function freeBackupStamp(operations, backupOperations) {
  const targets = operations.filter((item) => backupOperations.has(item.operation)).map((item) => item.targetFile);
  const date = new Date();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const stamp = timestamp(date);
    const taken = await Promise.all(targets.map((target) => exists(`${target}.workflow-kit-backup-${stamp}`)));
    if (!taken.some(Boolean)) return stamp;
    date.setSeconds(date.getSeconds() + 1);
  }
  throw new Error('Could not find a free backup name. Remove old *.workflow-kit-backup-* files and run again.');
}

async function readIfPresent(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function applyInstallPlan(plan) {
  const applied = [];

  const writeWithBackupOperations = new Set(['overwrite_with_backup', 'merge_with_backup']);
  const writeWithoutBackupOperations = new Set(['create', 'overwrite_no_backup', 'merge_no_backup']);
  const nonWriteOperations = new Set(['unchanged', 'skip_modified', 'skip_unmanaged', 'adopt_existing']);

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

  const backupStamp = await freeBackupStamp(plan.operations, new Set([...writeWithBackupOperations, ...deleteOperations]));
  const previousStateRaw = plan.stateFilePath ? await readIfPresent(plan.stateFilePath) : null;
  const journalFiles = [];
  let stateWritten = false;

  const toRelative = (absolute) => path.relative(plan.targetPath, absolute).split(path.sep).join('/');

  try {
    for (const item of plan.operations) {
      if (nonWriteOperations.has(item.operation)) {
        applied.push({ ...item, applied: false });
        continue;
      }

      if (deleteOperations.has(item.operation)) {
        // The backup stays next to the deleted file, so its directory stays.
        const backupPath = `${item.targetFile}.workflow-kit-backup-${backupStamp}`;
        await fs.copyFile(item.targetFile, backupPath);
        await fs.rm(item.targetFile);
        applied.push({ ...item, applied: true, backupPath });
        journalFiles.push({ relativePath: item.relativePath, action: 'deleted', backup: plan.targetPath ? toRelative(backupPath) : null, writtenChecksum: null });
        continue;
      }

      let backupPath = null;
      await fs.mkdir(path.dirname(item.targetFile), { recursive: true });

      if (writeWithBackupOperations.has(item.operation)) {
        backupPath = `${item.targetFile}.workflow-kit-backup-${backupStamp}`;
        await fs.copyFile(item.targetFile, backupPath);
      }

      await writeFileAtomic(item.targetFile, item.content);
      applied.push({ ...item, applied: true, backupPath });
      journalFiles.push({
        relativePath: item.relativePath,
        action: item.operation === 'create' ? 'created' : 'overwritten',
        backup: backupPath && plan.targetPath ? toRelative(backupPath) : null,
        writtenChecksum: checksumOf(item.content)
      });
    }

    if (plan.stateFilePath && plan.nextInstallState) {
      await fs.mkdir(path.dirname(plan.stateFilePath), { recursive: true });
      await writeFileAtomic(plan.stateFilePath, `${JSON.stringify(plan.nextInstallState, null, 2)}\n`);
      stateWritten = true;
    }
  } finally {
    // Written even when the run fails halfway, so the partial apply can be
    // rolled back. A run that wrote nothing keeps the previous journal.
    if (plan.recordJournal !== false && plan.targetPath && journalFiles.length > 0) {
      const journalPath = path.join(plan.targetPath, applyJournalRelativePath);
      await fs.mkdir(path.dirname(journalPath), { recursive: true });
      await writeFileAtomic(journalPath, `${JSON.stringify({
        schemaVersion: applyJournalSchemaVersion,
        appliedAt: new Date().toISOString(),
        backupStamp,
        mode: plan.mode ?? 'init',
        toolkitVersion: plan.toolkitVersion ?? null,
        completed: stateWritten || !plan.stateFilePath,
        stateWritten,
        previousInstallState: previousStateRaw,
        files: journalFiles
      }, null, 2)}\n`);
    }
  }

  return applied;
}
