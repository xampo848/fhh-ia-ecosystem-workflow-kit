import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Every test file runs in its own process. Temp repositories are removed when
// that process exits, so repeated runs do not fill the disk (a full install is
// about 2 MB and the suite creates more than a hundred of them).
const createdTempDirectories = new Set();
process.on('exit', () => {
  for (const directory of createdTempDirectories) {
    try {
      rmSync(directory, { recursive: true, force: true });
    } catch {
      // Best effort: a leftover temp directory must never fail a test run.
    }
  }
});

export async function makeTempRepo(prefix = 'workflow-kit-test-') {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  createdTempDirectories.add(directory);
  return directory;
}

// Register an extra path (for example a sibling symlink) to remove at exit.
export function trackTempPath(target) {
  createdTempDirectories.add(target);
  return target;
}

export function createMemoryIo() {
  const output = { stdout: '', stderr: '' };
  return {
    output,
    stdout: { write: (chunk) => { output.stdout += chunk; } },
    stderr: { write: (chunk) => { output.stderr += chunk; } }
  };
}

// Every entry under target, keyed by its "/" path, so "nothing changed" also
// covers what no assertion names: a file by its permission bits and content
// hash, a directory (empty ones included) by its type, a symbolic link by
// its target.
export async function hashTree(target) {
  const entries = {};
  async function walk(relativeDirectory) {
    for (const entry of await fs.readdir(path.join(target, relativeDirectory), { withFileTypes: true })) {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      const absolute = path.join(target, relativePath);
      if (entry.isSymbolicLink()) {
        entries[relativePath] = `symlink -> ${await fs.readlink(absolute)}`;
      } else if (entry.isDirectory()) {
        entries[relativePath] = 'dir';
        await walk(relativePath);
      } else {
        const mode = ((await fs.lstat(absolute)).mode & 0o777).toString(8);
        entries[relativePath] = `file ${mode} ${createHash('sha256').update(await fs.readFile(absolute)).digest('hex')}`;
      }
    }
  }
  await walk('.');
  return entries;
}
