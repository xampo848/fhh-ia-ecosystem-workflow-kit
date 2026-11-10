#!/usr/bin/env node
// Workflow skills must name neutral paths only (roadmap D-29): a rule that
// points into one runtime's folder is silently skipped in every other runtime.
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scannedRoots = ['.agents/skills', '.agents/delegation'];
const runtimePath = /(?:^|[^A-Za-z0-9_])(\.github\/|\.claude\/|\.codex\/|\.antigravity\/|\.cursor\/|\.opencode\/)/;

// Files allowed to name runtime folders, each with the reason.
export const runtimePathAllowlist = {
  '.agents/skills/README.md': 'explains how runtime wrappers relate to the canonical skills',
  '.agents/skills/registry.md': 'explains how runtime wrappers relate to the canonical skills',
  '.agents/skills/00-router/workflow-router/SKILL.md': 'lists the runtime adapters that are thin wrappers',
  '.agents/skills/02-implement/implement-prd/reference/delegate-skill-matrix.md': 'generated matrix of native adapters per runtime',
  '.agents/skills/06-patterns/authoring/init-legacy-attachments/SKILL.md': 'migrates skills found in legacy runtime folders'
};
// Third-party skills keep their upstream text (docs/legal/third-party/provenance.json).
const thirdPartyPrefixes = ['.agents/skills/04-crosscutting/frontend-design/', '.agents/skills/04-crosscutting/impeccable/', '.agents/skills/05-caveman/'];

async function markdownFiles(root, directory) {
  const files = [];
  let entries;
  try {
    entries = await fs.readdir(path.join(root, directory), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return files;
    throw error;
  }
  for (const entry of entries) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await markdownFiles(root, relative));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(relative);
  }
  return files;
}

export async function validateNeutralPaths({ root = packageRoot } = {}) {
  const failures = [];
  for (const scanned of scannedRoots) {
    for (const file of await markdownFiles(root, scanned)) {
      if (file in runtimePathAllowlist || thirdPartyPrefixes.some((prefix) => file.startsWith(prefix))) continue;
      const lines = (await fs.readFile(path.join(root, file), 'utf8')).split('\n');
      lines.forEach((line, index) => {
        const match = line.match(runtimePath);
        if (match) failures.push(`${file}:${index + 1} names the runtime folder ${match[1]} — use the neutral path under .agents/ (or add the file to the allowlist with a reason).`);
      });
    }
  }
  return { ok: failures.length === 0, failures };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateNeutralPaths();
  if (!result.ok) {
    console.error('Neutral path validation failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log('Workflow skills name neutral paths only.');
}
