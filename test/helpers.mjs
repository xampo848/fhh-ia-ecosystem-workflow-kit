import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function makeTempRepo(prefix = 'workflow-kit-test-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export function createMemoryIo() {
  const output = { stdout: '', stderr: '' };
  return {
    output,
    stdout: { write: (chunk) => { output.stdout += chunk; } },
    stderr: { write: (chunk) => { output.stderr += chunk; } }
  };
}
