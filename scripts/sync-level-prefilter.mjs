#!/usr/bin/env node
// Copies the level pre-filter block from .agents/instructions.md (single source)
// into every always-loaded runtime adapter and its template mirror.
// Usage: node scripts/sync-level-prefilter.mjs [--write]
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const prefilterSource = '.agents/instructions.md';
export const prefilterStartMarker = '<!-- workflow-kit:level-prefilter:start -->';
export const prefilterEndMarker = '<!-- workflow-kit:level-prefilter:end -->';

export const prefilterTargets = [
  'CLAUDE.md',
  'templates/runtime-adapters/claude/CLAUDE.md',
  'AGENTS.md',
  'templates/runtime-adapters/agents-md/AGENTS.md',
  '.github/copilot-instructions.md',
  'templates/runtime-adapters/copilot/.github/copilot-instructions.md',
  'ANTIGRAVITY.md',
  'templates/runtime-adapters/antigravity/ANTIGRAVITY.md'
];

export function extractPrefilterBlock(content, sourceLabel = prefilterSource) {
  const start = content.indexOf(prefilterStartMarker);
  const end = content.indexOf(prefilterEndMarker);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`${sourceLabel} must contain the level pre-filter markers in order.`);
  }
  if (content.indexOf(prefilterStartMarker, start + 1) >= 0) {
    throw new Error(`${sourceLabel} contains more than one level pre-filter block.`);
  }
  return content.slice(start, end + prefilterEndMarker.length);
}

export function replacePrefilterBlock(content, block, targetLabel) {
  const current = extractPrefilterBlock(content, targetLabel);
  return content.replace(current, block);
}

async function readText(root, relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

export async function validateLevelPrefilter({ root = packageRoot } = {}) {
  const failures = [];
  let block;
  try {
    block = extractPrefilterBlock(await readText(root, prefilterSource));
  } catch (error) {
    return { ok: false, failures: [error.message] };
  }

  for (const target of prefilterTargets) {
    let content;
    try {
      content = await readText(root, target);
    } catch {
      continue; // Adapter not present in this checkout; nothing to keep in sync.
    }
    try {
      if (extractPrefilterBlock(content, target) !== block) {
        failures.push(`Level pre-filter drift in ${target}; run node scripts/sync-level-prefilter.mjs --write.`);
      }
    } catch (error) {
      failures.push(error.message);
    }
  }

  return { ok: failures.length === 0, failures };
}

export async function writeLevelPrefilter({ root = packageRoot } = {}) {
  const block = extractPrefilterBlock(await readText(root, prefilterSource));
  let written = 0;
  for (const target of prefilterTargets) {
    let content;
    try {
      content = await readText(root, target);
    } catch {
      continue;
    }
    const next = replacePrefilterBlock(content, block, target);
    if (next !== content) {
      await fs.writeFile(path.join(root, target), next);
      written += 1;
    }
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--write')) {
    const written = await writeLevelPrefilter();
    console.log(`Level pre-filter synchronized (${written} adapter files updated).`);
  } else {
    const result = await validateLevelPrefilter();
    if (!result.ok) {
      console.error('Level pre-filter validation failed:');
      for (const failure of result.failures) console.error(`- ${failure}`);
      process.exit(1);
    }
    console.log('Level pre-filter is synchronized across runtime adapters.');
  }
}
