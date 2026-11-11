// Read-only doctor checks for the AI workspace (.ai-work/) and the durable PRD
// evidence section. Every finding is a warning: doctor makes leftovers visible,
// it never deletes them.
import fs from 'node:fs/promises';
import path from 'node:path';
import { gitignoreHasWorkspaceEntry, workspaceDirectory } from './planner.mjs';

export const staleWorkspaceDays = 14;
export const section10LineGuide = 60;
export const trackerLineGuide = 150;
const section10Heading = /^## 10\. Evidencia de Implementaci[oó]n\s*$/m;

function warning(code, relativePath, message) {
  return { code, path: relativePath, message, severity: 'warning' };
}

async function listDirectories(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw error;
  }
}

async function walk(directory, visit) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return;
    throw error;
  }
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    await visit(absolute, entry);
    if (entry.isDirectory()) await walk(absolute, visit);
  }
}

async function newestModification(directory) {
  let newest = 0;
  await walk(directory, async (absolute, entry) => {
    if (!entry.isFile()) return;
    const { mtimeMs } = await fs.stat(absolute);
    if (mtimeMs > newest) newest = mtimeMs;
  });
  return newest;
}

function section10Of(content) {
  const match = content.match(section10Heading);
  if (!match) return null;
  const rest = content.slice(match.index + match[0].length);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

function isClosed(section) {
  return /\*\*Estado\*\*:\s*Cerrada\b/.test(section) || /Fecha de cierre\s*\|\s*\d{4}-\d{2}-\d{2}/.test(section);
}

// PRD markdown files grouped by their directory name (the workspace slug).
async function collectPrds(targetPath) {
  const prds = [];
  const legacyMeta = [];
  await walk(path.join(targetPath, 'docs', 'prd'), async (absolute, entry) => {
    if (entry.isDirectory() && entry.name === '_meta') legacyMeta.push(absolute);
    if (!entry.isFile() || !entry.name.endsWith('.md') || absolute.includes(`${path.sep}_meta${path.sep}`)) return;
    const section = section10Of(await fs.readFile(absolute, 'utf8'));
    if (section === null) return;
    prds.push({ absolute, slug: path.basename(path.dirname(absolute)), section });
  });
  return { prds, legacyMeta };
}

export const projectContextPath = '.agents/project-context.md';
export const projectContextLineLimit = 200;
const projectContextTemplateMarker = '<!-- workflow-kit:project-context:template -->';
const pathLike = /^[A-Za-z0-9_.@-][A-Za-z0-9_.@/-]*$/;

// Checks that the project's fixed knowledge base is filled in, short, and
// still points to paths that exist.
export async function projectContextDiagnostics({ targetPath }) {
  let content;
  try {
    content = await fs.readFile(path.join(targetPath, projectContextPath), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  if (content.includes(projectContextTemplateMarker)) {
    return [warning('project-context/not-initialized', projectContextPath, 'Still the template. Generate the first version with an initial Discovery of the project (an N2 task), review it, and remove the template marker.')];
  }

  const diagnostics = [];
  const lines = content.split('\n').length;
  if (lines > projectContextLineLimit) {
    diagnostics.push(warning('project-context/too-long', projectContextPath, `${lines} lines (limit: ${projectContextLineLimit}). Point to other documents instead of copying them.`));
  }

  const missing = new Set();
  for (const match of content.matchAll(/`([^`\n]+)`/g)) {
    const candidate = match[1].trim().replace(/\/\*\*$/, '').replace(/\/$/, '');
    const looksLikePath = pathLike.test(candidate) && (candidate.includes('/') || /\.[a-z0-9]{1,5}$/i.test(candidate));
    if (!looksLikePath || candidate.startsWith('-')) continue;
    try {
      await fs.access(path.join(targetPath, candidate));
    } catch {
      missing.add(candidate);
    }
  }
  for (const candidate of [...missing].sort()) {
    diagnostics.push(warning('project-context/missing-path', projectContextPath, `Points to \`${candidate}\`, which does not exist. Update the file at the next closure.`));
  }
  return diagnostics;
}

export async function workspaceDiagnostics({ targetPath, now = Date.now() }) {
  const diagnostics = [];
  const relative = (absolute) => path.relative(targetPath, absolute).split(path.sep).join('/');
  const workspaceRoot = path.join(targetPath, workspaceDirectory);
  const workspaces = await listDirectories(workspaceRoot);
  const { prds, legacyMeta } = await collectPrds(targetPath);

  if (workspaces.length > 0) {
    let gitignore = '';
    try {
      gitignore = await fs.readFile(path.join(targetPath, '.gitignore'), 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (!gitignoreHasWorkspaceEntry(gitignore)) {
      diagnostics.push(warning('workspace/not-ignored', '.gitignore', `${workspaceDirectory}/ holds temporary AI state but is not ignored by Git. Run workflow-kit update, or add "${workspaceDirectory}/" to .gitignore.`));
    }
  }

  for (const slug of workspaces) {
    const workspacePath = path.join(workspaceRoot, slug);
    const workspaceRelative = `${workspaceDirectory}/${slug}`;
    const closed = prds.find((prd) => prd.slug === slug && isClosed(prd.section));
    if (closed) {
      diagnostics.push(warning('workspace/closed-prd-leftover', workspaceRelative, `${relative(closed.absolute)} is closed but its workspace still exists. Delete ${workspaceRelative}/.`));
    } else {
      const newest = await newestModification(workspacePath);
      const idleDays = newest === 0 ? null : Math.floor((now - newest) / 86_400_000);
      if (idleDays !== null && idleDays > staleWorkspaceDays) {
        diagnostics.push(warning('workspace/stale', workspaceRelative, `No activity for ${idleDays} days. Close the change, split it, or archive it; an open or blocked change may keep its workspace.`));
      }
    }

    try {
      const tracker = await fs.readFile(path.join(workspacePath, 'task_tracker.toon'), 'utf8');
      const lines = tracker.split('\n').length;
      const repeatedBlocks = (tracker.match(/^#?\s*previous_writer\b/gm) ?? []).length > 1;
      if (lines > trackerLineGuide || repeatedBlocks) {
        diagnostics.push(warning('workspace/tracker-is-a-log', `${workspaceRelative}/task_tracker.toon`, `The tracker has ${lines} lines${repeatedBlocks ? ' and repeated history blocks' : ''}. It is a snapshot of the current state; move history to events.log.`));
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  for (const metaPath of legacyMeta) {
    diagnostics.push(warning('workspace/legacy-meta', relative(metaPath), `Legacy PRD-local workspace. New work uses ${workspaceDirectory}/<prd-slug>/; delete this directory once its PRD is closed.`));
  }

  for (const prd of prds) {
    const lines = prd.section.split('\n').filter((line) => line.trim().length > 0).length;
    if (lines > section10LineGuide) {
      diagnostics.push(warning('prd/section-10-oversized', relative(prd.absolute), `"## 10. Evidencia de Implementacion" has ${lines} non-empty lines (guide: about ${section10LineGuide}). It is a durable summary, not a log; repair history belongs in the PR and commits.`));
    }
  }

  return diagnostics;
}
