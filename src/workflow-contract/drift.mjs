import fs from 'node:fs/promises';
import path from 'node:path';
import { classifyPath, loadKitManifest, manifestRelativePath } from '../kit-manifest.mjs';
import { diagnostic } from './diagnostics.mjs';

// The installable overlay ships the kit's .agents/ tree. Only the paths the
// manifest gives to the kit (kit, derived and seed, never a generated one)
// are compared: install state and the project's own files under
// .agents/project/ are local to a checkout.
const comparedClasses = new Set(['kit', 'derived', 'seed']);
const ignoredBasenames = new Set(['.DS_Store']);

function isCompared(manifest, relativePath) {
  if (ignoredBasenames.has(path.posix.basename(relativePath))) return false;
  const entry = classifyPath(manifest, relativePath);
  return Boolean(entry) && comparedClasses.has(entry.class) && !entry.generated;
}

export async function validateOverlayDrift({ root }) {
  const diagnostics = [];
  const overlayRoot = path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full');
  const drift = (relativePath, message) => diagnostics.push(diagnostic({ code: 'overlay/content-drift', path: relativePath, message }));

  let manifest;
  try {
    manifest = await loadKitManifest({ file: path.join(root, manifestRelativePath) });
  } catch (error) {
    drift(manifestRelativePath, `The kit manifest cannot be read, so the overlay cannot be compared: ${error.message}`);
    return diagnostics;
  }

  let canonicalFiles;
  let overlayFiles;
  try {
    [canonicalFiles, overlayFiles] = await Promise.all([
      collectFiles(path.join(root, '.agents')),
      collectFiles(path.join(overlayRoot, '.agents'))
    ]);
  } catch {
    drift('.agents', 'Canonical or installable overlay .agents/ directory is missing.');
    return diagnostics;
  }

  const canonical = new Set(canonicalFiles.map((file) => `.agents/${file}`).filter((file) => isCompared(manifest, file)));
  const overlay = new Set(overlayFiles.map((file) => `.agents/${file}`).filter((file) => isCompared(manifest, file)));
  for (const relativePath of [...new Set([...canonical, ...overlay])].sort()) {
    if (!overlay.has(relativePath)) {
      drift(relativePath, 'Canonical file is missing from the installable overlay.');
      continue;
    }
    if (!canonical.has(relativePath)) {
      drift(relativePath, 'Installable overlay file has no canonical counterpart in .agents/.');
      continue;
    }
    const [canonicalContent, overlayContent] = await Promise.all([
      fs.readFile(path.join(root, relativePath)),
      fs.readFile(path.join(overlayRoot, relativePath))
    ]);
    if (!canonicalContent.equals(overlayContent)) {
      drift(relativePath, 'Canonical and installable overlay content differ.');
    }
  }
  return diagnostics;
}

async function collectFiles(root) {
  const files = [];
  async function walk(current, relativeRoot = '') {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(current, entry.name), relativePath);
      else if (entry.isFile()) files.push(relativePath);
    }
  }
  await walk(root);
  return files.sort();
}
