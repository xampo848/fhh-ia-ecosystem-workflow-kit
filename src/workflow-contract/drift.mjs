import fs from 'node:fs/promises';
import path from 'node:path';
import { diagnostic } from './diagnostics.mjs';

const mirroredFiles = [
  '.agents/instructions.md',
  '.agents/skills/00-router/workflow-router/SKILL.md',
  '.agents/skills/registry.md',
  '.agents/skills/registry.json',
  '.agents/skills/registry.cache.json',
  '.agents/capabilities/README.md',
  '.agents/capabilities/registry.md'
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
  return diagnostics;
}
