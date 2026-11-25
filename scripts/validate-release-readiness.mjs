#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { isMainModule } from './is-main-module.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Exact `run` values every CI test job must execute (not substrings: `bun run check`
// must not be satisfied by `bun run check:workflow`).
export const requiredCiCommands = [
  'bun run test',
  'bun run check',
  'bun run check:workflow',
  'bun run check:docs',
  'bun run check:release',
  'bun run check:legal',
  'bun run check:security'
];

export async function validateReleaseReadiness({ root = packageRoot, env = process.env, checkVersionBump = true } = {}) {
  const failures = [];
  const notices = [];
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
  if (/npm publish|bun publish|pnpm publish|yarn publish|gh release|gh repo create|git push|release-it|semantic-release/.test(scriptText)) {
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
      const runLines = new Set(runCommands.flatMap((command) => command.split('\n').map((line) => line.trim()).filter(Boolean)));
      for (const expected of requiredCiCommands) {
        if (!runLines.has(expected)) {
          failures.push(`CI workflow must run ${expected}.`);
        }
      }
      const checkout = validateSteps.find((step) => /^actions\/checkout@/.test(`${step?.uses ?? ''}`));
      if (`${checkout?.with?.['fetch-depth'] ?? ''}` !== '0') {
        failures.push('CI checkout must use fetch-depth: 0 so the version-bump gate can resolve its base.');
      }
      if (!ciObject?.jobs?.validate?.env?.RELEASE_BASE_REF) {
        failures.push('CI job validate must set env.RELEASE_BASE_REF for the version-bump gate.');
      }
      if (runCommands.some((command) => /npm publish|bun publish|gh release|gh repo create|git push/.test(command))) {
        failures.push('CI workflow must not publish, push, create repositories, or upload releases in this phase.');
      }
    }
  }

  const packedFiles = listPackedFiles(root, failures);
  for (const requiredPackedFile of ['NOTICE', 'THIRD_PARTY_NOTICES.md', 'docs/legal/third-party/provenance.json', 'docs/legal/overlay-authorship.json']) {
    if (packedFiles && !packedFiles.has(requiredPackedFile)) {
      failures.push(`bun pm pack --dry-run must include ${requiredPackedFile}.`);
    }
  }

  const releaseDoc = await readIfExists(path.join(root, 'RELEASE.md'));
  for (const expected of ['explicit maintainer approval', 'npm publish', 'gh repo create', 'bun run check:workflow', 'bun run check:docs', 'bun run check:legal']) {
    if (!releaseDoc.includes(expected)) failures.push(`RELEASE.md must mention ${expected}.`);
  }

  if (checkVersionBump) {
    const gate = enforceVersionBump({ root, version: packageJson.version, env });
    failures.push(...gate.failures);
    notices.push(...gate.notices);
  }

  return { ok: failures.length === 0, failures, notices };
}

function listPackedFiles(root, failures) {
  let tempDir = null;
  try {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'workflow-kit-pack-'));
    const tarballName = execFileSync('bun', ['pm', 'pack', '--quiet', '--destination', tempDir], {
      cwd: root,
      encoding: 'utf8'
    }).trim();

    const tarballPath = path.isAbsolute(tarballName) ? tarballName : path.join(tempDir, tarballName);
    const output = execFileSync('tar', ['-tzf', tarballPath], {
      cwd: root,
      encoding: 'utf8'
    });
    const packed = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^package\//, ''));
    return new Set(packed);
  } catch (error) {
    failures.push(`Could not list the packed files with \`bun pm pack\` and \`tar\` (both must be on PATH): ${error.message.split('\n')[0]}`);
    return null;
  } finally {
    if (tempDir) {
      try {
        fsSync.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }
}

// Distributable surfaces changed since the base ref need a higher X.Y.Z.
// RELEASE_BASE_REF selects the base; by default `origin/main` when it exists
// (what CI compares with), else `main`, so a stale local `main` cannot pass a
// change CI rejects. In CI (env.CI set) a base that cannot be resolved fails
// the gate; locally it is skipped with a notice.
export function enforceVersionBump({ root, version, env = process.env }) {
  const failures = [];
  const notices = [];
  const strict = Boolean(env.CI);
  const releaseBaseRef = env.RELEASE_BASE_REF
    || (runGit(root, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main^{commit}']) ? 'origin/main' : 'main');
  const skip = (reason) => {
    if (strict) {
      failures.push(`Version-bump gate cannot run in CI: ${reason}. Check out full history (fetch-depth: 0) and set RELEASE_BASE_REF to a fetched ref.`);
    } else {
      notices.push(`Version-bump gate skipped: ${reason}.`);
    }
    return { failures, notices };
  };

  if (/^0+$/.test(releaseBaseRef)) {
    notices.push('Version-bump gate skipped: the base ref is the null commit (first push of a branch).');
    return { failures, notices };
  }
  if (!runGit(root, ['rev-parse', '--show-toplevel'])) return skip('not a git repository');

  const mergeBase = runGit(root, ['merge-base', 'HEAD', releaseBaseRef]);
  if (!mergeBase) return skip(`cannot find a merge base between HEAD and ${releaseBaseRef}`);

  // --no-renames lists both sides of a move, so moving a file out of a
  // distributable folder counts; untracked files count as local changes.
  const listChanges = (args) => runGit(root, ['diff', '--name-only', '--no-renames', ...args])?.split('\n').filter(Boolean) ?? [];
  const untracked = runGit(root, ['ls-files', '--others', '--exclude-standard'])?.split('\n').filter(Boolean) ?? [];
  const changedFiles = [...new Set([
    ...listChanges([`${mergeBase}..HEAD`]),
    ...listChanges(['--cached']),
    ...listChanges([]),
    ...untracked
  ])];

  const requiresBump = changedFiles.some((file) => (
    file.startsWith('.agents/') ||
    file.startsWith('templates/') ||
    file.startsWith('src/') ||
    file.startsWith('bin/') ||
    file.startsWith('scripts/') ||
    file === '.github/workflows/ci.yml'
  ));
  if (!requiresBump) return { failures, notices };

  const basePackageJsonText = runGit(root, ['show', `${mergeBase}:package.json`]);
  if (!basePackageJsonText) return skip(`package.json is not readable at ${releaseBaseRef}`);

  let baseVersion = null;
  try {
    baseVersion = JSON.parse(basePackageJsonText).version;
  } catch {
    return skip(`package.json at ${releaseBaseRef} is not valid JSON`);
  }
  if (baseVersion === version) {
    failures.push(`package.json version must be bumped when distributable surfaces change since ${releaseBaseRef}.`);
    return { failures, notices };
  }
  const current = parseVersionCore(version);
  const base = parseVersionCore(baseVersion);
  if (!current) {
    failures.push(`package.json version "${version}" must start with a numeric X.Y.Z (see docs/versioning.md).`);
  } else if (base && compareVersionCore(current, base) < 0) {
    failures.push(`package.json version ${version} must not be lower than ${baseVersion} on ${releaseBaseRef}.`);
  } else if (base && compareVersionCore(current, base) === 0) {
    failures.push(`package.json version ${version} must raise X.Y.Z above ${baseVersion} on ${releaseBaseRef}; changing only the suffix is not a bump.`);
  }
  return { failures, notices };
}

function parseVersionCore(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version ?? ''));
  return match ? match.slice(1, 4).map(Number) : null;
}

function compareVersionCore(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
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

if (isMainModule(import.meta.url)) {
  const result = await validateReleaseReadiness();
  for (const notice of result.notices) console.warn(`Notice: ${notice}`);
  if (!result.ok) {
    console.error('Release readiness validation failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('Release readiness validation passed. Publishing remains approval-gated.');
}
