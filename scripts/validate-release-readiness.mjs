#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function validateReleaseReadiness({ root = packageRoot } = {}) {
  const failures = [];
  const requiredFiles = [
    '.github/workflows/ci.yml',
    'RELEASE.md',
    'docs/versioning.md',
    'package.json',
    'NOTICE',
    'THIRD_PARTY_NOTICES.md'
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
    failures.push('package.json must keep the "private" flag enabled until explicit publication approval.');
  }

  for (const requiredFile of ['NOTICE', 'THIRD_PARTY_NOTICES.md']) {
    if (!(packageJson.files ?? []).includes(requiredFile)) {
      failures.push(`package.json files list must include ${requiredFile}.`);
    }
  }

  const scriptText = Object.entries(packageJson.scripts ?? {}).map(([name, command]) => `${name} ${command}`).join('\n');
  if (/npm publish|pnpm publish|yarn publish|gh release|gh repo create|git push|release-it|semantic-release/.test(scriptText)) {
    failures.push('package scripts must not publish, push, create repositories, or upload releases before approval.');
  }

  const ci = await readIfExists(path.join(root, '.github/workflows/ci.yml'));
  const ciDoc = YAML.parseDocument(ci);
  if (ciDoc.errors.length > 0) {
    failures.push(`CI workflow YAML is invalid: ${ciDoc.errors[0].message}`);
  } else {
    const ciObject = ciDoc.toJS();
    const validateSteps = ciObject?.jobs?.validate?.steps;
    if (!Array.isArray(validateSteps)) {
      failures.push('CI workflow must define jobs.validate.steps.');
    } else {
      const runCommands = validateSteps.map((step) => `${step?.run ?? ''}`);
      for (const expected of ['npm test', 'npm run check', 'npm run check:workflow', 'npm run check:docs', 'npm run check:release', 'npm run check:legal']) {
        if (!runCommands.some((command) => command.includes(expected))) {
          failures.push(`CI workflow must run ${expected}.`);
        }
      }
      if (runCommands.some((command) => /npm publish|gh release|gh repo create|git push/.test(command))) {
        failures.push('CI workflow must not publish, push, create repositories, or upload releases in this phase.');
      }
    }
  }

  const packedFiles = listPackedFiles(root);
  for (const requiredPackedFile of ['NOTICE', 'THIRD_PARTY_NOTICES.md', 'docs/legal/third-party/provenance.json', 'docs/legal/overlay-authorship.json']) {
    if (!packedFiles.has(requiredPackedFile)) {
      failures.push(`npm pack --dry-run must include ${requiredPackedFile}.`);
    }
  }

  const releaseDoc = await readIfExists(path.join(root, 'RELEASE.md'));
  for (const expected of ['explicit maintainer approval', 'npm publish', 'gh repo create', 'npm run check:workflow', 'npm run check:docs', 'npm run check:legal']) {
    if (!releaseDoc.includes(expected)) failures.push(`RELEASE.md must mention ${expected}.`);
  }

  enforceVersionBump({ root, packageJson, failures });

  return { ok: failures.length === 0, failures };
}

function listPackedFiles(root) {
  try {
    const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: root,
      encoding: 'utf8'
    });
    const packed = JSON.parse(output)?.[0]?.files ?? [];
    return new Set(packed.map((entry) => entry.path));
  } catch {
    return new Set();
  }
}

function enforceVersionBump({ root, packageJson, failures }) {
  const releaseBaseRef = process.env.RELEASE_BASE_REF ?? 'main';
  const gitRoot = runGit(root, ['rev-parse', '--show-toplevel']);
  if (!gitRoot) return;

  const mergeBase = runGit(root, ['merge-base', 'HEAD', releaseBaseRef]);
  if (!mergeBase) return;

  const committedChanges = runGit(root, ['diff', '--name-only', `${mergeBase}..HEAD`])
    ?.split('\n')
    .filter(Boolean) ?? [];
  const stagedChanges = runGit(root, ['diff', '--name-only', '--cached'])
    ?.split('\n')
    .filter(Boolean) ?? [];
  const unstagedChanges = runGit(root, ['diff', '--name-only'])
    ?.split('\n')
    .filter(Boolean) ?? [];
  const changedFiles = [...new Set([...committedChanges, ...stagedChanges, ...unstagedChanges])];
  if (changedFiles.length === 0) return;

  const requiresBump = changedFiles.some((file) => (
    file.startsWith('.agents/') ||
    file.startsWith('templates/') ||
    file.startsWith('src/') ||
    file.startsWith('bin/') ||
    file.startsWith('scripts/') ||
    file === '.github/workflows/ci.yml'
  ));
  if (!requiresBump) return;

  const basePackageJsonText = runGit(root, ['show', `${mergeBase}:package.json`]);
  if (!basePackageJsonText) return;

  let baseVersion = null;
  try {
    baseVersion = JSON.parse(basePackageJsonText).version;
  } catch {
    return;
  }
  if (baseVersion === packageJson.version) {
    failures.push(`package.json version must be bumped when distributable surfaces change since ${releaseBaseRef}.`);
  }
}

function runGit(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
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
