import fs from 'node:fs/promises';
import path from 'node:path';

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
}

export async function applyInstallPlan(plan) {
  const applied = [];
  const backupStamp = timestamp();

  for (const item of plan.operations) {
    if (item.operation === 'unchanged' || item.operation === 'skip_modified' || item.operation === 'skip_unmanaged' || item.operation === 'adopt_existing') {
      applied.push({ ...item, applied: false });
      continue;
    }

    let backupPath = null;

    if (item.operation === 'move_with_backup') {
      await fs.mkdir(path.dirname(item.targetFile), { recursive: true });
      backupPath = `${item.sourceFile}.workflow-kit-backup-${backupStamp}`;
      await fs.copyFile(item.sourceFile, backupPath);
      await fs.writeFile(item.targetFile, item.content, 'utf8');
      await fs.unlink(item.sourceFile);
      applied.push({ ...item, applied: true, backupPath });
      continue;
    }

    await fs.mkdir(path.dirname(item.targetFile), { recursive: true });

    if (item.operation === 'overwrite_with_backup' || item.operation === 'merge_with_backup') {
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
