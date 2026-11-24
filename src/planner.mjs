import fs from 'node:fs/promises';
import { realpath as realpathCallback } from 'node:fs';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSupportedRuntime, pluginRuntimes, pluginSettingsPaths, runtimeEntrypoints, runtimeTemplatePaths, supportedRuntimes } from './runtime-matrix.mjs';
import { defaultProfileFor, loadDelegateCatalog, parseProfileOption, renderClaudeAgent, renderCopilotAgent, renderDelegateAdapterForPath, resolveModelProfiles } from './model-profiles.mjs';
import { assertPluginRuntimes, planPluginSettings, planPluginSettingsRemoval, pluginAdapterContent, pluginName } from './plugin-mode.mjs';
import { inspectProjectInstructions, kitQualityGatePath, neutralInstructionPath, planCopilotWrappers, projectInstructionNames } from './project-instructions.mjs';
import { describeMigrations } from './plan-insight.mjs';
import { assertNoSymlinkWrites, assertPathShapes, assertWriteFoldersAreFolders, checksumOf, resolveInsideTarget } from './fs-safety.mjs';
import { applyJournalProblem, applyJournalRelativePath } from './apply.mjs';
import { classifyPath, defaultBlockName, extractManagedBlock, isProjectPath, loadKitManifest, replaceManagedBlock } from './kit-manifest.mjs';
import { backupFileMarker, layoutMigrationId, pendingEditReasons, prepareLayoutMigration, projectIndexPath, requireMigrationBackups } from './migration.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesRoot = path.join(packageRoot, 'templates');
const overlayTemplatePath = 'repo-overlay-fhh-ia-ecosystem-full';
export const installStateRelativePath = '.agents/workflow-kit/install-state.json';
const installStateSchemaVersion = '2.0.0';
export const legacyInstallStateSchemaVersion = '1.0.0';
const oneTimeLegacyDocsMapPath = 'docs/workflow/migration/legacy-docs-map.md';
// Planned paths without a manifest class: they stay user-owned, never enter
// install-state, and the kit only merges into them (.gitignore gets the
// manifest's ignore entries; in plugin mode a settings file gets the plugin
// declaration).
const gitignorePath = '.gitignore';
const userOwnedPaths = new Set([gitignorePath, ...Object.values(pluginSettingsPaths)]);
// Operations that leave the file as it is on disk.
const nonWritingOperations = new Set(['skip_unmanaged', 'skip_modified', 'unchanged', 'adopt_existing']);

const backupModes = new Set(['required', 'none']);

function normalizeBackupMode(value = 'required') {
  const mode = String(value ?? 'required').trim();
  if (!backupModes.has(mode)) {
    throw new Error(`Unsupported backup mode: ${mode}`);
  }
  return mode;
}

const overwriteOperation = (backupMode) => (backupMode === 'none' ? 'overwrite_no_backup' : 'overwrite_with_backup');
const mergeOperation = (backupMode) => (backupMode === 'none' ? 'merge_no_backup' : 'merge_with_backup');

export function parseRuntimeList(value = 'neutral') {
  const runtimes = new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean));
  if (runtimes.size === 0) runtimes.add('neutral');

  for (const runtime of runtimes) {
    if (runtime !== 'neutral' && !isSupportedRuntime(runtime)) {
      throw new Error(`Unsupported runtime: ${runtime}`);
    }
  }

  return [...runtimes];
}

export function normalizeOverlay(value = 'fhh-ia-ecosystem-full') {
  if (!['fhh-ia-ecosystem-full'].includes(value)) {
    throw new Error(`Unsupported overlay: ${value}`);
  }
  return value;
}

async function collectTemplateFiles(templateRelativePath) {
  const root = path.join(templatesRoot, templateRelativePath);
  const files = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile()) {
        // Plan paths always use "/": manifest entries and install-state keys
        // are written that way on every platform.
        const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
        if (relativePath === 'README.md') continue;
        files.push({
          sourcePath: absolutePath,
          relativePath
        });
      }
    }
  }

  await walk(root);
  return files;
}

export async function selectedTemplateFiles({ runtimes = ['neutral'], overlay = 'fhh-ia-ecosystem-full' } = {}) {
  const selected = await collectTemplateFiles(overlayTemplatePath);

  for (const runtime of runtimes) {
    if (runtime === 'neutral') continue;
    for (const templatePath of runtimeTemplatePaths[runtime]) {
      selected.push(...await collectTemplateFiles(templatePath));
    }
  }

  const deduped = new Map();
  for (const file of selected) {
    deduped.set(file.relativePath, file);
  }

  return [...deduped.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// Plugin mode (PRD plugin-mode-pilot 2.3): the chosen runtimes' entrypoints
// and the overlay seeds. A runtime whose profile is not the catalog default
// also gets the delegate agents, rendered in the plugin variant with that
// profile; with the default profile the plugin's own agents apply (D2).
const pluginAgents = {
  claude: { pathOf: (slug) => `.claude/agents/${slug}.md`, render: renderClaudeAgent },
  copilot: { pathOf: (slug) => `.github/agents/${slug}.agent.md`, render: renderCopilotAgent }
};

export async function pluginModeTemplateFiles({ runtimes, manifest, catalog, modelProfiles }) {
  const entrypoints = new Set(runtimes.flatMap((runtime) => runtimeEntrypoints[runtime] ?? []));
  const files = (await selectedTemplateFiles({ runtimes }))
    .filter((file) => entrypoints.has(file.relativePath) || classifyPath(manifest, file.relativePath)?.class === 'seed');
  // `neutral` may come along with a plugin runtime; it has no agents.
  for (const runtime of runtimes.filter((item) => Object.hasOwn(pluginAgents, item))) {
    const profile = modelProfiles[runtime];
    if (profile === defaultProfileFor(catalog, runtime)) continue;
    const { pathOf, render } = pluginAgents[runtime];
    for (const agent of catalog.agents) {
      files.push({ relativePath: pathOf(agent.slug), sourcePath: null, content: render(agent, catalog, profile, pluginName) });
    }
  }
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// What the apply journal says about the last init or update: null when there
// is none or it finished; `unusable` when it exists but cannot be read (the
// next apply would replace the only way back); `incomplete` when the run
// stopped halfway. Shared by the init/update gate and doctor.

export async function lastApplyProblem(targetPath) {
  let raw;
  try {
    raw = await readOptional(path.join(targetPath, applyJournalRelativePath));
  } catch (readError) {
    return { kind: 'unusable', reason: readError.code ?? readError.message };
  }
  if (raw === null) return null;
  let journal;
  try {
    journal = JSON.parse(raw);
  } catch {
    return { kind: 'unusable', reason: 'not valid JSON' };
  }
  if (applyJournalProblem(journal)) return { kind: 'unusable', reason: 'unsupported format' };
  return journal.completed === false ? { kind: 'incomplete', appliedAt: journal.appliedAt ?? 'unknown date' } : null;
}

export const unusableJournalMessage = (reason) => `${applyJournalRelativePath} cannot be read (${reason}), so rollback cannot use it. Fix it by hand (Git does not track it); only if you will not roll back the last apply, move it out of .agents/workflow-kit/`;
export const incompleteApplyMessage = (appliedAt) => `The last workflow-kit apply did not finish (${appliedAt}). Run \`workflow-kit rollback --apply --yes\` first`;

async function assertLastApplyFinished(targetPath) {
  const problem = await lastApplyProblem(targetPath);
  if (problem?.kind === 'unusable') throw new Error(`${unusableJournalMessage(problem.reason)}. Then run this command again. Nothing was written.`);
  if (problem?.kind === 'incomplete') throw new Error(`${incompleteApplyMessage(problem.appliedAt)}, then run this command again. Nothing was written.`);
}

// init plans as if nothing were installed: over a 1.0.0 state it would
// replace the project content that only the layout migration of update moves;
// over a 2.0.0 state it would reset the recorded runtimes, stack and profiles
// and replace pending edited files. A state that exists but cannot be used
// stops init the same way it stops update. An export only refreshes a folder
// whose state an earlier export wrote (mode "export"); any other state,
// including one an export from before 0.22.0 wrote, is a maintained install.
// init --mode plugin also names the way to plugin mode from that state (T4,
// T5).
async function assertNoInstallState(targetPath, manifest, { exporting = false, pluginMode = false, runtime } = {}) {
  const state = await readInstallState(path.join(targetPath, installStateRelativePath), manifest);
  if (exporting && state?.schemaVersion === installStateSchemaVersion && state.mode === 'export') return;
  if (exporting && state) {
    throw new Error(`${installStateRelativePath} ${state.schemaVersion === legacyInstallStateSchemaVersion ? `uses install-state ${legacyInstallStateSchemaVersion}` : `records an install, not an export (runtimes: ${(state.runtimes ?? []).join(', ') || 'none'})`}. If this folder is an export from a workflow-kit version before 0.22.0, export to an empty folder, or remove its ${installStateRelativePath} and export again. If it is a workflow-kit install, export to another folder; \`workflow-kit update\` brings an install to this version. Nothing was written.`);
  }
  const runtimeList = pluginMode ? pluginRuntimeList(runtime, state?.runtimes) : null;
  if (state?.schemaVersion === legacyInstallStateSchemaVersion) {
    throw new Error(`${installStateRelativePath} uses install-state ${legacyInstallStateSchemaVersion}. Run \`workflow-kit update\` to migrate this repository${pluginMode ? `, then \`${pluginUpdateCommand(runtimeList)}\`` : ''}; init would replace project content. Nothing was written.`);
  }
  if (state) {
    let pluginWay = '';
    if (pluginMode) pluginWay = state.mode === 'export' ? ` ${exportIsACopy(runtimeList)}` : ` To use plugin mode, run \`${pluginUpdateCommand(runtimeList)}\`.`;
    throw new Error(`${installStateRelativePath} already records an install (runtimes: ${(state.runtimes ?? []).join(', ') || 'none'}). Run \`workflow-kit update\` instead (with \`--runtime <list>\`, \`--stack\` or \`--profile\` to change those choices); init would reset the recorded runtimes, stack and profiles and replace pending edited files.${pluginWay} Nothing was written.`);
  }
}

const settingsPathsOf = (runtimes) => runtimes.flatMap((runtime) => pluginSettingsPaths[runtime] ?? []);

// The kit default quality gate is not in a plugin-mode repository: the
// Copilot wrapper takes it from the overlay template of this CLI.
export const packageKitQualityGate = () => fs.readFile(path.join(templatesRoot, overlayTemplatePath, kitQualityGatePath), 'utf8');

// PRD 2.4: without --mode, update keeps the recorded mode (T6, T8). A state
// without mode, an export, a 1.0.0 state or no state (--adopt-existing)
// updates as a repo-mode install, as before plugin mode existed. `switchTo`:
// a 2.0.0 repo-mode install moves to plugin mode (T7), or a plugin-mode
// install to repo mode (T9). Any other switch stops, writes nothing and names
// the commands that get there (T10, T11, T13).
function resolveUpdateMode(requestedMode, existingState, runtime) {
  const recordedMode = existingState?.mode === 'plugin' ? 'plugin' : 'repo';
  const mode = requestedMode ?? recordedMode;
  if (mode === recordedMode) return { mode, switchTo: null };
  // Only a plugin-mode state records another mode than repo.
  if (mode === 'repo') return { mode, switchTo: 'repo' };
  const runtimeList = pluginRuntimeList(runtime, existingState?.runtimes);
  if (!existingState) {
    throw new Error(`update --adopt-existing --mode plugin: there is no install state to switch from. Run \`workflow-kit update --adopt-existing --runtime ${runtimeList}\` first to bootstrap a safe baseline, then \`${pluginUpdateCommand(runtimeList)}\`. Nothing was written.`);
  }
  if (existingState.schemaVersion === legacyInstallStateSchemaVersion) {
    throw new Error(`${installStateRelativePath} uses install-state ${legacyInstallStateSchemaVersion}, and its layout migration has to run before a mode switch. Run \`workflow-kit update\` first, then \`${pluginUpdateCommand(runtimeList)}\`. Nothing was written.`);
  }
  if (existingState.mode === 'export') {
    throw new Error(`update --mode plugin: ${installStateRelativePath} records an export. ${exportIsACopy(runtimeList)} Nothing was written.`);
  }
  return { mode, switchTo: 'plugin' };
}

// The runtimes a plugin-mode command names in a stop: the plugin runtimes
// asked for or recorded, or every plugin runtime when there are none.
function pluginRuntimeList(runtime, recordedRuntimes) {
  const chosen = parseRuntimeList(runtime ?? recordedRuntimes?.join(',') ?? 'neutral').filter((item) => pluginRuntimes.includes(item));
  return (chosen.length > 0 ? chosen : pluginRuntimes).join(',');
}
const pluginUpdateCommand = (runtimeList) => `workflow-kit update --mode plugin --runtime ${runtimeList}`;
const exportIsACopy = (runtimeList) => `An exported folder is a copy of the kit, not an install, so it has no install mode: to use plugin mode, install the kit in a repository with \`workflow-kit init --mode plugin --runtime ${runtimeList} --target <repo>\`.`;

export async function buildInstallPlan(options = {}) {
  const targetPath = path.resolve(options.targetPath ?? process.cwd());
  await assertLastApplyFinished(targetPath);
  const manifest = options.manifest ?? await loadKitManifest();
  // An export writes a copy of the kit, not an install someone maintains:
  // exporting again to a folder an export wrote only refreshes that copy.
  await assertNoInstallState(targetPath, manifest, { exporting: Boolean(options.export), pluginMode: options.mode === 'plugin', runtime: options.runtime });
  const runtimes = parseRuntimeList(options.runtime ?? 'neutral');
  // Plugin mode (PRD plugin-mode-pilot 2.3): the kit runs as a plugin, so the
  // repository only gets what the plugin cannot deliver.
  const pluginMode = options.mode === 'plugin';
  if (pluginMode) assertPluginRuntimes(runtimes);
  const overlay = normalizeOverlay(options.overlay ?? 'fhh-ia-ecosystem-full');
  const backupMode = normalizeBackupMode(options.backupMode ?? 'required');
  const catalog = await loadDelegateCatalog();
  const modelProfiles = resolveModelProfiles({ catalog, runtimes, requested: parseProfileOption(options.profile) });
  const files = pluginMode
    ? await pluginModeTemplateFiles({ runtimes, manifest, catalog, modelProfiles })
    : await selectedTemplateFiles({ runtimes, overlay });
  await assertPathShapes(targetPath, [...files.map((file) => file.relativePath), gitignorePath, ...(pluginMode ? settingsPathsOf(runtimes) : [])]);
  const instructionInspection = await inspectProjectInstructions({ targetPath });
  const migratedInstructions = migratedInstructionContents(instructionInspection);
  const stackPack = normalizeStackPack(options.stack);
  const previousFiles = {};

  const operations = await planTemplateFiles({
    targetPath, files, manifest, mode: 'init', previousFiles, backupMode, catalog, modelProfiles, migratedInstructions, pluginMode
  });
  if (!pluginMode) operations.push(...await buildOneTimeDocsMigrationOperations({ targetPath, previousFiles }));
  if (options.ensureWorkspaceIgnore !== false) {
    operations.push(...await buildWorkspaceIgnoreOperations({ targetPath, backupMode, manifest }));
  }
  const kitQualityGate = pluginMode ? await packageKitQualityGate() : undefined;
  operations.push(...projectInstructionWrapperOperations({ targetPath, runtimes, operations, instructionInspection, backupMode, kitQualityGate }));
  operations.push(...await buildStackPackOperations({ targetPath, stackPack, previousFiles }));
  if (pluginMode) operations.push(...await planPluginSettings({ targetPath, runtimes }));
  await finalizeOperations({ targetPath, manifest, operations });

  const nextInstallState = buildNextInstallState({
    previousState: null,
    operations,
    runtimes,
    overlay,
    modelProfiles,
    stackPack,
    toolkitVersion: options.toolkitVersion,
    mode: options.export ? 'export' : pluginMode ? 'plugin' : 'repo'
  });

  return {
    mode: 'init',
    recordJournal: options.recordJournal !== false,
    migrations: describeMigrations({ operations, existingState: null, migratedInstructions }),
    targetPath,
    stateFilePath: path.join(targetPath, installStateRelativePath),
    nextInstallState,
    toolkitVersion: options.toolkitVersion ?? null,
    previousToolkitVersion: null,
    runtimes,
    overlay,
    modelProfiles,
    stackPack,
    operations,
    summary: summarizeOperations(operations),
    backupMode,
    previousStateFiles: {}
  };
}

export async function buildUpdatePlan(options = {}) {
  const targetPath = path.resolve(options.targetPath ?? process.cwd());
  const stateFilePath = path.join(targetPath, installStateRelativePath);
  await assertLastApplyFinished(targetPath);
  const manifest = options.manifest ?? await loadKitManifest();
  const existingState = await readInstallState(stateFilePath, manifest);
  if (!existingState && !options.adoptExisting) {
    throw new Error('No install state found. Run `workflow-kit update --adopt-existing --runtime <list>` first to bootstrap a safe baseline.');
  }
  const { mode: installMode, switchTo } = resolveUpdateMode(options.mode, existingState, options.runtime);
  // Plugin mode (T7, T8): the same file selection as init --mode plugin. To
  // repo mode (T9): the file list of a repo-mode update; the settings files
  // the plugin declaration was written to lose it.
  const pluginMode = installMode === 'plugin';
  const switching = switchTo === 'plugin';
  const leavingPlugin = switchTo === 'repo';
  const runtimes = parseRuntimeList(options.runtime ?? existingState?.runtimes?.join(',') ?? 'neutral');
  if (pluginMode) assertPluginRuntimes(runtimes, 'update');
  const declaredRuntimes = leavingPlugin ? [...new Set([...existingState.runtimes, ...runtimes])] : [];
  const overlay = normalizeOverlay(options.overlay ?? existingState?.overlay ?? 'fhh-ia-ecosystem-full');
  const backupMode = normalizeBackupMode(options.backupMode ?? 'required');
  const catalog = await loadDelegateCatalog();
  const modelProfiles = resolveModelProfiles({
    catalog,
    runtimes,
    requested: parseProfileOption(options.profile),
    stored: existingState?.modelProfiles
  });
  const files = pluginMode
    ? await pluginModeTemplateFiles({ runtimes, manifest, catalog, modelProfiles })
    : await selectedTemplateFiles({ runtimes, overlay });
  // The migration also reads the project index and lists the project skills.
  const migrating = existingState?.schemaVersion === legacyInstallStateSchemaVersion;
  // The migration leaves a new path it cannot move to pending (legacy_path_unsupported).
  const shapedFiles = files.map((file) => file.relativePath).filter((relativePath) => !migrating || !Object.values(manifest.legacy_paths).includes(relativePath));
  await assertPathShapes(targetPath, [...shapedFiles, gitignorePath, ...settingsPathsOf(pluginMode ? runtimes : declaredRuntimes), ...(migrating ? [projectIndexPath] : [])],
    migrating ? [`${manifest.project_root}skills`] : []);
  const instructionInspection = await inspectProjectInstructions({ targetPath });
  const migratedInstructions = migratedInstructionContents(instructionInspection);
  // Installs from before stack packs carried the Rails + React rules inside the
  // skills. Without a recorded or requested choice, keep those rules only when
  // the repository looks like Rails + React; anywhere else they would be wrong.
  const stackPack = normalizeStackPack(options.stack ?? existingState?.stackPack ?? await detectStackPack(targetPath));
  const previousFiles = existingState?.files ?? {};
  // A 1.0.0 state recorded merged catalogs and preserved files as if the kit
  // owned them, so it reaches the class planner only through the layout
  // migration, which decides what the planner sees as recorded.
  const migration = existingState?.schemaVersion === legacyInstallStateSchemaVersion
    ? await prepareLayoutMigration({ targetPath, manifest, previousFiles, previousToolkitVersion: existingState.toolkitVersion, files })
    : null;

  const operations = await planTemplateFiles({
    targetPath,
    // A legacy path that cannot move keeps its new path out of the plan.
    files: migration ? files.filter((file) => !migration.excludedPaths.has(file.relativePath)) : files,
    manifest,
    mode: existingState ? 'update' : 'adopt',
    previousFiles: migration?.plannerFiles ?? previousFiles,
    backupMode,
    catalog,
    modelProfiles,
    migratedInstructions: { ...migratedInstructions, ...migration?.seedContents },
    pluginMode
  });
  // A switch to plugin mode decides its pending files once the retired ones are known.
  const shadows = switching ? [] : await planEditedDecisions({ operations, edited: options.edited ?? {}, manifest, migration });
  if (migration) await migration.completeOperations(operations, shadows);
  operations.push(...await buildWorkspaceIgnoreOperations({ targetPath, backupMode, manifest }));
  const kitQualityGate = pluginMode ? await packageKitQualityGate() : undefined;
  operations.push(...projectInstructionWrapperOperations({ targetPath, runtimes, operations, instructionInspection, backupMode, kitQualityGate }));
  operations.push(...await buildStackPackOperations({ targetPath, stackPack, previousFiles }));
  if (pluginMode) operations.push(...await planPluginSettings({ targetPath, runtimes }));
  if (leavingPlugin) operations.push(...await planPluginSettingsRemoval({ targetPath, runtimes: declaredRuntimes }));
  const retired = existingState ? await planRetiredFiles({ targetPath, manifest, previousFiles, operations, pluginMode, switching }) : { operations: [], missing: [] };
  operations.push(...retired.operations);
  if (switching) {
    await planEditedDecisions({ operations, edited: options.edited ?? {}, manifest, switching });
    assertModeSwitchSettled(operations);
  }
  await finalizeOperations({ targetPath, manifest, operations, previousFiles });
  // A switch (either way), like the layout migration, is applied whole and
  // keeps a backup of everything it replaces, whatever the backup mode:
  // rollback has to be able to take it back (T16). Only the switch to plugin
  // mode is all or nothing: leaving it, a pending file stays pending (F2).
  if (migration || switchTo) requireMigrationBackups(operations);
  if (switchTo) for (const item of operations) item.migration = true;
  const droppedStatePaths = [...retired.missing, ...(migration?.droppedPaths ?? []), ...(switching ? adaptersLeftBehind(manifest, previousFiles, operations) : [])];
  const layoutMigration = migration?.describe(operations);
  const migrations = describeMigrations({
    operations,
    existingState,
    modelProfiles,
    requestedProfiles: parseProfileOption(options.profile),
    stackPack,
    stackRequested: options.stack !== undefined,
    migratedInstructions,
    layoutMigration
  });
  // Per-row and per-skill notes print under the layout migration's summary;
  // the catalog rows it does not write are listed by doctor.
  if (layoutMigration) Object.assign(migrations.find((item) => item.id === layoutMigrationId), { notes: layoutMigration.notes, unwrittenRows: layoutMigration.unwrittenRows });

  const nextInstallState = buildNextInstallState({
    previousState: existingState,
    operations,
    droppedPaths: droppedStatePaths,
    runtimes,
    overlay,
    modelProfiles,
    stackPack,
    toolkitVersion: options.toolkitVersion,
    mode: installMode
  });

  return {
    mode: 'update',
    targetPath,
    stateFilePath,
    hadExistingState: Boolean(existingState),
    // The TUI names a switch, not the layout migration, as the block it does not list.
    modeSwitch: Boolean(switchTo),
    migrations,
    nextInstallState,
    toolkitVersion: options.toolkitVersion ?? null,
    previousToolkitVersion: existingState?.toolkitVersion ?? null,
    runtimes,
    overlay,
    modelProfiles,
    stackPack,
    operations,
    summary: summarizeOperations(operations),
    backupMode,
    previousStateFiles: { ...previousFiles },
    droppedStatePaths
  };
}

// Every planned path takes its class from the manifest. A path the manifest
// does not cover is a kit bug: stop before anything is written.
function classifyOrThrow(manifest, relativePath) {
  const entry = classifyPath(manifest, relativePath);
  if (!entry) {
    throw new Error(`The kit manifest has no entry for the planned path ${relativePath}. Nothing was written; report this workflow-kit bug.`);
  }
  return entry;
}

// Decisions on a pending edited file (PRD manifest-updater 2.4): keep leaves
// it pending; discard takes the kit version; shadow (layout migration only)
// moves the edit to a project shadow of a kit leaf skill; split keeps the own
// lines of an unmarked adapter next to a new block. Every decided write keeps
// a backup, whatever the backup mode.
export const editedDecisions = Object.freeze(['keep', 'discard', 'shadow', 'split']);
const editedAllKey = 'all';

function invalidEditedDecision(relativePath, decision, validDecisions, problem) {
  const valid = validDecisions.length > 0 ? validDecisions.join(' | ') : 'none';
  const error = new Error(`Invalid --edited ${relativePath}=${decision}: ${problem}. Valid decisions: ${valid}. Nothing was written.`);
  return Object.assign(error, { code: 'INVALID_EDITED_DECISION', relativePath, decision, validDecisions });
}

// Path -> decision for the pending files. A named path wins over `all`, which
// takes every pending file where its decision is valid and leaves the rest
// pending. Anything that cannot be honored throws before a write is planned.
function chooseEditedDecisions(validByPath, edited) {
  const chosen = new Map();
  for (const [relativePath, decision] of Object.entries(edited)) {
    if (!editedDecisions.includes(decision)) throw invalidEditedDecision(relativePath, decision, editedDecisions, 'unknown decision');
    if (relativePath === editedAllKey) continue;
    const valid = validByPath.get(relativePath);
    if (!valid) throw invalidEditedDecision(relativePath, decision, [], 'the file is not a pending edited file');
    if (!valid.includes(decision)) throw invalidEditedDecision(relativePath, decision, valid, `${decision} does not apply to this file`);
    chosen.set(relativePath, decision);
  }
  // With nothing pending, `all` has nothing to decide: not an error, so a
  // script can always pass it.
  if (Object.hasOwn(edited, editedAllKey) && validByPath.size > 0) {
    const decision = edited[editedAllKey];
    const targets = [...validByPath].filter(([, valid]) => valid.includes(decision)).map(([relativePath]) => relativePath);
    if (targets.length === 0) {
      const validForSome = editedDecisions.filter((name) => [...validByPath.values()].some((valid) => valid.includes(name)));
      throw invalidEditedDecision(editedAllKey, decision, validForSome, 'it applies to no pending edited file');
    }
    for (const relativePath of targets) if (!chosen.has(relativePath)) chosen.set(relativePath, decision);
  }
  return chosen;
}

// Applies the chosen decisions to the pending operations; the ones left
// pending carry their valid decisions for the dry run. Returns the shadows
// the project index has to list. In a switch to plugin mode (T7) an edited
// retired file is pending too, and only discard settles it (deleted with a
// backup that keeps the edit); keep settles nothing there, since the switch
// is applied whole.
async function planEditedDecisions({ operations, edited, manifest, migration, switching = false }) {
  const pending = operations.filter((item) => item.operation === 'skip_modified' && (pendingEditReasons.has(item.reason) || (switching && item.retired)));
  const validByPath = new Map();
  const shadowTargets = new Map();
  const splitContents = new Map();
  for (const item of pending) {
    const shadow = migration ? await migration.shadowFor(item) : null;
    if (shadow) shadowTargets.set(item.relativePath, shadow);
    if (item.reason === 'unmarked_adapter') {
      const blockName = classifyPath(manifest, item.relativePath)?.block ?? defaultBlockName;
      const split = splitUnmarkedAdapter(await fs.readFile(item.targetFile, 'utf8'), item.content, blockName);
      if (split !== null) splitContents.set(item.relativePath, split);
    }
    const applies = { keep: !switching, discard: true, shadow: Boolean(shadow), split: splitContents.has(item.relativePath) };
    validByPath.set(item.relativePath, editedDecisions.filter((decision) => applies[decision]));
  }
  const chosen = chooseEditedDecisions(validByPath, edited);
  const shadows = [];
  for (const item of pending) {
    const decision = chosen.get(item.relativePath) ?? 'keep';
    if (decision === 'keep') {
      item.decisions = validByPath.get(item.relativePath);
      continue;
    }
    delete item.reason;
    // The apply deletes it only while it still has the content the plan saw.
    if (item.retired) {
      Object.assign(item, { operation: 'delete_with_backup', content: null, recordedChecksum: item.existingChecksum });
      continue;
    }
    if (decision === 'split') item.content = splitContents.get(item.relativePath);
    if (decision === 'shadow') {
      const shadow = shadowTargets.get(item.relativePath);
      shadows.push(shadow);
      operations.push(...migration.shadowOperations(shadow));
      item.migration = true;
    }
    Object.assign(item, { operation: 'overwrite_with_backup', stateChecksum: recordedChecksumOf(manifest, item.relativePath, item.class, item.content) });
  }
  return shadows;
}

// The kit text of a template block: the lines between its marker lines,
// without the trailing blank lines and HTML comment lines (the note about
// where own text goes, which kits before the markers did not have).
function kitBody(templateContent, blockName) {
  const lines = extractManagedBlock(templateContent, blockName).block.split('\n').slice(1, -1);
  while (lines.length > 0 && (lines.at(-1).trim() === '' || /^\s*<!--.*-->\s*$/.test(lines.at(-1)))) lines.pop();
  return lines.join('\n');
}

// split: valid only when the file holds the kit text as one region of whole
// lines, byte for byte. The own text is what comes before and after that
// region, unchanged except for the blank lines that touched it (one blank line
// keeps the two parts apart); the new block goes where the template places it.
// Returns null when split does not apply.
function splitUnmarkedAdapter(existingContent, templateContent, blockName) {
  const body = kitBody(templateContent, blockName);
  if (body === '') return null;
  let start = existingContent.indexOf(body);
  const wholeLines = (index) => (index === 0 || existingContent[index - 1] === '\n') && [undefined, '\n'].includes(existingContent[index + body.length]);
  while (start !== -1 && !wholeLines(start)) start = existingContent.indexOf(body, start + 1);
  if (start === -1) return null;
  const before = existingContent.slice(0, start).replace(/(?:^|(?<=\n))(?:[ \t]*\n)+$/, '');
  const after = existingContent.slice(start + body.length).replace(/^\n/, '').replace(/^(?:[ \t]*\n)+/, '').replace(/^[ \t]*$/, '');
  const own = `${before}${before && after ? '\n' : ''}${after}`;
  return own === '' ? templateContent : insertManagedBlock(own, templateContent, blockName);
}

// No plan replaces content without a backup unless that content matches what
// the kit recorded for it: init (no state), adopt, a decided edit, or a block
// edited by hand always keep a backup, whatever the backup mode. A write left
// without a backup carries the checksum of what it replaces (null: nothing),
// so the apply can keep a backup of content that changed since the plan.
const writesWithoutBackup = new Set(['create', 'overwrite_no_backup', 'merge_no_backup']);
async function requireBackupForUnrecordedContent({ targetPath, manifest, operations, previousFiles }) {
  for (const item of operations) {
    if (!writesWithoutBackup.has(item.operation)) continue;
    const existing = await readOptional(path.join(targetPath, item.relativePath));
    item.planChecksum = existing === null ? null : checksumOf(existing);
    if (existing === null || item.operation !== 'overwrite_no_backup') continue;
    const recorded = previousFiles[item.relativePath]?.sha256;
    if (!recorded || recorded !== recordedChecksumOf(manifest, item.relativePath, item.class, existing)) {
      item.operation = 'overwrite_with_backup';
    }
  }
}

// Retired operations already carry their class.
async function finalizeOperations({ targetPath, manifest, operations, previousFiles = {} }) {
  for (const item of operations) {
    if (item.class === undefined && !userOwnedPaths.has(item.relativePath)) item.class = classifyOrThrow(manifest, item.relativePath).class;
  }
  operations.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  // Before reading what the writes replace.
  await assertNoSymlinkWrites(targetPath, operations);
  await assertWriteFoldersAreFolders(targetPath, operations);
  await requireBackupForUnrecordedContent({ targetPath, manifest, operations, previousFiles });
}

// P4: a file the previous state records that this CLI version no longer ships.
// Only kit-owned content can retire: never an adapter, a seed, state, a
// generated file, the project overlay, a path the migration moves, or a
// backup. Shipped means any runtime's template, so switching runtimes never
// deletes the files of the runtime left out. In plugin mode (PRD 2.4) the kit
// ships no file in the repository, so only the paths this plan has are live:
// the agents of a profile that went back to the default retire. A switch to
// plugin mode (T7) also retires the generated derived files the plan does not
// write (the Copilot wrappers of a runtime left out).
const retirableClasses = new Set(['kit', 'derived']);
// The native call returns the letter case stored on disk.
const realpathNative = promisify(realpathCallback.native);

function isRetirable(manifest, relativePath, { switching = false } = {}) {
  if (relativePath.includes(backupFileMarker) || isProjectPath(manifest, relativePath)) return false;
  if (Object.hasOwn(manifest.legacy_paths, relativePath)) return false;
  const entry = classifyPath(manifest, relativePath);
  return (switching || !entry?.generated) && retirableClasses.has(entry?.class ?? null);
}

// Unedited: deleted with a backup whatever the backup mode. Edited: kept and
// flagged in the next state (in a switch, pending until discarded). Missing:
// only its record goes away.
async function planRetiredFiles({ targetPath, manifest, previousFiles, operations, pluginMode = false, switching = false }) {
  // Compared without letter case: on a case-insensitive file system a key
  // that differs from a live path only in case names that same live file.
  const livePaths = new Set([
    ...operations.map((item) => item.relativePath),
    ...(pluginMode ? [] : (await selectedTemplateFiles({ runtimes: supportedRuntimes })).map((file) => file.relativePath))
  ]);
  const live = new Set([...livePaths].map((relativePath) => relativePath.toLowerCase()));
  const realTarget = await fs.realpath(targetPath);
  const retired = { operations: [], missing: [] };
  for (const [relativePath, recorded] of Object.entries(previousFiles)) {
    if (!isRetirable(manifest, relativePath, { switching })) continue;
    if (livePaths.has(relativePath)) continue;
    // Same file as a live path in another letter case: only the stale key goes.
    if (live.has(relativePath.toLowerCase())) {
      retired.missing.push(relativePath);
      continue;
    }
    const targetFile = resolveInsideTarget(targetPath, relativePath);
    const existingContent = await readOptional(targetFile);
    if (existingContent === null) {
      retired.missing.push(relativePath);
      continue;
    }
    // The file found must be the one the key names, letter case included.
    const onDisk = path.relative(realTarget, await realpathNative(targetFile)).split(path.sep).join('/');
    if (onDisk !== relativePath) {
      retired.missing.push(relativePath);
      continue;
    }
    const base = { relativePath, targetFile, sourcePath: null, class: classifyPath(manifest, relativePath)?.class ?? null, retired: true };
    const existingChecksum = computeChecksum(existingContent);
    if (recorded.sha256 && recorded.sha256 === existingChecksum) {
      retired.operations.push({ ...base, operation: 'delete_with_backup', content: null, recordedChecksum: recorded.sha256 });
    } else {
      // The content is the file itself: the update brings no change to show.
      retired.operations.push({ ...base, operation: 'skip_modified', content: existingContent, existingChecksum, recordedChecksum: recorded.sha256 ?? null, reason: 'retired_edited' });
    }
  }
  return retired;
}

// T7 is all or nothing (D5): a file the switch leaves pending would leave the
// repository in both modes, so the switch stops before anything is written
// and names what settles each file.
const switchCommand = 'workflow-kit update --mode plugin';
function assertModeSwitchSettled(operations) {
  const pending = operations.filter((item) => item.operation === 'skip_modified' || (item.operation === 'skip_unmanaged' && item.reason === 'invalid_managed_block'));
  if (pending.length === 0) return;
  const lines = pending.map((item) => {
    const what = item.retired ? 'edited kit file; the switch deletes it' : item.reason;
    const settle = item.decisions?.length > 0 ? item.decisions.join(' | ') : 'no --edited decision applies; fix its workflow-kit markers by hand';
    return `- ${item.relativePath} (${what}): ${settle}`;
  });
  throw new Error([
    `update --mode plugin switches this install from repo mode to plugin mode, and a switch is applied whole, so each file below needs a decision first.`,
    ...lines,
    `Run \`${switchCommand} --edited <path>=discard\` for each file (or another decision listed for it), or \`${switchCommand} --edited all=discard\` for all of them; a discarded file keeps a backup next to it. To keep an edit of a kit file, move it first to a project shadow (.agents/kit-boundary.md), then switch. Nothing was written.`
  ].join('\n'));
}

// A recorded adapter the plugin plan does not write (the docs/README.md block,
// the entrypoint of a runtime left out) leaves the state of a switch: the kit
// no longer manages it, and its file stays as it is.
function adaptersLeftBehind(manifest, previousFiles, operations) {
  const planned = new Set(operations.map((item) => item.relativePath));
  return Object.keys(previousFiles).filter((relativePath) => !planned.has(relativePath) && classifyPath(manifest, relativePath)?.class === 'adapter');
}

async function readOptional(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// mode: 'init' (no state consulted), 'update' (state present) or 'adopt'
// (update without a state, bootstrapping a baseline).
async function planTemplateFiles(context) {
  const operations = [];
  for (const file of context.files) {
    const entry = classifyOrThrow(context.manifest, file.relativePath);
    if (entry.class === 'state') continue;
    const targetFile = path.resolve(context.targetPath, file.relativePath);
    const relativeTarget = path.relative(context.targetPath, targetFile);
    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
      throw new Error(`Refusing to plan write outside target: ${file.relativePath}`);
    }

    // A file with content is rendered already (a plugin-mode agent); in plugin
    // mode an adapter's block also carries the kit-location block.
    const sourceContent = file.content ?? await fs.readFile(file.sourcePath, 'utf8');
    const templateContent = context.pluginMode && entry.class === 'adapter'
      ? pluginAdapterContent(sourceContent, entry.block ?? defaultBlockName)
      : sourceContent;
    const planned = classPlanners[entry.class]({
      ...context,
      entry,
      templateContent,
      rendered: file.content !== undefined,
      existingContent: await readOptional(targetFile),
      recorded: context.previousFiles[file.relativePath] ?? null,
      base: {
        relativePath: file.relativePath,
        targetFile,
        sourcePath: file.sourcePath,
        class: entry.class,
        sourceChecksum: computeChecksum(templateContent)
      }
    });
    if (planned) operations.push(planned);
  }
  return operations;
}

const classPlanners = {
  kit: planOwnedFile,
  derived: planOwnedFile,
  adapter: planAdapter,
  seed: planSeed
};

// kit and derived: the kit owns the whole file. A file changed since the
// recorded install is a local edit and is only replaced by an --edited decision.
function planOwnedFile({ base, templateContent, rendered, existingContent, recorded, mode, backupMode, catalog, modelProfiles }) {
  const content = (rendered ? null : renderDelegateAdapterForPath(base.relativePath, catalog, modelProfiles)?.content) ?? templateContent;
  const plan = (operation, extra = {}) => ({ ...base, operation, content, stateChecksum: computeChecksum(content), ...extra });
  if (existingContent === null) return plan('create');
  // Content that already equals what this version would write is not a local
  // edit, whatever the state recorded: someone took the new version by hand.
  if (existingContent === content) return plan('unchanged');
  if (mode === 'init') return plan(overwriteOperation(backupMode));

  const existingChecksum = computeChecksum(existingContent);
  // A file that differs from this version when adopting is a customization,
  // not a baseline: record the kit checksum so later updates see it as edited.
  if (mode === 'adopt') return plan('adopt_existing', { existingChecksum });
  // Never recorded (a path this update ships for the first time, or that a
  // 1.0.0 state left out): someone's own text, pending like an edit.
  if (!recorded?.sha256) return plan('skip_modified', { existingChecksum, recordedChecksum: null, reason: 'unrecorded_kit_file' });
  if (recorded.sha256 === existingChecksum) return plan(overwriteOperation(backupMode), { recordedChecksum: recorded.sha256 });
  return plan('skip_modified', { existingChecksum, recordedChecksum: recorded.sha256, reason: 'edited_kit_file' });
}

// adapter: the kit owns only its block; the text outside it is the project's.
function planAdapter({ base, entry, templateContent, existingContent, recorded, backupMode }) {
  const blockName = entry.block ?? defaultBlockName;
  const plan = (operation, content, extra = {}) => ({ ...base, operation, content, stateChecksum: managedBlockChecksum(content, blockName), ...extra });
  if (existingContent === null) return plan('create', templateContent);

  const replaced = replaceManagedBlock(existingContent, templateContent, blockName);
  if (replaced !== null) return plan(replaced === existingContent ? 'unchanged' : overwriteOperation(backupMode), replaced);

  // No single valid block. A file the kit wrote before it had markers is
  // recognized by its recorded whole-file hash; anything else recorded is a
  // local edit the migration has to decide on.
  if (recorded?.sha256) {
    const existingChecksum = computeChecksum(existingContent);
    if (recorded.sha256 === existingChecksum) return plan(overwriteOperation(backupMode), templateContent, { recordedChecksum: recorded.sha256 });
    return { ...base, operation: 'skip_modified', content: templateContent, existingChecksum, recordedChecksum: recorded.sha256, reason: 'unmarked_adapter' };
  }
  // A lone or repeated marker cannot be paired safely with a new block.
  if (extractManagedBlock(existingContent, blockName).error !== 'missing') {
    return { ...base, operation: 'skip_unmanaged', content: templateContent, reason: 'invalid_managed_block' };
  }
  if (!existingContent.trim()) return plan(overwriteOperation(backupMode), templateContent);
  // A file the project wrote before the kit arrived keeps its text; the block
  // goes where the template places it.
  return plan(mergeOperation(backupMode), insertManagedBlock(existingContent, templateContent, blockName));
}

function insertManagedBlock(existingContent, templateContent, blockName) {
  const { block } = extractManagedBlock(templateContent, blockName);
  if (templateContent.startsWith(block)) return `${block}\n\n${existingContent}`;
  const separator = existingContent.endsWith('\n') ? '' : '\n';
  return `${existingContent}${separator}\n${block}\n`;
}

// seed: created once; after that the project owns it. A seed the kit created
// and the project deleted is never recreated. Hand-written Copilot
// instructions become the seed's first content instead of the template.
function planSeed({ base, templateContent, existingContent, recorded, migratedInstructions }) {
  if (existingContent !== null) return { ...base, operation: 'skip_unmanaged', content: existingContent, reason: 'project_owned' };
  const migrated = migratedInstructions[base.relativePath];
  if (typeof migrated === 'string') return { ...base, operation: 'create', content: migrated };
  if (recorded?.class === 'seed') return null;
  return { ...base, operation: 'create', content: templateContent };
}

// Checksum install-state records for a file of a given class: the managed
// block for an adapter (null when it has no valid block), the whole file for
// kit and derived files.
export function recordedChecksumOf(manifest, relativePath, fileClass, content) {
  if (fileClass !== 'adapter') return computeChecksum(content);
  return managedBlockChecksum(content, classifyPath(manifest, relativePath)?.block ?? defaultBlockName);
}

function managedBlockChecksum(content, blockName) {
  const extracted = extractManagedBlock(content, blockName);
  return extracted.error ? null : computeChecksum(extracted.block);
}

export function selectPlanOperations(plan, selectedRelativePaths = []) {
  const selected = new Set(selectedRelativePaths);
  // The layout migration is applied whole: deselecting part of it would leave
  // catalog rows or the context pointing at files that moved.
  const operations = plan.operations.filter((item) => item.migration || selected.has(item.relativePath));

  const nextInstallState = buildNextInstallState({
    previousState: { files: { ...(plan.previousStateFiles ?? {}) } },
    operations,
    droppedPaths: plan.droppedStatePaths,
    runtimes: plan.runtimes,
    overlay: plan.overlay,
    modelProfiles: plan.modelProfiles,
    stackPack: plan.stackPack,
    toolkitVersion: plan.toolkitVersion,
    mode: plan.nextInstallState?.mode
  });

  return {
    ...plan,
    operations,
    summary: summarizeOperations(operations),
    nextInstallState
  };
}

export async function readManagedInstallState(targetPath = process.cwd(), { manifest } = {}) {
  return readInstallState(path.join(path.resolve(targetPath), installStateRelativePath), manifest ?? await loadKitManifest());
}

export function summarizeOperations(operations) {
  const summary = {
    create: 0,
    unchanged: 0,
    merge_with_backup: 0,
    merge_no_backup: 0,
    overwrite_with_backup: 0,
    overwrite_no_backup: 0,
    skip_modified: 0,
    skip_unmanaged: 0,
    adopt_existing: 0,
    delete_with_backup: 0
  };

  for (const item of operations) {
    summary[item.operation] = (summary[item.operation] ?? 0) + 1;
  }

  return summary;
}

export function formatPlan(plan) {
  const lines = [
    `Target: ${plan.targetPath}`,
    `Mode: ${plan.mode ?? 'init'}`,
    // Only in plugin mode, so the repo-mode output does not change.
    ...(plan.nextInstallState?.mode === 'plugin' ? ['Install mode: plugin'] : []),
    `Toolkit version: ${plan.toolkitVersion ?? 'unknown'}`,
    `Target managed version: ${plan.previousToolkitVersion ?? 'none recorded'}`,
    `Runtimes: ${plan.runtimes.join(',')}`,
    `Overlay: ${plan.overlay}`,
    `Model profiles: ${formatModelProfiles(plan.modelProfiles)}`,
    `Stack pack: ${plan.stackPack ?? 'none'}`
  ];

  if ((plan.migrations ?? []).length > 0) {
    lines.push('Migrations (applied once, idempotent):');
    for (const migration of plan.migrations) {
      lines.push(`- ${migration.id}: ${migration.summary}`);
      for (const item of migration.pending ?? []) lines.push(`  - pending ${item.relativePath} (${item.reason})${item.decisions ? `: ${item.decisions.join(' | ')}` : ''}`);
      for (const note of migration.notes ?? []) lines.push(`  - note: ${note}`);
    }
  }
  lines.push('Operations:');

  // A pending file lists the decisions that settle it, as the migration lines
  // do; under a layout migration those lines already list them.
  const migrationListsPending = (plan.migrations ?? []).some((migration) => migration.id === layoutMigrationId);
  for (const item of plan.operations) {
    let note = item.retired ? ` (no longer shipped${item.operation === 'skip_modified' ? '; edited, kept' : ''})` : '';
    if (item.decisions && !migrationListsPending) note = ` (${item.reason}): ${item.decisions.join(' | ')}`;
    if (item.manualFragment) note = ` (${item.reason}); ${item.manualAction} by hand:\n${item.manualFragment.replace(/^/gm, '    ')}`;
    lines.push(`- ${item.operation}: ${item.relativePath}${note}`);
  }

  lines.push(`Summary: create=${plan.summary.create}, unchanged=${plan.summary.unchanged}, merge_with_backup=${plan.summary.merge_with_backup}, merge_no_backup=${plan.summary.merge_no_backup}, overwrite_with_backup=${plan.summary.overwrite_with_backup}, overwrite_no_backup=${plan.summary.overwrite_no_backup}, skip_modified=${plan.summary.skip_modified}, skip_unmanaged=${plan.summary.skip_unmanaged}, adopt_existing=${plan.summary.adopt_existing}, delete_with_backup=${plan.summary.delete_with_backup}`);
  return lines.join('\n');
}

function computeChecksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// Reads a 2.0.0 state, or a 1.0.0 state converted to the same file entries.
// A converted state keeps schemaVersion 1.0.0 so the caller can tell that its
// adapter hashes cover the whole file and that it still needs the migration.
async function readInstallState(stateFilePath, manifest) {
  const raw = await readOptional(stateFilePath);
  if (raw === null) return null;

  // A state file that exists but cannot be used is not "no install": treating
  // it as missing would send the user to --adopt-existing over a real install.
  const unusable = (reason) => new Error(`${installStateRelativePath} ${reason}. Restore it from Git, or upgrade the CLI with \`workflow-kit upgrade --apply --yes\` if a newer version wrote it.`);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw unusable('is not valid JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) || typeof parsed.files !== 'object' || parsed.files === null || Array.isArray(parsed.files)) {
    throw unusable('does not have the expected structure');
  }
  if (![legacyInstallStateSchemaVersion, installStateSchemaVersion].includes(parsed.schemaVersion)) {
    throw unusable(`uses schema ${parsed.schemaVersion ?? 'unknown'}, and this CLI reads ${legacyInstallStateSchemaVersion} and ${installStateSchemaVersion}`);
  }
  const legacy = parsed.schemaVersion === legacyInstallStateSchemaVersion;
  const files = {};
  const ignoredKeys = [];
  for (const [rawPath, entry] of Object.entries(parsed.files)) {
    // Keys come from the repository: installs before 0.17.0 on Windows wrote
    // "\". A key that is absolute or steps through "." or ".." names no file
    // the kit installed, so it is ignored (doctor lists it).
    const relativePath = rawPath.replaceAll('\\', '/');
    if (relativePath.startsWith('/') || relativePath.split('/').some((segment) => ['', '.', '..'].includes(segment))) {
      ignoredKeys.push(rawPath);
      continue;
    }
    if (relativePath !== rawPath && Object.hasOwn(parsed.files, relativePath)) continue;
    if (legacy && typeof entry === 'string') {
      files[relativePath] = { sha256: entry, class: classifyPath(manifest, relativePath)?.class ?? null };
    } else if (!legacy && entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
      files[relativePath] = entry;
    } else {
      throw unusable('does not have the expected structure');
    }
  }

  try {
    return {
      schemaVersion: parsed.schemaVersion,
      managedBy: parsed.managedBy,
      toolkitVersion: parsed.toolkitVersion,
      generatedAt: parsed.generatedAt,
      mode: parsed.mode ?? 'repo',
      runtimes: Array.isArray(parsed.runtimes) ? parseRuntimeList(parsed.runtimes.join(',')) : ['neutral'],
      overlay: normalizeOverlay(parsed.overlay ?? 'fhh-ia-ecosystem-full'),
      modelProfiles: parsed.modelProfiles && typeof parsed.modelProfiles === 'object' ? parsed.modelProfiles : {},
      stackPack: typeof parsed.stackPack === 'string' ? parsed.stackPack : undefined,
      files,
      ignoredKeys
    };
  } catch (error) {
    throw unusable(`names something this CLI version does not support (${error.message})`);
  }
}

function formatModelProfiles(modelProfiles = {}) {
  const entries = Object.entries(modelProfiles);
  return entries.length > 0 ? entries.map(([runtime, profile]) => `${runtime}=${profile}`).join(',') : 'none (no runtime with delegate agents)';
}

// install-state 2.0.0: kit and derived files record the hash of the file,
// adapters the hash of their block, seeds only that the kit created them. A
// retired file that was deleted or is gone leaves the state; one kept because
// it was edited stays with `retired: true` so doctor can name it.
function buildNextInstallState({ previousState, operations, droppedPaths = [], runtimes, overlay, modelProfiles, stackPack, toolkitVersion, mode = 'repo' }) {
  const files = {};
  for (const [relativePath, entry] of Object.entries(previousState?.files ?? {})) {
    files[relativePath] = entry.class === 'seed' ? { class: 'seed' } : { ...entry };
  }
  for (const relativePath of droppedPaths) delete files[relativePath];

  for (const item of operations) {
    // A deleted file (retired, or moved by the layout migration) leaves the state.
    if (item.operation === 'delete_with_backup') {
      delete files[item.relativePath];
      continue;
    }
    if (item.retired) {
      files[item.relativePath] = { ...files[item.relativePath], retired: true };
      continue;
    }
    // .gitignore has no class and stays user-owned; skipped files keep what
    // the previous state recorded.
    if (!item.class || item.class === 'state') continue;
    if (item.operation === 'skip_unmanaged' || item.operation === 'skip_modified') continue;
    // A seed the kit wrote: created, or reset by the layout migration.
    if (item.class === 'seed') {
      files[item.relativePath] = { class: 'seed' };
      continue;
    }
    files[item.relativePath] = { sha256: item.stateChecksum, class: item.class };
  }

  return {
    schemaVersion: installStateSchemaVersion,
    managedBy: 'fhh-ia-ecosystem-workflow-kit',
    toolkitVersion: toolkitVersion ?? null,
    generatedAt: new Date().toISOString(),
    // "export": a copy of the kit that export may refresh; "repo": an install.
    mode,
    runtimes,
    overlay,
    modelProfiles: { ...(previousState?.modelProfiles ?? {}), ...(modelProfiles ?? {}) },
    stackPack: stackPack ?? previousState?.stackPack ?? 'none',
    files
  };
}

// Stack packs hold the framework rules that are no longer part of the neutral
// skills (roadmap D-30). The pack is copied once to .agents/project/stack.md;
// after that the project owns the file and the installer never touches it.
export const stackPackNames = Object.freeze(['rails-react']);
export const stackRulesPath = '.agents/project/stack.md';

export function normalizeStackPack(value) {
  if (value === undefined || value === null || value === '' || value === 'none') return 'none';
  if (!stackPackNames.includes(value)) {
    throw new Error(`Unsupported --stack value "${value}". Use one of: none, ${stackPackNames.join(', ')}.`);
  }
  return value;
}

async function readJsonOptional(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

// A repository is Rails + React when it has a Gemfile and declares react in a
// package.json at the root or one folder down (frontend/, client/, web/...).
export async function detectStackPack(targetPath) {
  try {
    await fs.access(path.join(targetPath, 'Gemfile'));
  } catch {
    return 'none';
  }
  const entries = await fs.readdir(targetPath, { withFileTypes: true }).catch(() => []);
  const folders = ['.', ...entries.filter((entry) => entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')).map((entry) => entry.name)];
  for (const folder of folders) {
    const manifest = await readJsonOptional(path.join(targetPath, folder, 'package.json'));
    if (manifest?.dependencies?.react || manifest?.devDependencies?.react) return 'rails-react';
  }
  return 'none';
}

// Generated seed: created when missing and not created before.
async function buildStackPackOperations({ targetPath, stackPack, previousFiles }) {
  if (stackPack === 'none' || previousFiles[stackRulesPath]?.class === 'seed') return [];
  const targetFile = path.join(targetPath, stackRulesPath);
  if (await readOptional(targetFile) !== null) return [];
  const content = await fs.readFile(path.join(templatesRoot, 'stack-packs', stackPack, 'stack.md'), 'utf8');
  return [{ operation: 'create', relativePath: stackRulesPath, targetFile, sourcePath: null, content }];
}

function migratedInstructionContents(inspection) {
  const migrated = {};
  for (const name of projectInstructionNames) {
    if (inspection[name].migratedContent !== null) migrated[neutralInstructionPath(name)] = inspection[name].migratedContent;
  }
  return migrated;
}

// Copilot loads instructions from .github/instructions/. Generate those files
// from the kit default and the neutral files as they will be after this plan
// is applied.
function projectInstructionWrapperOperations({ targetPath, runtimes, operations, instructionInspection, backupMode, kitQualityGate: packageKitQualityGate }) {
  if (!runtimes.includes('copilot')) return [];
  const contentAfterPlan = (relativePath, current) => {
    const planned = operations.find((item) => item.relativePath === relativePath);
    return planned && !nonWritingOperations.has(planned.operation) ? planned.content : current;
  };
  const neutralContents = {};
  for (const name of projectInstructionNames) {
    neutralContents[name] = contentAfterPlan(neutralInstructionPath(name), instructionInspection[name].neutral);
  }
  const kitQualityGate = packageKitQualityGate ?? contentAfterPlan(kitQualityGatePath, instructionInspection['quality-gate'].kitDefault);
  // Record the generated content so install-state tracks these files and
  // doctor flags a hand edit instead of an old template checksum.
  return planCopilotWrappers({ targetPath, inspection: instructionInspection, neutralContents, kitQualityGate, backupMode })
    .map((operation) => ({ ...operation, stateChecksum: computeChecksum(operation.content) }));
}

// Local state the kit writes in the target repository must be ignored by Git
// (the manifest's ignore_entries: the AI workspace and the rollback journal of
// the last apply, which only makes sense on the machine that ran it). Missing
// entries are appended once; .gitignore stays user-owned, so the operation has
// no class and never enters install-state.
export const workspaceDirectory = '.ai-work';

const normalizeIgnoreLine = (line) => line.trim().replace(/^\//, '').replace(/\/$/, '');

function gitignoreHasEntry(content, entry) {
  const wanted = normalizeIgnoreLine(entry);
  return String(content).split(/\r?\n/).some((line) => normalizeIgnoreLine(line) === wanted);
}

export function gitignoreHasWorkspaceEntry(content) {
  return gitignoreHasEntry(content, workspaceDirectory);
}

export function gitignoreHasApplyJournalEntry(content) {
  return gitignoreHasEntry(content, applyJournalRelativePath);
}

async function buildWorkspaceIgnoreOperations({ targetPath, backupMode, manifest }) {
  const targetFile = path.join(targetPath, gitignorePath);
  const existing = await readOptional(targetFile);
  const ignoredEntries = manifest.ignore_entries.filter((entry) => !gitignoreHasEntry(existing ?? '', entry));
  if (ignoredEntries.length === 0) return [];
  const block = `# workflow-kit local state (stays on this machine)\n${ignoredEntries.join('\n')}\n`;

  if (existing === null) {
    return [{ operation: 'create', relativePath: gitignorePath, targetFile, sourcePath: null, content: block, ignoredEntries }];
  }

  const separator = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  return [{
    operation: mergeOperation(backupMode),
    relativePath: gitignorePath,
    targetFile,
    sourcePath: null,
    content: `${existing}${separator}\n${block}`,
    ignoredEntries
  }];
}

// Generated seed: written once at init when legacy docs exist, never again.
async function buildOneTimeDocsMigrationOperations({ targetPath, previousFiles }) {
  const migrationMapTarget = path.join(targetPath, oneTimeLegacyDocsMapPath);
  if (previousFiles[oneTimeLegacyDocsMapPath]?.class === 'seed' || await readOptional(migrationMapTarget) !== null) return [];

  const legacyDocs = await collectLegacyDocsForMigration({ docsRoot: path.join(targetPath, 'docs') });
  if (legacyDocs.length === 0) return [];

  return [{
    operation: 'create',
    relativePath: oneTimeLegacyDocsMapPath,
    targetFile: migrationMapTarget,
    sourcePath: null,
    content: renderLegacyDocsMigrationMap(legacyDocs)
  }];
}


async function collectLegacyDocsForMigration({ docsRoot }) {
  const files = [];

  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }

      if (!entry.isFile()) continue;
      const relative = path.relative(docsRoot, absolute).split(path.sep).join('/');
      if (relative.startsWith('workflow/')) continue;
      if (!isDocFile(relative)) continue;

      files.push({
        relative,
        suggested: suggestWorkflowDocsTarget(relative)
      });
    }
  }

  await walk(docsRoot);
  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

function isDocFile(relativePath) {
  return /\.(md|mdx|txt|rst)$/i.test(relativePath);
}

function suggestWorkflowDocsTarget(relativePath) {
  const lower = relativePath.toLowerCase();
  const slug = relativePath.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9/-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  if (/(adr|decision|architecture|arquitectura|tradeoff)/.test(lower)) {
    return `docs/workflow/decisions/imported-${slug}.md`;
  }

  if (/(runbook|playbook|operat|release|deploy|incident|troubleshoot|soporte)/.test(lower)) {
    return `docs/workflow/runbooks/imported-${slug}.md`;
  }

  if (/(handoff|handover|entrega|qa|transfer|ownership)/.test(lower)) {
    return `docs/workflow/handoffs/imported-${slug}.md`;
  }

  if (/(backend|api|contract|frontend|ui|ux|style|guideline|standard|estandar)/.test(lower)) {
    return `docs/workflow/standards/imported-${slug}.md`;
  }

  return `docs/workflow/migration/review-${slug}.md`;
}

function renderLegacyDocsMigrationMap(legacyDocs) {
  const lines = [
    '# Legacy Docs Migration Map',
    '',
    'This file is generated once by workflow-kit during init when legacy docs already exist.',
    'It preserves originals and proposes coherent target locations under docs/workflow/.',
    '',
    '## How to use this map',
    '',
    '1. Review each suggestion and adjust target paths if needed.',
    '2. Move files with `git mv` to preserve history.',
    '3. Keep this file as migration evidence or archive it once complete.',
    '',
    '| Existing file | Suggested destination |',
    '| --- | --- |'
  ];

  for (const item of legacyDocs) {
    lines.push(`| docs/${item.relative} | ${item.suggested} |`);
  }

  lines.push('', '## Suggested move commands', '');
  for (const item of legacyDocs) {
    lines.push(`- git mv "docs/${item.relative}" "${item.suggested}"`);
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}
