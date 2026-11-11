#!/usr/bin/env node
// Skill files stay at or under 200 lines so an agent reads only the part it
// needs (roadmap D-31). Splits follow load conditions, not line counts: a
// reference must say when to read it. Exceptions are explicit and justified.
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const skillLineLimit = 200;
const scannedRoots = ['.agents/skills', '.agents/delegation'];
// Third-party skills keep their upstream structure so upstream updates still apply.
const thirdPartyPrefixes = ['.agents/skills/04-crosscutting/frontend-design/', '.agents/skills/04-crosscutting/impeccable/', '.agents/skills/05-caveman/'];
// Exceptions: file -> { limit, reason }. Keep this list short.
export const sizeExceptions = {
  '.agents/skills/registry.md': { limit: 260, reason: 'generated inventory, read only for maintenance or fallback' },
  '.agents/skills/01-product/create-prd/PRD_TEMPLATE.md': { limit: 270, reason: 'skeleton copied whole when drafting; its conditional sections already live in template-sections/' },
  '.agents/skills/01-product/create-epic/references/epic-template.md': { limit: 270, reason: 'single fenced skeleton copied whole when drafting an epic' }
};
const referenceDirectories = /\/(reference|references|template-sections)\//;
const loadCondition = /\bread it\b|\bread only\b|\bread this\b|\bleer\b|\bléelo\b|\binsert it\b|\bnever load\b|\buse this template\b|\bload this file\b|\buse this reference\b/i;

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

export async function validateSkillSize({ root = packageRoot } = {}) {
  const failures = [];
  const measured = [];
  for (const scanned of scannedRoots) {
    for (const file of await markdownFiles(root, scanned)) {
      if (thirdPartyPrefixes.some((prefix) => file.startsWith(prefix))) continue;
      const content = await fs.readFile(path.join(root, file), 'utf8');
      const lines = content.replace(/\n$/, '').split('\n').length;
      const limit = sizeExceptions[file]?.limit ?? skillLineLimit;
      measured.push({ file, lines });
      if (lines > limit) {
        failures.push(`${file} has ${lines} lines (limit ${limit}). Move a section that is read under its own condition to a reference file, or add a justified exception.`);
      }
      if (referenceDirectories.test(file) && !(file in sizeExceptions) && !loadCondition.test(content.split('\n').slice(0, 12).join('\n'))) {
        failures.push(`${file} must say in its first lines when to read it.`);
      }
    }
  }
  for (const file of Object.keys(sizeExceptions)) {
    if (!measured.some((item) => item.file === file)) failures.push(`Size exception for a file that no longer exists: ${file}`);
  }
  return { ok: failures.length === 0, failures, fileCount: measured.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateSkillSize();
  if (!result.ok) {
    console.error('Skill size validation failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`All ${result.fileCount} own skill files are within the ${skillLineLimit}-line limit (${Object.keys(sizeExceptions).length} justified exceptions).`);
}
