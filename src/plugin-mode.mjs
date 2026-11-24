// Plugin mode (PRD 4 of the kit-project-overlay epic): the workflow kit runs as
// the plugin `fhh` of the marketplace `fhh-ia-ecosystem`, published as the
// content of the branch `plugin` of the kit repository. This module is the
// single source of that identity and of the path rule every plugin text uses
// verbatim (the `kit-root` skill, the plugin agents and the adapter block of
// a repository in plugin mode).
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import packageJson from '../package.json' with { type: 'json' };
import { blockMarkers } from './kit-manifest.mjs';
import { pluginRuntimes, pluginSettingsPaths } from './runtime-matrix.mjs';

export const pluginName = 'fhh';
export const marketplaceName = 'fhh-ia-ecosystem';
export const pluginBranch = 'plugin';

// PRD 2.2. The plugin ships only the `kit` and `derived` files of the kit
// manifest, so anything else a kit file names is not under the kit root and
// resolves in the repository.
export const pluginPathRule = 'Path rule: a path that a kit file names is read under the kit root when that file exists there; when it does not exist there, it resolves in the repository. So `.agents/project/**`, the install state, the diagnostics, the apply journal, the seeds, `.ai-work/**` and the project\'s own files always resolve in the repository: the plugin ships none of them. Never write under the kit root.';

// Plugin identity and declaration (PRD 2.1, 2.3). The marketplace repository
// comes from package.json, as the build reads it.
export const pluginId = `${pluginName}@${marketplaceName}`;
export const marketplaceRepository = packageJson.workflowKit.repository;
export const installModes = Object.freeze(['repo', 'plugin']);
export const kitLocationBlockName = 'workflow-kit:kit-location';
const kitRootSkill = `${pluginName}:kit-root`;

const installCommands = {
  claude: `claude plugin install ${pluginId} --scope project`,
  copilot: `copilot plugin install ${pluginId}`
};
export const claudePluginUpdateCommand = `claude plugin update ${pluginId}`;
// Copilot has no documented way to read its installed plugins (PRD 2.5).
export const copilotPluginListCommand = 'copilot plugin list';
const runtimeLabels = { claude: 'Claude Code', copilot: 'Copilot' };

export function pluginInstallCommand(runtime) {
  return installCommands[runtime];
}

// After an apply in plugin mode: the repository only declares the plugin;
// each person installs it once per clone.
export function formatPluginInstallSteps(runtimes) {
  const lines = runtimes.filter((runtime) => pluginRuntimes.includes(runtime))
    .map((runtime) => `- ${runtimeLabels[runtime]}: ${pluginInstallCommand(runtime)}`);
  return `Install the plugin ${pluginName}:\n${lines.join('\n')}\nEach person runs it once per clone of this repository; the repository only declares the plugin.\n`;
}

// Plugin mode needs at least one runtime and only runtimes with a plugin. The
// stop names the same command in repo mode (init, or update: T3, T14).
export function assertPluginRuntimes(runtimes, command = 'init') {
  const chosen = runtimes.filter((runtime) => runtime !== 'neutral');
  const withoutPlugin = chosen.filter((runtime) => !pluginRuntimes.includes(runtime));
  if (chosen.length > 0 && withoutPlugin.length === 0) return;
  const problem = chosen.length === 0
    ? 'plugin mode needs --runtime, and no runtime was chosen'
    : `${withoutPlugin.join(', ')} ${withoutPlugin.length === 1 ? 'has' : 'have'} no plugin; plugin mode supports ${pluginRuntimes.join(', ')}`;
  const repoCommand = `workflow-kit ${command} --mode repo${chosen.length > 0 ? ` --runtime ${chosen.join(',')}` : ''}`;
  throw new Error(`Cannot install in plugin mode: ${problem}. Use \`--runtime ${pluginRuntimes.join(',')}\` (or one of them), or install the kit files in the repository with \`${repoCommand}\`. Nothing was written.`);
}

// PRD 2.2: the block an adapter carries in plugin mode, generated from the
// same path rule as the kit-root skill and the plugin agents.
function kitLocationBlock() {
  const { start, end } = blockMarkers(kitLocationBlockName);
  return [
    start,
    `Kit location: the workflow kit runs as the plugin \`${pluginName}\`, so the kit files are not in this repository. Before N2/N3 work, or before reading a kit path, load the skill \`${kitRootSkill}\`: it gives the kit root.`,
    pluginPathRule,
    `If the skill \`${kitRootSkill}\` is not available, the plugin is not installed: do only N0 work and tell the user the install command (\`${installCommands.claude}\` in Claude Code, \`${installCommands.copilot}\` in Copilot).`,
    end
  ].join('\n');
}

// The repo-mode template with the kit-location block right after the start
// marker of its managed block; nothing else changes.
export function pluginAdapterContent(templateContent, blockName) {
  const { start } = blockMarkers(blockName);
  const index = templateContent.indexOf(start);
  if (index < 0) throw new Error(`The adapter template has no ${start} marker.`);
  const at = index + start.length;
  return `${templateContent.slice(0, at)}\n${kitLocationBlock()}\n${templateContent.slice(at)}`;
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const marketplaceDeclaration = () => ({ source: { source: 'github', repo: marketplaceRepository } });
const declarationKeys = ['extraKnownMarketplaces', 'enabledPlugins'];
const declarationFragment = () => ({ extraKnownMarketplaces: { [marketplaceName]: marketplaceDeclaration() }, enabledPlugins: { [pluginId]: true } });
const isKitMarketplace = (settings) => isDeepStrictEqual(settings.extraKnownMarketplaces?.[marketplaceName], marketplaceDeclaration());
const enablesPlugin = (settings) => settings.enabledPlugins?.[pluginId] === true;
const isDeclared = (settings) => isKitMarketplace(settings) && enablesPlugin(settings);
// The fragment to add by hand, on one line so a message can carry it.
export const pluginDeclarationFragment = () => JSON.stringify(declarationFragment());

// The settings file of each chosen plugin runtime: null when it is missing;
// `settings: null` when it is not a JSON object whose two declaration keys are
// objects, so the kit never touches it.
async function readPluginSettings({ targetPath, runtimes }) {
  const files = [];
  for (const runtime of runtimes.filter((item) => pluginRuntimes.includes(item))) {
    const relativePath = pluginSettingsPaths[runtime];
    const targetFile = path.join(targetPath, relativePath);
    const existing = await readOptional(targetFile);
    let settings = null;
    if (existing !== null) {
      try {
        settings = JSON.parse(existing);
      } catch {
        settings = null;
      }
      if (!isPlainObject(settings) || declarationKeys.some((key) => settings[key] !== undefined && !isPlainObject(settings[key]))) settings = null;
    }
    files.push({ base: { relativePath, targetFile, sourcePath: null }, existing, settings });
  }
  return files;
}

// Keep the file's indentation so the diff shows only the declaration.
const serializeLike = (existing, settings) => `${JSON.stringify(settings, null, existing.match(/\n([ \t]+)"/)?.[1] ?? 2)}\n`;
const invalidSettings = (base, existing, manualAction) => ({ ...base, operation: 'skip_unmanaged', content: existing, reason: 'invalid_settings_json', manualFragment: JSON.stringify(declarationFragment(), null, 2), manualAction });

// The settings files are the user's, like .gitignore: their operations have no
// class and never enter install-state. A valid file only gains the two keys
// (other keys and their order stay) and always keeps a backup; a file that is
// not a JSON object, or whose two keys are not objects, is never touched: the
// plan shows the fragment to add by hand.
export async function planPluginSettings({ targetPath, runtimes }) {
  const operations = [];
  for (const { base, existing, settings } of await readPluginSettings({ targetPath, runtimes })) {
    if (existing === null) {
      operations.push({ ...base, operation: 'create', content: `${JSON.stringify(declarationFragment(), null, 2)}\n` });
      continue;
    }
    if (settings === null) {
      operations.push(invalidSettings(base, existing, 'add this to it'));
      continue;
    }
    if (isDeclared(settings)) {
      operations.push({ ...base, operation: 'unchanged', content: existing });
      continue;
    }
    const merged = { ...settings };
    merged.extraKnownMarketplaces = { ...settings.extraKnownMarketplaces, [marketplaceName]: marketplaceDeclaration() };
    merged.enabledPlugins = { ...settings.enabledPlugins, [pluginId]: true };
    operations.push({ ...base, operation: 'merge_with_backup', content: serializeLike(existing, merged) });
  }
  return operations;
}

// Leaving plugin mode (PRD 2.4, T9): only the plugin entry leaves, and the
// marketplace entry only while it is the one the kit writes (a marketplace
// changed by hand is the user's). A declaration key left empty leaves too, as
// the kit added it; every other key and its order stay, and the file is never
// deleted, even when it ends up `{}`. Always with a backup; a missing file has
// nothing to remove; an invalid one is never touched and the plan shows what
// to remove by hand.
export async function planPluginSettingsRemoval({ targetPath, runtimes }) {
  const operations = [];
  for (const { base, existing, settings } of await readPluginSettings({ targetPath, runtimes })) {
    if (existing === null) continue;
    if (settings === null) {
      operations.push(invalidSettings(base, existing, 'remove this from it'));
      continue;
    }
    const removals = [
      ...(Object.hasOwn(settings.enabledPlugins ?? {}, pluginId) ? [['enabledPlugins', pluginId]] : []),
      ...(isKitMarketplace(settings) ? [['extraKnownMarketplaces', marketplaceName]] : [])
    ];
    if (removals.length === 0) {
      operations.push({ ...base, operation: 'unchanged', content: existing });
      continue;
    }
    const cleaned = { ...settings };
    for (const [key, name] of removals) {
      const rest = { ...cleaned[key] };
      delete rest[name];
      if (Object.keys(rest).length === 0) delete cleaned[key];
      else cleaned[key] = rest;
    }
    operations.push({ ...base, operation: 'merge_with_backup', content: serializeLike(existing, cleaned) });
  }
  return operations;
}

// What doctor reads in each settings file (PRD 2.5): `valid` is false when the
// file is not a JSON object the kit would merge into; `declared` is the
// declaration the plan writes; `enabled` is the plugin turned on, whatever
// marketplace serves it.
export async function inspectPluginSettings({ targetPath, runtimes }) {
  return (await readPluginSettings({ targetPath, runtimes })).map(({ base, existing, settings }) => ({
    relativePath: base.relativePath,
    exists: existing !== null,
    valid: settings !== null,
    declared: settings !== null && isDeclared(settings),
    enabled: settings !== null && enablesPlugin(settings)
  }));
}

// `claude plugin list --json`, the only command doctor runs (PRD 2.5): read
// only, without a shell, bounded in time.
export const claudePluginListCommand = Object.freeze({ file: 'claude', args: Object.freeze(['plugin', 'list', '--json']) });
// What a person runs to check by hand.
export const claudePluginListHint = 'claude plugin list';
export const pluginListTimeoutMs = 5000;

// Default command executor: resolves `{ code, stdout }` once the command
// exits; rejects when it cannot start (ENOENT) or is killed at the timeout.
export function runCommand(file, args, { cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { cwd, timeout: timeoutMs, shell: false, windowsHide: true }, (runError, stdout) => {
      if (runError && typeof runError.code !== 'number') reject(runError);
      else resolve({ code: runError ? runError.code : 0, stdout });
    });
  });
}

// The plugin as Claude Code lists it: `installed` with its version, `absent`,
// or `unverified` with the reason. Never throws and never waits longer than
// `timeoutMs`, whatever the executor does: doctor keeps its own timer.
export async function inspectInstalledPlugins({ targetPath, executor = runCommand, timeoutMs = pluginListTimeoutMs }) {
  const { file, args } = claudePluginListCommand;
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
  let outcome;
  try {
    outcome = await Promise.race([Promise.resolve().then(() => executor(file, [...args], { cwd: targetPath, timeoutMs })), timeout]);
  } catch (runError) {
    return { status: 'unverified', reason: runError?.code === 'ENOENT' ? `${file} is not on the PATH` : `${file} could not run (${runError?.code ?? runError?.message ?? 'unknown error'})` };
  } finally {
    clearTimeout(timer);
  }
  if (outcome === null) return { status: 'unverified', reason: `${file} did not answer within ${timeoutMs / 1000} seconds` };
  if (outcome?.code !== 0) return { status: 'unverified', reason: `${file} exited with code ${outcome?.code}` };
  let plugins;
  try {
    plugins = JSON.parse(outcome.stdout);
  } catch {
    plugins = null;
  }
  if (!Array.isArray(plugins)) return { status: 'unverified', reason: `${file} did not answer with a JSON list` };
  const entry = plugins.find((item) => item?.id === pluginId);
  return entry ? { status: 'installed', version: entry.version ?? null } : { status: 'absent' };
}

async function readOptional(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
