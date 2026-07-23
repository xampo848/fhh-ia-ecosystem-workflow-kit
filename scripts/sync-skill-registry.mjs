#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryRelativePath = '.agents/skills/registry.md';
const jsonRelativePath = '.agents/skills/registry.json';
const cacheRelativePath = '.agents/skills/registry.cache.json';
const overlayPrefix = 'templates/repo-overlay-fhh-ia-ecosystem-full';

function cleanCodeCell(value) {
  const trimmed = value.trim();
  return trimmed.startsWith('`') && trimmed.endsWith('`')
    ? trimmed.slice(1, -1)
    : trimmed;
}

function parseInventory(markdown, heading, endHeading) {
  const start = markdown.indexOf(heading);
  if (start < 0) throw new Error(`Missing registry heading: ${heading}`);
  const end = endHeading ? markdown.indexOf(endHeading, start + heading.length) : markdown.length;
  const section = markdown.slice(start, end < 0 ? markdown.length : end);
  const entries = [];

  for (const line of section.split('\n')) {
    if (!/^\|\s*`[^`]+`\s*\|/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 8) throw new Error(`Invalid registry row: ${line}`);
    entries.push({
      name: cleanCodeCell(cells[0]),
      class: cells[1],
      path: cleanCodeCell(cells[2]),
      trigger: cells[3],
      loading_posture: cells[4],
      cost_hint: cells[5] === '—' ? null : cleanCodeCell(cells[5]),
      key: cleanCodeCell(cells[6]),
      runtime_notes: cells[7] === '—' ? null : cells[7]
    });
  }
  return entries;
}

function assertUnique(entries, field) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry[field])) throw new Error(`Duplicate skill ${field}: ${entry[field]}`);
    seen.add(entry[field]);
  }
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function buildSkillRegistryArtifacts({ root = packageRoot } = {}) {
  const markdown = await fs.readFile(path.join(root, registryRelativePath), 'utf8');
  const skills = parseInventory(
    markdown,
    '## Skill inventory',
    '## Standards/pattern skill slot'
  );
  const patternSkills = parseInventory(markdown, '## Standards/pattern skill slot');
  const entries = [...skills, ...patternSkills];
  assertUnique(entries, 'name');
  assertUnique(entries, 'key');

  const registry = {
    schema_version: '1.0.0',
    canonical_source: registryRelativePath,
    derived_artifact: true,
    generated_by: 'scripts/sync-skill-registry.mjs',
    skills,
    pattern_skills: patternSkills
  };
  const registryJson = `${JSON.stringify(registry, null, 2)}\n`;
  const cacheEntries = [];
  for (const entry of entries.sort((a, b) => a.key.localeCompare(b.key))) {
    const skillContent = await fs.readFile(path.join(root, entry.path), 'utf8');
    cacheEntries.push({
      key: entry.key,
      name: entry.name,
      group: patternSkills.includes(entry) ? 'pattern_skills' : 'skills',
      class: entry.class,
      path: entry.path,
      loading_posture: entry.loading_posture,
      skill_sha256: sha256(skillContent)
    });
  }
  const cache = {
    cache_schema_version: '1.0.0',
    derived_artifact: true,
    generated_by: 'scripts/sync-skill-registry.mjs',
    canonical_source: registryRelativePath,
    structured_registry: jsonRelativePath,
    source_hashes: {
      [registryRelativePath]: sha256(markdown),
      [jsonRelativePath]: sha256(registryJson)
    },
    entry_count: cacheEntries.length,
    entries: cacheEntries
  };

  return {
    markdown,
    registryJson,
    cacheJson: `${JSON.stringify(cache, null, 2)}\n`
  };
}

async function compareFile(file, expected, failures) {
  try {
    const actual = await fs.readFile(file, 'utf8');
    if (actual !== expected) failures.push(path.relative(packageRoot, file));
  } catch {
    failures.push(path.relative(packageRoot, file));
  }
}

export async function checkSkillRegistry({ root = packageRoot } = {}) {
  const artifacts = await buildSkillRegistryArtifacts({ root });
  const failures = [];
  await compareFile(path.join(root, jsonRelativePath), artifacts.registryJson, failures);
  await compareFile(path.join(root, cacheRelativePath), artifacts.cacheJson, failures);
  await compareFile(path.join(root, overlayPrefix, registryRelativePath), artifacts.markdown, failures);
  await compareFile(path.join(root, overlayPrefix, jsonRelativePath), artifacts.registryJson, failures);
  await compareFile(path.join(root, overlayPrefix, cacheRelativePath), artifacts.cacheJson, failures);
  return { ok: failures.length === 0, failures };
}

export async function writeSkillRegistry({ root = packageRoot } = {}) {
  const artifacts = await buildSkillRegistryArtifacts({ root });
  const writes = [
    [jsonRelativePath, artifacts.registryJson],
    [cacheRelativePath, artifacts.cacheJson],
    [path.join(overlayPrefix, registryRelativePath), artifacts.markdown],
    [path.join(overlayPrefix, jsonRelativePath), artifacts.registryJson],
    [path.join(overlayPrefix, cacheRelativePath), artifacts.cacheJson]
  ];
  for (const [relativePath, content] of writes) {
    const file = path.join(root, relativePath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, 'utf8');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  if (mode === 'write') {
    await writeSkillRegistry();
    console.log('Skill registry artifacts synchronized.');
  } else {
    const result = await checkSkillRegistry();
    if (!result.ok) {
      console.error('Skill registry artifacts are out of sync:');
      for (const file of result.failures) console.error(`- ${file}`);
      process.exit(1);
    }
    console.log('Skill registry artifacts are synchronized.');
  }
}
