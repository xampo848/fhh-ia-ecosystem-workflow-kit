import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import packageJson from '../package.json' with { type: 'json' };
import {
  buildUpdatePlan, incompleteApplyMessage, installStateRelativePath, lastApplyProblem, legacyInstallStateSchemaVersion,
  normalizeOverlay, parseRuntimeList, readManagedInstallState, recordedChecksumOf, selectedTemplateFiles, stackRulesPath, unusableJournalMessage
} from './planner.mjs';
import { applyJournalRelativePath } from './apply.mjs';
import { classifyPath, currentPathFor, isProjectPath, loadKitManifest } from './kit-manifest.mjs';
import { backupFileMarker, layoutMigrationId, projectIndexPath, projectIndexTableRows, shadowManifestName, skillsRoot, unquote, walkTree } from './migration.mjs';
import { supportedRuntimes } from './runtime-matrix.mjs';
import { validateWorkflowContract } from './workflow-contract/index.mjs';
import { loadDelegateCatalog, modelSettingLine, renderDelegateAdapterForPath, resolveModelProfiles } from './model-profiles.mjs';
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
async function adapterBlockDiagnostics({ targetPath, manifest, state, files }) {
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
    if (template && actual === recordedChecksumOf(manifest, relativePath, 'adapter', await fs.readFile(template.sourcePath, 'utf8'))) continue;
    diagnostics.push(warning('boundary/adapter-block-edited', relativePath, 'The workflow-kit block of this adapter was edited. The next update restores the block (with a backup); move your text outside the markers.'));
  }
  return diagnostics;
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
  const decide = `Run \`workflow-kit update --edited ${item.relativePath}=${(item.decisions ?? ['keep', 'discard']).join('|')}\` (keep leaves it as it is; discard takes the kit version${item.decisions?.includes('shadow') ? '; shadow moves your edit to a project shadow' : ''}${item.decisions?.includes('split') ? '; split keeps your own lines next to a new block' : ''}).`;
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

const sha256Pattern = /^[0-9a-f]{64}$/;

// A shadow replaces a kit leaf skill; when the kit file changes, the shadow
// may miss its fixes. Only shadows listed in the project index take effect.
async function shadowDiagnostics({ targetPath, manifest, shippedPaths }) {
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
    const kitContent = await readOptional(resolveInsideTarget(targetPath, kitPath));
    if (kitContent === null) {
      // A file the kit still ships is listed under missing files.
      if (shippedPaths.has(kitPath)) continue;
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
async function unownedPathDiagnostics({ targetPath, manifest, state, shippedPaths }) {
  if (!state || state.schemaVersion === legacyInstallStateSchemaVersion) return [];
  const { files } = await walkTree(targetPath, skillsRoot);
  return files
    .filter((relativePath) => !relativePath.includes(backupFileMarker) && classifyPath(manifest, relativePath)?.class === 'kit' && !shippedPaths.has(relativePath) && !Object.hasOwn(state.files, relativePath))
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
  const files = await selectedTemplateFiles({ runtimes, overlay });
  const shippedPaths = new Set((await selectedTemplateFiles({ runtimes: supportedRuntimes })).map((file) => file.relativePath));
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

  const catalog = await loadDelegateCatalog();
  const modelProfiles = resolveModelProfiles({ catalog, runtimes, stored: storedState?.modelProfiles });
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
    async () => (await validateWorkflowContract({ root: targetPath, runtimes })).diagnostics.map(targetRepoContractDiagnostic),
    () => modelProfileDiagnostics({ targetPath, present, catalog, modelProfiles }),
    () => workspaceDiagnostics({ targetPath }),
    () => projectContextDiagnostics({ targetPath }),
    () => projectInstructionDiagnostics({ targetPath, runtimes }),
    () => stackPackDiagnostics({ targetPath, stackPack: storedState?.stackPack }),
    () => adapterBlockDiagnostics({ targetPath, manifest, state: storedState, files }),
    () => pendingDiagnostics({ targetPath, manifest, state: storedState, runtimes, overlay, journalProblem }),
    () => shadowDiagnostics({ targetPath, manifest, shippedPaths }),
    () => unownedPathDiagnostics({ targetPath, manifest, state: storedState, shippedPaths }),
    () => symlinkDiagnostics(targetPath, files)
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
