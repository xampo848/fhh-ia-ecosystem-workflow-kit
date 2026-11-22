import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatExportApplySummary,
  formatInitApplySummary,
  formatUpdateApplySummary
} from '../src/cli/summaries.mjs';

function operation(overrides = {}) {
  return { applied: false, backupPath: null, operation: 'create', ...overrides };
}

test('formatInitApplySummary counts applied writes and backups', () => {
  const applied = [
    operation({ applied: true }),
    operation({ applied: true, backupPath: '/tmp/a.bak' }),
    operation({ applied: false })
  ];

  assert.equal(formatInitApplySummary(applied), 'Applied writes: 2\nBackups created: 1\n');
});

test('formatExportApplySummary counts applied writes and backups', () => {
  const applied = [
    operation({ applied: true }),
    operation({ applied: true, backupPath: '/tmp/a.bak' })
  ];

  assert.equal(formatExportApplySummary(applied), 'Exported files: 2\nBackups created: 1\n');
});

test('formatUpdateApplySummary counts writes, backups, skips, adoptions and retired deletes', () => {
  const applied = [
    operation({ applied: true }),
    operation({ applied: true, backupPath: '/tmp/a.bak' }),
    operation({ operation: 'skip_modified' }),
    operation({ operation: 'skip_modified' }),
    operation({ operation: 'skip_unmanaged' }),
    operation({ operation: 'adopt_existing' }),
    // A retired delete always keeps a backup and is not counted as a write.
    operation({ operation: 'delete_with_backup', applied: true, backupPath: '/tmp/b.bak' })
  ];

  assert.equal(
    formatUpdateApplySummary(applied),
    'Updated writes: 2\nBackups created: 2\nProtected local edits (skipped): 2\nUnmanaged files (skipped): 1\nAdopted baseline files: 1\nRetired files deleted (backup kept): 1\n'
  );
});
