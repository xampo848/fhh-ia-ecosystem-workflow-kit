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
//   --publish  export the tracked content of HEAD (a commit origin/main
//              contains) and run its own legal check and its own build code on
//              it, never a file of the working tree; validate like check mode,
//              rebuild dist/plugin/ and commit it to the local branch `plugin`
//              without touching HEAD, the index or the working tree. It never
//              pushes, never fetches and never changes the git configuration.
//              --same-version publishes new content under the version already
//              published.
// Internal: --root <dir> --out <out> builds and validates like check mode into
// <out>, a new directory or an empty one; --publish runs it on the exported
// commit with that commit's code.
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classifyPath, loadKitManifest, manifestRelativePath } from '../src/kit-manifest.mjs';
import {
  loadDelegateCatalog,
  pluginGeneratedMarker as generatedMarker,
  renderClaudeAgent,
  renderCopilotAgent
} from '../src/model-profiles.mjs';
import { marketplaceName, pluginBranch, pluginEntryPoints, pluginName, pluginPathRule } from '../src/plugin-mode.mjs';
import { claudeSkillDescription, claudeSkillEntries, listFiles } from './sync-claude-skills.mjs';
import { isMainModule } from './is-main-module.mjs';

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
// Every path the build reads, its code included. --publish builds with the
// content and the code of HEAD only; it also refuses uncommitted changes in
// these paths, so what it publishes is not something other than what the
// publisher sees (git status cannot see edits hidden with skip-worktree or
// assume-unchanged, which is why the build never runs the working tree).
export const pluginBuildInputs = [
  templatePath,
  '.agents/skills/registry.json',
  catalogPath,
  'package.json',
  ...pluginLegalFiles,
  pluginLegalDirectory,
  'scripts/build-plugin.mjs',
  'scripts/is-main-module.mjs',
  'scripts/sync-claude-skills.mjs',
  'scripts/validate-legal-readiness.mjs',
  'src/model-profiles.mjs',
  'src/plugin-mode.mjs',
  'src/runtime-matrix.mjs',
  'src/kit-manifest.mjs',
  manifestRelativePath,
  marketplacePath
];
const agentPluginsSchema = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const pluginDescription = 'Workflow kit: routed workflow skills and delegates that run from the plugin while each repository keeps its own project overlay.';
const marketplaceDescription = 'Marketplace of the fhh workflow kit plugin.';
// The copies of the kit manifest a release raises (docs/versioning.md, release
// step 1): the template copy, which the plugin ships, and the repository copy.
const kitManifestCopies = [`${templatePath}/${manifestRelativePath}`, manifestRelativePath];
const pluginRemote = 'origin';
// --publish only publishes a commit this branch of the remote contains.
const sourceBranch = 'main';
// The staging folder of a build is dist/.plugin-build-XXXXXX (mkdtemp adds six
// characters); a swap moves the previous dist/plugin to that name plus
// -previous. Only folders of exactly this pattern are ever removed from dist/.
const stagingPrefix = '.plugin-build-';
const leftoverPattern = /^\.plugin-build-[A-Za-z0-9]{6}(-previous)?$/;
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

${pluginEntryPoints}

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

// A leftover folder that cannot be removed never fails a build: it is
// reported with the commands that remove it, from the repository root.
function leftoverWarning(realRoot, folder, error, context) {
  const shown = path.relative(realRoot, folder);
  return `${context}Could not remove ${shown} (${error.code ?? error.message}), a leftover of an earlier build that nothing uses. Restore write permission and delete it: chmod -R u+w ${shown} && rm -rf ${shown}`;
}

// Removes what a killed build left in dist/: staging folders and previous
// plugin folders of the pattern above, and nothing else.
async function removeLeftovers(realRoot, distDir) {
  const warnings = [];
  for (const entry of await fs.readdir(distDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !leftoverPattern.test(entry.name)) continue;
    const folder = path.join(distDir, entry.name);
    try {
      await fs.rm(folder, { recursive: true, force: true });
    } catch (error) {
      warnings.push(leftoverWarning(realRoot, folder, error, ''));
    }
  }
  return warnings;
}

// Fills a fresh folder inside dist/ (fill builds and validates it, and throws
// when it does not validate), then swaps it in for dist/plugin with renames
// and runs afterSwap (the marketplace rewrite). A failure up to there undoes
// the swap, removes the fresh folder and leaves dist/plugin as it was; only
// then is the previous folder removed, and a previous folder that cannot be
// removed is reported, not fatal.
async function replacePluginDirectory({ realRoot, fill, afterSwap = async () => {} }) {
  const distDir = await prepareDistDirectory(realRoot);
  const warnings = await removeLeftovers(realRoot, distDir);
  const staging = await fs.mkdtemp(path.join(distDir, stagingPrefix));
  let dir;
  let count;
  let previous = null;
  try {
    count = await fill(staging);
    dir = (await guardedPath(realRoot, pluginOutputDirectory, 'directory')).target;
    previous = existsSync(dir) ? `${staging}-previous` : null;
    if (previous) await fs.rename(dir, previous);
    try {
      await fs.rename(staging, dir);
    } catch (error) {
      if (previous) await fs.rename(previous, dir);
      throw error;
    }
    try {
      await afterSwap();
    } catch (error) {
      await fs.rename(dir, staging);
      if (previous) await fs.rename(previous, dir);
      throw error;
    }
  } finally {
    // After a successful swap the fresh folder is dist/plugin: nothing left.
    await fs.rm(staging, { recursive: true, force: true });
  }
  if (previous) {
    try {
      await fs.rm(previous, { recursive: true, force: true });
    } catch (error) {
      warnings.push(leftoverWarning(realRoot, previous, error, `${pluginOutputDirectory} was replaced and ${marketplacePath} is in sync with it. `));
    }
  }
  return { dir, count, warnings };
}

export async function writePluginBuild({ root = packageRoot } = {}) {
  const resolved = await resolveKitRoot(root);
  const realRoot = await fs.realpath(resolved);
  const marketplace = await guardedPath(realRoot, marketplacePath, 'file');
  const result = await replacePluginDirectory({
    realRoot,
    fill: async (dir) => {
      const { count, failures } = await buildAndValidate({ root: resolved, dir, marketplace: false });
      if (failures.length > 0) throw new Error(formatFailures(failures));
      return count;
    },
    afterSwap: async () => {
      await fs.mkdir(path.dirname(marketplace.target), { recursive: true });
      await fs.writeFile(marketplace.target, await expectedMarketplace({ root: resolved }), 'utf8');
    }
  });
  return { root: resolved, ...result };
}

function frontmatterDescription(content) {
  const frontmatter = content.startsWith('---\n') ? content.slice(4, content.indexOf('\n---\n', 4)) : '';
  const value = frontmatter.match(/^description:(.*)$/m)?.[1].trim() ?? '';
  return value.replace(/^"(.*)"$/, '$1').trim();
}

// The copies of the kit manifest whose kit_version is not the package version;
// a copy that is missing or not JSON is not named.
async function staleKitManifests(root, version) {
  const stale = [];
  for (const file of kitManifestCopies) {
    const kitVersion = await fs.readFile(path.join(root, file), 'utf8').then((text) => JSON.parse(text).kit_version, () => version);
    if (kitVersion !== version) stale.push(file);
  }
  return stale;
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
  // The shipped kit manifest carries the version too: a release raises all three.
  for (const [label, file, field] of [
    ['Plugin manifest', 'plugin.json', 'version'],
    ['Plugin manifest', '.claude-plugin/plugin.json', 'version'],
    ['Kit manifest', manifestRelativePath, 'kit_version']
  ]) {
    let version;
    try {
      version = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'))[field];
    } catch {
      fail(`${label} missing or not JSON: ${file}`);
      continue;
    }
    if (version === packageJson.version) continue;
    // The shipped kit manifest is a copy: name the source copies to fix, or the
    // file of the folder when no source differs.
    const stale = field === 'kit_version' ? await staleKitManifests(root, packageJson.version) : [];
    fail(`${label} ${field} ${version} is not the package.json version ${packageJson.version}: ${stale.length > 0 ? stale.join(' and ') : file}`);
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

// --out accepts a directory that does not exist (its parent must) or an empty
// one, never a symbolic link: everything inside it afterwards was written by
// this build. Returns whether it created the directory.
async function prepareOutDirectory(dir) {
  let stats;
  try {
    stats = await fs.lstat(dir);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.mkdir(dir);
    return true;
  }
  const refuse = (problem) => new Error(`Refusing to build: --out ${dir} ${problem}. Give a new or empty directory.`);
  if (stats.isSymbolicLink()) throw refuse('is a symbolic link');
  if (!stats.isDirectory()) throw refuse('is not a directory');
  if ((await fs.readdir(dir)).length > 0) throw refuse('exists and is not empty');
  return false;
}

// Out mode: builds and validates like check mode, into the given directory. A
// build that does not validate leaves the directory as it found it; nothing
// outside it is ever removed.
export async function buildPluginInto({ root, out }) {
  const resolved = await resolveKitRoot(root);
  const dir = path.resolve(out);
  const created = await prepareOutDirectory(dir);
  const { count, failures } = await buildAndValidate({ root: resolved, dir, marketplace: true });
  if (failures.length > 0) {
    if (created) await fs.rm(dir, { recursive: true, force: true });
    else for (const entry of await fs.readdir(dir)) await fs.rm(path.join(dir, entry), { recursive: true, force: true });
  }
  return { ok: failures.length === 0, count, failures, dir };
}

function git(args, { cwd, env, input }) {
  const result = spawnSync('git', args, { cwd, env, input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
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
// GIT_NO_REPLACE_OBJECTS is then set: a `refs/replace/*` entry would make
// every git call read other content under an object id, so the source, the
// history checks and the published tree are always the objects themselves.
function withoutGitVariables(env) {
  return { ...Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('GIT_'))), GIT_NO_REPLACE_OBJECTS: '1' };
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

// The tracked content of HEAD, written into a fresh folder from the raw
// objects (`git ls-tree` and `git cat-file --batch`): what --publish builds
// from, and the code it builds with. Files Git ignores (through .gitignore, a
// global excludes file or info/exclude) and edits hidden with
// `git update-index --skip-worktree` or `--assume-unchanged` are not in it,
// and neither attributes (.git/info/attributes, export-ignore, export-subst)
// nor filters or line-ending settings (core.autocrlf) change a byte of it, so
// the branch `plugin` holds exactly what the source commit its message names
// builds.
async function exportHead({ realRoot, gitEnv, folder }) {
  const sourceRoot = path.join(folder, 'source');
  await fs.mkdir(sourceRoot);
  const listed = spawnSync('git', ['ls-tree', '-r', '-z', '--full-tree', 'HEAD'], { cwd: realRoot, env: gitEnv, maxBuffer: 64 * 1024 * 1024 });
  if (listed.error || listed.status !== 0) throw new Error(`Refusing to publish: could not list the source commit: ${listed.error?.message ?? listed.stderr.toString().trim()}`);
  const entries = listed.stdout.toString('utf8').split('\0').filter(Boolean).map((line) => {
    const [meta, relativePath] = [line.slice(0, line.indexOf('\t')), line.slice(line.indexOf('\t') + 1)];
    const [mode, type, objectId] = meta.split(' ');
    return { mode, type, objectId, relativePath };
  });
  const blobs = entries.filter((entry) => entry.type === 'blob');
  const read = spawnSync('git', ['cat-file', '--batch'], { cwd: realRoot, env: gitEnv, input: blobs.map((entry) => `${entry.objectId}\n`).join(''), maxBuffer: 256 * 1024 * 1024 });
  if (read.error || read.status !== 0) throw new Error(`Refusing to publish: could not read the source commit: ${read.error?.message ?? read.stderr.toString().trim()}`);
  const realSourceRoot = await fs.realpath(sourceRoot);
  let offset = 0;
  for (const entry of blobs) {
    const headerEnd = read.stdout.indexOf(0x0a, offset);
    const [objectId, type, size] = read.stdout.subarray(offset, headerEnd).toString('utf8').split(' ');
    if (objectId !== entry.objectId || type !== 'blob') throw new Error(`Refusing to publish: could not read ${entry.relativePath} from the source commit.`);
    const content = read.stdout.subarray(headerEnd + 1, headerEnd + 1 + Number(size));
    offset = headerEnd + 1 + Number(size) + 1;
    const file = path.join(sourceRoot, ...entry.relativePath.split('/'));
    const outside = new Error(`Refusing to publish: the source commit names a path that would be written outside the export folder: ${entry.relativePath}.`);
    if (!isInside(sourceRoot, file)) throw outside;
    await fs.mkdir(path.dirname(file), { recursive: true });
    // A link the export wrote earlier (on a case-insensitive file system, `A`
    // for `a/x`) must not carry a write outside the folder; `wx` never writes
    // through an existing entry.
    if (!isInside(realSourceRoot, path.join(await fs.realpath(path.dirname(file)), path.basename(file)))) throw outside;
    try {
      if (entry.mode === '120000') await fs.symlink(content.toString('utf8'), file);
      else await fs.writeFile(file, content, { mode: entry.mode === '100755' ? 0o755 : 0o644, flag: 'wx' });
    } catch (error) {
      if (error.code === 'EEXIST') throw new Error(`Refusing to publish: two paths of the source commit land on the same file here (${entry.relativePath}); this file system does not tell their names apart.`);
      throw error;
    }
  }
  for (const entry of entries.filter((item) => item.type === 'commit')) await fs.mkdir(path.join(sourceRoot, ...entry.relativePath.split('/')), { recursive: true });
  return sourceRoot;
}

// The tree of a built plugin folder, written without the index of the
// checkout and without filters: `hash-object --no-filters` stores every file
// as it is (no clean filter, no line-ending conversion from attributes or
// core.autocrlf), and a temporary index records each mode.
function pluginTree({ gitDir, gitEnv, dir, files, indexFile }) {
  const at = { cwd: dir, env: gitEnv };
  const hashes = gitOk([`--git-dir=${gitDir}`, 'hash-object', '-w', '--no-filters', '--stdin-paths'], { ...at, input: `${files.map(({ relativePath }) => relativePath).join('\n')}\n` }).split('\n');
  if (hashes.length !== files.length) throw new Error('Refusing to publish: git did not store every file of the build.');
  const indexInfo = files.map(({ relativePath, executable }, index) => `${executable ? '100755' : '100644'} ${hashes[index]}\t${relativePath}\n`).join('');
  const withIndex = { ...at, env: { ...gitEnv, GIT_INDEX_FILE: indexFile } };
  gitOk([`--git-dir=${gitDir}`, 'update-index', '--add', '--index-info'], { ...withIndex, input: indexInfo });
  return gitOk([`--git-dir=${gitDir}`, 'write-tree'], withIndex);
}

// The regular files of a built plugin folder, as paths with `/`; anything
// else (a link, a special file) or a path git cannot store as given stops the
// publish.
export async function builtFiles(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { recursive: true, withFileTypes: true })) {
    const absolutePath = path.join(entry.parentPath ?? entry.path, entry.name);
    const relativePath = path.relative(dir, absolutePath).split(path.sep).join('/');
    if (entry.isDirectory()) continue;
    if (!entry.isFile()) throw new Error(`Refusing to publish: the build holds ${relativePath}, which is not a regular file.`);
    // Printable ASCII only: git reads --stdin-paths and --index-info lines as
    // text (a trailing CR is dropped, a leading quote starts a quoted name),
    // and on macOS it stores names precomposed; such a name is refused.
    if (!/^[\x20-\x7e]+$/.test(relativePath) || relativePath.startsWith('"')) throw new Error(`Refusing to publish: the build holds a path with a character git may store differently: ${JSON.stringify(relativePath)}. Plugin paths are printable ASCII.`);
    files.push({ relativePath, executable: ((await fs.stat(absolutePath)).mode & 0o111) !== 0 });
  }
  return files.sort((left, right) => (left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0));
}

// A commit on the branch `plugin` that --publish did not write: its subject
// does not start with "Publish plugin <name> ".
function foreignCommits(run, localTip, remoteTip) {
  const log = run(['log', '--format=%H %s', localTip, ...(remoteTip ? [`^${remoteTip}`] : [])]);
  if (log.status !== 0) throw new Error(`Refusing to publish: could not read the history of the local branch ${pluginBranch} (${log.stderr || `git log exit status ${log.status}`}), so it cannot tell whether --publish wrote it. Repair the repository and rerun.`);
  return log.stdout.split('\n').filter(Boolean).filter((line) => !line.slice(line.indexOf(' ') + 1).startsWith(`Publish plugin ${pluginName} `)).map((line) => line.slice(0, 12));
}

// SIGINT or SIGTERM while publishing removes the temporary folder, then ends
// the process as the signal would (exit status 128 + its number). A handler
// only runs between synchronous steps, so `drain` lets a signal that already
// arrived run it: right before the commit (an interrupted publish commits
// nothing) and before the handlers go (a Ctrl-C that also stopped a git or
// node child still ends with 130). After the commit the handler says which
// commit the branch holds.
const signalStatuses = { SIGINT: 130, SIGTERM: 143 };
function signalGuard(folder) {
  const state = { committed: null };
  const handler = (signal) => {
    rmSync(folder, { recursive: true, force: true });
    if (state.committed) process.stderr.write(`Interrupted after the commit: the local branch ${pluginBranch} holds ${state.committed}, and ${pluginOutputDirectory} was not refreshed (run ${writeCommand}).\n`);
    process.exit(signalStatuses[signal]);
  };
  for (const signal of Object.keys(signalStatuses)) process.on(signal, handler);
  return {
    state,
    drain: () => new Promise((resolve) => setTimeout(resolve, 0)).then(() => new Promise((resolve) => setImmediate(resolve))),
    remove: () => { for (const signal of Object.keys(signalStatuses)) process.removeListener(signal, handler); }
  };
}

// Runs node on the exported source commit with the sanitized environment: the
// code that runs is the commit's, never a file of the working tree.
// NODE_OPTIONS is dropped too: an inherited --import or --require would run
// code that is not the commit's inside that process.
function runSourceNode(sourceRoot, args, env) {
  const { NODE_OPTIONS: _ignored, ...sourceEnv } = env;
  const result = spawnSync(process.execPath, args, { cwd: sourceRoot, env: sourceEnv, encoding: 'utf8' });
  if (result.error) throw new Error(`Refusing to publish: could not run node on the source commit: ${result.error.message}`);
  return result;
}

// The legal check of the source commit, run on it. Output that is not its
// result counts as a failure, so a check that did not run never passes.
const legalProbe = 'const { validateLegalReadiness } = await import(process.argv[1]); process.stdout.write(JSON.stringify(validateLegalReadiness({ root: process.argv[2] })));';
function sourceLegalCheck(sourceRoot, env) {
  const module = pathToFileURL(path.join(sourceRoot, 'scripts/validate-legal-readiness.mjs')).href;
  const result = runSourceNode(sourceRoot, ['--input-type=module', '-e', legalProbe, module, sourceRoot], env);
  try {
    const legal = JSON.parse(result.stdout);
    if (result.status === 0 && typeof legal.ok === 'boolean' && Array.isArray(legal.failures)) return legal;
  } catch {
    // Reported below.
  }
  return { ok: false, failures: [`the legal check did not run: ${result.stderr.trim() || `exit status ${result.status}`}`] };
}

// Commits a validated build to the local branch `plugin` with plumbing only:
// objects stored without filters, a temporary index, and update-ref
// --no-deref; dist/plugin is refreshed after the commit. HEAD, the
// current branch, the index, the working tree and the git configuration are
// left alone; nothing is fetched or pushed. The build reads the tracked
// content of HEAD and runs the build code of HEAD (--out in a child node),
// never the working tree; the result is validated again before the commit.
// It refuses, before building, when
// the root is not the top level of its own repository, the branch is a
// symbolic ref, a worktree has the branch checked out, git has no identity, a build input has uncommitted
// changes, origin/main is missing or does not contain HEAD, the local branch
// does not contain origin/plugin, or it holds commits --publish did not
// write; and, after exporting HEAD, when the
// legal check fails on it, the build does not validate, the marketplace is out
// of sync, or new content keeps the published version without sameVersion.
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
  // A symbolic ref would make update-ref move the branch it points at.
  if (run(['symbolic-ref', '--quiet', branchRef]).status === 0) {
    throw new Error(`Refusing to publish: ${branchRef} is a symbolic reference (to ${run(['symbolic-ref', '--quiet', branchRef]).stdout}), so a commit to it would move that branch. Delete it with \`git symbolic-ref --delete ${branchRef}\` and rerun.`);
  }
  const holder = worktreeHolding(runOk(['worktree', 'list', '--porcelain']), branchRef);
  if (holder) throw new Error(`Refusing to publish: the branch ${pluginBranch} is checked out in ${holder}. Switch that worktree to another branch and rerun.`);

  const name = run(['config', 'user.name']).stdout.trim();
  const email = run(['config', 'user.email']).stdout.trim();
  if (!name || !email) throw new Error('Refusing to publish: no git identity for this repository. Publishing reads the identity from the repository\'s git configuration (git config user.name and user.email) with a sanitized environment: inherited GIT_* variables are ignored, GIT_AUTHOR_*, GIT_COMMITTER_* and GIT_CONFIG_GLOBAL included. Configure user.name and user.email yourself and rerun; publishing never sets them.');
  const identity = `${name} <${email}>`;
  log(`Publishing as ${identity}.`);

  const dirty = runOk(['status', '--porcelain', '--untracked-files=all', '--', ...pluginBuildInputs]);
  if (dirty) {
    const paths = dirty.split('\n').map((line) => line.slice(3));
    throw new Error(`Refusing to publish: uncommitted changes in files the build reads: ${paths.join(', ')}. Commit or discard them and rerun.`);
  }
  const source = run(['rev-parse', '--short', 'HEAD']);
  if (source.status !== 0) throw new Error('Refusing to publish: the repository has no commit to name as the source of the build.');

  const mainBranch = `${pluginRemote}/${sourceBranch}`;
  const mainTip = commitOf(run, `refs/remotes/${mainBranch}`);
  if (!mainTip) {
    throw new Error(`Refusing to publish: ${mainBranch} is not present locally: fetch it first (git fetch ${pluginRemote}, which also brings ${pluginRemote}/${pluginBranch} when the remote has it) and rerun. Publishing never fetches, and it only publishes a commit that ${mainBranch} contains.`);
  }
  if (run(['merge-base', '--is-ancestor', 'HEAD', mainTip]).status !== 0) {
    throw new Error(`Refusing to publish: HEAD (${source.stdout}) is not contained in ${mainBranch}. Publish only a released commit: merge it into ${sourceBranch}, fetch, check out a commit that ${mainBranch} contains and rerun. Publishing never fetches: ${mainBranch} is the copy last fetched.`);
  }

  const remoteBranch = `${pluginRemote}/${pluginBranch}`;
  const localTip = commitOf(run, branchRef);
  const remoteTip = commitOf(run, `refs/remotes/${remoteBranch}`);
  if (localTip && remoteTip && run(['merge-base', '--is-ancestor', remoteTip, localTip]).status !== 0) {
    throw new Error(`Refusing to publish: the local branch ${pluginBranch} is behind or diverged from ${remoteBranch}: it does not contain ${remoteTip}. Bring the local branch up to date first, so that it contains ${remoteBranch}, and rerun. Publishing never fetches: ${remoteBranch} is the copy last fetched.`);
  }
  const foreign = localTip ? foreignCommits(run, localTip, remoteTip) : [];
  if (foreign.length > 0) {
    throw new Error(`Refusing to publish: the local branch ${pluginBranch} holds commits that --publish did not write (${foreign.join(', ')}): their message does not start with "Publish plugin ${pluginName} ". Publishing on top would push that history with the plugin. Check what the branch holds; if it is not the published plugin, delete it (git branch -D ${pluginBranch}) and rerun.`);
  }
  const parent = localTip ?? remoteTip;
  const base = localTip ? pluginBranch : remoteBranch;
  if (!parent) {
    // Right for the first publish; otherwise origin/plugin was never fetched
    // here, and the push of an unrelated history would be rejected.
    log(`No local branch ${pluginBranch} and no ${remoteBranch}: this commit starts a new history of ${pluginBranch}. If the remote already has ${pluginBranch}, fetch it first (git fetch ${pluginRemote}) and rerun, so the commit builds on it.`);
  }

  // A real path: the child node runs the exported script by it.
  const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-plugin-publish-')));
  const guard = signalGuard(temporary);
  try {
    const sourceRoot = await exportHead({ realRoot, gitEnv, folder: temporary });
    const legal = sourceLegalCheck(sourceRoot, gitEnv);
    if (!legal.ok) {
      throw new Error([
        `Refusing to publish: the legal check (node scripts/validate-legal-readiness.mjs) fails on the source commit ${source.stdout}:`,
        ...legal.failures.map((failure) => `- ${failure}`),
        'Fix what it names and commit. After a version raise or any template change, renew remainingInventory (fileCount and pathContentSha256) in docs/legal/overlay-authorship.json as docs/versioning.md explains.'
      ].join('\n'));
    }
    // The build goes to the temporary folder: dist/plugin changes only once
    // the branch holds it, so a refusal leaves dist/plugin as it was.
    const built = path.join(temporary, 'plugin');
    const build = runSourceNode(sourceRoot, [path.join(sourceRoot, 'scripts/build-plugin.mjs'), '--root', sourceRoot, '--out', built], gitEnv);
    if (build.status !== 0) throw new Error(build.stderr.trim() || `The build of the source commit ${source.stdout} failed with exit status ${build.status}.`);
    const { failures } = await validatePluginFolder({ root: sourceRoot, dir: built });
    if (failures.length > 0) throw new Error(formatFailures(failures));
    const { version } = await readPackageJson(sourceRoot);
    const message = `Publish plugin ${pluginName} ${version} from ${source.stdout}`;
    const gitDir = runOk(['rev-parse', '--absolute-git-dir']);
    const treeId = pluginTree({ gitDir, gitEnv, dir: built, files: await builtFiles(built), indexFile: path.join(temporary, 'index') });
    let result;
    if (parent && runOk(['rev-parse', `${parent}^{tree}`]) === treeId) {
      result = { committed: false, commit: parent, base, branchExists: Boolean(localTip), identity, message };
    } else {
      if (parent && !sameVersion && publishedVersion(run, parent) === version) {
        throw new Error(`Refusing to publish: the build differs from the tip of ${base} (${parent}) but keeps its version ${version}. Claude Code pins a plugin to its version, so people who installed ${version} would not receive this change. Raise the version first (the release steps of docs/versioning.md: package.json, kit_version, the overlay authorship record, then ${writeCommand}), commit it to ${sourceBranch}, or pass --same-version to publish it under ${version} anyway.`);
      }
      await guard.drain();
      const committer = { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email };
      const commit = gitOk(['commit-tree', treeId, ...(parent ? ['-p', parent] : []), '-m', message], { cwd: realRoot, env: { ...gitEnv, ...committer } });
      // --no-deref and the expected old value: only the branch itself moves,
      // and only from the tip checked above.
      runOk(['update-ref', '--no-deref', '-m', message, branchRef, commit, localTip ?? '']);
      guard.state.committed = commit;
      result = { committed: true, commit, parent, branchExists: true, identity, message };
    }
    // dist/plugin follows what the branch holds; failing to refresh it is
    // reported, as the publish itself is done.
    let warnings;
    try {
      ({ warnings } = await replacePluginDirectory({ realRoot, fill: async (staging) => fs.cp(built, staging, { recursive: true }) }));
    } catch (error) {
      warnings = [`The branch ${pluginBranch} holds the build, but ${pluginOutputDirectory} could not be refreshed (${error.message}). Run ${writeCommand} to rebuild it.`];
    }
    return { ...result, warnings };
  } finally {
    await guard.drain();
    guard.remove();
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

const usage = 'node scripts/build-plugin.mjs [--write | --publish [--same-version]] [--root <dir>]';

function parseArguments(argv) {
  const options = { mode: 'check', root: packageRoot, rootGiven: false, out: null, sameVersion: false };
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
      options.rootGiven = true;
    } else if (argument === '--out') {
      if (index + 1 >= argv.length || argv[index + 1].trim() === '') throw new Error('--out needs a directory: a new or empty directory to build into.');
      options.out = argv[index += 1];
    } else {
      throw new Error(`Unknown option ${argument}. Usage: ${usage}`);
    }
  }
  if (options.sameVersion && options.mode !== 'publish') throw new Error(`--same-version only applies to --publish. Usage: ${usage}`);
  if (options.out !== null && options.mode !== 'check') throw new Error('--out only applies to check mode (no --write, no --publish).');
  if (options.out !== null && !options.rootGiven) throw new Error('--out needs --root: the workflow kit repository to build from.');
  return options;
}

async function main(argv) {
  const options = parseArguments(argv);
  if (options.out !== null) {
    const result = await buildPluginInto({ root: options.root, out: options.out });
    if (!result.ok) {
      console.error(formatFailures(result.failures));
      return 1;
    }
    console.log(`Built ${result.count} plugin files into ${result.dir}.`);
    return 0;
  }
  if (options.mode === 'write') {
    const { count, warnings } = await writePluginBuild({ root: options.root });
    console.log(`Wrote ${count} plugin files to ${pluginOutputDirectory}/ and ${marketplacePath}.`);
    for (const warning of warnings) console.warn(warning);
    return 0;
  }
  if (options.mode === 'publish') {
    const result = await publishPluginBuild({ root: options.root, sameVersion: options.sameVersion, log: (line) => console.log(line) });
    console.log(result.committed
      ? `${result.message}: committed ${result.commit} to the local branch ${pluginBranch}${result.parent ? ` (parent ${result.parent})` : ' (first commit)'}.`
      : `${result.base} already holds this build (${result.commit}); no commit created.`);
    if (result.branchExists) console.log(`Next step, with explicit approval: git push ${pluginRemote} ${pluginBranch}`);
    for (const warning of result.warnings) console.warn(warning);
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

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
