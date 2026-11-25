import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import packageJson from '../package.json' with { type: 'json' };
import {
  buildUpdatePlan, incompleteApplyMessage, installStateRelativePath, lastApplyProblem, legacyInstallStateSchemaVersion,
  normalizeOverlay, packageKitQualityGate, parseRuntimeList, pluginModeTemplateFiles, readManagedInstallState, recordedChecksumOf,
  selectedTemplateFiles, stackRulesPath, unusableJournalMessage
} from './planner.mjs';
import { applyJournalRelativePath } from './apply.mjs';
import { classifyPath, currentPathFor, defaultBlockName, extractManagedBlock, isProjectPath, loadKitManifest } from './kit-manifest.mjs';
import { backupFileMarker, layoutMigrationId, projectIndexPath, projectIndexTableRows, shadowManifestName, skillsRoot, unquote, walkTree } from './migration.mjs';
import {
  claudePluginEnableCommand, claudePluginListHint, claudePluginUpdateCommand, copilotPluginListCommand, inspectInstalledPlugins, inspectPluginSettings,
  kitMarketplaceEntry, marketplaceEntryKey, pluginAdapterContent, pluginBranch, pluginDeclarationFragment, pluginEntryKey, pluginId, pluginInstallCommand
} from './plugin-mode.mjs';
import { pluginRuntimes, pluginSettingsPaths, runtimeEntrypoints, supportedRuntimes } from './runtime-matrix.mjs';
import { validateWorkflowContract } from './workflow-contract/index.mjs';
import { validateAdapterContracts } from './workflow-contract/adapters.mjs';
import { generatedMarker, loadDelegateCatalog, modelSettingLine, renderDelegateAdapterForPath, resolveModelProfiles } from './model-profiles.mjs';
import { projectContextDiagnostics, workspaceDiagnostics } from './workspace-diagnostics.mjs';
import { projectInstructionDiagnostics } from './project-instructions.mjs';
import { findSymlinkInPath, resolveInsideTarget } from './fs-safety.mjs';

function checksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

const warning = (code, relativePath, message) => ({ code, path: relativePath, message, severity: 'warning' });
const error = (code, relativePath, message) => ({ code, path: relativePath, message, severity: 'error' });

async function readOptional(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (readError) {
    if (readError.code === 'ENOENT' || readError.code === 'ENOTDIR' || readError.code === 'EISDIR') return null;
    throw readError;
  }
}

// An adapter's own text outside its block is the project's. Only an edit
// inside the block is reported: the next update restores the block. Pending
// kit and derived files come from the update plan (pendingDiagnostics).
async function adapterBlockDiagnostics({ targetPath, manifest, state, files, pluginMode }) {
  // A 1.0.0 state hashed every file whole; the layout migration decides on it.
  if (!state || state.schemaVersion === legacyInstallStateSchemaVersion) return [];
  const diagnostics = [];
  for (const [relativePath, entry] of Object.entries(state.files)) {
    if (entry.class !== 'adapter' || !entry.sha256) continue;
    // State keys come from the repository: never read outside the target.
    const content = await readOptional(resolveInsideTarget(targetPath, relativePath));
    if (content === null) continue; // Missing files are reported by the presence scan.
    const actual = recordedChecksumOf(manifest, relativePath, 'adapter', content);
    if (actual === null || actual === entry.sha256) continue;
    const template = files.find((file) => file.relativePath === relativePath);
    if (template && actual === recordedChecksumOf(manifest, relativePath, 'adapter', await adapterTemplate(manifest, template, pluginMode))) continue;
    diagnostics.push(warning('boundary/adapter-block-edited', relativePath, 'The workflow-kit block of this adapter was edited. The next update restores the block (with a backup); move your text outside the markers.'));
  }
  return diagnostics;
}

// The block this CLI writes: in plugin mode it carries the kit-location block.
async function adapterTemplate(manifest, template, pluginMode) {
  const content = await fs.readFile(template.sourcePath, 'utf8');
  return pluginMode ? pluginAdapterContent(content, classifyPath(manifest, template.relativePath)?.block ?? defaultBlockName) : content;
}

function stateDiagnostics(state) {
  if (!state) return [];
  const diagnostics = state.ignoredKeys.map((key) => warning('boundary/ignored-state-key', installStateRelativePath, `Key "${key}" names no file the kit installed (absolute, or with ".", ".." or empty segments), so workflow-kit ignores it; remove it from install-state.json.`));
  if (state.schemaVersion === legacyInstallStateSchemaVersion) {
    diagnostics.push(warning('managed/legacy-layout', installStateRelativePath, `Installed with the layout from before the kit and project overlay (install-state ${legacyInstallStateSchemaVersion}); run workflow-kit update (dry run first) to migrate to the kit/project overlay layout.`));
  }
  return diagnostics;
}

const projectSkillsHint = '.agents/project/skills/<name>/';
// In a target repository the kit registry lists only kit skills: a SKILL.md
// it does not list is own or left-over content (AC-12 warns about those), and
// registering it in the kit catalog would only make that catalog a pending edit.
function targetRepoContractDiagnostic(item) {
  if (item.code !== 'skills/unregistered-file') return item;
  return warning(item.code, item.path, `SKILL.md under .agents/skills/ that the kit registry does not list, so it is not kit content and the router does not load it. If a boundary/* finding names it or its folder, follow that; otherwise move the skill to ${projectSkillsHint} with a row in ${projectIndexPath}.`);
}

function journalDiagnostics(problem) {
  if (problem?.kind === 'unusable') return [error('managed/apply-journal-unusable', applyJournalRelativePath, `${unusableJournalMessage(problem.reason)}. init and update stop until then.`)];
  if (problem?.kind === 'incomplete') return [error('managed/apply-incomplete', applyJournalRelativePath, `${incompleteApplyMessage(problem.appliedAt)}, then run init or update again.`)];
  return [];
}

// What each pending reason of the update plan asks the user to do. Own
// skills the layout migration cannot move are moved by hand.
function pendingMessage(manifest, item) {
  // One decision per run; a list joined with | would be a shell pipe when pasted.
  const decisions = item.decisions ?? ['keep', 'discard'];
  const decide = `Run \`workflow-kit update --edited ${item.relativePath}=<decision>\`, where <decision> is ${decisions.length > 1 ? `${decisions.slice(0, -1).join(', ')} or ${decisions.at(-1)}` : decisions[0]} (keep leaves it as it is; discard takes the kit version${item.decisions?.includes('shadow') ? '; shadow moves your edit to a project shadow' : ''}${item.decisions?.includes('split') ? '; split keeps your own lines next to a new block' : ''}).`;
  const skillHome = `${manifest.project_root}skills/<name>/`;
  const moveByHand = (problem, step) => `${problem}, so the migration does not move it: ${step}move the folder by hand to ${skillHome} and add its row to ${projectIndexPath}.`;
  switch (item.reason) {
    case 'edited_kit_file': return `Kit file edited in this repository: update leaves it as it is, so it gets no kit fixes. ${decide}`;
    case 'unrecorded_kit_file': return `Kit file that differs from this kit version and that install-state does not record. ${decide}`;
    case 'unmarked_adapter': return `Adapter without the workflow-kit markers: update cannot refresh its block. ${decide}`;
    case 'retired_edited': return 'Edited, and the kit no longer ships it; delete it or keep it as project content outside the kit folders.';
    case 'symlink': return moveByHand('Own skill with a symbolic link inside', 'replace the links with real files, then ');
    case 'project_skill_exists': return moveByHand('A project skill with this name already exists', 'rename one of them, then ');
    case 'kit_skill_name': return moveByHand('Own skill with the name of a kit skill', 'rename it (to change the kit skill, use a shadow), then ');
    case 'invalid_skill_name': return moveByHand('Own skill whose name is not a valid folder name', 'rename it, then ');
    case 'mixed_with_kit_files': return moveByHand('Own skill folder that also holds kit files', 'leave the kit files where they are and ');
    case 'binary_file': return moveByHand('Own skill with a file that is not UTF-8 text', '');
    case 'legacy_path_unsupported': return `Cannot move to ${currentPathFor(manifest, item.relativePath)}: it is not UTF-8 text, or one of the two paths is a folder. Fix the file (UTF-8 text, not a folder) and run workflow-kit update.`;
    default: return `Pending in workflow-kit update (${item.reason}). Run workflow-kit update (dry run) to see it.`;
  }
}

const pendingReasons = new Set(['edited_kit_file', 'unrecorded_kit_file', 'unmarked_adapter', 'retired_edited']);

// One source of truth: the update plan in dry run. A plan that cannot be
// built is a finding, never a crash.
async function pendingDiagnostics({ targetPath, manifest, state, runtimes, overlay, journalProblem }) {
  if (!state || journalProblem) return [];
  let plan;
  try {
    plan = await buildUpdatePlan({ targetPath, manifest, runtime: runtimes.join(','), overlay });
  } catch (planError) {
    return [warning('boundary/update-plan-failed', installStateRelativePath, `workflow-kit update cannot plan this repository: ${planError.message} Fix that and run doctor again.`)];
  }
  const migration = plan.migrations.find((item) => item.id === layoutMigrationId);
  const pending = new Map();
  const add = (item) => pending.set(`${item.relativePath}\0${item.reason}`, pending.get(`${item.relativePath}\0${item.reason}`) ?? item);
  for (const item of plan.operations) {
    if (item.operation === 'skip_modified' && pendingReasons.has(item.reason)) add({ relativePath: item.relativePath, reason: item.reason, decisions: item.decisions });
  }
  for (const item of migration?.pending ?? []) add(item);
  const diagnostics = [...pending.values()].map((item) => warning(`boundary/pending-${item.reason}`, item.relativePath, pendingMessage(manifest, item)));
  for (const row of migration?.unwrittenRows ?? []) {
    diagnostics.push(warning('boundary/pending-catalog_row_not_moved', row.rowPath, `The catalog row ${row.name} names a path in the kit tree that is no own skill, so the migration does not write it to ${projectIndexPath}. If the skill lives at a project path, add the row to ${projectIndexPath} by hand.`));
  }
  return diagnostics;
}

async function pathExists(targetPath, relativePath) {
  try {
    await fs.lstat(resolveInsideTarget(targetPath, relativePath));
    return true;
  } catch (statError) {
    if (statError.code === 'ENOENT' || statError.code === 'ENOTDIR') return false;
    throw statError;
  }
}

const listedPathsLimit = 10;
const listPaths = (paths) => (paths.length <= listedPathsLimit
  ? paths.join(', ')
  : `${paths.slice(0, listedPathsLimit).join(', ')} and ${paths.length - listedPathsLimit} more`);

// PRD 2.5: one install mode at a time. In plugin mode a kit or derived file
// the plugin plan does not write is a second copy of the kit (backups and the
// apply journal are no such path); in repo mode a settings file that turns the
// plugin on loads the kit twice (an export, a copy of the kit, too). A
// settings file doctor cannot read is skipped there: repo mode never needed
// it (F4). Under the agents folders only a repo-mode agent, which carries the
// generator marker, is such a copy; a project agent with a kit slug, or an
// edited plugin agent kept by an update, is not (R11).
const agentFolders = ['.claude/agents/', '.github/agents/'];
async function modeMixDiagnostics({ targetPath, manifest, state, pluginMode, files, shipped }) {
  if (!state) return [];
  if (!pluginMode) {
    return (await inspectPluginSettings({ targetPath, runtimes: pluginRuntimes, tolerant: true })).filter((item) => item.enabled)
      .map((item) => error('mode/repo-and-plugin', item.relativePath, `This install records ${state.mode === 'export' ? 'an export (a copy of the kit files in this folder)' : 'repo mode (the kit files are in the repository)'}, but this file enables the plugin ${pluginId}, so the kit would load twice. ${repoAndPluginWayOut(state, item.relativePath)}`));
  }
  const planned = new Set(files.map((file) => file.relativePath));
  const found = [];
  for (const relativePath of shipped.keys()) {
    if (planned.has(relativePath) || !['kit', 'derived'].includes(classifyPath(manifest, relativePath)?.class)) continue;
    if (!await pathExists(targetPath, relativePath)) continue;
    if (agentFolders.some((folder) => relativePath.startsWith(folder)) && !(await readOptional(resolveInsideTarget(targetPath, relativePath)))?.includes(generatedMarker)) continue;
    found.push(relativePath);
  }
  if (found.length === 0) return [];
  return [error('mode/repo-and-plugin', installStateRelativePath, `This install records plugin mode, but kit files are in the repository, where plugin mode does not install them, so the kit would load twice: ${listPaths(found)}. Delete them to keep plugin mode (the plugin ${pluginId} delivers them), or run \`workflow-kit update --mode repo\` to keep the kit files in the repository.`)];
}

// F7: `update --mode plugin` works only from a 2.0.0 install (not an export)
// whose every recorded runtime has a plugin; otherwise the way out is the
// key to remove by hand.
function repoAndPluginWayOut(state, relativePath) {
  const recorded = state.runtimes.filter((runtime) => runtime !== 'neutral');
  const switchable = state.schemaVersion !== legacyInstallStateSchemaVersion && state.mode !== 'export'
    && recorded.length > 0 && recorded.every((runtime) => pluginRuntimes.includes(runtime));
  const byHand = `remove ${pluginEntryKey} from ${relativePath}`;
  return switchable
    ? `Run \`workflow-kit update --mode plugin\` to use the plugin, or ${byHand} to keep repo mode.`
    : `To keep the kit files in ${state.mode === 'export' ? 'this folder' : 'the repository'}, ${byHand} by hand: ${state.mode === 'export' ? 'an export has no install mode to switch' : `this install cannot switch to plugin mode as it is (runtimes: ${state.runtimes.join(', ')}${state.schemaVersion === legacyInstallStateSchemaVersion ? `; install-state ${legacyInstallStateSchemaVersion}` : ''})`}.`;
}

// Plugin mode: each recorded plugin runtime's settings file declares the
// plugin, unless the project decided otherwise in it (D15): that choice is
// named, with what to change for the kit's value.
async function declarationDiagnostics({ targetPath, runtimes }) {
  const diagnostics = [];
  for (const item of await inspectPluginSettings({ targetPath, runtimes })) {
    if (item.disabledByProject) {
      diagnostics.push(warning('mode/plugin-disabled-by-project', item.relativePath, `The project turned the plugin ${pluginId} off in this file (${pluginEntryKey} is false), so this runtime does not load the kit; workflow-kit leaves that choice as it is. To use the kit, set ${pluginEntryKey} to true.`));
    }
    if (item.marketplaceCustomized) {
      diagnostics.push(warning('mode/marketplace-customized', item.relativePath, `${marketplaceEntryKey} in this file is not the kit's entry, so the plugin comes from that marketplace; workflow-kit leaves that choice as it is. To use the kit's marketplace, set it to ${kitMarketplaceEntry()}.`));
    }
    if (item.declared || item.disabledByProject || item.marketplaceCustomized) continue;
    diagnostics.push(warning('mode/plugin-not-declared', item.relativePath, item.exists && !item.valid
      ? `Not a JSON object workflow-kit can merge into, so the plugin ${pluginId} is not declared and workflow-kit does not touch the file. Fix it and run \`workflow-kit update --apply --yes\`, or add this to it by hand: ${pluginDeclarationFragment()}`
      : `The plugin ${pluginId} is not declared ${item.exists ? 'in this file' : '(the file is missing)'}, so this runtime does not offer it for this repository. Run \`workflow-kit update --apply --yes\` to declare it.`));
  }
  return diagnostics;
}

// D16: an entrypoint with a workflow-kit block that neither a recorded
// runtime nor install-state claims (a runtime left out by an update, or a
// switch) is a project file the kit no longer refreshes. The finding names
// the update that takes it back (for the runtimes it most likely belongs to:
// the ones with most such entrypoints) and that deleting it drops it. A file
// doctor cannot read is skipped.
async function untrackedAdapterDiagnostics({ targetPath, manifest, state, pluginMode }) {
  if (!state) return [];
  const recorded = state.runtimes.filter((runtime) => runtime !== 'neutral');
  const claimed = new Set(recorded.flatMap((runtime) => runtimeEntrypoints[runtime] ?? []));
  const untracked = new Set();
  for (const relativePath of new Set(Object.values(runtimeEntrypoints).flat())) {
    if (claimed.has(relativePath) || Object.hasOwn(state.files, relativePath) || classifyPath(manifest, relativePath)?.class !== 'adapter') continue;
    const content = await readOptional(resolveInsideTarget(targetPath, relativePath)).catch(() => null);
    if (content !== null && !extractManagedBlock(content, classifyPath(manifest, relativePath)?.block ?? defaultBlockName).error) untracked.add(relativePath);
  }
  const keepCommand = (runtime) => `workflow-kit update${pluginMode && !pluginRuntimes.includes(runtime) ? ' --mode repo' : ''} --runtime ${[...recorded, runtime].join(',')}`;
  return [...untracked].sort().map((relativePath) => {
    const candidates = supportedRuntimes.filter((runtime) => !recorded.includes(runtime) && runtimeEntrypoints[runtime].includes(relativePath));
    const score = (runtime) => runtimeEntrypoints[runtime].filter((item) => untracked.has(item)).length;
    const best = Math.max(...candidates.map(score));
    const commands = candidates.filter((runtime) => score(runtime) === best).map((runtime) => `\`${keepCommand(runtime)}\``);
    const keep = commands.length > 1 ? `${commands.slice(0, -1).join(', ')} or ${commands.at(-1)}` : commands[0];
    return warning('mode/adapter-not-tracked', relativePath, `This entrypoint has a workflow-kit block, but its runtime is not recorded in install-state, so workflow-kit no longer refreshes it. To keep it, run ${keep}; to drop it, delete the file.`);
  });
}

// Plugin mode with Claude: what `claude plugin list --json` says. Only ever a
// warning: doctor lists plugins, it never installs or updates one.
async function installedPluginDiagnostics({ targetPath, executor, timeoutMs }) {
  const settingsPath = pluginSettingsPaths.claude;
  const install = pluginInstallCommand('claude');
  const found = await inspectInstalledPlugins({ targetPath, executor, timeoutMs });
  if (found.status === 'absent') {
    return [warning('mode/plugin-not-installed', settingsPath, `Claude Code does not list the plugin ${pluginId} as installed, so the kit does not load in this repository. Run \`${install}\`. The marketplace serves the plugin only after the kit's \`${pluginBranch}\` branch is published.`)];
  }
  if (found.status === 'unverified') {
    return [warning('mode/plugin-install-unverified', settingsPath, `Could not check whether Claude Code has the plugin ${pluginId} installed (${found.reason}). Run \`${claudePluginListHint}\` to check, and \`${install}\` if it is missing.`)];
  }
  const diagnostics = [];
  if (found.enabled === false) {
    diagnostics.push(warning('mode/plugin-disabled', settingsPath, `Claude Code lists the plugin ${pluginId} as installed but disabled, so the kit does not load in this repository. Run \`${claudePluginEnableCommand}\`.`));
  }
  if (found.version !== packageJson.version) {
    diagnostics.push(warning('mode/plugin-version-mismatch', settingsPath, `Claude Code has the plugin ${pluginId} ${found.version ?? 'without a version'} installed; this workflow-kit CLI is ${packageJson.version}. Run \`${claudePluginUpdateCommand}\`.`));
  }
  return diagnostics;
}

const sha256Pattern = /^[0-9a-f]{64}$/;

// A shadow replaces a kit leaf skill; when the kit file changes, the shadow
// may miss its fixes. Only shadows listed in the project index take effect.
// In plugin mode the kit file is not in the repository: the shadow is compared
// with the one this CLI ships, as the plugin of this version does.
async function shadowDiagnostics({ targetPath, manifest, shipped, pluginMode }) {
  const index = await readOptional(path.join(targetPath, projectIndexPath));
  const diagnostics = [];
  for (const cells of (index === null ? null : projectIndexTableRows(index, 'Shadows')) ?? []) {
    const directory = unquote(cells[1]).replace(/\/+$/, '');
    if (!directory) continue;
    const manifestPath = `${directory}/${shadowManifestName}`;
    const invalid = (problem) => diagnostics.push(warning('boundary/shadow-invalid', manifestPath, `${problem}. Write it as .agents/kit-boundary.md describes (skill, kit_path, base_sha256, kit_version) so the shadow can be checked against the kit.`));
    if (!isProjectPath(manifest, manifestPath) || directory.split('/').includes('..')) {
      invalid(`The shadow directory is not under ${manifest.project_root}`);
      continue;
    }
    const raw = await readOptional(resolveInsideTarget(targetPath, manifestPath));
    if (raw === null) {
      invalid(`${shadowManifestName} is missing`);
      continue;
    }
    let shadow;
    try {
      shadow = JSON.parse(raw);
    } catch {
      invalid(`${shadowManifestName} is not valid JSON`);
      continue;
    }
    const kitPath = shadow?.kit_path;
    if (typeof kitPath !== 'string' || !sha256Pattern.test(shadow?.base_sha256 ?? '')) {
      invalid(`${shadowManifestName} needs a kit_path and a base_sha256 (64 hexadecimal characters)`);
      continue;
    }
    if (classifyPath(manifest, kitPath)?.class !== 'kit' || kitPath.split('/').includes('..')) {
      invalid(`kit_path ${kitPath} is not a kit file`);
      continue;
    }
    const kitContent = pluginMode
      ? (shipped.has(kitPath) ? await fs.readFile(shipped.get(kitPath), 'utf8') : null)
      : await readOptional(resolveInsideTarget(targetPath, kitPath));
    if (kitContent === null) {
      // A file the kit still ships is listed under missing files.
      if (shipped.has(kitPath)) continue;
      diagnostics.push(warning('boundary/shadow-outdated', manifestPath, `The shadowed kit file ${kitPath} is gone: the kit no longer ships it. Keep what you still need as a project skill, then remove the shadow and its row in ${projectIndexPath}.`));
    } else if (checksum(kitContent) !== shadow.base_sha256) {
      diagnostics.push(warning('boundary/shadow-outdated', manifestPath, `The kit file ${kitPath} changed since this shadow was made (its sha256 no longer matches base_sha256); compare it with the shadow, refresh the shadow, then update base_sha256.`));
    }
  }
  return diagnostics;
}

// A file in the kit skills tree that no template ships and install-state does
// not record is neither kit nor project. Under a 1.0.0 state the migration
// plan already lists those.
async function unownedPathDiagnostics({ targetPath, manifest, state, shipped }) {
  if (!state || state.schemaVersion === legacyInstallStateSchemaVersion) return [];
  const { files } = await walkTree(targetPath, skillsRoot);
  return files
    .filter((relativePath) => !relativePath.includes(backupFileMarker) && classifyPath(manifest, relativePath)?.class === 'kit' && !shipped.has(relativePath) && !Object.hasOwn(state.files, relativePath))
    .map((relativePath) => warning('boundary/unowned-path', relativePath, `This file is neither kit nor project; move it to ${manifest.project_root} (skills go to ${manifest.project_root}skills/<name>/ with a row in ${projectIndexPath}).`));
}

// A managed path behind a symbolic link is written into another file (or
// outside the repository); init and update refuse to do it.
async function symlinkDiagnostics(targetPath, files) {
  const cache = new Map();
  const links = new Set();
  for (const file of files) {
    const link = await findSymlinkInPath(targetPath, file.relativePath, cache);
    if (link) links.add(link);
  }
  return [...links].sort().map((link) => ({
    code: 'managed/symlink',
    path: link,
    message: 'Managed path is a symbolic link. workflow-kit will not write through it; replace it with a real file or directory.',
    severity: 'warning'
  }));
}

function managedVersionDiagnostics(state) {
  if (!state?.toolkitVersion || !packageJson.version || state.toolkitVersion === packageJson.version) {
    return [];
  }

  return [{
    code: 'managed/toolkit-version-mismatch',
    path: '.agents/workflow-kit/install-state.json',
    message: `Managed files were last applied with toolkit version ${state.toolkitVersion}; current CLI version is ${packageJson.version}. Run workflow-kit update --target <repo> to bring this project's workflow to the current workflow-kit version.`,
    severity: 'warning'
  }];
}

export async function runDoctor(options = {}) {
  const targetPath = path.resolve(options.targetPath ?? process.cwd());
  const manifest = await loadKitManifest();
  // An unreadable install-state or apply journal is a finding, not a crash:
  // doctor is the command people run to learn what is wrong.
  let storedState = null;
  const unusableState = [];
  try {
    storedState = await readManagedInstallState(targetPath, { manifest });
  } catch (stateError) {
    unusableState.push(error('managed/install-state-unusable', installStateRelativePath, stateError.message));
  }
  const journalProblem = await lastApplyProblem(targetPath);
  const runtimes = parseRuntimeList(options.runtime ?? storedState?.runtimes?.join(',') ?? 'neutral');
  const overlay = normalizeOverlay(options.overlay ?? 'fhh-ia-ecosystem-full');
  // PRD 2.5: in plugin mode the kit tree is not in the repository; doctor
  // expects only the files of the plugin plan.
  const pluginMode = storedState?.mode === 'plugin';
  const catalog = await loadDelegateCatalog();
  const modelProfiles = resolveModelProfiles({ catalog, runtimes, stored: storedState?.modelProfiles });
  const files = pluginMode
    ? await pluginModeTemplateFiles({ runtimes, manifest, catalog, modelProfiles })
    : await selectedTemplateFiles({ runtimes, overlay });
  // Every file this CLI ships, with its source in the package.
  const shipped = new Map((await selectedTemplateFiles({ runtimes: supportedRuntimes })).map((file) => [file.relativePath, file.sourcePath]));
  const missing = [];
  const present = [];
  // A path doctor cannot read (a file where a folder should be, a folder
  // where a file should be, no permission) is a finding, never a crash.
  const unreadable = new Map();
  const unreadableFinding = (relativePath, code) => error('managed/path-unreadable', relativePath, `Cannot read ${relativePath} (${code}): a file stands where a folder of this path should be, a folder where a file should be, or it is not readable. Fix it and run doctor again.`);
  // One finding per blocking path: nothing below a path already reported.
  const addUnreadable = (relativePath, code) => {
    if ([...unreadable.keys()].some((known) => relativePath === known || relativePath.startsWith(`${known}/`))) return;
    unreadable.set(relativePath, unreadableFinding(relativePath, code));
  };

  for (const file of files) {
    const targetFile = path.join(targetPath, file.relativePath);
    try {
      if ((await fs.stat(targetFile)).isDirectory()) addUnreadable(file.relativePath, 'EISDIR');
      else present.push(file.relativePath);
    } catch (statError) {
      // ENOTDIR: a file stands where a folder of the path should be.
      if (statError.code === 'ENOENT' || statError.code === 'ENOTDIR') missing.push(file.relativePath);
      else addUnreadable(await firstUnreadableFolder(targetPath, file.relativePath), statError.code ?? 'unknown');
    }
  }

  // A path doctor cannot read (a file where a folder should be, no
  // permission) is a finding of the check that met it, never a crash.
  // A check that meets such a path reports it; a read error without a path
  // (EISDIR) is the path the presence check above already names.
  const guarded = async (check) => {
    try {
      return await check();
    } catch (fsError) {
      if (typeof fsError?.code !== 'string' || !/^E[A-Z]+$/.test(fsError.code)) throw fsError;
      if (typeof fsError.path === 'string') addUnreadable(path.relative(targetPath, fsError.path).split(path.sep).join('/'), fsError.code);
      else if (unreadable.size === 0) addUnreadable('.', fsError.code);
      return [];
    }
  };
  const checks = await Promise.all([
    pluginMode
      ? () => validateAdapterContracts({ root: targetPath, runtimes })
      : async () => (await validateWorkflowContract({ root: targetPath, runtimes })).diagnostics.map(targetRepoContractDiagnostic),
    () => modelProfileDiagnostics({ targetPath, present, catalog, modelProfiles }),
    () => workspaceDiagnostics({ targetPath }),
    () => projectContextDiagnostics({ targetPath }),
    // The Copilot quality-gate wrapper of a plugin install comes from the kit
    // quality gate this CLI ships, as the plan writes it.
    async () => projectInstructionDiagnostics({ targetPath, runtimes, kitQualityGate: pluginMode ? await packageKitQualityGate() : null }),
    () => stackPackDiagnostics({ targetPath, stackPack: storedState?.stackPack }),
    () => adapterBlockDiagnostics({ targetPath, manifest, state: storedState, files, pluginMode }),
    () => pendingDiagnostics({ targetPath, manifest, state: storedState, runtimes, overlay, journalProblem }),
    () => shadowDiagnostics({ targetPath, manifest, shipped, pluginMode }),
    () => unownedPathDiagnostics({ targetPath, manifest, state: storedState, shipped }),
    () => symlinkDiagnostics(targetPath, files),
    () => modeMixDiagnostics({ targetPath, manifest, state: storedState, pluginMode, files, shipped }),
    () => untrackedAdapterDiagnostics({ targetPath, manifest, state: storedState, pluginMode }),
    ...(pluginMode ? [() => declarationDiagnostics({ targetPath, runtimes })] : []),
    // Never in repo mode: the only command doctor runs, and only to read.
    ...(pluginMode && runtimes.includes('claude')
      ? [() => installedPluginDiagnostics({ targetPath, executor: options.commandExecutor, timeoutMs: options.pluginCheckTimeoutMs })]
      : [])
  ].map(guarded));
  const diagnostics = [
    ...checks.flat(),
    ...unreadable.values(),
    ...stateDiagnostics(storedState),
    ...managedVersionDiagnostics(storedState),
    ...journalDiagnostics(journalProblem),
    ...unusableState
  ].sort((a, b) => a.severity.localeCompare(b.severity)
    || a.code.localeCompare(b.code)
    || a.path.localeCompare(b.path));

  return {
    ok: missing.length === 0 && !diagnostics.some((item) => item.severity === 'error'),
    targetPath,
    installMode: pluginMode ? 'plugin' : 'repo',
    runtimes,
    overlay,
    modelProfiles,
    stackPack: storedState?.stackPack ?? 'none',
    present,
    missing,
    diagnostics
  };
}

// The first folder of relativePath doctor may not list or enter, or the path
// itself when every folder is open.
async function firstUnreadableFolder(targetPath, relativePath) {
  const segments = relativePath.split('/');
  for (let length = 1; length < segments.length; length += 1) {
    const folder = segments.slice(0, length).join('/');
    try {
      await fs.access(path.join(targetPath, folder), fsConstants.R_OK | fsConstants.X_OK);
    } catch {
      return folder;
    }
  }
  return relativePath;
}

// A seed the kit created is never recreated, so update --stack cannot bring
// the rules file back.
async function stackPackDiagnostics({ targetPath, stackPack }) {
  if (!stackPack || stackPack === 'none') return [];
  if (await readOptional(path.join(targetPath, stackRulesPath)) !== null) return [];
  return [warning('stack-pack/missing', stackRulesPath, `The ${stackPack} stack pack is recorded but its rules file is missing, so stack-specific rules are not applied. The kit never recreates it: restore ${stackRulesPath} from Git, or copy templates' ${stackPack} pack again by hand (templates/stack-packs/${stackPack}/stack.md in the workflow-kit package).`)];
}

// Fails when a delegate agent's model setting does not match the project's
// profile (for example a calidad project with costo agents after a manual copy).
async function modelProfileDiagnostics({ targetPath, present, catalog, modelProfiles }) {
  const diagnostics = [];
  for (const relativePath of present) {
    const expected = renderDelegateAdapterForPath(relativePath, catalog, modelProfiles);
    if (!expected) continue;
    const content = await fs.readFile(path.join(targetPath, relativePath), 'utf8');
    const actualLine = modelSettingLine(expected.runtime, content);
    const expectedLine = modelSettingLine(expected.runtime, expected.content);
    if (actualLine !== expectedLine) {
      diagnostics.push({
        code: 'model-profile/agent-mismatch',
        path: relativePath,
        message: `Expected \`${expectedLine}\` for the ${modelProfiles[expected.runtime]} profile but found \`${actualLine ?? 'no model setting'}\`. Run workflow-kit update --profile ${expected.runtime}=${modelProfiles[expected.runtime]} --apply --yes to regenerate it.`,
        severity: 'error'
      });
    }
  }
  return diagnostics;
}

export function formatDoctorResult(result) {
  const lines = [
    `Target: ${result.targetPath}`,
    `Toolkit version: ${packageJson.version}`,
    `Runtimes: ${result.runtimes.join(',')}`,
    `Overlay: ${result.overlay}`,
    `Model profiles: ${Object.entries(result.modelProfiles ?? {}).map(([runtime, profile]) => `${runtime}=${profile}`).join(',') || 'none'}`,
    `Stack pack: ${result.stackPack ?? 'none'}`,
    // Only in plugin mode, so the repo-mode output does not change.
    ...(result.installMode === 'plugin' ? ['Install mode: plugin'] : []),
    // Copilot has no documented way to list its installed plugins: a line, not a diagnostic.
    ...(result.installMode === 'plugin' && result.runtimes.includes('copilot')
      ? [`Copilot plugin: doctor cannot check it; run \`${copilotPluginListCommand}\` to see it, and \`${pluginInstallCommand('copilot')}\` if it is missing.`]
      : []),
    result.ok ? 'Doctor: ok' : 'Doctor: failed'
  ];

  if (result.missing.length > 0) {
    lines.push('Missing files:');
    for (const item of result.missing) lines.push(`- ${item}`);
  }

  if (result.diagnostics.length > 0) {
    lines.push('Diagnostics:');
    for (const item of result.diagnostics) {
      lines.push(`- [${item.code}] ${item.path}: ${item.message} (${item.severity})`);
    }
  }

  return lines.join('\n');
}
