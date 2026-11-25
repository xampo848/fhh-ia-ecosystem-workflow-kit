#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateWorkflowContract } from '../src/workflow-contract/index.mjs';
import { validateDelegateRuntimeAdapters } from './sync-delegate-runtime-adapters.mjs';
import { isMainModule } from './is-main-module.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesRoot = path.join(packageRoot, 'templates');
const manifestPath = path.join(templatesRoot, 'template-manifest.json');

// Every file under templates/runtime-adapters/<runtime>/ is mirrored at the
// repository root. Root folders owned by one runtime must not carry files that
// the template would not install (local runtime settings excepted).
const runtimeAdaptersRoot = 'templates/runtime-adapters';
const runtimeOwnedRootDirectories = ['.codex', '.claude', '.antigravity', '.github/agents'];
const runtimeLocalFiles = new Set(['.claude/settings.json', '.claude/settings.local.json']);
const ignoredBasenames = new Set(['.DS_Store']);
// Other checkouts of this repository (Claude Code worktrees) live under
// .claude/worktrees/; their files belong to those checkouts, not to this one.
const nestedCheckoutDirectories = new Set(['.claude/worktrees']);

export async function validateTemplatePacks({ root = packageRoot } = {}) {
  const templateRoot = path.join(root, 'templates');
  const manifest = JSON.parse(await fs.readFile(path.join(templateRoot, 'template-manifest.json'), 'utf8'));
  const failures = [];
  const forbiddenTerms = manifest.forbidden_terms_in_portable_or_adapters ?? [];

  if (!manifest.schema_version) failures.push('template-manifest.json must define schema_version.');
  if (!Array.isArray(manifest.packs) || manifest.packs.length === 0) failures.push('template-manifest.json must define packs.');

  for (const pack of manifest.packs ?? []) {
    if (!pack.id || !pack.source) {
      failures.push(`Pack is missing id/source: ${JSON.stringify(pack)}`);
      continue;
    }

    const packRoot = path.join(templateRoot, pack.source);
    try {
      const stat = await fs.stat(packRoot);
      if (!stat.isDirectory()) failures.push(`Pack source is not a directory: ${pack.source}`);
    } catch {
      failures.push(`Pack source missing: ${pack.source}`);
      continue;
    }

    for (const requiredFile of pack.required_files ?? []) {
      try {
        const stat = await fs.stat(path.join(packRoot, requiredFile));
        if (!stat.isFile()) failures.push(`Required pack path is not a file: ${pack.id}:${requiredFile}`);
      } catch {
        failures.push(`Required pack file missing: ${pack.id}:${requiredFile}`);
      }
    }

    const shouldCheckPortableTerms = pack.id.startsWith('adapter-');
    const shouldCheckThinReference = Boolean(pack.requires_reference);
    const files = await collectFiles(packRoot);

    for (const file of files) {
      const relativePath = path.relative(packRoot, file);
      if ((pack.documentation_only ?? []).includes(relativePath)) continue;
      const content = await fs.readFile(file, 'utf8');

      if (shouldCheckPortableTerms) {
        for (const term of forbiddenTerms) {
          if (content.includes(term)) {
            failures.push(`Forbidden portable/adapter term "${term}" found in ${pack.id}:${relativePath}`);
          }
        }
      }

      if (shouldCheckThinReference && requiredTextFile(relativePath) && !content.includes(pack.requires_reference)) {
        failures.push(`Adapter file must reference ${pack.requires_reference}: ${pack.id}:${relativePath}`);
      }
    }
  }

  const contract = await validateWorkflowContract({
    root,
    runtimes: ['neutral'],
    checkOverlayDrift: true
  });
  for (const item of contract.diagnostics) {
    if (item.severity === 'error') {
      failures.push(`[${item.code}] ${item.path}: ${item.message}`);
    }
  }

  failures.push(...await validateRuntimeAdapterMirrors({ root }));

  const delegateAdapters = await validateDelegateRuntimeAdapters({ root });
  failures.push(...delegateAdapters.failures);

  return { ok: failures.length === 0, failures, manifest };
}

async function validateRuntimeAdapterMirrors({ root }) {
  const failures = [];
  const adaptersRoot = path.join(root, runtimeAdaptersRoot);
  const templated = new Set();
  let runtimes = [];
  try {
    runtimes = (await fs.readdir(adaptersRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return [`Runtime adapter templates missing: ${runtimeAdaptersRoot}`];
  }

  for (const runtime of runtimes) {
    const runtimeRoot = path.join(adaptersRoot, runtime);
    for (const file of (await collectFiles(runtimeRoot)).sort()) {
      const relativePath = path.relative(runtimeRoot, file).split(path.sep).join('/');
      if (ignoredBasenames.has(path.posix.basename(relativePath))) continue;
      templated.add(relativePath);
      const templatePath = `${runtimeAdaptersRoot}/${runtime}/${relativePath}`;
      let canonical;
      let template;
      try {
        [canonical, template] = await Promise.all([
          fs.readFile(path.join(root, relativePath), 'utf8'),
          fs.readFile(file, 'utf8')
        ]);
      } catch {
        failures.push(`Runtime adapter mirror missing for ${runtime}: ${relativePath} <-> ${templatePath}`);
        continue;
      }
      if (canonical !== template) {
        failures.push(`Runtime adapter drift for ${runtime}: ${relativePath} does not match ${templatePath}`);
      }
    }
  }

  for (const directory of runtimeOwnedRootDirectories) {
    let files = [];
    try {
      files = await collectFiles(path.join(root, directory), { root, skip: nestedCheckoutDirectories });
    } catch (error) {
      if (error.code === 'ENOENT') continue; // Runtime folder not present in this checkout.
      failures.push(`Runtime folder could not be read: ${directory} (${error.code ?? error.message})`);
      continue;
    }
    for (const file of files) {
      const relativePath = path.relative(root, file).split(path.sep).join('/');
      if (templated.has(relativePath) || runtimeLocalFiles.has(relativePath) || ignoredBasenames.has(path.posix.basename(relativePath))) continue;
      failures.push(`Runtime adapter file has no template twin under ${runtimeAdaptersRoot}/: ${relativePath}`);
    }
  }
  return failures;
}

// `skip` holds folders, relative to `root`, that are not walked.
async function collectFiles(start, { root = start, skip = new Set() } = {}) {
  const files = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(path.relative(root, absolutePath).split(path.sep).join('/'))) await walk(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }
  await walk(start);
  return files;
}

function requiredTextFile(relativePath) {
  return /(^|\/)(AGENTS|CLAUDE|ANTIGRAVITY|README|copilot-instructions|.*\.instructions)\.md$/.test(relativePath);
}

if (isMainModule(import.meta.url)) {
  const result = await validateTemplatePacks();
  if (!result.ok) {
    console.error('Template pack validation failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`Template pack validation passed. ${result.manifest.packs.length} packs are valid.`);
}
