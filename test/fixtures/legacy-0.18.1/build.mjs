#!/usr/bin/env node
// Development script, never run by the tests. It regenerates the 0.18.1
// fixture from Git: the structural files workflow-kit 0.18.1 (commit f5ddeb0)
// installed, one kit file that a release before 0.18.1 retired, and
// files.json, which lists them together with the template paths added since
// 0.18.1. install.mjs combines them with a current install into a repository
// shaped like one that 0.18.1 installed and updated.
//
//   node test/fixtures/legacy-0.18.1/build.mjs          rewrite files/ and files.json
//   node test/fixtures/legacy-0.18.1/build.mjs --check  exit 1 when they differ from Git
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeTemplatePaths } from '../../../src/runtime-matrix.mjs';

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(fixtureDir, '../../..');
const filesDir = path.join(fixtureDir, 'files');
const indexPath = path.join(fixtureDir, 'files.json');

const legacyCommit = 'f5ddeb0';
const currentRev = 'HEAD';
const overlayRoot = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const adaptersRoot = 'templates/runtime-adapters';
// A kit-authored pattern skill retired in 5a8fa2a (before 0.18.1). A repository
// installed before then still has it on disk and recorded in its state.
const retired = {
  target: '.agents/skills/06-patterns/backend/feature-flag-implementation/SKILL.md',
  commit: '5a8fa2a~1',
  retiredIn: '5a8fa2a'
};
const overlayFiles = [
  '.agents/skills/index.md',
  '.agents/skills/registry.md',
  '.agents/skills/registry.json',
  '.agents/skills/registry.cache.json',
  '.agents/skills/06-patterns/index.md',
  '.agents/project/quality-gate.md',
  '.agents/project-context.md'
];
const adapterFiles = [
  { target: 'CLAUDE.md', template: 'claude' },
  { target: 'AGENTS.md', template: 'agents-md' },
  { target: 'ANTIGRAVITY.md', template: 'antigravity' },
  { target: '.github/copilot-instructions.md', template: 'copilot' },
  { target: '.github/instructions/ai-workflow.instructions.md', template: 'copilot' }
];
const maxBytes = 300 * 1024;
const maxFiles = 20;

const git = (args) => execFileSync('git', args, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });
const show = (rev, file) => git(['show', `${rev}:${file}`]);
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
// Fixture names are flat and end in .snap, so no runtime loads them as its own
// instructions (a nested CLAUDE.md or AGENTS.md would be read as one).
const fixtureName = (target) => `${target.split('/').map((segment) => segment.replace(/^\./, '')).join('__')}.snap`;
const runtimesFor = (template) => Object.keys(runtimeTemplatePaths)
  .filter((runtime) => runtimeTemplatePaths[runtime].includes(`runtime-adapters/${template}`));

// Target paths a release installs, from its template tree. 0.18.1 skipped
// .agents/workflow-kit/ (it installed no manifest); every release skips the
// README.md at a template root.
function installedPaths(rev, { skipWorkflowKit }) {
  const listed = git(['ls-tree', '-r', '--name-only', rev, '--', overlayRoot, adaptersRoot]).toString('utf8').split('\n').filter(Boolean);
  const targets = new Set();
  for (const file of listed) {
    let target = null;
    if (file.startsWith(`${overlayRoot}/`)) target = file.slice(overlayRoot.length + 1);
    else if (file.startsWith(`${adaptersRoot}/`)) {
      const rest = file.slice(adaptersRoot.length + 1).split('/');
      if (rest.length > 1) target = rest.slice(1).join('/');
    }
    if (!target || target === 'README.md') continue;
    if (skipWorkflowKit && target.startsWith('.agents/workflow-kit/')) continue;
    targets.add(target);
  }
  return targets;
}

function generate() {
  const contents = new Map();
  const snapshot = [];
  const add = (entry, buffer) => {
    const fixture = fixtureName(entry.target);
    contents.set(fixture, buffer);
    return { ...entry, fixture: `files/${fixture}`, sha256: sha256(buffer) };
  };
  for (const target of overlayFiles) {
    const source = `${overlayRoot}/${target}`;
    snapshot.push(add({ target, source: `${legacyCommit}:${source}`, runtimes: null }, show(legacyCommit, source)));
  }
  for (const { target, template } of adapterFiles) {
    const source = `${adaptersRoot}/${template}/${target}`;
    snapshot.push(add({ target, source: `${legacyCommit}:${source}`, runtimes: runtimesFor(template) }, show(legacyCommit, source)));
  }
  const retiredSource = `${overlayRoot}/${retired.target}`;
  const retiredEntry = add({ target: retired.target, source: `${retired.commit}:${retiredSource}`, retiredIn: retired.retiredIn }, show(retired.commit, retiredSource));
  if (installedPaths(legacyCommit, { skipWorkflowKit: true }).has(retired.target)) {
    throw new Error(`${retired.target} is still shipped at ${legacyCommit}; it is not a retired file.`);
  }

  const legacy = installedPaths(legacyCommit, { skipWorkflowKit: true });
  const current = installedPaths(currentRev, { skipWorkflowKit: false });
  const index = {
    description: 'Generated by build.mjs from Git; do not edit. Structural files of workflow-kit 0.18.1 and the template paths it never installed.',
    legacyCommit,
    toolkitVersion: JSON.parse(show(legacyCommit, 'package.json').toString('utf8')).version,
    snapshot,
    retired: retiredEntry,
    addedSince: [...current].filter((target) => !legacy.has(target)).sort(),
    removedSince: [...legacy].filter((target) => !current.has(target)).sort()
  };
  contents.set('files.json', Buffer.from(`${JSON.stringify(index, null, 2)}\n`, 'utf8'));

  const fileCount = contents.size - 1;
  const totalBytes = [...contents.entries()].filter(([name]) => name !== 'files.json').reduce((sum, [, buffer]) => sum + buffer.length, 0);
  if (fileCount > maxFiles || totalBytes > maxBytes) {
    throw new Error(`The fixture would hold ${fileCount} files and ${totalBytes} bytes (limit ${maxFiles} files, ${maxBytes} bytes). Stop and narrow it.`);
  }
  return contents;
}

async function readOptional(file) {
  try {
    return await fs.readFile(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function check(contents) {
  const differences = [];
  const onDisk = new Set(await fs.readdir(filesDir).catch(() => []));
  for (const [name, buffer] of contents) {
    const file = name === 'files.json' ? indexPath : path.join(filesDir, name);
    const existing = await readOptional(file);
    if (existing === null) differences.push(`missing ${name}`);
    else if (!existing.equals(buffer)) differences.push(`differs ${name}`);
    onDisk.delete(name);
  }
  for (const name of onDisk) differences.push(`unexpected files/${name}`);
  return differences;
}

async function write(contents) {
  await fs.rm(filesDir, { recursive: true, force: true });
  await fs.mkdir(filesDir, { recursive: true });
  for (const [name, buffer] of contents) {
    await fs.writeFile(name === 'files.json' ? indexPath : path.join(filesDir, name), buffer);
  }
}

// `node --test` runs every .mjs file under test/, this one included: under
// the test runner it does nothing, so a test run never rewrites the fixture.
if (process.env.NODE_TEST_CONTEXT) process.exit(0);

const contents = generate();
if (process.argv.includes('--check')) {
  const differences = await check(contents);
  if (differences.length > 0) {
    console.error(`legacy-0.18.1 fixture is out of date (run node test/fixtures/legacy-0.18.1/build.mjs):\n- ${differences.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`legacy-0.18.1 fixture matches Git (${contents.size - 1} files).`);
} else {
  await write(contents);
  console.log(`legacy-0.18.1 fixture written (${contents.size - 1} files).`);
}
