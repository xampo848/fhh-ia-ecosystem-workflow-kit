import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { makeTempRepo } from './helpers.mjs';

const execFileAsync = promisify(execFile);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));

async function testFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await testFiles(full));
    else if (entry.name.endsWith('.mjs')) files.push(full);
  }
  return files;
}

test('temp directories are only created through the helper that removes them', async () => {
  const direct = /\bmkdtemp(Sync)?\b/;
  const offenders = [];
  for (const file of await testFiles(testDirectory)) {
    const relative = path.relative(testDirectory, file).split(path.sep).join('/');
    // fixtures/ holds standalone regeneration scripts that remove their own directories.
    if (relative === 'helpers.mjs' || relative === 'temp-dir-hygiene.test.mjs' || relative.startsWith('fixtures/')) continue;
    if (direct.test(await fs.readFile(file, 'utf8'))) offenders.push(relative);
  }
  assert.deepEqual(offenders, [], 'use makeTempRepo from test/helpers.mjs instead of calling the temp-directory API directly');
});

test('a representative test file leaves nothing behind in the temp directory', async () => {
  const scratch = await makeTempRepo('temp-dir-hygiene-');
  const childTmp = path.join(scratch, 'tmp');
  await fs.mkdir(childTmp);
  // Without NODE_TEST_CONTEXT the child runs the file as its own test run, as the suite does.
  const { NODE_TEST_CONTEXT: _nested, ...env } = process.env;
  await execFileAsync(process.execPath, ['--test', path.join(testDirectory, 'kit-boundary.test.mjs')], {
    env: { ...env, TMPDIR: childTmp, TMP: childTmp, TEMP: childTmp },
    maxBuffer: 16 * 1024 * 1024
  });
  assert.deepEqual(await fs.readdir(childTmp), []);
});
