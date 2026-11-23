#!/usr/bin/env node
// Builds the plugin `fhh` (marketplace `fhh-ia-ecosystem`) as a generated
// folder, `dist/plugin/`, that is never committed on `main`: the plugin
// manifests, the plugin skills (the explicit workflow wrappers plus `kit-root`,
// the one skill the model may load on its own), the plugin variant of the
// delegate agents for Claude Code and Copilot, the legal files, and a copy of
// the `kit` and `derived` files of the overlay template. Only the marketplace,
// which points at the branch `plugin`, is committed at the repository root.
// Usage: node scripts/build-plugin.mjs [--write | --publish [--same-version]] [--root <dir>]
//   (no flag)  build into a temporary folder, validate it and compare the
//              committed marketplace; never writes into the repository.
//   --write    build and validate a fresh folder, swap it in for dist/plugin/
//              and rewrite the marketplace.
//   --publish  validate like check mode, rebuild dist/plugin/ and commit it to
//              the local branch `plugin` without touching HEAD, the index or
//              the working tree. It never pushes, never fetches and never
//              changes the git configuration. --same-version publishes new
//              content under the version already published.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { classifyPath, loadKitManifest, manifestRelativePath } from '../src/kit-manifest.mjs';
import {
  loadDelegateCatalog,
  pluginGeneratedMarker as generatedMarker,
  renderClaudeAgent,
  renderCopilotAgent
} from '../src/model-profiles.mjs';
import { marketplaceName, pluginBranch, pluginName, pluginPathRule } from '../src/plugin-mode.mjs';
import { claudeSkillDescription, claudeSkillEntries, listFiles } from './sync-claude-skills.mjs';

export { marketplaceName, pluginName };

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Same catalog source as scripts/sync-delegate-runtime-adapters.mjs.
const catalogPath = 'scripts/delegate-agent-catalog.json';
// Same template and README exclusion as collectTemplateFiles in src/planner.mjs.
const templatePath = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const kitPrefixes = ['.agents/', 'docs/workflow/'];
const shippedClasses = new Set(['kit', 'derived']);
export const pluginOutputDirectory = 'dist/plugin';
export const marketplacePath = '.claude-plugin/marketplace.json';
// The plugin redistributes kit content, third-party skills included (MIT and
// Apache-2.0): it ships the legal files of package.json `files` and the
// docs/legal tree they cite (license texts, third-party notices, provenance).
export const pluginLegalFiles = ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md'];
export const pluginLegalDirectory = 'docs/legal';
// Every path the build reads. --publish refuses uncommitted changes in them,
// so the source commit its message names holds exactly what it built.
export const pluginBuildInputs = [
  templatePath,
  '.agents/skills/registry.json',
  catalogPath,
  'package.json',
  ...pluginLegalFiles,
  pluginLegalDirectory,
  'scripts/build-plugin.mjs',
  'scripts/sync-claude-skills.mjs',
  'src/model-profiles.mjs',
  'src/plugin-mode.mjs',
  'src/kit-manifest.mjs',
  marketplacePath
];
const agentPluginsSchema = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const pluginDescription = 'Workflow kit: routed workflow skills and delegates that run from the plugin while each repository keeps its own project overlay.';
const marketplaceDescription = 'Marketplace of the fhh workflow kit plugin.';
const pluginRemote = 'origin';
const writeCommand = 'node scripts/build-plugin.mjs --write';
const sourceFix = 'fix the source named in the message (skill registry, delegate catalog, overlay template or kit manifest), then run node scripts/build-plugin.mjs';

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readPackageJson(root) {
  return JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
}

// A --root must be a workflow kit repository: refusing anything else keeps a
// mistyped --root from rebuilding (and clearing) a dist/plugin elsewhere.
export async function resolveKitRoot(root) {
  if (typeof root !== 'string' || root.trim() === '') throw new Error('--root needs a directory: the workflow kit repository to build from.');
  const resolved = path.resolve(root);
  try {
    const packageJson = await readPackageJson(resolved);
    await fs.access(path.join(resolved, templatePath, manifestRelativePath));
    if (!packageJson.workflowKit?.repository) throw new Error('no workflowKit.repository');
  } catch {
    throw new Error(`--root ${resolved} is not a workflow kit repository (it needs package.json with workflowKit.repository and ${templatePath}/${manifestRelativePath}).`);
  }
  return resolved;
}

function pluginIdentity(packageJson) {
  return {
    name: pluginName,
    version: packageJson.version,
    description: pluginDescription,
    author: { name: marketplaceName },
    license: packageJson.license,
    repository: `https://github.com/${packageJson.workflowKit.repository}`
  };
}

export async function expectedMarketplace({ root = packageRoot } = {}) {
  const packageJson = await readPackageJson(root);
  return json({
    name: marketplaceName,
    owner: { name: marketplaceName },
    metadata: { description: marketplaceDescription, version: packageJson.version },
    plugins: [{
      name: pluginName,
      source: { source: 'github', repo: packageJson.workflowKit.repository, ref: pluginBranch },
      description: pluginDescription
    }]
  });
}

const kitRootSentence = 'Kit root: `${CLAUDE_PLUGIN_ROOT}`. If that text shows an unexpanded variable, the kit root is the folder that contains `skills/` and `.agents/` (this skill sits in its `skills/` folder).';

function renderWrapper(entry) {
  return `---
name: ${entry.name}
description: "${claudeSkillDescription(entry)}"
disable-model-invocation: true
---

<!-- ${generatedMarker} -->

Explicit invocation of the \`${entry.name}\` workflow skill from the plugin \`${pluginName}\`.

${kitRootSentence}

Load \`<kit root>/${entry.path}\` ([${entry.path}](../../${entry.path})) and follow it. That file is the canonical procedure. Resolve every other path with the rule in the \`kit-root\` skill.

It is never invoked automatically: freeform requests keep going through the level pre-filter and \`workflow-router\`.
`;
}

function renderKitRoot() {
  return `---
name: kit-root
description: "Load before any N2/N3 work, and before reading a workflow kit path such as .agents/** or docs/workflow/**, in a repository whose adapter says the workflow kit runs as the plugin ${pluginName}. Gives the kit root, the rule that says which paths resolve under it, and the delegate names."
---

<!-- ${generatedMarker} -->

The workflow kit runs as the plugin \`${pluginName}\`.

${kitRootSentence}

${pluginPathRule}

Delegates: In Claude Code, a delegate is the plugin agent \`${pluginName}:<slug>\`, unless the project defines an agent with that slug: then the project agent wins. In Copilot, name a delegate by its alias (the \`name\` of its agent file); whether Copilot prefixes plugin agents is not documented. Every delegation brief carries the line \`Kit root: <absolute path>\`.

Next step: read \`<kit root>/.agents/instructions.md\`.
`;
}

// The generated files of the plugin folder, keyed by their path in it.
export async function expectedPluginFiles({ root = packageRoot } = {}) {
  const packageJson = await readPackageJson(root);
  const identity = pluginIdentity(packageJson);
  const outputs = new Map([
    ['plugin.json', json({ $schema: agentPluginsSchema, ...identity, keywords: packageJson.keywords })],
    ['.claude-plugin/plugin.json', json(identity)]
  ]);
  for (const entry of await claudeSkillEntries({ root })) {
    outputs.set(`skills/${entry.name}/SKILL.md`, renderWrapper(entry));
  }
  outputs.set('skills/kit-root/SKILL.md', renderKitRoot());
  const catalog = await loadDelegateCatalog({ root, relativePath: catalogPath });
  for (const agent of catalog.agents) {
    // undefined keeps each runtime's default profile.
    outputs.set(`agents/${agent.slug}.md`, renderClaudeAgent(agent, catalog, undefined, pluginName));
    outputs.set(`com.github.copilot/agents/${agent.slug}.agent.md`, renderCopilotAgent(agent, catalog, undefined, pluginName));
  }
  return outputs;
}

async function loadTemplateManifest(root) {
  return loadKitManifest({ file: path.join(root, templatePath, manifestRelativePath) });
}

function shipsInPlugin(manifest, relativePath) {
  const entry = classifyPath(manifest, relativePath);
  return shippedClasses.has(entry?.class)
    && !entry.generated
    && !relativePath.startsWith(manifest.project_root)
    && kitPrefixes.some((prefix) => relativePath.startsWith(prefix));
}

// The copied files of the plugin folder: path in the folder -> source file.
export async function pluginCopiedFiles({ root = packageRoot } = {}) {
  const manifest = await loadTemplateManifest(root);
  const copies = new Map(pluginLegalFiles.map((file) => [file, path.join(root, file)]));
  for (const file of await listFiles(root, pluginLegalDirectory)) copies.set(file, path.join(root, file));
  for (const file of await listFiles(path.join(root, templatePath), '.')) {
    const relativePath = file.slice(2);
    if (relativePath === 'README.md' || !shipsInPlugin(manifest, relativePath)) continue;
    copies.set(relativePath, path.join(root, templatePath, relativePath));
  }
  return copies;
}

// Writes the plugin into an empty, real directory.
async function buildInto({ root, dir }) {
  const generated = await expectedPluginFiles({ root });
  const copies = await pluginCopiedFiles({ root });
  for (const [relativePath, content] of generated) {
    await fs.mkdir(path.dirname(path.join(dir, relativePath)), { recursive: true });
    await fs.writeFile(path.join(dir, relativePath), content, 'utf8');
  }
  for (const [relativePath, source] of copies) {
    await fs.mkdir(path.dirname(path.join(dir, relativePath)), { recursive: true });
    await fs.copyFile(source, path.join(dir, relativePath));
  }
  return generated.size + copies.size;
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

// Looks at a path inside the real root one segment at a time and never
// follows a link: a segment that is a symbolic link, a parent that is not a
// directory, or a last segment of the wrong kind stops the build before
// anything is written. Returns the absolute path and whether it exists.
async function guardedPath(realRoot, relativePath, kind) {
  const segments = relativePath.split('/');
  let current = realRoot;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const label = segments.slice(0, index + 1).join('/');
    const last = index === segments.length - 1;
    let stats;
    try {
      stats = await fs.lstat(current);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { target: path.join(realRoot, ...segments), exists: false };
    }
    if (stats.isSymbolicLink()) {
      const target = await fs.realpath(current).catch(() => null);
      if (!target || !isInside(realRoot, target)) throw new Error(`Refusing to build: ${label} resolves outside the root (it is a symbolic link). Remove it and rerun.`);
      throw new Error(`Refusing to build: ${label} is a symbolic link. Remove it and rerun.`);
    }
    if ((!last || kind === 'directory') && !stats.isDirectory()) throw new Error(`Refusing to build: ${label} is not a directory. Remove it and rerun.`);
    if (last && kind === 'file' && !stats.isFile()) throw new Error(`Refusing to build: ${label} is not a file. Remove it and rerun.`);
  }
  return { target: current, exists: true };
}

// Returns dist/ as a real directory inside the root, after checking that
// dist/plugin, when present, is a real directory too.
async function prepareDistDirectory(realRoot) {
  const dist = await guardedPath(realRoot, path.posix.dirname(pluginOutputDirectory), 'directory');
  if (!dist.exists) await fs.mkdir(dist.target);
  await guardedPath(realRoot, pluginOutputDirectory, 'directory');
  return dist.target;
}

function formatFailures(failures) {
  return ['Plugin build validation failed:', ...failures.map((failure) => `- ${failure.message} (fix: ${failure.fix})`)].join('\n');
}

async function marketplaceFailures(root) {
  const expected = await expectedMarketplace({ root });
  const committed = await fs.readFile(path.join(root, marketplacePath), 'utf8').catch(() => null);
  if (committed === null) return [{ message: `Marketplace missing: ${marketplacePath}`, fix: writeCommand }];
  if (committed !== expected) return [{ message: `Marketplace drift: ${marketplacePath}`, fix: writeCommand }];
  return [];
}

// The one validation of every mode: build into an empty folder, apply the
// structural rules and, unless the caller rewrites it, compare the marketplace.
async function buildAndValidate({ root, dir, marketplace }) {
  let count;
  try {
    count = await buildInto({ root, dir });
  } catch (error) {
    return { count: 0, failures: [{ message: `Plugin build failed: ${error.message}`, fix: sourceFix }] };
  }
  const { failures } = await validatePluginFolder({ root, dir });
  if (marketplace) failures.push(...await marketplaceFailures(root));
  return { count, failures };
}

// Builds and validates a fresh folder inside dist/, then swaps it in for
// dist/plugin with renames and removes the previous folder only after the
// swap. Any failure removes the fresh folder and leaves dist/plugin as it was.
async function replacePluginDirectory({ root, realRoot, marketplace }) {
  const distDir = await prepareDistDirectory(realRoot);
  const staging = await fs.mkdtemp(path.join(distDir, '.plugin-build-'));
  try {
    const { count, failures } = await buildAndValidate({ root, dir: staging, marketplace });
    if (failures.length > 0) throw new Error(formatFailures(failures));
    const dir = (await guardedPath(realRoot, pluginOutputDirectory, 'directory')).target;
    const previous = existsSync(dir) ? `${staging}-previous` : null;
    if (previous) await fs.rename(dir, previous);
    try {
      await fs.rename(staging, dir);
    } catch (error) {
      if (previous) await fs.rename(previous, dir);
      throw error;
    }
    if (previous) await fs.rm(previous, { recursive: true, force: true });
    return { dir, count };
  } finally {
    // After a successful swap the fresh folder is dist/plugin: nothing left.
    await fs.rm(staging, { recursive: true, force: true });
  }
}

export async function writePluginBuild({ root = packageRoot } = {}) {
  const resolved = await resolveKitRoot(root);
  const realRoot = await fs.realpath(resolved);
  const marketplace = await guardedPath(realRoot, marketplacePath, 'file');
  const result = await replacePluginDirectory({ root: resolved, realRoot, marketplace: false });
  await fs.mkdir(path.dirname(marketplace.target), { recursive: true });
  await fs.writeFile(marketplace.target, await expectedMarketplace({ root: resolved }), 'utf8');
  return { root: resolved, ...result };
}

function frontmatterDescription(content) {
  const frontmatter = content.startsWith('---\n') ? content.slice(4, content.indexOf('\n---\n', 4)) : '';
  const value = frontmatter.match(/^description:(.*)$/m)?.[1].trim() ?? '';
  return value.replace(/^"(.*)"$/, '$1').trim();
}

// Structural rules of a built plugin folder: what the plugin needs to load
// and what it may redistribute.
export async function validatePluginFolder({ root = packageRoot, dir }) {
  const failures = [];
  const fail = (message) => failures.push({ message, fix: sourceFix });
  const packageJson = await readPackageJson(root);
  const manifest = await loadTemplateManifest(root);
  const generated = await expectedPluginFiles({ root });
  const exists = (relativePath) => fs.stat(path.join(dir, relativePath)).then((stats) => stats.isFile(), () => false);
  const files = (await listFiles(dir, '.')).map((file) => file.slice(2)).sort();

  for (const file of files) {
    if (generated.has(file) || pluginLegalFiles.includes(file) || file.startsWith(`${pluginLegalDirectory}/`)) continue;
    if (!shipsInPlugin(manifest, file)) fail(`Not a kit or derived file of the kit manifest: ${file}`);
  }
  for (const file of ['plugin.json', '.claude-plugin/plugin.json']) {
    let version;
    try {
      version = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8')).version;
    } catch {
      fail(`Plugin manifest missing or not JSON: ${file}`);
      continue;
    }
    if (version !== packageJson.version) fail(`Plugin manifest version ${version} is not the package.json version ${packageJson.version}: ${file}`);
  }
  for (const file of files.filter((item) => /^skills\/[^/]+\/SKILL\.md$/.test(item))) {
    const content = await fs.readFile(path.join(dir, file), 'utf8');
    if (!frontmatterDescription(content)) fail(`Skill without a description: ${file}`);
    for (const [, link] of content.matchAll(/\]\(\.\.\/\.\.\/([^)]+)\)/g)) {
      if (!await exists(link)) fail(`Broken wrapper link: ${file} -> ${link}`);
    }
  }
  for (const file of files.filter((item) => item.startsWith('agents/') || item.startsWith('com.github.copilot/agents/'))) {
    const named = (await fs.readFile(path.join(dir, file), 'utf8')).match(/read and follow `([^`]+)`/)?.[1];
    if (!named || !await exists(named)) fail(`Agent skill not in the plugin: ${file} -> ${named}`);
  }
  return { ok: failures.length === 0, failures };
}

// Check mode: builds into a temporary folder, never into the repository.
export async function checkPluginBuild({ root = packageRoot } = {}) {
  const resolved = await resolveKitRoot(root);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-plugin-check-'));
  try {
    const dir = path.join(temporary, 'plugin');
    await fs.mkdir(dir);
    const { count, failures } = await buildAndValidate({ root: resolved, dir, marketplace: true });
    return { ok: failures.length === 0, count, failures };
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

function git(args, { cwd, env }) {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  if (result.error) throw new Error(`git ${args[0]} failed: ${result.error.message}`);
  // Only the end is trimmed: `git status --porcelain` lines start with a space.
  return { status: result.status, stdout: result.stdout.trimEnd(), stderr: result.stderr.trim() };
}

function gitOk(args, options) {
  const result = git(args, options);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

// Publishing runs git without the GIT_* variables it inherits: GIT_DIR,
// GIT_WORK_TREE, GIT_INDEX_FILE and the like could point it at another
// repository, and GIT_AUTHOR_* or GIT_COMMITTER_* would commit as someone
// other than the identity it prints. PATH, HOME and the rest are kept.
function withoutGitVariables(env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('GIT_')));
}

// The worktree that has the branch checked out, from `git worktree list --porcelain`.
function worktreeHolding(worktreeList, branchRef) {
  let worktree = null;
  for (const line of worktreeList.split('\n')) {
    if (line.startsWith('worktree ')) worktree = line.slice('worktree '.length);
    else if (line === `branch ${branchRef}`) return worktree;
  }
  return null;
}

function commitOf(run, ref) {
  const result = run(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  return result.status === 0 ? result.stdout : null;
}

function publishedVersion(run, commit) {
  const result = run(['show', `${commit}:.claude-plugin/plugin.json`]);
  try {
    return result.status === 0 ? JSON.parse(result.stdout).version : null;
  } catch {
    return null;
  }
}

// Commits a validated dist/plugin to the local branch `plugin` with plumbing
// only: a temporary index, the folder as work tree, and update-ref. HEAD, the
// current branch, the index, the working tree and the git configuration are
// left alone; nothing is fetched or pushed. It refuses, before building, when
// the root is not the top level of its own repository, a worktree has the
// branch checked out, git has no identity, a build input has uncommitted
// changes, or the local branch does not contain origin/plugin; and, after
// building, when the build does not validate, the marketplace is out of sync,
// or new content keeps the published version without sameVersion.
export async function publishPluginBuild({ root = packageRoot, env = process.env, sameVersion = false, log = () => {} } = {}) {
  const resolved = await resolveKitRoot(root);
  const realRoot = await fs.realpath(resolved);
  const gitEnv = withoutGitVariables(env);
  const run = (args) => git(args, { cwd: realRoot, env: gitEnv });
  const runOk = (args) => gitOk(args, { cwd: realRoot, env: gitEnv });

  const topLevel = run(['rev-parse', '--show-toplevel']);
  const realTopLevel = topLevel.status === 0 ? await fs.realpath(topLevel.stdout).catch(() => null) : null;
  if (realTopLevel !== realRoot) {
    throw new Error(`Refusing to publish: ${resolved} is not the top level of its own git repository (git top level: ${topLevel.status === 0 ? topLevel.stdout : 'none'}). Publish from the kit repository itself.`);
  }
  const branchRef = `refs/heads/${pluginBranch}`;
  const holder = worktreeHolding(runOk(['worktree', 'list', '--porcelain']), branchRef);
  if (holder) throw new Error(`Refusing to publish: the branch ${pluginBranch} is checked out in ${holder}. Switch that worktree to another branch and rerun.`);

  const name = run(['config', 'user.name']).stdout.trim();
  const email = run(['config', 'user.email']).stdout.trim();
  if (!name || !email) throw new Error('Refusing to publish: this repository has no git user.name or user.email. Configure your git identity yourself and rerun; publishing never sets it.');
  const identity = `${name} <${email}>`;
  log(`Publishing as ${identity}.`);

  const dirty = runOk(['status', '--porcelain', '--untracked-files=all', '--', ...pluginBuildInputs]);
  if (dirty) {
    const paths = dirty.split('\n').map((line) => line.slice(3));
    throw new Error(`Refusing to publish: uncommitted changes in files the build reads: ${paths.join(', ')}. Commit or discard them and rerun.`);
  }
  const source = run(['rev-parse', '--short', 'HEAD']);
  if (source.status !== 0) throw new Error('Refusing to publish: the repository has no commit to name as the source of the build.');

  const remoteBranch = `${pluginRemote}/${pluginBranch}`;
  const localTip = commitOf(run, branchRef);
  const remoteTip = commitOf(run, `refs/remotes/${remoteBranch}`);
  if (localTip && remoteTip && run(['merge-base', '--is-ancestor', remoteTip, localTip]).status !== 0) {
    throw new Error(`Refusing to publish: the local branch ${pluginBranch} is behind or diverged from ${remoteBranch}: it does not contain ${remoteTip}. Bring the local branch up to date first, so that it contains ${remoteBranch}, and rerun. Publishing never fetches: ${remoteBranch} is the copy last fetched.`);
  }
  const parent = localTip ?? remoteTip;
  const base = localTip ? pluginBranch : remoteBranch;

  const { dir } = await replacePluginDirectory({ root: resolved, realRoot, marketplace: true });
  const { version } = await readPackageJson(resolved);
  const message = `Publish plugin ${pluginName} ${version} from ${source.stdout}`;
  const gitDir = runOk(['rev-parse', '--absolute-git-dir']);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-plugin-index-'));
  try {
    const plumbing = { cwd: dir, env: { ...gitEnv, GIT_INDEX_FILE: path.join(temporary, 'index') } };
    const tree = [`--git-dir=${gitDir}`, `--work-tree=${dir}`];
    gitOk([...tree, 'add', '--all', '--force', '--', '.'], plumbing);
    const treeId = gitOk([...tree, 'write-tree'], plumbing);
    if (parent && runOk(['rev-parse', `${parent}^{tree}`]) === treeId) {
      return { committed: false, commit: parent, base, branchExists: Boolean(localTip), identity, message };
    }
    if (parent && !sameVersion && publishedVersion(run, parent) === version) {
      throw new Error(`Refusing to publish: the build differs from the tip of ${base} (${parent}) but keeps its version ${version}. Claude Code pins a plugin to its version, so people who installed ${version} would not receive this change. Raise the version in package.json first (then run ${writeCommand} and commit), or pass --same-version to publish it under ${version} anyway.`);
    }
    const committer = { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email };
    const commit = gitOk(['commit-tree', treeId, ...(parent ? ['-p', parent] : []), '-m', message], { cwd: realRoot, env: { ...gitEnv, ...committer } });
    runOk(['update-ref', '-m', message, branchRef, commit, localTip ?? '']);
    return { committed: true, commit, parent, branchExists: true, identity, message };
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

const usage = 'node scripts/build-plugin.mjs [--write | --publish [--same-version]] [--root <dir>]';

function parseArguments(argv) {
  const options = { mode: 'check', root: packageRoot, sameVersion: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write' || argument === '--publish') {
      if (options.mode !== 'check') throw new Error('Use only one of --write and --publish.');
      options.mode = argument.slice(2);
    } else if (argument === '--same-version') {
      options.sameVersion = true;
    } else if (argument === '--root') {
      if (index + 1 >= argv.length) throw new Error('--root needs a directory: the workflow kit repository to build from.');
      options.root = argv[index += 1];
    } else {
      throw new Error(`Unknown option ${argument}. Usage: ${usage}`);
    }
  }
  if (options.sameVersion && options.mode !== 'publish') throw new Error(`--same-version only applies to --publish. Usage: ${usage}`);
  return options;
}

async function main(argv) {
  const options = parseArguments(argv);
  if (options.mode === 'write') {
    const { count } = await writePluginBuild({ root: options.root });
    console.log(`Wrote ${count} plugin files to ${pluginOutputDirectory}/ and ${marketplacePath}.`);
    return 0;
  }
  if (options.mode === 'publish') {
    const result = await publishPluginBuild({ root: options.root, sameVersion: options.sameVersion, log: (line) => console.log(line) });
    console.log(result.committed
      ? `${result.message}: committed ${result.commit} to the local branch ${pluginBranch}${result.parent ? ` (parent ${result.parent})` : ' (first commit)'}.`
      : `${result.base} already holds this build (${result.commit}); no commit created.`);
    if (result.branchExists) console.log(`Next step, with explicit approval: git push ${pluginRemote} ${pluginBranch}`);
    return 0;
  }
  const result = await checkPluginBuild({ root: options.root });
  if (!result.ok) {
    console.error(formatFailures(result.failures));
    return 1;
  }
  console.log(`Plugin build is valid (${result.count} files) and the marketplace is synchronized.`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
