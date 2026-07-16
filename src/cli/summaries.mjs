function countApplied(applied) {
  return {
    writeCount: applied.filter((item) => item.applied).length,
    backupCount: applied.filter((item) => item.backupPath).length
  };
}

export function formatInitApplySummary(applied) {
  const { writeCount, backupCount } = countApplied(applied);
  return `Applied writes: ${writeCount}\nBackups created: ${backupCount}\n`;
}

export function formatExportApplySummary(applied) {
  const { writeCount, backupCount } = countApplied(applied);
  return `Exported files: ${writeCount}\nBackups created: ${backupCount}\n`;
}

export function formatUpdateApplySummary(applied) {
  const { writeCount, backupCount } = countApplied(applied);
  const modifiedSkips = applied.filter((item) => item.operation === 'skip_modified').length;
  const unmanagedSkips = applied.filter((item) => item.operation === 'skip_unmanaged').length;
  const adopted = applied.filter((item) => item.operation === 'adopt_existing').length;

  return `Updated writes: ${writeCount}\nBackups created: ${backupCount}\nProtected local edits (skipped): ${modifiedSkips}\nUnmanaged files (skipped): ${unmanagedSkips}\nAdopted baseline files: ${adopted}\n`;
}
