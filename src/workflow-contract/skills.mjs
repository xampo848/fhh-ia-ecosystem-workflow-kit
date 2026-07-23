import fs from 'node:fs/promises';
import path from 'node:path';
import { diagnostic } from './diagnostics.mjs';

async function collectSkillFiles(root) {
  const base = path.join(root, '.agents/skills');
  const files = [];
  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && entry.name === 'SKILL.md') {
        files.push(path.relative(root, absolute).split(path.sep).join('/'));
      }
    }
  }
  await walk(base);
  return files.sort();
}

export async function validateSkillRegistry({ root }) {
  const diagnostics = [];
  const relativePath = '.agents/skills/registry.json';
  let registry;
  try {
    registry = JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
  } catch {
    return [diagnostic({
      code: 'skills/invalid-registry',
      path: relativePath,
      message: 'Expected valid JSON skill registry.'
    })];
  }

  const entries = [...(registry.skills ?? []), ...(registry.pattern_skills ?? [])];
  if (!Array.isArray(registry.skills) || !Array.isArray(registry.pattern_skills)) {
    diagnostics.push(diagnostic({
      code: 'skills/invalid-registry',
      path: relativePath,
      message: 'Expected skills and pattern_skills arrays.'
    }));
    return diagnostics;
  }

  for (const field of ['name', 'key']) {
    const seen = new Set();
    for (const entry of entries) {
      const value = entry[field];
      if (!value) continue;
      if (seen.has(value)) {
        diagnostics.push(diagnostic({
          code: `skills/duplicate-${field}`,
          path: relativePath,
          message: `Duplicate ${field}: ${value}.`
        }));
      }
      seen.add(value);
    }
  }

  const registeredPaths = new Set();
  for (const entry of entries) {
    if (!entry.name || !entry.key || !entry.path || !entry.class || !entry.trigger || !entry.loading_posture) {
      diagnostics.push(diagnostic({
        code: 'skills/invalid-registry',
        path: relativePath,
        message: `Incomplete registry entry: ${entry.name ?? entry.key ?? 'unknown'}.`
      }));
      continue;
    }
    registeredPaths.add(entry.path);
    try {
      await fs.access(path.join(root, entry.path));
    } catch {
      diagnostics.push(diagnostic({
        code: 'skills/missing-file',
        path: entry.path,
        message: `Registered skill ${entry.name} does not exist.`
      }));
    }
  }

  for (const skillPath of await collectSkillFiles(root)) {
    if (!registeredPaths.has(skillPath)) {
      diagnostics.push(diagnostic({
        code: 'skills/unregistered-file',
        path: skillPath,
        message: 'SKILL.md is not represented in registry.json.'
      }));
    }
  }

  return diagnostics;
}
