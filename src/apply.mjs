import fs from 'node:fs/promises';
import path from 'node:path';

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
}

export async function applyInstallPlan(plan) {
  const applied = [];
  const backupStamp = timestamp();

  const writeWithBackupOperations = new Set(['overwrite_with_backup', 'merge_with_backup']);
  const writeWithoutBackupOperations = new Set(['create', 'overwrite_no_backup', 'merge_no_backup']);
  const nonWriteOperations = new Set(['unchanged', 'skip_modified', 'skip_unmanaged', 'adopt_existing']);

  for (const item of plan.operations) {
    if (nonWriteOperations.has(item.operation)) {
      applied.push({ ...item, applied: false });
      continue;
    }

    if (!writeWithBackupOperations.has(item.operation) && !writeWithoutBackupOperations.has(item.operation)) {
      throw new Error(`Unsupported operation: ${item.operation}`);
    }

    let backupPath = null;
    await fs.mkdir(path.dirname(item.targetFile), { recursive: true });

    if (writeWithBackupOperations.has(item.operation)) {
      backupPath = `${item.targetFile}.workflow-kit-backup-${backupStamp}`;
      await fs.copyFile(item.targetFile, backupPath);
    }

    await fs.writeFile(item.targetFile, item.content, 'utf8');
    applied.push({ ...item, applied: true, backupPath });
  }

  if (plan.stateFilePath && plan.nextInstallState) {
    await fs.mkdir(path.dirname(plan.stateFilePath), { recursive: true });
    await fs.writeFile(plan.stateFilePath, `${JSON.stringify(plan.nextInstallState, null, 2)}\n`, 'utf8');
  }

  return applied;
}
