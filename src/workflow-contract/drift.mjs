import fs from 'node:fs/promises';
import path from 'node:path';
import { diagnostic } from './diagnostics.mjs';

const mirroredFiles = [
  '.agents/instructions.md',
  '.agents/skills/index.md',
  '.agents/skills/00-router/workflow-router/SKILL.md',
  '.agents/skills/registry.md',
  '.agents/skills/registry.json',
  '.agents/skills/registry.cache.json',
  '.agents/capabilities/README.md',
  '.agents/capabilities/registry.md'
];

const mirroredDirectories = [
  '.agents/skills/04-crosscutting/frontend-design',
  '.agents/skills/04-crosscutting/impeccable',
  '.agents/skills/05-caveman'
];

export async function validateOverlayDrift({ root }) {
  const diagnostics = [];
  const overlayRoot = path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full');
  for (const relativePath of mirroredFiles) {
    try {
      const [canonical, overlay] = await Promise.all([
        fs.readFile(path.join(root, relativePath), 'utf8'),
        fs.readFile(path.join(overlayRoot, relativePath), 'utf8')
      ]);
      if (canonical !== overlay) {
        diagnostics.push(diagnostic({
          code: 'overlay/content-drift',
          path: relativePath,
          message: 'Canonical and installable overlay content differ.'
        }));
      }
    } catch {
      diagnostics.push(diagnostic({
        code: 'overlay/content-drift',
        path: relativePath,
        message: 'Canonical or installable overlay file is missing.'
      }));
    }
  }
  for (const relativePath of mirroredDirectories) {
    const canonicalRoot = path.join(root, relativePath);
    const overlayRootPath = path.join(overlayRoot, relativePath);
    try {
      const [canonicalFiles, overlayFiles] = await Promise.all([
        collectFiles(canonicalRoot),
        collectFiles(overlayRootPath)
      ]);
      if (canonicalFiles.length !== overlayFiles.length || canonicalFiles.some((file, index) => file !== overlayFiles[index])) {
        diagnostics.push(diagnostic({
          code: 'overlay/content-drift',
          path: relativePath,
          message: 'Canonical and installable overlay directory inventories differ.'
        }));
        continue;
      }
      for (const file of canonicalFiles) {
        const [canonical, overlay] = await Promise.all([
          fs.readFile(path.join(canonicalRoot, file)),
          fs.readFile(path.join(overlayRootPath, file))
        ]);
        if (!canonical.equals(overlay)) {
          diagnostics.push(diagnostic({
            code: 'overlay/content-drift',
            path: path.join(relativePath, file),
            message: 'Canonical and installable overlay content differ.'
          }));
          break;
        }
      }
    } catch {
      diagnostics.push(diagnostic({
        code: 'overlay/content-drift',
        path: relativePath,
        message: 'Canonical or installable overlay directory is missing.'
      }));
    }
  }
  return diagnostics;
}

async function collectFiles(root) {
  const files = [];
  async function walk(current, relativeRoot = '') {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = path.join(relativeRoot, entry.name);
      if (entry.isDirectory()) await walk(path.join(current, entry.name), relativePath);
      else if (entry.isFile()) files.push(relativePath);
    }
  }
  await walk(root);
  return files.sort();
}
