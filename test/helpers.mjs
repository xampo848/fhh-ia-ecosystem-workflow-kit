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

export function createMemoryIo() {
  const output = { stdout: '', stderr: '' };
  return {
    output,
    stdout: { write: (chunk) => { output.stdout += chunk; } },
    stderr: { write: (chunk) => { output.stderr += chunk; } }
  };
}
