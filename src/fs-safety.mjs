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
  'merge_no_backup',
  // A delete through a link would remove a file somewhere else.
  'delete_with_backup'
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
    `Refusing to write or delete through symbolic links in the target (${offending.length} file(s) affected):`,
    ...links.map((link) => `- ${link}`),
    'Replace each link with a real file or directory, or leave that runtime out with --runtime, then run again.'
  ].join('\n'));
}

// Fails before planning reads anything when a path the kit writes needs a
// folder where a file stands (for example docs or .agents/project as a file)
// or is itself a folder: the plan could not read it, and the apply would stop
// halfway. `folders` are paths that must be folders when they exist. Paths
// that do not exist yet are fine.
export async function assertPathShapes(targetPath, relativePaths, folders = []) {
  const root = path.resolve(targetPath);
  const kinds = new Map();
  const kindOf = async (relativePath) => {
    if (!kinds.has(relativePath)) {
      let kind = 'missing';
      try {
        const stat = await fs.lstat(path.join(root, relativePath));
        // A symbolic link is refused by assertNoSymlinkWrites with its own message.
        kind = stat.isSymbolicLink() ? 'link' : stat.isDirectory() ? 'folder' : 'file';
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      }
      kinds.set(relativePath, kind);
    }
    return kinds.get(relativePath);
  };
  const problems = new Map();
  // A folder path is checked like the path of a file inside it.
  for (const relativePath of [...relativePaths, ...folders.map((folder) => `${folder}/\0`)]) {
    const segments = String(relativePath).split(/[\\/]+/).filter(Boolean);
    let walked = '';
    let blocked = false;
    for (const segment of segments.slice(0, -1)) {
      walked = walked ? `${walked}/${segment}` : segment;
      const kind = await kindOf(walked);
      if (kind === 'missing' || kind === 'link') break;
      if (kind === 'file') {
        problems.set(walked, `${walked} is a file, not a folder, and the plan writes inside it.`);
        blocked = true;
        break;
      }
    }
    if (!blocked && !relativePath.endsWith('/\0') && await kindOf(segments.join('/')) === 'folder') problems.set(segments.join('/'), `${segments.join('/')} is a folder, not a file, and the plan writes that file.`);
  }
  if (problems.size === 0) return;
  throw new Error([...problems.keys()].sort().map((key) => problems.get(key)).join('\n')
    + '\nMove it aside (or rename it) and run again. Nothing was written.');
}

export async function assertWriteFoldersAreFolders(targetPath, operations) {
  await assertPathShapes(targetPath, operations
    .filter((item) => writingOperations.has(item.operation) && item.operation !== 'delete_with_backup')
    .map((item) => item.relativePath));
}

// The temporary file of an atomic write: a short name in the destination
// folder that does not grow with the destination's name (a long file name
// would otherwise fail with ENAMETOOLONG halfway through an apply). The same
// process writes one file at a time, so the process id keeps it unique;
// rollback removes the one an interrupted run left (the journal records the
// process id).
export const temporaryFileMarker = '.workflow-kit-tmp-';
export function temporaryPathFor(targetFile, pid = process.pid) {
  return path.join(path.dirname(targetFile), `${temporaryFileMarker}${pid}`);
}

// Write to a sibling temporary file and rename it over the destination, so an
// interrupted run never leaves a half-written file.
export async function writeFileAtomic(targetFile, content) {
  const temporary = temporaryPathFor(targetFile);
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

// Name limits, checked while planning so an apply never stops halfway with a
// raw ENAMETOOLONG. A backup adds its suffix to the file name
// (".workflow-kit-backup-" and a 16-character stamp); rollback without a
// journal adds "-before-rollback" to that.
export const backupSuffixLength = '.workflow-kit-backup-'.length + '20260101T000000Z'.length;
const nameMaxBytes = 255;
// macOS and the BSDs: 1024; Linux: 4096. Windows handles long paths itself.
const pathMaxBytes = process.platform === 'win32' ? Infinity : ['linux', 'android'].includes(process.platform) ? 4096 : 1024;
const byteLength = (text) => Buffer.byteLength(text, 'utf8');

// Fails when a write of the plan would need a name the file system refuses:
// a folder or file name over 255 bytes, a file whose backup name would be,
// or a whole path over the system limit. `mayBackUp(item)` says whether the
// write can leave a backup next to the file.
export function assertNameLengths(targetPath, operations, mayBackUp = () => true) {
  const problems = [];
  for (const item of operations) {
    if (!writingOperations.has(item.operation)) continue;
    const segments = String(item.relativePath).split(/[\\/]+/).filter(Boolean);
    const suffix = mayBackUp(item) ? backupSuffixLength : 0;
    const longSegment = segments.find((segment, index) => byteLength(segment) + (index === segments.length - 1 ? suffix : 0) > nameMaxBytes);
    const absoluteBytes = byteLength(path.resolve(targetPath, item.relativePath)) + suffix;
    if (longSegment !== undefined) {
      problems.push(`- ${item.relativePath}: the name ${byteLength(longSegment) > nameMaxBytes ? '' : 'of its backup '}is longer than ${nameMaxBytes} bytes`);
    } else if (absoluteBytes >= pathMaxBytes) {
      problems.push(`- ${item.relativePath}: the full path ${suffix > 0 ? 'of its backup ' : ''}is longer than ${pathMaxBytes - 1} bytes`);
    }
  }
  if (problems.length === 0) return;
  throw new Error([
    `These paths are too long for this file system (a backup adds ${backupSuffixLength} characters to a file name):`,
    ...problems,
    'Rename or move them to a shorter path, then run again. Nothing was written.'
  ].join('\n'));
}
