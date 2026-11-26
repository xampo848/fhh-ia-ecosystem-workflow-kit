const deleteOperation = 'delete_with_backup';

// What an apply did, counted once for the CLI summaries and the TUI. A delete
// is not a write: a retired kit file is deleted, and the old copy of a project
// file the layout migration moved to .agents/project/ is moved.
export function countAppliedOperations(applied) {
  const deleted = applied.filter((item) => item.applied && item.operation === deleteOperation);
  return {
    writeCount: applied.filter((item) => item.applied && item.operation !== deleteOperation).length,
    backupCount: applied.filter((item) => item.backupPath).length,
    modifiedSkips: applied.filter((item) => item.operation === 'skip_modified').length,
    // A seed the project owns (created once, then the project's) is not an
    // unmanaged file: it is counted on its own.
    unmanagedSkips: applied.filter((item) => item.operation === 'skip_unmanaged' && item.reason !== 'project_owned').length,
    projectOwned: applied.filter((item) => item.operation === 'skip_unmanaged' && item.reason === 'project_owned').length,
    // A delete the apply did not do because the file changed since the plan.
    changedSincePlan: applied.filter((item) => item.reason === 'changed_since_plan').length,
    adopted: applied.filter((item) => item.operation === 'adopt_existing').length,
    retiredDeleted: deleted.filter((item) => item.retired).length,
    projectFilesMoved: deleted.filter((item) => item.migration && !item.retired).length
  };
}

export function formatInitApplySummary(applied) {
  const { writeCount, backupCount } = countAppliedOperations(applied);
  return `Applied writes: ${writeCount}\nBackups created: ${backupCount}\n`;
}

export function formatExportApplySummary(applied) {
  const { writeCount, backupCount } = countAppliedOperations(applied);
  return `Exported files: ${writeCount}\nBackups created: ${backupCount}\n`;
}

export function formatUpdateApplySummary(applied) {
  const counts = countAppliedOperations(applied);
  return [
    `Updated writes: ${counts.writeCount}`,
    `Backups created: ${counts.backupCount}`,
    `Protected local edits (skipped): ${counts.modifiedSkips}`,
    `Unmanaged files (skipped): ${counts.unmanagedSkips}`,
    `Project-owned files left as they are: ${counts.projectOwned}`,
    `Adopted baseline files: ${counts.adopted}`,
    `Retired files deleted (backup kept): ${counts.retiredDeleted}`,
    `Project files moved to .agents/project/: ${counts.projectFilesMoved}`,
    ...(counts.changedSincePlan > 0 ? [`Not deleted (changed since the plan, kept as they are): ${counts.changedSincePlan}`] : []),
    ''
  ].join('\n');
}

// The notes of the plan (what it could not do for the user), repeated after the apply.
export function formatPlanNotices(plan) {
  return (plan.notices ?? []).map((notice) => `Note: ${notice}\n`).join('');
}
