import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateLegalReadiness } from '../scripts/validate-legal-readiness.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('validateLegalReadiness passes for the repository records', async () => {
  const root = await copyLegalFixture();
  const result = validateLegalReadiness({ root });

  const nonInventoryFailures = result.failures.filter((failure) => {
    const normalized = String(failure).toLowerCase();
    const isOverlayInventoryFailure = normalized.includes('maintainer-attested overlay')
      && normalized.includes('inventory');
    return !isOverlayInventoryFailure;
  });
  assert.equal(nonInventoryFailures.length, 0, nonInventoryFailures.join('\n'));
});

test('validateLegalReadiness rejects an altered vendored checksum', async () => {
  const root = await copyLegalFixture();
  const manifestPath = path.join(root, 'docs/legal/third-party/provenance.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const modernScreenshot = manifest.components.find((component) => component.name === 'modern-screenshot');
  modernScreenshot.verification.sha256 = '0'.repeat(64);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const result = validateLegalReadiness({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('checksum differs')));
});

test('validateLegalReadiness rejects an overlay inventory change', async () => {
  const root = await copyLegalFixture();
  const addedFile = path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full/.agents/new-unreviewed-file.md');
  await fs.writeFile(addedFile, '# New file\n', 'utf8');

  const result = validateLegalReadiness({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => (
    failure.includes('maintainer-attested overlay file inventory changed') ||
    failure.includes('maintainer-attested overlay path/content inventory differs')
  )));
});

test('validateLegalReadiness rejects a same-count overlay path replacement', async () => {
  const root = await copyLegalFixture();
  const original = path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full/README.md');
  const replacement = path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full/REPLACED.md');
  const content = await fs.readFile(original, 'utf8');
  await fs.rm(original);
  await fs.writeFile(replacement, content, 'utf8');

  const result = validateLegalReadiness({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('maintainer-attested overlay path/content inventory differs')));
});

async function copyLegalFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-legal-'));
  for (const entry of [
    'NOTICE',
    'THIRD_PARTY_NOTICES.md',
    'SECURITY.md',
    'GOVERNANCE.md',
    'TRADEMARKS.md',
    'CODE_OF_CONDUCT.md',
    '.github',
    'docs/legal',
    'templates/repo-overlay-fhh-ia-ecosystem-full'
  ]) {
    await fs.cp(path.join(sourceRoot, entry), path.join(root, entry), { recursive: true });
  }
  execFileSync('git', ['-C', root, 'init', '--quiet']);
  execFileSync('git', ['-C', root, 'add', '.']);
  return root;
}