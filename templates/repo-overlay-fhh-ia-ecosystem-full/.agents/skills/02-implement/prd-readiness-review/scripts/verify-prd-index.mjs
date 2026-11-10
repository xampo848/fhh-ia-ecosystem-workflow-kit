#!/usr/bin/env node
// Deterministic check of a PRD index against its PRD (roadmap D-17).
// Usage: node verify-prd-index.mjs --prd <prd.md> --index <prd-index.toon>
// Exit codes: 0 complete and current, 1 missing ids or stale hash, 2 usage error.
// Needs only Node.js. It compares identifiers and the PRD hash; it does not
// judge whether an index entry describes its PRD section correctly.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const idPattern = /\b(?:AC|UC|INV(?:-[A-Z0-9]+)*|P\d+-S)-?\d+\b/g;
export const edgeCaseCategories = ['datos vacios', 'limites', 'errores', 'permisos/tenancy', 'concurrencia/orden', 'rollout/rollback'];

function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Section 10 and the traceability matrix repeat ids; ids are taken from the
// whole PRD because an id that exists anywhere must be reachable from the index.
export function extractPrdIds(prd) {
  return [...new Set(prd.match(idPattern) ?? [])].sort();
}

export function prdHash(prd) {
  return createHash('sha256').update(prd).digest('hex');
}

export function verifyPrdIndex({ prd, index }) {
  const failures = [];
  const indexIds = new Set(index.match(idPattern) ?? []);
  const missing = extractPrdIds(prd).filter((id) => !indexIds.has(id));
  if (missing.length > 0) failures.push(`Index is missing PRD ids: ${missing.join(', ')}`);

  const normalizedPrd = normalize(prd);
  const normalizedIndex = normalize(index);
  const missingCategories = edgeCaseCategories.filter((category) => normalizedPrd.includes(category) && !normalizedIndex.includes(category));
  if (missingCategories.length > 0) failures.push(`Index is missing edge-case categories: ${missingCategories.join(', ')}`);

  const recorded = index.match(/^prd_sha256:\s*([a-f0-9]{64})\s*$/m)?.[1];
  const current = prdHash(prd);
  if (!recorded) failures.push('Index has no prd_sha256 line.');
  else if (recorded !== current) failures.push(`Index is stale: PRD changed since the index was built (expected prd_sha256: ${current}). Regenerate the index.`);

  return { ok: failures.length === 0, failures, prdSha256: current };
}

function argument(name) {
  const position = process.argv.indexOf(name);
  return position >= 0 ? process.argv[position + 1] : undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const prdPath = argument('--prd');
  const indexPath = argument('--index');
  if (!prdPath) {
    console.error('Usage: node verify-prd-index.mjs --prd <prd.md> [--index <prd-index.toon>]');
    process.exit(2);
  }
  const prd = readFileSync(prdPath, 'utf8');
  if (!indexPath) {
    console.log(`prd_sha256: ${prdHash(prd)}`);
    console.log(`ids: ${extractPrdIds(prd).join(', ')}`);
    process.exit(0);
  }
  const result = verifyPrdIndex({ prd, index: readFileSync(indexPath, 'utf8') });
  if (result.ok) {
    console.log('PRD index is complete and current.');
  } else {
    for (const failure of result.failures) console.error(failure);
    process.exit(1);
  }
}
