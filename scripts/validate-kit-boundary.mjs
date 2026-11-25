#!/usr/bin/env node
// Enforces the kit/project boundary (.agents/kit-boundary.md) in the kit source:
// the manifest is a closed, classed list that covers every installable file;
// adapters carry exactly one kit-owned block; path references follow
// INV-PATH-01; and a project overlay, when present, is well formed.
// Usage: node scripts/validate-kit-boundary.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { thirdPartyPrefixes } from './validate-skill-size.mjs';
import { isMainModule } from './is-main-module.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const manifestPath = '.agents/workflow-kit/manifest.json';
const overlayTemplate = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const adapterTemplates = 'templates/runtime-adapters';
const classes = new Set(['kit', 'derived', 'adapter', 'seed', 'state']);
const defaultBlock = 'workflow-kit:managed';
const prefilterBlock = 'workflow-kit:level-prefilter';
const projectRoot = '.agents/project/';
const projectSkillsRoot = '.agents/project/skills/';
const runbooksRoot = '.agents/project/skills/runbooks/';
const projectSkillClasses = new Set(['Pattern', 'Runbook']);
// Headings every runbook carries (.agents/kit-boundary.md, "Runbooks").
export const runbookSections = ['## Trigger', '## Preconditions', '## Steps', '## Verification', '## Rollback'];
const ignoredBasenames = new Set(['.DS_Store']);
// Characters that turn a path reference into a pattern (placeholder or glob).
const patternChars = /[<*{[]/;
const pathReference = /(?<![\w./-])\.agents\/[A-Za-z0-9._/<>*{}-]*[A-Za-z0-9_/>*}-]/g;

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function walk(root, relative = '') {
  const files = [];
  let entries;
  try {
    entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return files;
    throw error;
  }
  for (const entry of entries) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walk(root, child));
    else if (entry.isFile() && !ignoredBasenames.has(entry.name)) files.push(child);
  }
  return files.sort();
}

export function matchEntry(manifest, relativePath) {
  let best = null;
  for (const entry of manifest.paths) {
    const hit = entry.path.endsWith('/') ? relativePath.startsWith(entry.path) : relativePath === entry.path;
    if (hit && (!best || entry.path.length > best.path.length)) best = entry;
  }
  return best;
}

// Installable files keyed by their target path, with every template copy that backs them.
export async function installableFiles(root) {
  const files = new Map();
  const add = (target, source) => files.set(target, [...(files.get(target) ?? []), source]);
  for (const file of await walk(path.join(root, overlayTemplate))) {
    if (file !== 'README.md') add(file, `${overlayTemplate}/${file}`);
  }
  for (const runtime of await fs.readdir(path.join(root, adapterTemplates), { withFileTypes: true })) {
    if (!runtime.isDirectory()) continue;
    for (const file of await walk(path.join(root, adapterTemplates, runtime.name))) {
      add(file, `${adapterTemplates}/${runtime.name}/${file}`);
    }
  }
  return files;
}

export function validateManifestShape(manifest, packageVersion) {
  const failures = [];
  if (manifest.schema_version !== '2.0.0') failures.push(`${manifestPath}: schema_version must be 2.0.0.`);
  if (manifest.kit_version !== packageVersion) {
    failures.push(`${manifestPath}: kit_version ${manifest.kit_version} differs from package.json version ${packageVersion}.`);
  }
  if (manifest.project_root !== projectRoot) failures.push(`${manifestPath}: project_root must be ${projectRoot}.`);
  if (!Array.isArray(manifest.paths) || manifest.paths.length === 0) {
    failures.push(`${manifestPath}: paths must be a non-empty list.`);
    return failures;
  }
  const seen = new Set();
  for (const entry of manifest.paths) {
    if (seen.has(entry.path)) failures.push(`${manifestPath}: duplicate entry ${entry.path}.`);
    seen.add(entry.path);
    if (!classes.has(entry.class)) failures.push(`${manifestPath}: ${entry.path} has unknown class ${entry.class}.`);
    if (entry.path.startsWith(projectRoot) && entry.class !== 'seed') {
      failures.push(`${manifestPath}: ${entry.path} is under ${projectRoot}; the kit may only seed project files (class seed).`);
    }
    if (entry.block && entry.class !== 'adapter') failures.push(`${manifestPath}: ${entry.path} declares a block but is not an adapter.`);
  }
  for (const [legacy, current] of Object.entries(manifest.legacy_paths ?? {})) {
    if (!(manifest.project_layout ?? []).includes(current)) failures.push(`${manifestPath}: legacy path ${legacy} maps to ${current}, which is not in project_layout.`);
  }
  for (const [skill, file] of Object.entries(manifest.extension_points ?? {})) {
    if (!isInLayout(manifest, file)) failures.push(`${manifestPath}: extension point of ${skill} (${file}) is not in project_layout.`);
  }
  return failures;
}

export function validateCoverage(manifest, files) {
  const failures = [];
  const matched = new Set();
  for (const [target, sources] of files) {
    const entry = matchEntry(manifest, target);
    if (target.startsWith(projectRoot) && entry?.class !== 'seed') {
      failures.push(`${sources[0]}: the template ships ${target} under ${projectRoot} without class seed; the project overlay is never distributed.`);
      continue;
    }
    if (!entry) {
      failures.push(`${sources[0]}: installs ${target}, which no manifest entry covers; add it to ${manifestPath} with a class.`);
      continue;
    }
    matched.add(entry.path);
  }
  for (const entry of manifest.paths) {
    if (!entry.generated && !matched.has(entry.path)) {
      failures.push(`${manifestPath}: ${entry.path} matches no template file; remove it or mark it generated.`);
    }
  }
  return failures;
}

function blockMarkers(name) {
  return { start: `<!-- ${name}:start -->`, end: `<!-- ${name}:end -->` };
}

export function extractBlock(content, name) {
  const { start, end } = blockMarkers(name);
  const first = content.indexOf(start);
  const last = content.indexOf(end);
  if (first < 0 || last < 0) return { error: 'is missing its markers' };
  if (content.indexOf(start, first + 1) >= 0 || content.indexOf(end, last + 1) >= 0) return { error: 'has more than one block' };
  if (last < first) return { error: 'has its end marker before its start marker' };
  return { block: content.slice(first, last + end.length), start: first, end: last + end.length };
}

export async function validateAdapters(root, manifest, files) {
  const failures = [];
  for (const entry of manifest.paths.filter((item) => item.class === 'adapter')) {
    const name = entry.block ?? defaultBlock;
    const sources = files.get(entry.path) ?? [];
    const copies = [...sources];
    const managed = name === defaultBlock;
    if (managed && await exists(path.join(root, entry.path))) copies.push(entry.path);
    const blocks = new Map();
    for (const copy of copies) {
      const content = await fs.readFile(path.join(root, copy), 'utf8');
      const result = extractBlock(content, name);
      if (result.error) {
        failures.push(`${copy}: the ${name} block ${result.error}.`);
        continue;
      }
      blocks.set(copy, result.block);
      const prefilter = extractBlock(content, prefilterBlock);
      if (managed && !prefilter.error && (prefilter.start < result.start || prefilter.end > result.end)) {
        failures.push(`${copy}: the level pre-filter block must sit inside the ${name} block.`);
      }
    }
    const distinct = new Set(blocks.values());
    if (managed && distinct.size > 1) {
      failures.push(`${entry.path}: the ${name} block differs between ${[...blocks.keys()].join(' and ')}; copy the template block.`);
    }
  }
  return failures;
}

function isInLayout(manifest, reference) {
  if (reference === projectRoot || `${reference}/` === projectRoot) return true;
  return (manifest.project_layout ?? []).some((item) => (
    item.endsWith('/') ? reference.startsWith(item) || `${reference}/` === item : reference === item
  ));
}

function staticPrefix(reference) {
  const special = reference.search(patternChars);
  if (special < 0) return reference;
  return reference.slice(0, reference.lastIndexOf('/', special) + 1);
}

export function referencesIn(content) {
  return [...content.matchAll(pathReference)].map((match) => ({
    reference: match[0].replace(/[.]+$/, ''),
    line: content.slice(0, match.index).split('\n').length
  }));
}

async function scannedKitFiles(root, manifest) {
  const files = [];
  for (const file of await walk(path.join(root, '.agents'))) {
    const relative = `.agents/${file}`;
    // Third-party skills keep their upstream text, so their paths are not the kit's to fix.
    if (!relative.endsWith('.md') || thirdPartyPrefixes.some((prefix) => relative.startsWith(prefix))) continue;
    const entry = matchEntry(manifest, relative);
    if (entry && (entry.class === 'kit' || entry.class === 'derived')) files.push({ file: relative, content: await fs.readFile(path.join(root, relative), 'utf8') });
  }
  // Kit docs installed with the overlay (docs/workflow/**) follow the same rules.
  for (const file of await walk(path.join(root, overlayTemplate, 'docs/workflow'))) {
    if (!file.endsWith('.md')) continue;
    const relative = `${overlayTemplate}/docs/workflow/${file}`;
    files.push({ file: relative, content: await fs.readFile(path.join(root, relative), 'utf8') });
  }
  for (const entry of manifest.paths.filter((item) => item.class === 'adapter' && !item.block)) {
    if (!await exists(path.join(root, entry.path))) continue;
    const content = await fs.readFile(path.join(root, entry.path), 'utf8');
    const result = extractBlock(content, defaultBlock);
    if (!result.error) files.push({ file: entry.path, content: result.block });
  }
  return files;
}

export async function validatePathReferences(root, manifest) {
  const failures = [];
  const legacy = manifest.legacy_paths ?? {};
  for (const { file, content } of await scannedKitFiles(root, manifest)) {
    const lines = content.split('\n');
    for (const { reference, line } of referencesIn(content)) {
      const where = `${file}:${line}`;
      if (legacy[reference]) {
        if (!lines[line - 1].includes(legacy[reference])) {
          failures.push(`${where}: legacy path ${reference} must be named next to its current path ${legacy[reference]}.`);
        }
        continue;
      }
      if (reference.startsWith(projectRoot) || `${reference}/` === projectRoot) {
        const prefix = staticPrefix(reference);
        const wholeOverlay = prefix !== projectRoot || /^(\*\*?)?(\/\*\*?)*$/.test(reference.slice(projectRoot.length));
        if (!wholeOverlay || !isInLayout(manifest, prefix)) {
          failures.push(`${where}: ${reference} is not in the overlay layout (project_layout in ${manifestPath}).`);
        }
        continue;
      }
      const target = staticPrefix(reference);
      if (!await exists(path.join(root, target))) {
        failures.push(`${where}: ${reference} does not resolve inside the kit tree.`);
      }
    }
  }
  for (const file of await walk(path.join(root, '.agents/project'))) {
    const relative = `.agents/project/${file}`;
    // A shadow is a fork of kit text, so it may keep the kit's own paths.
    if (!relative.endsWith('.md') || relative.startsWith('.agents/project/shadows/')) continue;
    const content = await fs.readFile(path.join(root, relative), 'utf8');
    for (const { reference, line } of referencesIn(content)) {
      if (!reference.startsWith(projectRoot) && !legacy[reference]) {
        failures.push(`${relative}:${line}: project files name kit skills by name, never by path (${reference}).`);
      }
    }
  }
  return failures;
}

function tableRows(markdown, heading) {
  const start = markdown.search(new RegExp(`^## ${heading}\\s*$`, 'm'));
  if (start < 0) return [];
  const rest = markdown.slice(start).split('\n').slice(1);
  const rows = [];
  for (const line of rest) {
    if (/^#{1,2} /.test(line)) break;
    if (!line.startsWith('|') || /^\|[\s|:-]+\|?\s*$/.test(line)) continue;
    rows.push(line.split('|').slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/g, '')));
  }
  // The first table row is the header.
  return rows.slice(1);
}

async function kitSkillNames(root) {
  try {
    const registry = JSON.parse(await fs.readFile(path.join(root, '.agents/skills/registry.json'), 'utf8'));
    const names = new Map();
    for (const item of [...registry.skills, ...registry.pattern_skills]) {
      names.set(item.name, item.path);
      names.set(item.key, item.path);
    }
    return names;
  } catch {
    return new Map();
  }
}

async function validateRunbook(root, skillPath) {
  const failures = [];
  const content = await fs.readFile(path.join(root, skillPath), 'utf8');
  const folder = path.posix.basename(path.posix.dirname(skillPath));
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1] ?? '';
  const name = /^name:\s*["']?([^"'\r\n]*?)["']?\s*$/m.exec(frontmatter)?.[1];
  if (name !== folder) failures.push(`${skillPath}: runbook frontmatter name ${name ?? '(missing)'} differs from its folder ${folder}.`);
  const headings = new Set(content.split(/\r?\n/).map((line) => line.trim()));
  for (const section of runbookSections) {
    if (!headings.has(section)) failures.push(`${skillPath}: runbook has no ${section} section.`);
  }
  return failures;
}

export async function validateProjectOverlay(root, manifest) {
  const failures = [];
  const indexPath = '.agents/project/index.md';
  if (!await exists(path.join(root, indexPath))) return failures;
  const index = await fs.readFile(path.join(root, indexPath), 'utf8');
  const kitNames = await kitSkillNames(root);
  for (const [name, skillClass, , skillPath] of tableRows(index, 'Skills')) {
    if (kitNames.has(name)) failures.push(`${indexPath}: project skill ${name} reuses a kit skill name; use extend or shadow instead.`);
    if (!projectSkillClasses.has(skillClass)) failures.push(`${indexPath}: project skill ${name} has class ${skillClass}; use Pattern or Runbook.`);
    const runbookPath = `${runbooksRoot}${name}/SKILL.md`;
    if (skillClass === 'Runbook' && skillPath !== runbookPath) failures.push(`${indexPath}: runbook ${name} must live at ${runbookPath} (folder equals the skill name).`);
    if (skillClass === 'Pattern' && skillPath?.startsWith(runbooksRoot)) failures.push(`${indexPath}: pattern ${name} must not live under ${runbooksRoot}; only runbooks do.`);
    if (!skillPath?.startsWith(projectSkillsRoot)) failures.push(`${indexPath}: project skill ${name} must live under ${projectSkillsRoot}.`);
    else if (!await exists(path.join(root, skillPath))) failures.push(`${indexPath}: project skill ${name} points to missing ${skillPath}.`);
    else if (skillClass === 'Runbook') failures.push(...await validateRunbook(root, skillPath));
  }
  for (const [skill, file] of tableRows(index, 'Extensions')) {
    if (manifest.extension_points?.[skill] !== file) failures.push(`${indexPath}: ${skill} declares no extension point at ${file}.`);
    else if (!await exists(path.join(root, file))) failures.push(`${indexPath}: extension of ${skill} points to missing ${file}.`);
  }
  for (const [skill, directory] of tableRows(index, 'Shadows')) {
    const where = `${indexPath}: shadow of ${skill}`;
    if ((manifest.not_shadowable ?? []).includes(skill)) {
      failures.push(`${where} is not allowed; ${skill} accepts only extend through .agents/project/routing.md.`);
      continue;
    }
    if (!kitNames.has(skill)) failures.push(`${where} names no kit skill.`);
    const dir = directory.replace(/\/$/, '');
    if (!dir.startsWith('.agents/project/shadows/')) {
      failures.push(`${where} must live under .agents/project/shadows/.`);
      continue;
    }
    if (!await exists(path.join(root, dir, 'SKILL.md'))) failures.push(`${where} has no SKILL.md.`);
    let record;
    try {
      record = JSON.parse(await fs.readFile(path.join(root, dir, 'shadow.json'), 'utf8'));
    } catch {
      failures.push(`${where} has no readable shadow.json.`);
      continue;
    }
    if (record.skill !== skill || !/^[0-9a-f]{64}$/.test(record.base_sha256 ?? '') || typeof record.kit_path !== 'string') {
      failures.push(`${where}: shadow.json needs skill, kit_path, and a sha256 base_sha256.`);
    } else if (!await exists(path.join(root, record.kit_path))) {
      failures.push(`${where}: shadow.json kit_path ${record.kit_path} does not exist in the kit.`);
    }
  }
  return failures;
}

export async function validateKitBoundary({ root = packageRoot } = {}) {
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(root, manifestPath), 'utf8'));
  } catch (error) {
    return { ok: false, failures: [`${manifestPath}: cannot read the manifest (${error.message}).`] };
  }
  const packageVersion = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
  const shape = validateManifestShape(manifest, packageVersion);
  if (!Array.isArray(manifest.paths)) return { ok: false, failures: shape };
  const files = await installableFiles(root);
  const failures = [
    ...shape,
    ...validateCoverage(manifest, files),
    ...await validateAdapters(root, manifest, files),
    ...await validatePathReferences(root, manifest),
    ...await validateProjectOverlay(root, manifest)
  ];
  return { ok: failures.length === 0, failures, fileCount: files.size };
}

if (isMainModule(import.meta.url)) {
  const result = await validateKitBoundary();
  if (!result.ok) {
    console.error('Kit boundary validation failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Kit boundary holds: the manifest covers all ${result.fileCount} installable files, adapters and path references follow .agents/kit-boundary.md.`);
}
