#!/usr/bin/env node
// Builds the plugin `fhh` (marketplace `fhh-ia-ecosystem`) as a generated
// folder, `dist/plugin/`, that is never committed on `main`: the plugin
// manifests, the plugin skills (the explicit workflow wrappers plus `kit-root`,
// the one skill the model may load on its own), the plugin variant of the
// delegate agents for Claude Code and Copilot, the legal files, and a copy of
// the `kit` and `derived` files of the overlay template. Only the marketplace,
// which points at the branch `plugin`, is committed at the repository root.
// Usage: node scripts/build-plugin.mjs [--write | --publish] [--root <dir>]
//   (no flag)  build into a temporary folder, validate it and compare the
//              committed marketplace; never writes into the repository.
//   --write    rebuild dist/plugin/ from scratch and rewrite the marketplace.
//   --publish  rebuild dist/plugin/ and commit it to the local branch
//              `plugin` without touching HEAD, the index or the working tree.
//              It never pushes.
import { spawnSync } from 'node:child_process';
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
const agentPluginsSchema = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const pluginDescription = 'Workflow kit: routed workflow skills and delegates that run from the plugin while each repository keeps its own project overlay.';
const marketplaceDescription = 'Marketplace of the fhh workflow kit plugin.';
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

// Returns dist/plugin as a real, empty directory inside the root. It never
// follows a link: a `dist` or `dist/plugin` that resolves outside the root, is
// a symbolic link, or is not a directory stops the build before any removal.
// Only the contents of dist/plugin are removed.
async function preparePluginDirectory(root) {
  const realRoot = await fs.realpath(root);
  let current = realRoot;
  for (const segment of pluginOutputDirectory.split('/')) {
    current = path.join(current, segment);
    const label = path.relative(realRoot, current).split(path.sep).join('/');
    let stats;
    try {
      stats = await fs.lstat(current);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await fs.mkdir(current);
      continue;
    }
    if (stats.isSymbolicLink()) {
      const target = await fs.realpath(current).catch(() => null);
      if (!target || !isInside(realRoot, target)) throw new Error(`Refusing to build: ${label} resolves outside the root (it is a symbolic link). Remove it and rerun.`);
      throw new Error(`Refusing to build: ${label} is a symbolic link. Remove it and rerun.`);
    }
    if (!stats.isDirectory()) throw new Error(`Refusing to build: ${label} is not a directory. Remove it and rerun.`);
  }
  for (const entry of await fs.readdir(current)) {
    await fs.rm(path.join(current, entry), { recursive: true, force: true });
  }
  return current;
}

async function buildPluginDirectory(root) {
  const resolved = await resolveKitRoot(root);
  const dir = await preparePluginDirectory(resolved);
  const count = await buildInto({ root: resolved, dir });
  return { root: resolved, dir, count };
}

export async function writePluginBuild({ root = packageRoot } = {}) {
  const result = await buildPluginDirectory(root);
  const target = path.join(result.root, marketplacePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, await expectedMarketplace({ root: result.root }), 'utf8');
  return result;
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
    let count;
    try {
      count = await buildInto({ root: resolved, dir });
    } catch (error) {
      return { ok: false, count: 0, failures: [{ message: `Plugin build failed: ${error.message}`, fix: sourceFix }] };
    }
    const { failures } = await validatePluginFolder({ root: resolved, dir });
    const expected = await expectedMarketplace({ root: resolved });
    const committed = await fs.readFile(path.join(resolved, marketplacePath), 'utf8').catch(() => null);
    if (committed === null) failures.push({ message: `Marketplace missing: ${marketplacePath}`, fix: writeCommand });
    else if (committed !== expected) failures.push({ message: `Marketplace drift: ${marketplacePath}`, fix: writeCommand });
    return { ok: failures.length === 0, count, failures };
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

function git(args, { cwd, env = process.env }) {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  if (result.error) throw new Error(`git ${args[0]} failed: ${result.error.message}`);
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function gitOk(args, options) {
  const result = git(args, options);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

// Commits dist/plugin to the local branch `plugin` with plumbing only: a
// temporary index, the folder as work tree, and update-ref. HEAD, the current
// branch, the index, the working tree and the git configuration are left
// alone, and nothing is pushed. The identity is the one git already resolves.
export async function publishPluginBuild({ root = packageRoot, env = process.env } = {}) {
  const resolved = await resolveKitRoot(root);
  const gitDir = gitOk(['rev-parse', '--absolute-git-dir'], { cwd: resolved, env });
  const branchRef = `refs/heads/${pluginBranch}`;
  const head = git(['symbolic-ref', '-q', 'HEAD'], { cwd: resolved, env });
  if (head.stdout === branchRef) throw new Error(`Refusing to publish: the branch ${pluginBranch} is checked out. Switch to another branch and rerun.`);

  const { dir } = await buildPluginDirectory(resolved);
  const packageJson = await readPackageJson(resolved);
  const message = `Publish plugin ${pluginName} ${packageJson.version}`;
  const parentResult = git(['rev-parse', '--verify', '--quiet', `${branchRef}^{commit}`], { cwd: resolved, env });
  const parent = parentResult.status === 0 ? parentResult.stdout : null;

  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-plugin-index-'));
  try {
    const plumbing = { cwd: dir, env: { ...env, GIT_INDEX_FILE: path.join(temporary, 'index') } };
    const tree = [`--git-dir=${gitDir}`, `--work-tree=${dir}`];
    gitOk([...tree, 'add', '--all', '--force', '--', '.'], plumbing);
    const treeId = gitOk([...tree, 'write-tree'], plumbing);
    if (parent && gitOk(['rev-parse', `${parent}^{tree}`], { cwd: resolved, env }) === treeId) {
      return { committed: false, commit: parent, message };
    }
    const commit = gitOk(['commit-tree', treeId, ...(parent ? ['-p', parent] : []), '-m', message], { cwd: resolved, env });
    gitOk(['update-ref', '-m', message, branchRef, commit, parent ?? ''], { cwd: resolved, env });
    return { committed: true, commit, parent, message };
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

function parseArguments(argv) {
  const options = { mode: 'check', root: packageRoot };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write' || argument === '--publish') {
      if (options.mode !== 'check') throw new Error('Use only one of --write and --publish.');
      options.mode = argument.slice(2);
    } else if (argument === '--root') {
      if (index + 1 >= argv.length) throw new Error('--root needs a directory: the workflow kit repository to build from.');
      options.root = argv[index += 1];
    } else {
      throw new Error(`Unknown option ${argument}. Usage: node scripts/build-plugin.mjs [--write | --publish] [--root <dir>]`);
    }
  }
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
    const result = await publishPluginBuild({ root: options.root });
    console.log(result.committed
      ? `${result.message}: committed ${result.commit} to the local branch ${pluginBranch}${result.parent ? ` (parent ${result.parent})` : ' (first commit)'}.`
      : `The local branch ${pluginBranch} already holds this build (${result.commit}); no commit created.`);
    console.log(`Next step, with explicit approval: git push origin ${pluginBranch}`);
    return 0;
  }
  const result = await checkPluginBuild({ root: options.root });
  if (!result.ok) {
    console.error('Plugin build validation failed:');
    for (const failure of result.failures) console.error(`- ${failure.message} (fix: ${failure.fix})`);
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
