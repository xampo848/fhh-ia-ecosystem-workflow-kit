// File-system guards shared by apply, rollback and doctor. The toolkit writes
// into someone else's repository, so every write path is checked twice: it must
// stay inside the target, and it must not pass through a symbolic link.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export function checksumOf(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// Resolves a path recorded in a plan, a journal or install-state. Those files
// live in the target repository, so their keys are untrusted input.
export function resolveInsideTarget(targetPath, relativePath) {
  const root = path.resolve(targetPath);
  const absolute = path.resolve(root, String(relativePath));
  const relative = path.relative(root, absolute);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to touch a path outside the target: ${relativePath}`);
  }
  return absolute;
}

// Returns the first component of relativePath (relative to targetPath) that is
// a symbolic link, or null. Missing components end the search: nothing below
// them exists yet.
export async function findSymlinkInPath(targetPath, relativePath, cache = new Map()) {
  const segments = String(relativePath).split(/[\\/]+/).filter(Boolean);
  let current = path.resolve(targetPath);
  let walked = '';

  for (const segment of segments) {
    current = path.join(current, segment);
    walked = walked ? `${walked}/${segment}` : segment;

    let isLink = cache.get(current);
    if (isLink === undefined) {
      try {
        isLink = (await fs.lstat(current)).isSymbolicLink();
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
        throw error;
      }
      cache.set(current, isLink);
    }
    if (isLink) return walked;
  }

  return null;
}

export const writingOperations = new Set([
  'create',
  'overwrite_with_backup',
  'overwrite_no_backup',
  'merge_with_backup',
  'merge_no_backup'
]);

// Fails the whole plan when a write would go through a symbolic link: the
// content would land in another file (or outside the repository) and the
// backup would not protect what was really overwritten.
export async function assertNoSymlinkWrites(targetPath, operations) {
  const cache = new Map();
  const offending = [];
  for (const item of operations) {
    if (!writingOperations.has(item.operation)) continue;
    const link = await findSymlinkInPath(targetPath, item.relativePath, cache);
    if (link) offending.push({ relativePath: item.relativePath, link });
  }
  if (offending.length === 0) return;

  const links = [...new Set(offending.map((item) => item.link))].sort();
  throw new Error([
    `Refusing to write through symbolic links in the target (${offending.length} file(s) affected):`,
    ...links.map((link) => `- ${link}`),
    'Replace each link with a real file or directory, or leave that runtime out with --runtime, then run again.'
  ].join('\n'));
}

// Write to a sibling temporary file and rename it over the destination, so an
// interrupted run never leaves a half-written file.
export async function writeFileAtomic(targetFile, content) {
  const temporary = `${targetFile}.workflow-kit-tmp-${process.pid}`;
  let mode;
  try {
    mode = (await fs.stat(targetFile)).mode;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  try {
    await fs.writeFile(temporary, content, 'utf8');
    if (mode !== undefined) await fs.chmod(temporary, mode);
    await fs.rename(temporary, targetFile);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}
