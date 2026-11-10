import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  computeFingerprint,
  decideReuse,
  readRegistry,
  recordEvidence
} from '../.agents/skills/02-implement/validation-runner/scripts/validation-fingerprint.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

async function project() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-fingerprint-'));
  await fs.mkdir(path.join(dir, 'src'));
  await fs.writeFile(path.join(dir, 'src/a.ts'), 'export const a = 1;\n');
  await fs.writeFile(path.join(dir, 'src/b.ts'), 'export const b = 2;\n');
  await fs.writeFile(path.join(dir, 'bun.lock'), 'lock-v1\n');
  await fs.writeFile(path.join(dir, 'tsconfig.json'), '{}\n');
  return dir;
}

test('fingerprint is deterministic and changes with scope, lockfile, config, generated code and tools', async () => {
  const dir = await project();
  const base = { root: dir, scope: ['src'], config: ['tsconfig.json'] };
  const first = computeFingerprint(base);
  assert.equal(computeFingerprint(base).fingerprint, first.fingerprint);
  assert.equal(first.files.scope, 2);
  assert.equal(first.files.lockfiles, 1);
  assert.ok(first.tools.some((tool) => tool.startsWith('node=')));

  await fs.writeFile(path.join(dir, 'src/a.ts'), 'export const a = 3;\n');
  const afterScope = computeFingerprint(base);
  assert.notEqual(afterScope.fingerprint, first.fingerprint);

  await fs.writeFile(path.join(dir, 'bun.lock'), 'lock-v2\n');
  const afterLock = computeFingerprint(base);
  assert.notEqual(afterLock.fingerprint, afterScope.fingerprint);

  await fs.writeFile(path.join(dir, 'tsconfig.json'), '{"strict":true}\n');
  const afterConfig = computeFingerprint(base);
  assert.notEqual(afterConfig.fingerprint, afterLock.fingerprint);

  assert.notEqual(computeFingerprint({ ...base, tools: ['tsc=5.9.0'] }).fingerprint, afterConfig.fingerprint);
  assert.notEqual(computeFingerprint({ ...base, generated: ['missing-generated-dir'] }).fingerprint, afterConfig.fingerprint);
  assert.throws(() => computeFingerprint({ root: dir, scope: [] }), /--scope/);
});

test('reuse decisions follow the rules: exact PASS, known FAIL, widening only for lint and types', async () => {
  const dir = await project();
  const registryPath = path.join(dir, '.ai-work/prd/validation-registry.jsonl');
  const fingerprint = 'f'.repeat(64);
  recordEvidence({ registryPath, kind: 'unit', command: 'bun run test', scopeId: 'pkg', fingerprint, result: 'PASS', stage: 'turbo-backend' });
  recordEvidence({ registryPath, kind: 'build', command: 'bun run build', scopeId: 'pkg', fingerprint, result: 'FAIL', stage: 'lint-ranger' });
  recordEvidence({ registryPath, kind: 'typecheck', command: 'tsc -p .', scopeId: 'pkg', fingerprint, result: 'PASS', stage: 'lint-ranger' });
  recordEvidence({ registryPath, kind: 'lint', command: 'eslint .', scopeId: 'pkg', fingerprint, result: 'PASS', stage: 'lint-ranger' });
  const registry = readRegistry(registryPath);
  assert.equal(registry.length, 4);
  const ask = (overrides) => decideReuse({ registry, fingerprint, mode: 'active', ...overrides });

  const reused = ask({ kind: 'unit', command: 'bun run test', scopeId: 'pkg' });
  assert.equal(reused.decision, 'REUSE');
  assert.match(reused.reason, /reutilizado de turbo-backend, huella f{12}/);
  assert.equal(ask({ kind: 'build', command: 'bun run build', scopeId: 'pkg' }).decision, 'KNOWN_FAIL');
  assert.equal(ask({ kind: 'unit', command: 'bun run test', scopeId: 'pkg', fingerprint: 'a'.repeat(64) }).decision, 'RUN');
  assert.equal(ask({ kind: 'unit', command: 'bun run test', scopeId: 'pkg', fingerprint: 'unknown' }).decision, 'RUN');
  assert.equal(ask({ kind: 'unit', command: 'bun run test --coverage', scopeId: 'pkg' }).decision, 'RUN', 'other flags are another check');

  assert.equal(ask({ kind: 'typecheck', command: 'tsc src/a.ts', scopeId: 'src/a.ts', covers: ['pkg'] }).decision, 'REUSE');
  assert.equal(ask({ kind: 'lint', command: 'eslint src/a.ts', scopeId: 'src/a.ts', covers: ['pkg'] }).decision, 'REUSE');
  assert.equal(ask({ kind: 'lint', command: 'eslint .', scopeId: 'pkg' }).decision, 'RUN', 'cheap lint simply runs');
  assert.equal(ask({ kind: 'unit', command: 'bun test src/a.test.ts', scopeId: 'src/a.test.ts', covers: ['pkg'] }).decision, 'RUN', 'no widening for tests');
  assert.equal(ask({ kind: 'e2e', command: 'playwright test', scopeId: 'all' }).decision, 'RUN');
  assert.equal(ask({ kind: 'integration', command: 'make test-integration', scopeId: 'all' }).decision, 'RUN');
});

test('critical slices, closure and shadow mode always run', async () => {
  const fingerprint = 'c'.repeat(64);
  const registry = [{ stage: 'turbo-backend', kind: 'unit', command: 'bun run test', scope_id: 'pkg', fingerprint, result: 'PASS' }];
  const base = { registry, kind: 'unit', command: 'bun run test', scopeId: 'pkg', fingerprint };
  assert.equal(decideReuse({ ...base, mode: 'active', critical: true }).decision, 'RUN');
  assert.equal(decideReuse({ ...base, mode: 'active', closure: true }).decision, 'RUN');
  const shadow = decideReuse(base);
  assert.equal(shadow.decision, 'RUN');
  assert.equal(shadow.would, 'REUSE');
  assert.match(shadow.reason, /shadow mode/);
});

test('reuse and incremental QA rules are documented with their safeguards', async () => {
  const [stops, qa, runner] = await Promise.all([
    fs.readFile(path.join(root, '.agents/skills/02-implement/implement-prd/reference/validation-and-stop-conditions.md'), 'utf8'),
    fs.readFile(path.join(root, '.agents/skills/02-implement/qa-handoff-review/SKILL.md'), 'utf8'),
    fs.readFile(path.join(root, '.agents/skills/02-implement/validation-runner/SKILL.md'), 'utf8')
  ]);
  assert.match(stops, /## Evidence Reuse/);
  assert.match(stops, /Never compute or guess\s+a fingerprint by hand/);
  assert.match(stops, /Integration and E2E are never reused/);
  assert.match(stops, /Reuse starts in shadow mode/);
  assert.match(stops, /the full suite\s+at closure, which always runs once/);
  assert.match(qa, /### Incremental Re-entry/);
  assert.match(qa, /The first QA is complete/);
  assert.match(qa, /Every file in the final diff must\s+have been reviewed by some QA at its current version/);
  assert.match(qa, /touches files outside the repaired\s+slice/);
  assert.match(qa, /Calibration \(once per project\)/);
  assert.match(runner, /validation-fingerprint\.mjs/);
});
