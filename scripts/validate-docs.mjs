#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const requiredDocs = [
  'README.md',
  'docs/quickstart.md',
  'docs/troubleshooting.md',
  'docs/migration.md',
  'docs/README.md',
  'docs/github-install.md',
  'docs/workflow/cross-runtime-capability-matrix.md',
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
  'README.md': ['Quickstart', 'GitHub install', 'Troubleshooting', 'Migration', 'Release Checklist'],
  'docs/quickstart.md': [
    'dry-run', '--apply --yes', 'doctor', 'tui', 'export',
    '## 11. Plugin mode (pilot)', '### Every person installs the plugin', '### Commands that stop', '### What a switch leaves behind', '### `doctor` in plugin mode',
    'init --mode plugin', 'update --mode plugin', 'update --mode repo',
    'claude plugin install fhh@fhh-ia-ecosystem --scope project', 'copilot plugin install fhh@fhh-ia-ecosystem',
    ...['repo-and-plugin', 'plugin-not-declared', 'kit-location-missing', 'plugin-not-installed', 'plugin-version-mismatch', 'plugin-install-unverified', 'plugin-disabled', 'adapter-not-tracked'].map((code) => `mode/${code}`)
  ],
  'docs/troubleshooting.md': ['overwrite_with_backup', 'backup', 'Unsupported runtime', 'missing files'],
  'docs/migration.md': ['manual `.agents` copying', 'full workflow package', 'Runtime adapters', '\n## Rollback', '\n### Deciding edited files'],
  'docs/github-install.md': ['bun add -g', 'public GitHub repository', 'package.json` intentionally remains `private: true`', '## Plugin mode (pilot)', '--mode plugin', 'claude plugin install fhh@fhh-ia-ecosystem --scope project', 'copilot plugin install fhh@fhh-ia-ecosystem'],
  // Plugin mode (plugin-mode pilot AC-20): the four guides explain the two
  // install modes, the install command per person, the switches and the
  // `mode/*` codes. Markers, not sentences, so the prose can still change.
  'docs/README.md': ['## Install modes', 'plugin mode', 'quickstart.md#11-plugin-mode-pilot', 'cross-runtime-capability-matrix.md#plugin-mode'],
  'docs/workflow/cross-runtime-capability-matrix.md': ['\n## Plugin mode', 'Plugin mode (pilot)', 'claude plugin install fhh@fhh-ia-ecosystem --scope project', 'not verified'],
  'docs/legal/OPEN-SOURCE-READINESS.md': ['Recommendation: `GO`', 'product-studio has been removed', 'explicit maintainer approval'],
  'docs/legal/PROVENANCE-AUDIT.md': ['P-010', 'removed from distribution scope', 'SHA-256'],
  'docs/legal/third-party/README.md': ['Schema v2', 'EXTERNAL_UNVERIFIED'],
  'THIRD_PARTY_NOTICES.md': ['frontend-design', 'Product Studio', 'removed from distribution scope'],
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

if (isMainModule(import.meta.url)) {
  const result = await validateDocs();
  if (!result.ok) {
    console.error('Documentation validation failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log('Documentation validation passed. Quickstart, examples, troubleshooting, and migration docs are present.');
}
