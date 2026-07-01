#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function validateReleaseReadiness({ root = packageRoot } = {}) {
  const failures = [];
  const requiredFiles = [
    '.github/workflows/ci.yml',
    'RELEASE.md',
    'docs/versioning.md',
    'package.json'
  ];

  for (const file of requiredFiles) {
    try {
      const stat = await fs.stat(path.join(root, file));
      if (!stat.isFile()) failures.push(`Required release file is not a file: ${file}`);
    } catch {
      failures.push(`Required release file missing: ${file}`);
    }
  }

  const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  if (packageJson.private !== true) {
    failures.push('package.json must remain private until explicit publication approval.');
  }

  const scriptText = Object.entries(packageJson.scripts ?? {}).map(([name, command]) => `${name} ${command}`).join('\n');
  if (/npm publish|pnpm publish|yarn publish|gh release|gh repo create|git push|release-it|semantic-release/.test(scriptText)) {
    failures.push('package scripts must not publish, push, create repositories, or upload releases before approval.');
  }

  const ci = await readIfExists(path.join(root, '.github/workflows/ci.yml'));
  for (const expected of ['npm test', 'npm run check', 'npm run check:templates', 'npm run check:release']) {
    if (!ci.includes(expected)) failures.push(`CI workflow must run ${expected}.`);
  }
  if (/npm publish|gh release|gh repo create|git push/.test(ci)) {
    failures.push('CI workflow must not publish, push, create repositories, or upload releases in this phase.');
  }

  const releaseDoc = await readIfExists(path.join(root, 'RELEASE.md'));
  for (const expected of ['explicit maintainer approval', 'npm publish', 'gh repo create']) {
    if (!releaseDoc.includes(expected)) failures.push(`RELEASE.md must mention ${expected}.`);
  }

  return { ok: failures.length === 0, failures };
}

async function readIfExists(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return '';
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateReleaseReadiness();
  if (!result.ok) {
    console.error('Release readiness validation failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('Release readiness validation passed. Publishing remains approval-gated.');
}
