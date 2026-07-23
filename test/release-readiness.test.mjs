import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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

test('validateReleaseReadiness rejects CI comment bypass', async () => {
  const root = await copyReleaseFixture();
  const ciPath = path.join(root, '.github/workflows/ci.yml');
  const ci = await fs.readFile(ciPath, 'utf8');
  const mutated = ci
    .replace('      - name: Validate legal and provenance guardrails\n        run: npm run check:legal\n', '')
    .concat('\n# npm run check:legal\n');
  await fs.writeFile(ciPath, mutated, 'utf8');

  const result = await validateReleaseReadiness({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('CI workflow must run npm run check:legal')));
});

test('validateReleaseReadiness enforces version bump for distributable changes', async () => {
  const root = await copyReleaseFixture();
  execFileSync('git', ['-C', root, 'init', '--quiet']);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test Runner']);
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-m', 'baseline'], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'branch', '-M', 'main']);
  execFileSync('git', ['-C', root, 'checkout', '-b', 'feature'], { stdio: 'ignore' });

  const touchedTemplate = path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full/.agents/README.md');
  const current = await fs.readFile(touchedTemplate, 'utf8');
  await fs.writeFile(touchedTemplate, `${current}\nChanged distributable surface.\n`, 'utf8');

  const result = await validateReleaseReadiness({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('version must be bumped')));
});

async function copyReleaseFixture() {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-release-'));
  for (const entry of ['package.json', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'RELEASE.md', 'docs', '.github', 'templates', 'src', 'bin']) {
    await fs.cp(path.join(sourceRoot, entry), path.join(targetRoot, entry), { recursive: true });
  }
  return targetRoot;
}
