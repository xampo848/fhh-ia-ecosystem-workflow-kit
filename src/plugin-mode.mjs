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
// Claude Code prefixes plugin skills with the plugin name; Copilot CLI lists
// them without a prefix (P3-S2 smoke), so the adapter names both.
const kitRootSkill = `the skill \`kit-root\` of the plugin \`${pluginName}\` (\`${pluginName}:kit-root\` in Claude Code, \`kit-root\` in Copilot)`;

const installCommands = {
  claude: `claude plugin install ${pluginId} --scope project`,
  copilot: `copilot plugin install ${pluginId}`
};
export const claudePluginUpdateCommand = `claude plugin update ${pluginId}`;
export const claudePluginEnableCommand = `claude plugin enable ${pluginId}`;
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
    `Kit location: the workflow kit runs as the plugin \`${pluginName}\`, so the kit files are not in this repository. Before N2/N3 work, or before reading a kit path, load ${kitRootSkill}: it gives the kit root.`,
    pluginPathRule,
    `If that skill is not available, the plugin is not installed: do only N0 work and tell the user the install command (\`${installCommands.claude}\` in Claude Code, \`${installCommands.copilot}\` in Copilot).`,
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
// D15: what a project decided in its settings file stays. A plugin entry set
// to false, or a marketplace entry other than the kit's (a fork, an own ref),
// is never replaced, and leaving plugin mode only removes an entry that is
// the kit's.
const disabledByProject = (settings) => settings.enabledPlugins?.[pluginId] === false;
const marketplaceCustomized = (settings) => settings.extraKnownMarketplaces?.[marketplaceName] !== undefined && !isKitMarketplace(settings);
// Something leaving plugin mode removes: an entry the kit writes.
const carriesKitEntry = (settings) => enablesPlugin(settings) || isKitMarketplace(settings);
// The two keys as a person finds them in the file.
export const pluginEntryKey = `enabledPlugins["${pluginId}"]`;
export const marketplaceEntryKey = `extraKnownMarketplaces["${marketplaceName}"]`;
export const kitMarketplaceEntry = () => JSON.stringify(marketplaceDeclaration());
// The fragment to add by hand, on one line so a message can carry it.
export const pluginDeclarationFragment = () => JSON.stringify(declarationFragment());

// The settings file of each chosen plugin runtime: null when it is missing;
// `settings: null` when it is not a JSON object whose two declaration keys are
// objects, so the kit never touches it. `tolerant`: a file that cannot be read
// (no permission, a folder at its path, a file where a folder of its path
// should be) counts as missing, for the reads that only look for the plugin.
async function readPluginSettings({ targetPath, runtimes, tolerant = false }) {
  const files = [];
  for (const runtime of runtimes.filter((item) => pluginRuntimes.includes(item))) {
    const relativePath = pluginSettingsPaths[runtime];
    const targetFile = path.join(targetPath, relativePath);
    let existing;
    try {
      existing = await readOptional(targetFile);
    } catch (readError) {
      if (!tolerant) throw readError;
      existing = null;
    }
    let settings = null;
    if (existing !== null) {
      try {
        settings = JSON.parse(existing);
      } catch {
        settings = null;
      }
      if (!isPlainObject(settings) || declarationKeys.some((key) => settings[key] !== undefined && !isPlainObject(settings[key]))) settings = null;
    }
    files.push({ runtime, base: { relativePath, targetFile, sourcePath: null }, existing, settings });
  }
  return files;
}

// Keep the file's indentation so the diff shows only the declaration.
const serializeLike = (existing, settings) => `${JSON.stringify(settings, null, existing.match(/\n([ \t]+)"/)?.[1] ?? 2)}\n`;
const invalidSettings = (base, existing, manualAction) => ({ ...base, operation: 'skip_unmanaged', content: existing, reason: 'invalid_settings_json', manualFragment: JSON.stringify(declarationFragment(), null, 2), manualAction });

// D15: the plan line of a settings file the project decided on.
function projectChoice(base, existing, settings) {
  const choices = [
    ...(disabledByProject(settings) ? [['plugin_disabled_by_project', `${pluginEntryKey} is false, the project turned the plugin off (set it to true to load the kit)`]] : []),
    ...(marketplaceCustomized(settings) ? [['marketplace_customized', `${marketplaceEntryKey} is the project's own entry (set it to ${kitMarketplaceEntry()} to use the kit's)`]] : [])
  ];
  if (choices.length === 0) return null;
  return { ...base, operation: 'skip_unmanaged', content: existing, reason: choices[0][0], note: `the project's choice, left as it is: ${choices.map(([, text]) => text).join('; ')}` };
}

// The settings files are the user's, like .gitignore: their operations have no
// class and never enter install-state. A valid file only gains the two keys
// (other keys and their order stay) and always keeps a backup; a file that is
// not a JSON object, or whose two keys are not objects, is never touched: the
// plan shows the fragment to add by hand. A file where the project turned the
// plugin off or uses its own marketplace entry is not touched either (D15).
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
    const choice = projectChoice(base, existing, settings);
    if (choice) {
      operations.push(choice);
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

// Leaving plugin mode (PRD 2.4, T9), or a runtime leaving a plugin install
// (D16): only the entries the kit writes leave, the plugin turned on and the
// kit's marketplace entry (D15: what the project changed is the project's). A
// declaration key left empty leaves too, as the kit added it; every other key
// and its order stay, and the file is never deleted, even when it ends up
// `{}`. Always with a backup; a missing file has nothing to remove; an invalid
// one is never touched and the plan shows what to remove by hand.
export async function planPluginSettingsRemoval({ targetPath, runtimes }) {
  const operations = [];
  for (const { base, existing, settings } of await readPluginSettings({ targetPath, runtimes })) {
    if (existing === null) continue;
    if (settings === null) {
      operations.push(invalidSettings(base, existing, 'remove this from it'));
      continue;
    }
    const removals = [
      ...(enablesPlugin(settings) ? [['enabledPlugins', pluginId]] : []),
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

// D16: the plugin runtimes whose settings file carries an entry the kit
// writes, whatever the state records; a file that cannot be read carries none.
export async function runtimesDeclaringPlugin({ targetPath }) {
  return (await readPluginSettings({ targetPath, runtimes: pluginRuntimes, tolerant: true }))
    .filter(({ settings }) => settings !== null && carriesKitEntry(settings))
    .map(({ runtime }) => runtime);
}

// What doctor reads in each settings file (PRD 2.5): `valid` is false when the
// file is not a JSON object the kit would merge into; `declared` is the
// declaration the plan writes; `enabled` is the plugin turned on, whatever
// marketplace serves it; `disabledByProject` and `marketplaceCustomized` are
// the project's choices the kit leaves as they are (D15). `tolerant`: a file
// that cannot be read reads as missing.
export async function inspectPluginSettings({ targetPath, runtimes, tolerant = false }) {
  return (await readPluginSettings({ targetPath, runtimes, tolerant })).map(({ base, existing, settings }) => ({
    relativePath: base.relativePath,
    exists: existing !== null,
    valid: settings !== null,
    declared: settings !== null && isDeclared(settings),
    enabled: settings !== null && enablesPlugin(settings),
    disabledByProject: settings !== null && disabledByProject(settings),
    marketplaceCustomized: settings !== null && marketplaceCustomized(settings)
  }));
}

// `claude plugin list --json`, the only command doctor runs (PRD 2.5): read
// only, without a shell, bounded in time.
export const claudePluginListCommand = Object.freeze({ file: 'claude', args: Object.freeze(['plugin', 'list', '--json']) });
// What a person runs to check by hand.
export const claudePluginListHint = 'claude plugin list';
export const pluginListTimeoutMs = 5000;

// Default command executor: resolves `{ code, stdout }` once the command
// exits; rejects when it cannot start (ENOENT) or at the timeout. At the
// timeout the command is killed with SIGKILL (a SIGTERM can be ignored), and
// its pipes are closed and released, so nothing it left behind (a child
// still holding its output) keeps this process alive.
export function runCommand(file, args, { cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const child = execFile(file, args, { cwd, timeout: timeoutMs, killSignal: 'SIGKILL', shell: false, windowsHide: true }, (runError, stdout) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (runError && typeof runError.code !== 'number') reject(runError);
      else resolve({ code: runError ? runError.code : 0, stdout });
    });
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      for (const stream of [child.stdin, child.stdout, child.stderr]) stream?.destroy();
      child.unref();
      reject(Object.assign(new Error(`${file} did not answer within ${timeoutMs / 1000} seconds`), { code: 'ETIMEDOUT' }));
    }, timeoutMs);
  });
}

// The plugin as Claude Code lists it: `installed` with its version and
// whether it is enabled, `absent`, or `unverified` with the reason. Never
// throws and never waits longer than `timeoutMs`, whatever the executor does:
// doctor keeps its own timer.
export async function inspectInstalledPlugins({ targetPath, executor = runCommand, timeoutMs = pluginListTimeoutMs }) {
  const { file, args } = claudePluginListCommand;
  const timedOut = { status: 'unverified', reason: `${file} did not answer within ${timeoutMs / 1000} seconds` };
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
  let outcome;
  try {
    outcome = await Promise.race([Promise.resolve().then(() => executor(file, [...args], { cwd: targetPath, timeoutMs })), timeout]);
  } catch (runError) {
    if (runError?.code === 'ETIMEDOUT') return timedOut;
    return { status: 'unverified', reason: runError?.code === 'ENOENT' ? `${file} is not on the PATH` : `${file} could not run (${runError?.code ?? runError?.message ?? 'unknown error'})` };
  } finally {
    clearTimeout(timer);
  }
  if (outcome === null) return timedOut;
  if (outcome?.code !== 0) return { status: 'unverified', reason: `${file} exited with code ${outcome?.code}` };
  let plugins;
  try {
    plugins = JSON.parse(outcome.stdout);
  } catch {
    plugins = null;
  }
  if (!Array.isArray(plugins)) return { status: 'unverified', reason: `${file} did not answer with a JSON list` };
  const entry = plugins.find((item) => item?.id === pluginId);
  return entry ? { status: 'installed', version: entry.version ?? null, enabled: entry.enabled !== false } : { status: 'absent' };
}

async function readOptional(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
