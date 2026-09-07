import fs from 'node:fs/promises';
import path from 'node:path';
import { readManagedInstallState } from './planner.mjs';

const backupSuffixPattern = /\.workflow-kit-backup-(\d{8}T\d{6}Z)$/;

export async function buildRollbackPlan(options = {}) {
  const targetPath = path.resolve(options.targetPath ?? process.cwd());
  const state = await readManagedInstallState(targetPath);
  const managedFiles = Object.keys(state?.files ?? {});

  const operations = [];
  for (const relativePath of managedFiles) {
    const targetFile = path.join(targetPath, relativePath);
    const latestBackup = await findLatestBackup(targetFile);
    if (!latestBackup) continue;

    operations.push({
      relativePath,
      targetFile,
      backupPath: latestBackup.backupPath,
      backupStamp: latestBackup.backupStamp
    });
  }

  return { targetPath, operations };
}

export async function applyRollbackPlan(plan) {
  const restored = [];
  for (const item of plan.operations) {
    await fs.copyFile(item.backupPath, item.targetFile);
    restored.push({ ...item, restored: true });
  }
  return restored;
}

export function formatRollbackPlan(plan) {
  const header = `Target: ${plan.targetPath}`;
  if (plan.operations.length === 0) {
    return `${header}\nNo workflow-kit backup files found for managed paths. Nothing to roll back.`;
  }

  const lines = plan.operations.map((item) => `restore ${item.relativePath} <- ${path.basename(item.backupPath)}`);
  return [header, ...lines].join('\n');
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
