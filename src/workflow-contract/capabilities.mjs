import fs from 'node:fs/promises';
import path from 'node:path';
import { diagnostic } from './diagnostics.mjs';

const allowedAttachPoints = new Set([
  'startup-discovery',
  'workflow-routing',
  'skill-execution',
  'delegation',
  'memory',
  'documentation',
  'validation',
  'runtime-adapter'
]);

const requiredIdentityFields = [
  'name',
  'type',
  'availability',
  'scope',
  'install_mode',
  'runtime_support',
  'source_policy',
  'owner_layer',
  'status'
];

function parseIdentity(content) {
  const values = {};
  for (const match of content.matchAll(/^\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|$/gm)) {
    values[match[1]] = match[2].replace(/^`|`$/g, '');
  }
  return values;
}

function parseAttachPoints(content) {
  const section = content.match(/## Attach points\n([\s\S]*?)(?=\n## |\nFallback:|$)/);
  if (!section) return [];
  return [...section[1].matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((match) => match[1]);
}

export async function validateCapabilityRegistry({ root }) {
  const diagnostics = [];
  const manifestsRoot = path.join(root, '.agents/capabilities/manifests');
  let files;
  try {
    files = (await fs.readdir(manifestsRoot)).filter((file) => file.endsWith('.md')).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return diagnostics;
    throw error;
  }

  const names = new Set();
  for (const file of files) {
    const relativePath = `.agents/capabilities/manifests/${file}`;
    const content = await fs.readFile(path.join(manifestsRoot, file), 'utf8');
    const identity = parseIdentity(content);
    const missing = requiredIdentityFields.filter((field) => !identity[field]);
    const attachPoints = parseAttachPoints(content);

    if (missing.length > 0 || attachPoints.length === 0 || !/## Activation rules/.test(content)) {
      diagnostics.push(diagnostic({
        code: 'capabilities/malformed-manifest',
        path: relativePath,
        message: `Missing manifest contract: ${[
          ...missing,
          ...(attachPoints.length === 0 ? ['attach_points'] : []),
          ...(!/## Activation rules/.test(content) ? ['activation_notes'] : [])
        ].join(', ')}.`
      }));
    }

    if (identity.name) {
      if (names.has(identity.name)) {
        diagnostics.push(diagnostic({
          code: 'capabilities/duplicate-name',
          path: relativePath,
          message: `Duplicate capability name: ${identity.name}.`
        }));
      }
      names.add(identity.name);
    }

    for (const attachPoint of attachPoints) {
      if (!allowedAttachPoints.has(attachPoint)) {
        diagnostics.push(diagnostic({
          code: 'capabilities/unknown-attach-point',
          path: relativePath,
          message: `Unknown attach point: ${attachPoint}.`
        }));
      }
    }
  }

  return diagnostics;
}
