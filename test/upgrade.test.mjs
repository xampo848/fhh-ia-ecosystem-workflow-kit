import assert from 'node:assert/strict';
import os from 'node:os';
import test from 'node:test';
import { globalUpgradeWorkingDirectory, isNonBlockingBunRemoveFailure, runUpgradePlan } from '../src/upgrade.mjs';

test('globalUpgradeWorkingDirectory prefers HOME', () => {
  assert.equal(globalUpgradeWorkingDirectory(), os.homedir());
});

test('runUpgradePlan defaults to HOME as cwd', async () => {
  const expected = JSON.stringify(os.homedir());
  const plan = {
    command: 'node',
    args: ['-e', `process.exit(process.cwd()===${expected}?0:9)`]
  };

  const result = await runUpgradePlan(plan);
  assert.equal(result.ok, true);
  assert.equal(result.code, 0);
});

test('isNonBlockingBunRemoveFailure detects missing-package outputs', () => {
  assert.equal(isNonBlockingBunRemoveFailure({ stderr: 'error: package not found' }), true);
  assert.equal(isNonBlockingBunRemoveFailure({ stdout: 'No such package' }), true);
  assert.equal(isNonBlockingBunRemoveFailure({ stderr: 'permission denied' }), false);
});

