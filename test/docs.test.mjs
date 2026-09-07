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

test('validateDocs rejects removal of the public-release GO decision', async () => {
  const root = await copyDocsFixture();
  await fs.writeFile(path.join(root, 'docs/legal/OPEN-SOURCE-READINESS.md'), '# OPEN SOURCE READINESS\n', 'utf8');

  const result = await validateDocs({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('OPEN-SOURCE-READINESS.md must mention Recommendation: `GO`')));
});

test('cross-runtime baseline documents preserve unknown runtime evidence and required fields', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const [matrix, runbook] = await Promise.all([
    fs.readFile(path.join(root, 'docs/workflow/cross-runtime-capability-matrix.md'), 'utf8'),
    fs.readFile(path.join(root, 'docs/workflow/cross-runtime-delegation-runbook.md'), 'utf8')
  ]);

  for (const field of ['Surface', 'Runtime version', 'Schema version', 'Registered agent', 'Requested model', 'Resolved model', 'Overrides', 'Permissions', 'Result']) {
    assert.match(matrix, new RegExp(field));
  }
  assert.match(matrix, /\| Copilot \| `unknown` \| `unknown`/);
  assert.match(matrix, /\| Claude Code \| `unknown` \| `unknown`/);
  assert.match(matrix, /Documented \| Configured \| Observed/);
  assert.match(runbook, /resolved_model: unknown/);
  assert.match(runbook, /effective_agent: unknown/);
});

test('cross-runtime baseline documents prohibit unobserved compatibility claims', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const documents = await Promise.all([
    fs.readFile(path.join(root, 'docs/workflow/cross-runtime-capability-matrix.md'), 'utf8'),
    fs.readFile(path.join(root, 'docs/workflow/cross-runtime-delegation-runbook.md'), 'utf8')
  ]);
  const content = documents.join('\n');

  assert.match(content, /does not\s+claim compatibility/i);
  assert.match(content, /Do not state that Copilot or Claude Code is compatible/i);
  assert.match(content, /Only `observed` describes the executed runtime\/surface\/version/);
  assert.doesNotMatch(content, /Copilot and Claude Code (are|remain) compatible/i);
});

test('diagnostics policy keeps opt-in local storage and forbids secrets, prompts, and invented telemetry', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const [policy, gitignore] = await Promise.all([
    fs.readFile(path.join(root, 'docs/workflow/delegation-diagnostics-policy.md'), 'utf8'),
    fs.readFile(path.join(root, '.gitignore'), 'utf8')
  ]);

  assert.match(gitignore, /\.agents\/workflow-kit\/diagnostics\//);
  assert.match(policy, /ignored by Git/);
  assert.match(policy, /Opt-in only/);
  assert.match(policy, /Prompts, full conversation transcripts/);
  assert.match(policy, /Secrets, credentials, tokens, or environment variable values/);
  assert.match(policy, /Never estimate a figure\s+and present it as measured/);
  assert.match(policy, /Missing diagnostics do not block PRD closure/);
});

test('cross-runtime benchmark contract forbids unearned savings claims and unsourced cost figures', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const benchmark = await fs.readFile(path.join(root, 'docs/workflow/cross-runtime-delegation-benchmark.md'), 'utf8');

  assert.match(benchmark, /No runtime pilot has been executed yet/);
  assert.match(benchmark, /unknown-no-real-source/);
  assert.match(benchmark, /Do not fix a savings percentage without a completed baseline\/candidate pair/);
  assert.match(benchmark, /Do not equate byte counts or tool-call counts with\s+monetary cost/);
  assert.match(benchmark, /Do not cite\s+this document as evidence of measured savings/);
});

async function copyDocsFixture() {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-docs-'));
  for (const entry of ['README.md', 'RELEASE.md', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'docs', 'examples']) {
    await fs.cp(path.join(sourceRoot, entry), path.join(targetRoot, entry), { recursive: true });
  }
  return targetRoot;
}
