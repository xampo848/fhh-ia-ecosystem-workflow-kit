#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const requiredDocs = [
  'README.md',
  'docs/quickstart.md',
  'docs/troubleshooting.md',
  'docs/migration.md',
  'docs/private-github-install.md',
  'docs/adapter-authoring.md',
  'docs/versioning.md',
  'docs/legal/OPEN-SOURCE-READINESS.md',
  'docs/legal/PROVENANCE-AUDIT.md',
  'docs/legal/third-party/README.md',
  'RELEASE.md',
  'NOTICE',
  'THIRD_PARTY_NOTICES.md',
  'examples/fresh-codex/README.md',
  'examples/existing-copilot/README.md',
  'examples/neutral-core/README.md'
];

const requiredPhrases = {
  'README.md': ['Quickstart', 'Private GitHub install', 'Troubleshooting', 'Migration', 'Release Checklist'],
  'docs/quickstart.md': ['dry-run', '--apply --yes', 'doctor', 'tui', 'export'],
  'docs/troubleshooting.md': ['overwrite_with_backup', 'backup', 'Unsupported runtime', 'missing files'],
  'docs/migration.md': ['manual `.agents` copying', 'full workflow package', 'Runtime adapters'],
  'docs/private-github-install.md': ['npm install -g', 'private repository', 'package.json` intentionally remains `private: true`'],
  'docs/legal/OPEN-SOURCE-READINESS.md': ['Recommendation: `NO-GO`', 'EXTERNAL_UNVERIFIED', 'product-studio'],
  'docs/legal/PROVENANCE-AUDIT.md': ['EXTERNAL_UNVERIFIED', 'P-010', 'SHA-256'],
  'docs/legal/third-party/README.md': ['Schema v2', 'EXTERNAL_UNVERIFIED'],
  'THIRD_PARTY_NOTICES.md': ['frontend-design', 'EXTERNAL_UNVERIFIED', 'product-studio'],
  'examples/fresh-codex/README.md': ['--runtime codex', '--apply --yes'],
  'examples/existing-copilot/README.md': ['--runtime copilot', 'overwrite_with_backup'],
  'examples/neutral-core/README.md': ['--runtime neutral', 'No runtime adapter files']
};

export async function validateDocs({ root = packageRoot } = {}) {
  const failures = [];

  for (const doc of requiredDocs) {
    const file = path.join(root, doc);
    let content = '';
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      failures.push(`Required documentation file missing: ${doc}`);
      continue;
    }

    for (const phrase of requiredPhrases[doc] ?? []) {
      if (!content.includes(phrase)) failures.push(`${doc} must mention ${phrase}.`);
    }
  }

  return { ok: failures.length === 0, failures };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateDocs();
  if (!result.ok) {
    console.error('Documentation validation failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log('Documentation validation passed. Quickstart, examples, troubleshooting, and migration docs are present.');
}
