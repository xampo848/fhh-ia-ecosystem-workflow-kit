import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { enforceVersionBump, validateReleaseReadiness } from '../scripts/validate-release-readiness.mjs';
import { makeTempRepo } from './helpers.mjs';

// Needs `bun` and `tar` on PATH (the packed-file check runs `bun pm pack`). The
// version-bump gate depends on the checked-out branch, so it is covered by the
// throwaway-repository tests below instead.
test('validateReleaseReadiness passes for bundled release prep', async () => {
  const result = await validateReleaseReadiness({ checkVersionBump: false });
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
  assert.ok(result.failures.some((failure) => failure.includes('must keep the "private" flag enabled')));
});

test('validateReleaseReadiness rejects CI comment bypass', async () => {
  const root = await copyReleaseFixture();
  const ciPath = path.join(root, '.github/workflows/ci.yml');
  const ci = await fs.readFile(ciPath, 'utf8');
  const mutated = ci
    .replace('      - name: Validate legal and provenance guardrails\n        run: bun run check:legal\n', '')
    .concat('\n# bun run check:legal\n');
  await fs.writeFile(ciPath, mutated, 'utf8');

  const result = await validateReleaseReadiness({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('CI workflow must run bun run check:legal')));
});

test('validateReleaseReadiness requires exact CI commands, not prefixes', async () => {
  const root = await copyReleaseFixture();
  const ciPath = path.join(root, '.github/workflows/ci.yml');
  const ci = await fs.readFile(ciPath, 'utf8');
  const mutated = ci
    .replace('        run: bun run check\n', '        run: echo skipped\n')
    .replace('        run: bun run check:security\n', '        run: echo skipped\n');
  assert.notEqual(mutated, ci);
  await fs.writeFile(ciPath, mutated, 'utf8');

  const result = await validateReleaseReadiness({ root, checkVersionBump: false });

  assert.ok(result.failures.includes('CI workflow must run bun run check.'), result.failures.join('\n'));
  assert.ok(result.failures.includes('CI workflow must run bun run check:security.'), result.failures.join('\n'));
});

test('validateReleaseReadiness requires full-history checkout and a release base ref in CI', async () => {
  const root = await copyReleaseFixture();
  const ciPath = path.join(root, '.github/workflows/ci.yml');
  const ci = await fs.readFile(ciPath, 'utf8');
  const mutated = ci.replace('          fetch-depth: 0\n', '          fetch-depth: 1\n').replace(/^      RELEASE_BASE_REF:.*\n/m, '');
  assert.notEqual(mutated, ci);
  await fs.writeFile(ciPath, mutated, 'utf8');

  const result = await validateReleaseReadiness({ root, checkVersionBump: false });

  assert.ok(result.failures.some((failure) => failure.includes('fetch-depth: 0')), result.failures.join('\n'));
  assert.ok(result.failures.some((failure) => failure.includes('RELEASE_BASE_REF')), result.failures.join('\n'));
});

test('version-bump gate fails when distributable changes keep the base version', async () => {
  const root = await makeVersionRepo('1.2.0-base');
  await fs.appendFile(path.join(root, 'templates/pack.md'), 'Changed distributable surface.\n', 'utf8');

  const result = enforceVersionBump({ root, version: '1.2.0-base', env: {} });

  assert.ok(result.failures.some((failure) => failure.includes('version must be bumped')), result.failures.join('\n'));
});

test('version-bump gate rejects a version lower than the base', async () => {
  const root = await makeVersionRepo('1.2.0-base');
  await fs.appendFile(path.join(root, 'templates/pack.md'), 'Changed distributable surface.\n', 'utf8');

  const result = enforceVersionBump({ root, version: '1.1.9-later-label', env: {} });

  assert.ok(result.failures.some((failure) => failure.includes('must not be lower than 1.2.0-base')), result.failures.join('\n'));
});

test('version-bump gate accepts a higher version', async () => {
  const root = await makeVersionRepo('1.2.0-base');
  await fs.appendFile(path.join(root, 'templates/pack.md'), 'Changed distributable surface.\n', 'utf8');

  const result = enforceVersionBump({ root, version: '1.3.0-next', env: {} });

  assert.deepEqual(result, { failures: [], notices: [] });
});

test('version-bump gate fails in CI when the base ref cannot be resolved', async () => {
  const root = await makeVersionRepo('1.2.0-base');

  const result = enforceVersionBump({ root, version: '1.2.0-base', env: { CI: 'true', RELEASE_BASE_REF: 'origin/main' } });

  assert.ok(result.failures.some((failure) => failure.includes('Version-bump gate cannot run in CI')), result.failures.join('\n'));
});

test('version-bump gate is skipped locally with a notice when the base ref cannot be resolved', async () => {
  const root = await makeVersionRepo('1.2.0-base');

  const result = enforceVersionBump({ root, version: '1.2.0-base', env: { RELEASE_BASE_REF: 'origin/main' } });

  assert.deepEqual(result.failures, []);
  assert.ok(result.notices.some((notice) => notice.includes('Version-bump gate skipped')), result.notices.join('\n'));
});

test('version-bump gate does not count a suffix-only change as a bump', async () => {
  const root = await makeVersionRepo('1.2.0-base');
  await fs.appendFile(path.join(root, 'templates/pack.md'), 'Changed distributable surface.\n', 'utf8');

  const result = enforceVersionBump({ root, version: '1.2.0-renamed', env: {} });

  assert.ok(result.failures.some((failure) => failure.includes('raise X.Y.Z')), result.failures.join('\n'));
});

test('version-bump gate sees a file moved out of a distributable folder', async () => {
  const root = await makeVersionRepo('1.2.0-base');
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'ignore' });
  await fs.mkdir(path.join(root, 'notes'), { recursive: true });
  git('mv', 'templates/pack.md', 'notes/pack.md');
  git('commit', '-m', 'move out');

  const result = enforceVersionBump({ root, version: '1.2.0-base', env: {} });

  assert.ok(result.failures.some((failure) => failure.includes('version must be bumped')), result.failures.join('\n'));
});

test('version-bump gate sees an untracked new file in a distributable folder', async () => {
  const root = await makeVersionRepo('1.2.0-base');
  await fs.mkdir(path.join(root, 'scripts'), { recursive: true });
  await fs.writeFile(path.join(root, 'scripts/new-check.mjs'), '// new\n', 'utf8');

  const result = enforceVersionBump({ root, version: '1.2.0-base', env: {} });

  assert.ok(result.failures.some((failure) => failure.includes('version must be bumped')), result.failures.join('\n'));
});

test('version-bump gate compares with origin/main by default when a stale local main exists', async () => {
  const root = await makeVersionRepo('1.2.0-base');
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'ignore' });
  // origin/main already released 1.3.0-next; local main still points at 1.2.0-base.
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.3.0-next' }), 'utf8');
  git('commit', '-am', 'release 1.3.0');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  await fs.appendFile(path.join(root, 'templates/pack.md'), 'Changed after the release.\n', 'utf8');

  const result = enforceVersionBump({ root, version: '1.3.0-next', env: {} });

  assert.ok(result.failures.some((failure) => failure.includes('version must be bumped') && failure.includes('origin/main')), result.failures.join('\n'));
});

// Throwaway repository: `main` holds the base version; HEAD is a feature branch.
async function makeVersionRepo(baseVersion) {
  const root = await makeTempRepo('workflow-kit-version-gate-');
  await fs.mkdir(path.join(root, 'templates'), { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: baseVersion }), 'utf8');
  await fs.writeFile(path.join(root, 'templates/pack.md'), '# Pack\n', 'utf8');
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'ignore' });
  git('init', '--quiet');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test Runner');
  git('config', 'commit.gpgsign', 'false');
  git('add', '.');
  git('commit', '-m', 'baseline');
  git('branch', '-M', 'main');
  git('checkout', '-b', 'feature');
  return root;
}

async function copyReleaseFixture() {
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const targetRoot = await makeTempRepo('workflow-kit-release-');
  for (const entry of ['package.json', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'RELEASE.md', 'docs', '.github', 'templates', 'src', 'bin']) {
    await fs.cp(path.join(sourceRoot, entry), path.join(targetRoot, entry), { recursive: true });
  }
  return targetRoot;
}
