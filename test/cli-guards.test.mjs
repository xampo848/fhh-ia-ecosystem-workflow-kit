import assert from 'node:assert/strict';
import test from 'node:test';
import { yesGuardMessage } from '../src/cli/guards.mjs';

test('yesGuardMessage returns null when apply is not requested', () => {
  assert.equal(yesGuardMessage({ apply: false, yes: false }, 'apply'), null);
});

test('yesGuardMessage returns null when apply and yes are both set', () => {
  assert.equal(yesGuardMessage({ apply: true, yes: true }, 'apply'), null);
});

test('yesGuardMessage returns a warning message with the action label when yes is missing', () => {
  const message = yesGuardMessage({ apply: true, yes: false }, 'apply update');

  assert.equal(message, 'Refusing to apply update without --yes. Run dry-run first, then use --apply --yes.\n');
});
