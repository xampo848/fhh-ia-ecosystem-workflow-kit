#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

function fail(msg) {
  console.error(`[legal-check] ${msg}`);
  process.exitCode = 1;
}

const requiredFiles = [
  'NOTICE',
  'THIRD_PARTY_NOTICES.md',
  'docs/legal/PROVENANCE-AUDIT.md',
  'docs/legal/OPEN-SOURCE-READINESS.md',
  'docs/legal/CORPORATE-CONTRIBUTIONS.md',
  '.github/CODEOWNERS',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'SECURITY.md',
  'GOVERNANCE.md',
  'TRADEMARKS.md',
  'CODE_OF_CONDUCT.md'
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    fail(`Missing required compliance file: ${file}`);
  }
}

if (existsSync('THIRD_PARTY_NOTICES.md')) {
  const notices = readFileSync('THIRD_PARTY_NOTICES.md', 'utf-8');
  const expectedMarkers = [
    'modern-screenshot',
    'product-manager-prompts',
    'JuliusBrussee/caveman',
    'pbakaus/impeccable'
  ];
  for (const marker of expectedMarkers) {
    if (!notices.includes(marker)) {
      fail(`THIRD_PARTY_NOTICES.md missing marker: ${marker}`);
    }
  }
}

if (existsSync('docs/legal/PROVENANCE-AUDIT.md')) {
  const provenance = readFileSync('docs/legal/PROVENANCE-AUDIT.md', 'utf-8');
  const requiredClasses = [
    'UNKNOWN_PROVENANCE',
    'REQUIRES_AUTHOR_PERMISSION',
    'EMPLOYMENT_OWNERSHIP_RISK',
    'EXTERNAL_PERMISSIVE'
  ];
  for (const cls of requiredClasses) {
    if (!provenance.includes(cls)) {
      fail(`PROVENANCE-AUDIT.md missing classification: ${cls}`);
    }
  }
}

if (!process.exitCode) {
  console.log('[legal-check] OK');
}
