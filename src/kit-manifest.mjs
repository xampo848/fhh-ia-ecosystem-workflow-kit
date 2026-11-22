import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The kit manifest is the closed list of paths the kit owns in a target repo
// (contract: .agents/kit-boundary.md). The CLI reads the copy that ships with
// this package version. scripts/validate-kit-boundary.mjs is not part of the
// published package, so the entry matching and block extraction rules it uses
// are restated here with the same semantics.

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const manifestRelativePath = '.agents/workflow-kit/manifest.json';
export const defaultBlockName = 'workflow-kit:managed';

const packageManifestFile = path.join(packageRoot, 'templates', 'repo-overlay-fhh-ia-ecosystem-full', manifestRelativePath);
const supportedSchemaVersion = '2.0.0';
const manifestClasses = new Set(['kit', 'derived', 'adapter', 'seed', 'state']);

export async function loadKitManifest({ file = packageManifestFile } = {}) {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read the kit manifest ${file}: ${error.message}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    throw new Error(`The kit manifest ${file} is not valid JSON: ${error.message}`);
  }
  const problem = manifestProblem(manifest);
  if (problem) throw new Error(`The kit manifest ${file} ${problem}.`);
  return {
    ...manifest,
    legacy_paths: manifest.legacy_paths ?? {},
    not_shadowable: manifest.not_shadowable ?? [],
    ignore_entries: manifest.ignore_entries ?? [],
    superseded_seeds: manifest.superseded_seeds ?? {}
  };
}

function manifestProblem(manifest) {
  if (manifest?.schema_version !== supportedSchemaVersion) {
    return `has schema_version ${manifest?.schema_version}; this CLI reads ${supportedSchemaVersion}`;
  }
  if (!Array.isArray(manifest.paths) || manifest.paths.length === 0) return 'must list its paths in a non-empty array';
  for (const entry of manifest.paths) {
    if (typeof entry?.path !== 'string') return `has a path entry without a string path (${JSON.stringify(entry)})`;
    if (!manifestClasses.has(entry.class)) return `gives ${entry.path} the unknown class ${entry.class}`;
  }
  if (typeof manifest.project_root !== 'string' || !manifest.project_root.endsWith('/')) return 'has no project_root (a folder ending in /)';
  return null;
}

// The most specific entry wins: an exact path, or a prefix entry ending in `/`.
export function classifyPath(manifest, relativePath) {
  let best = null;
  for (const entry of manifest.paths) {
    const hit = entry.path.endsWith('/') ? relativePath.startsWith(entry.path) : relativePath === entry.path;
    if (hit && (!best || entry.path.length > best.path.length)) best = entry;
  }
  return best;
}

export function isProjectPath(manifest, relativePath) {
  return relativePath.startsWith(manifest.project_root);
}

export function blockMarkers(name) {
  return { start: `<!-- ${name}:start -->`, end: `<!-- ${name}:end -->` };
}

export function extractManagedBlock(content, name = defaultBlockName) {
  const markers = blockMarkers(name);
  const start = content.indexOf(markers.start);
  const endMarker = content.indexOf(markers.end);
  if (start < 0 || endMarker < 0) return { error: 'missing' };
  if (content.indexOf(markers.start, start + 1) >= 0 || content.indexOf(markers.end, endMarker + 1) >= 0) return { error: 'duplicate' };
  if (endMarker < start) return { error: 'unordered' };
  const end = endMarker + markers.end.length;
  return { block: content.slice(start, end), start, end };
}

// Returns the existing content with only its block replaced by the template's,
// or null when the existing content has no single valid block: what to do with
// an unmarked adapter is a migration decision of the caller.
export function replaceManagedBlock(existingContent, templateContent, name = defaultBlockName) {
  const source = extractManagedBlock(templateContent, name);
  if (source.error) throw new Error(`The template has no valid ${name} block (${source.error}).`);
  const target = extractManagedBlock(existingContent, name);
  if (target.error) return null;
  return existingContent.slice(0, target.start) + source.block + existingContent.slice(target.end);
}

export function supersededSeedHashes(manifest, relativePath) {
  return new Set(Object.hasOwn(manifest.superseded_seeds, relativePath) ? manifest.superseded_seeds[relativePath] : []);
}

export function legacyPathFor(manifest, currentPath) {
  const match = Object.entries(manifest.legacy_paths).find(([, current]) => current === currentPath);
  return match ? match[0] : null;
}

export function currentPathFor(manifest, legacyPath) {
  return Object.hasOwn(manifest.legacy_paths, legacyPath) ? manifest.legacy_paths[legacyPath] : null;
}
