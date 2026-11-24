// Plugin mode (PRD 4 of the kit-project-overlay epic): the workflow kit runs as
// the plugin `fhh` of the marketplace `fhh-ia-ecosystem`, published as the
// content of the branch `plugin` of the kit repository. This module is the
// single source of that identity and of the path rule every plugin text uses
// verbatim (the `kit-root` skill, the plugin agents and the adapter block of
// a repository in plugin mode).
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

// Plugin mode needs at least one runtime and only runtimes with a plugin.
export function assertPluginRuntimes(runtimes) {
  const chosen = runtimes.filter((runtime) => runtime !== 'neutral');
  const withoutPlugin = chosen.filter((runtime) => !pluginRuntimes.includes(runtime));
  if (chosen.length > 0 && withoutPlugin.length === 0) return;
  const problem = chosen.length === 0
    ? 'plugin mode needs --runtime, and no runtime was chosen'
    : `${withoutPlugin.join(', ')} ${withoutPlugin.length === 1 ? 'has' : 'have'} no plugin; plugin mode supports ${pluginRuntimes.join(', ')}`;
  const repoCommand = `workflow-kit init --mode repo${chosen.length > 0 ? ` --runtime ${chosen.join(',')}` : ''}`;
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

// The settings files are the user's, like .gitignore: their operations have no
// class and never enter install-state. A valid file only gains the two keys
// (other keys and their order stay) and always keeps a backup; a file that is
// not a JSON object, or whose two keys are not objects, is never touched: the
// plan shows the fragment to add by hand.
export async function planPluginSettings({ targetPath, runtimes }) {
  const operations = [];
  for (const runtime of runtimes.filter((item) => pluginRuntimes.includes(item))) {
    const relativePath = pluginSettingsPaths[runtime];
    const targetFile = path.join(targetPath, relativePath);
    const base = { relativePath, targetFile, sourcePath: null };
    const existing = await readOptional(targetFile);
    if (existing === null) {
      operations.push({ ...base, operation: 'create', content: `${JSON.stringify(declarationFragment(), null, 2)}\n` });
      continue;
    }
    let settings;
    try {
      settings = JSON.parse(existing);
    } catch {
      settings = null;
    }
    if (!isPlainObject(settings) || declarationKeys.some((key) => settings[key] !== undefined && !isPlainObject(settings[key]))) {
      operations.push({ ...base, operation: 'skip_unmanaged', content: existing, reason: 'invalid_settings_json', manualFragment: JSON.stringify(declarationFragment(), null, 2) });
      continue;
    }
    if (isDeepStrictEqual(settings.extraKnownMarketplaces?.[marketplaceName], marketplaceDeclaration()) && settings.enabledPlugins?.[pluginId] === true) {
      operations.push({ ...base, operation: 'unchanged', content: existing });
      continue;
    }
    const merged = { ...settings };
    merged.extraKnownMarketplaces = { ...settings.extraKnownMarketplaces, [marketplaceName]: marketplaceDeclaration() };
    merged.enabledPlugins = { ...settings.enabledPlugins, [pluginId]: true };
    // Keep the file's indentation so the diff shows only the declaration.
    const indent = existing.match(/\n([ \t]+)"/)?.[1] ?? 2;
    operations.push({ ...base, operation: 'merge_with_backup', content: `${JSON.stringify(merged, null, indent)}\n` });
  }
  return operations;
}

async function readOptional(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
