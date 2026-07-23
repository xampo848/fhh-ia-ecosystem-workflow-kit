import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateDocs } from '../scripts/validate-docs.mjs';

test('validateDocs passes for bundled documentation', async () => {
  const result = await validateDocs();
  assert.equal(result.ok, true, result.failures.join('\n'));
});

test('validateDocs rejects missing required safety phrase', async () => {
  const root = await copyDocsFixture();
  await fs.writeFile(path.join(root, 'docs/quickstart.md'), '# Quickstart\n\nNo details yet.\n', 'utf8');

  const result = await validateDocs({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('docs/quickstart.md must mention dry-run')));
});

test('validateDocs rejects removal of the public-release NO-GO decision', async () => {
  const root = await copyDocsFixture();
  await fs.writeFile(path.join(root, 'docs/legal/OPEN-SOURCE-READINESS.md'), '# OPEN SOURCE READINESS\n', 'utf8');

  const result = await validateDocs({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('OPEN-SOURCE-READINESS.md must mention Recommendation: `NO-GO`')));
});

async function copyDocsFixture() {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-docs-'));
  for (const entry of ['README.md', 'RELEASE.md', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'docs', 'examples']) {
    await fs.cp(path.join(sourceRoot, entry), path.join(targetRoot, entry), { recursive: true });
  }
  return targetRoot;
}
