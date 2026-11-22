import fs from 'node:fs/promises';
import path from 'node:path';
import { applyJournalRelativePath, readableApplyJournalVersions } from './apply.mjs';
import { checksumOf, findSymlinkInPath, resolveInsideTarget, writeFileAtomic } from './fs-safety.mjs';
import { installStateRelativePath, readManagedInstallState } from './planner.mjs';

const backupSuffixPattern = /\.workflow-kit-backup-(\d{8}T\d{6}Z)$/;
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
  const raw = await readIfPresent(path.join(targetPath, applyJournalRelativePath));
  if (raw === null) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${applyJournalRelativePath} is not valid JSON. Restore it from Git or delete it to fall back to the newest backup of each managed file.`);
  }
  if (!readableApplyJournalVersions.has(parsed?.schemaVersion) || !Array.isArray(parsed.files)) {
    throw new Error(`${applyJournalRelativePath} has an unsupported format. Run rollback with the workflow-kit version that wrote it.`);
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
async function buildLegacyRollbackPlan(targetPath) {
  const state = await readManagedInstallState(targetPath);
  const operations = [];
  for (const relativePath of Object.keys(state?.files ?? {})) {
    const targetFile = await safeTargetFile(targetPath, relativePath);
    const latestBackup = await findLatestBackup(targetFile);
    if (!latestBackup) continue;
    operations.push({ relativePath, targetFile, action: 'restore', backupPath: latestBackup.backupPath });
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
  for (const item of plan.operations) {
    if (item.action === 'restore') {
      await fs.copyFile(item.backupPath, item.targetFile);
      if (plan.source === 'journal') await fs.rm(item.backupPath, { force: true });
      results.push({ ...item, restored: true });
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
    if (item.action === 'restore') return `restore ${item.relativePath} <- ${path.basename(item.backupPath)}${item.deleted ? ' (deleted by the last apply)' : ''}`;
    if (item.action === 'remove') return `remove ${item.relativePath} (created by the last apply)`;
    if (item.action === 'keep_modified') return `keep ${item.relativePath} (${item.deleted ? 'recreated' : 'edited'} after the last apply; not touched)`;
    return `cannot restore ${item.relativePath} (${item.reason})`;
  });
  const scope = plan.source === 'journal'
    ? `Undoes the apply of ${plan.appliedAt ?? 'unknown date'}; install-state returns to its previous content.`
    : 'No apply journal found: restoring the newest backup of each managed file. Created files and install-state stay as they are.';
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
