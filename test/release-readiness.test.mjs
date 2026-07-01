import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateReleaseReadiness } from '../scripts/validate-release-readiness.mjs';

test('validateReleaseReadiness passes for bundled release prep', async () => {
  const result = await validateReleaseReadiness();
  assert.equal(result.ok, true, result.failures.join('\n'));
});

test('validateReleaseReadiness rejects publish scripts', async () => {
  const root = await copyReleaseFixture();
  const packageJsonPath = path.join(root, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  packageJson.scripts.publish = 'npm publish';
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');

  const result = await validateReleaseReadiness({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('must not publish')));
});

test('validateReleaseReadiness rejects public package before approval', async () => {
  const root = await copyReleaseFixture();
  const packageJsonPath = path.join(root, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  packageJson.private = false;
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');

  const result = await validateReleaseReadiness({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('must remain private')));
});

async function copyReleaseFixture() {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-release-'));
  for (const entry of ['package.json', 'RELEASE.md', 'docs', '.github']) {
    await fs.cp(path.join(sourceRoot, entry), path.join(targetRoot, entry), { recursive: true });
  }
  return targetRoot;
}
