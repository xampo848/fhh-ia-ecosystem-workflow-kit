import fs from 'node:fs/promises';
import path from 'node:path';
import { code, kitCommand, rollbackCommand } from './plugin-mode.mjs';
import { acquireTargetLock, applyJournalProblem, assertLockPathNotSymlinked, findTemporaryLeftovers, assertObservedUnchanged, assertTargetNotLocked, applyJournalRelativePath, applyLockRelativePath, freeBackupStamp, interruptedCode, journalBelongsToLock, observeTarget, removeCreatedDirectories, removeTemporaryLeftovers, staleLockRecord } from './apply.mjs';
import { checksumOf, copyFileAtomic, findSymlinkInPath, readFileNamed, resolveInsideTarget, writeFileAtomic } from './fs-safety.mjs';
import { explainedPlanning, giveUpRollbackAdvice, installStateRelativePath, readManagedInstallState, selectedTemplateFiles, stackRulesPath, unreadableReason, workspaceDirectory } from './planner.mjs';
import { pluginSettingsPaths, runtimeEntrypoints, supportedRuntimes } from './runtime-matrix.mjs';

const backupSuffixPattern = /\.workflow-kit-backup-(\d{8}T\d{6}Z)$/;
// Copies a rollback without a journal keeps; never picked as a backup to restore.
export const beforeRollbackSuffix = '-before-rollback';
// 1.0.0 journals only hold `created` and `overwritten` entries; 2.0.0 adds
// `deleted` (a retired kit file removed with a backup).

// A path under a folder that became a file (ENOTDIR) is not there either.
async function readIfPresent(file) {
  try {
    return await readFileNamed(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

async function readJournal(targetPath) {
  let raw;
  try {
    raw = await readIfPresent(path.join(targetPath, applyJournalRelativePath));
  } catch (readError) {
    throw new Error(`${applyJournalRelativePath} cannot be read (${unreadableReason(readError)}), so rollback cannot tell what the last apply wrote, and Git does not track it. To keep the way back, make it a readable file again. ${giveUpRollbackAdvice(targetPath)}. Nothing was changed.`);
  }
  if (raw === null) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${applyJournalRelativePath} is not valid JSON, so rollback cannot tell what the last apply wrote, and Git does not track it. If you have a copy of the file, put it back. ${giveUpRollbackAdvice(targetPath)}. Nothing was changed.`);
  }
  const problem = applyJournalProblem(parsed);
  if (problem === 'version') {
    throw new Error(`${applyJournalRelativePath} has an unsupported format (schema ${JSON.stringify(parsed?.schemaVersion ?? null)}). Run rollback with the workflow-kit version that wrote it (a newer one: upgrade the CLI with ${code('workflow-kit upgrade --apply --yes')}, a global command with no --target). ${giveUpRollbackAdvice(targetPath)}. Nothing was changed.`);
  }
  if (problem === 'entries') {
    throw new Error(`${applyJournalRelativePath} has entries rollback cannot act on, and Git does not track it. If you have a copy of the file, put it back. ${giveUpRollbackAdvice(targetPath)}. Nothing was changed.`);
  }
  return parsed;
}

// Paths in the journal and in install-state come from the target repository:
// keep them inside the target and never follow a symbolic link.
async function safeTargetFile(targetPath, relativePath) {
  const absolute = resolveInsideTarget(targetPath, relativePath);
  const link = await findSymlinkInPath(targetPath, relativePath);
  if (link) throw new Error(`Refusing to roll back through a symbolic link: ${link}`);
  return absolute;
}

export const buildRollbackPlan = (options = {}) => explainedPlanning(path.resolve(options.targetPath ?? process.cwd()), () => planRollback(options));

async function planRollback(options = {}) {
  const targetPath = path.resolve(options.targetPath ?? process.cwd());
  await assertTargetFolder(targetPath);
  await assertTargetNotLocked(targetPath);
  // Read first: the apply of this plan checks under its lock that the
  // journal and install-state are still the ones it was planned from.
  const observed = await observeTarget(targetPath, path.join(targetPath, installStateRelativePath));
  const stale = await staleLockRecord(targetPath);
  const journal = await readJournal(targetPath);
  // A run killed before it wrote its journal (an apply) or after it removed it
  // (a rollback) left only its lock, temporary files and the folders it made.
  // This rollback cleans exactly that and stops: a journal that is there
  // belongs to an earlier run and is not touched until the next rollback.
  if (stale && (journal === null || (stale.kind === 'apply' && !journalBelongsToLock(journal, stale)))) {
    await assertLockPathNotSymlinked(targetPath);
    const kit = await kitFolders();
    const recorded = stale.createdDirectories.filter((folder) => kit.has(folder));
    const temporaryFiles = await findTemporaryLeftovers(targetPath);
    return { targetPath, source: 'leftovers', observed, stoppedRun: stale.kind, stoppedAt: stale.startedAt, previousJournal: journal !== null, olderBackups: journal === null ? await countOlderBackups(targetPath) : 0, fromBackupsDeferred: options.fromBackups === true, createdDirectories: recorded, temporaryFiles, removedFolders: await foldersThatGo(targetPath, recorded, [applyLockRelativePath, ...temporaryFiles], journal !== null), operations: [] };
  }
  // Without a journal nothing says which run a backup belongs to: the newest
  // one may be from the original init. Restoring them is asked for by name
  // (--from-backups); otherwise the plan only lists what is there.
  if (!journal) {
    const legacy = await buildLegacyRollbackPlan(targetPath);
    if (options.fromBackups === true) return { ...legacy, observed, fromBackups: true };
    return { ...legacy, observed, operations: [], availableBackups: legacy.operations };
  }
  if (options.fromBackups === true) {
    throw new Error(`--from-backups applies only when there is no record of an applied run. This project has one (${applyJournalRelativePath}): run ${code(kitCommand(targetPath, 'rollback'))} (a dry run) without --from-backups to see what it undoes. Nothing was changed.`);
  }

  const operations = [];
  // Entries written since 0.23.2 carry the checksum the file had before the
  // run, so a file an interrupted run never reached is told apart from one
  // it wrote and one edited after it.
  const knowsPrevious = journal.files.every((entry) => Object.hasOwn(entry, 'previousChecksum'));
  for (const entry of journal.files) {
    const targetFile = await safeTargetFile(targetPath, entry.relativePath);
    const current = await readIfPresent(targetFile);
    const currentChecksum = current === null ? null : checksumOf(current);
    const deleted = entry.action === 'deleted';
    const base = { relativePath: entry.relativePath, targetFile, ...(deleted ? { deleted: true } : {}) };
    const backupPath = entry.backup ? await safeTargetFile(targetPath, entry.backup) : null;
    const backupExists = backupPath !== null && (await readIfPresent(backupPath)) !== null;
    const restoreOrExplain = () => (backupPath === null
      ? { ...base, action: 'no_backup', reason: 'applied with --backup-mode none' }
      : backupExists ? { ...base, action: 'restore', backupPath } : { ...base, action: 'no_backup', reason: 'backup file is missing' });

    if (knowsPrevious) {
      // A finished apply created it and it is gone: removed by hand after
      // the run, not a file the run never reached. A rollback that already
      // started may have removed it itself, so it says nothing then.
      if (entry.action === 'created' && current === null && journal.completed !== false && typeof journal.rollbackStartedAt !== 'string') {
        operations.push({ ...base, action: 'keep_modified', gone: true, createdGone: true });
        continue;
      }
      const wroteIt = deleted ? current === null : currentChecksum === entry.writtenChecksum;
      if (wroteIt) {
        operations.push(entry.action === 'created' ? { ...base, action: 'remove' } : restoreOrExplain());
      } else if (currentChecksum === entry.previousChecksum) {
        // Not reached by the run (or already undone): its backup, when the
        // run made one before stopping, holds this same content.
        operations.push({ ...base, action: 'untouched', ...(backupExists ? { backupPath } : {}) });
      } else {
        // Edited, or removed by hand, after the run: left as it is; a backup
        // of it stays where it is.
        operations.push({ ...base, action: 'keep_modified', ...(current === null && !deleted ? { gone: true } : {}), ...(backupExists ? { keptBackup: backupPath } : {}) });
      }
      continue;
    }

    // A deleted path that exists again was recreated after the apply.
    const editedSinceApply = current !== null && (deleted || currentChecksum !== entry.writtenChecksum);
    if (editedSinceApply) {
      operations.push({ ...base, action: 'keep_modified' });
    } else if (entry.action === 'created') {
      if (current !== null) operations.push({ ...base, action: 'remove' });
    } else {
      operations.push(restoreOrExplain());
    }
  }

  // A state edited after the run (neither what it wrote nor the previous
  // one) is kept as a copy before the previous state comes back.
  const statePath = path.join(targetPath, installStateRelativePath);
  const currentState = await readIfPresent(statePath);
  const previousState = typeof journal.previousInstallState === 'string' ? journal.previousInstallState : null;
  const stateEdited = journal.stateWritten !== false && typeof journal.stateChecksum === 'string' && currentState !== null
    && checksumOf(currentState) !== journal.stateChecksum && currentState !== previousState;

  return {
    targetPath,
    source: 'journal',
    observed,
    mode: typeof journal.mode === 'string' ? journal.mode : null,
    toolkitVersion: typeof journal.toolkitVersion === 'string' ? journal.toolkitVersion : null,
    appliedAt: journal.appliedAt ?? null,
    stateEdited,
    rollbackStartedAt: typeof journal.rollbackStartedAt === 'string' ? journal.rollbackStartedAt : null,
    completed: journal.completed !== false,
    stateWritten: journal.stateWritten !== false,
    previousInstallState: typeof journal.previousInstallState === 'string' ? journal.previousInstallState : null,
    createdDirectories: Array.isArray(journal.createdDirectories) ? journal.createdDirectories : null,
    operations
  };
}

// Every folder the kit can create: the folders above the files of every
// template, the runtime entrypoints and plugin settings, the stack rules, the
// plugin agents, the workspace folder and the kit's own state files. A lock
// is hand-editable, so a folder it names that is not in this set is never
// removed. (A folder only an exotic setup creates stays: it is empty, not
// lost.)
async function kitFolders() {
  const files = (await selectedTemplateFiles({ runtimes: supportedRuntimes })).map((file) => file.relativePath);
  files.push(...Object.values(runtimeEntrypoints).flat(), ...Object.values(pluginSettingsPaths).flat(), stackRulesPath, `${workspaceDirectory}/x`, '.claude/agents/x', '.github/agents/x', installStateRelativePath, applyJournalRelativePath, applyLockRelativePath);
  const folders = new Set();
  for (const file of files) {
    const segments = String(file).split('/').slice(0, -1);
    segments.forEach((_, index) => folders.add(segments.slice(0, index + 1).join('/')));
  }
  return folders;
}

// The recorded folders that are empty once the lock and the temporary files
// are gone, as the apply removes them (deepest first, a folder only when what
// is left in it is removed too). The journal, when there is one, stays.
async function foldersThatGo(targetPath, recorded, removedFiles, journalStays) {
  const gone = new Set(removedFiles);
  const goes = [];
  const deepestFirst = [...recorded].sort((a, b) => b.split('/').length - a.split('/').length || b.localeCompare(a));
  for (const folder of deepestFirst) {
    if (await findSymlinkInPath(targetPath, folder)) continue;
    let names;
    try {
      names = await fs.readdir(path.join(targetPath, folder));
    } catch {
      continue;
    }
    if (names.every((name) => gone.has(`${folder}/${name}`) && !(journalStays && `${folder}/${name}` === applyJournalRelativePath))) {
      goes.push(folder);
      gone.add(folder);
    }
  }
  return goes;
}

// --target must name a folder that exists: anything else would only give a
// message about the journal or install-state inside it.
async function assertTargetFolder(targetPath) {
  let stat;
  try {
    stat = await fs.stat(targetPath);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`The target ${targetPath} does not exist. Check --target. Nothing was changed.`);
    throw error;
  }
  if (!stat.isDirectory()) throw new Error(`The target ${targetPath} is a file, not a folder. Check --target. Nothing was changed.`);
}

// Installs applied before the journal existed: restore the newest backup of
// each managed file. Created files and install-state cannot be undone here.
// Nothing says whether a file changed after its backup, so the apply keeps a
// copy of the content it replaces (see applyRollbackPlan).
async function buildLegacyRollbackPlan(targetPath) {
  const state = await readManagedInstallState(targetPath);
  const operations = [];
  // The files the kit only merges into (.gitignore, plugin settings) are not
  // in install-state, and an install backs them up too.
  const recorded = Object.keys(state?.files ?? {});
  const merged = state ? ['.gitignore', ...Object.values(pluginSettingsPaths).flat()].filter((relativePath) => !recorded.includes(relativePath)) : [];
  let matchingBackups = 0;
  for (const relativePath of [...recorded, ...merged]) {
    // A merged file behind a symbolic link is never written by the kit, so
    // it has no backup of its own to offer: skipped, not an error.
    if (merged.includes(relativePath) && await findSymlinkInPath(targetPath, relativePath)) continue;
    const targetFile = await safeTargetFile(targetPath, relativePath);
    const latestBackup = await findLatestBackup(targetFile);
    if (!latestBackup) continue;
    const current = await readBufferIfPresent(targetFile);
    const backup = await readFileNamed(latestBackup.backupPath);
    // Already the backup's content: nothing to restore (a second run is a no-op).
    if (current !== null && current.equals(backup)) {
      matchingBackups += 1;
      continue;
    }
    operations.push({ relativePath, targetFile, action: 'restore', backupPath: latestBackup.backupPath, backupStamp: latestBackup.backupStamp, ...(current !== null ? { keepsCopy: true } : {}) });
  }
  return { targetPath, source: 'backups', operations, checkedFiles: recorded.length, matchingBackups };
}

// How many backups of earlier runs a rollback with --from-backups would
// restore. A state that cannot be read counts as none: this only words a hint.
async function countOlderBackups(targetPath) {
  try {
    return (await buildLegacyRollbackPlan(targetPath)).operations.length;
  } catch {
    return 0;
  }
}

// `20261126T202311Z` as `2026-11-26 20:23:11 UTC`.
const stampAsDate = (stamp) => stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3 $4:$5:$6 UTC');

// Journals written before 0.23.2 do not record the folders their run created:
// the empty folders above a removed file go, as those versions did.
async function removeEmptyParents(targetPath, file) {
  let directory = path.dirname(file);
  while (directory.startsWith(`${targetPath}${path.sep}`)) {
    try {
      await fs.rmdir(directory);
    } catch {
      return;
    }
    directory = path.dirname(directory);
  }
}

// `signal` (an AbortSignal) stops the rollback between two files; its
// journal stays, so running rollback again finishes it.
export async function applyRollbackPlan(plan, { signal } = {}) {
  const restores = plan.operations.filter((item) => item.action === 'restore');
  const journalPath = path.join(plan.targetPath, applyJournalRelativePath);
  const statePath = path.join(plan.targetPath, installStateRelativePath);
  // The lock records the folders this rollback is about to remove: killed
  // after it deleted the journal, the next rollback still finishes the job.
  if (plan.source === 'leftovers') await assertLockPathNotSymlinked(plan.targetPath);
  const { release } = await acquireTargetLock(plan.targetPath, { kind: 'rollback', record: plan.createdDirectories ?? [] });
  const results = [];
  let stateCopy = null;
  try {
    // Planned before another run applied or rolled back: undoing from this
    // plan would undo the wrong run and orphan the other run's backups.
    await assertObservedUnchanged(plan.observed, plan.targetPath, statePath);
    if (plan.source === 'leftovers') {
      // Only the temporary files; the lock and the recorded folders go with the release.
      await removeTemporaryLeftovers(plan.targetPath);
      return results;
    }
    // Recorded before the first change: a rollback stopped at any point
    // (even killed) stops the next init or update, which points back here,
    // and doctor reports it; running rollback again finishes it.
    if (plan.source === 'journal') await markRollbackStarted(journalPath);
    // Temporary files a killed run (or rollback) left next to the files it wrote.
    const folders = [...plan.operations.map((item) => path.relative(plan.targetPath, path.dirname(item.targetFile))), path.dirname(applyJournalRelativePath)];
    await removeTemporaryLeftovers(plan.targetPath, folders);
    const copyStamp = plan.source === 'backups' && restores.length > 0
      ? await freeBackupStamp(restores.map((item) => item.targetFile), beforeRollbackSuffix)
      : null;
    // A journal's backups go only once the whole rollback is done: a
    // rollback stopped halfway is run again from the same journal.
    const usedBackups = [];
    for (const item of plan.operations) {
      if (signal?.aborted) {
        throw Object.assign(new Error(`Interrupted before ${item.relativePath}: rollback stopped between two files. Its journal stays; run ${rollbackCommand(plan.targetPath)} again to finish it.`), { code: interruptedCode });
      }
      if (item.action === 'restore') {
        const keptCopy = copyStamp && item.keepsCopy ? await keepCurrentContent(item, copyStamp) : null;
        await fs.mkdir(path.dirname(item.targetFile), { recursive: true });
        // Never half-written: copied next to the file, then renamed over it.
        await copyFileAtomic(item.backupPath, item.targetFile);
        if (plan.source === 'journal') usedBackups.push(item.backupPath);
        results.push({ ...item, restored: true, ...(keptCopy ? { keptCopy } : {}) });
      } else if (item.action === 'remove') {
        await fs.rm(item.targetFile, { force: true });
        if (!plan.createdDirectories && plan.source === 'journal') await removeEmptyParents(plan.targetPath, item.targetFile);
        results.push({ ...item, removed: true });
      } else if (item.action === 'untouched') {
        // The backup an interrupted run took of a file it never wrote.
        if (item.backupPath) usedBackups.push(item.backupPath);
        results.push({ ...item });
      } else {
        results.push({ ...item });
      }
    }

    if (plan.source === 'journal') {
      if (plan.stateWritten) {
        if (plan.stateEdited) {
          const stamp = await freeBackupStamp([statePath], beforeRollbackSuffix);
          stateCopy = `${statePath}.workflow-kit-backup-${stamp}${beforeRollbackSuffix}`;
          await fs.copyFile(statePath, stateCopy, fs.constants.COPYFILE_EXCL);
        }
        if (plan.previousInstallState === null) await fs.rm(statePath, { force: true });
        else await writeFileAtomic(statePath, plan.previousInstallState);
      }
      for (const backup of usedBackups) await fs.rm(backup, { force: true });
      // The folders the run created, before the journal goes: a rollback
      // killed after this still finds its journal and finishes.
      if (plan.createdDirectories) await removeCreatedDirectories(plan.targetPath, plan.createdDirectories);
      await fs.rm(journalPath, { force: true });
    }
  } finally {
    await release();
  }
  // The journal's own folders, now that the lock is gone too.
  if (plan.source === 'journal') {
    if (plan.createdDirectories) await removeCreatedDirectories(plan.targetPath, plan.createdDirectories);
    else await removeEmptyParents(plan.targetPath, journalPath);
  }
  if (stateCopy) results.push({ relativePath: installStateRelativePath, targetFile: statePath, action: 'state_copy', keptCopy: stateCopy });

  return results;
}

// Without a journal: the content a restore replaces is kept first as a
// -before-rollback copy. Returns its path, or null when the file is gone.
async function keepCurrentContent(item, stamp) {
  if (await readBufferIfPresent(item.targetFile) === null) return null;
  const copyPath = `${item.targetFile}.workflow-kit-backup-${stamp}${beforeRollbackSuffix}`;
  await fs.copyFile(item.targetFile, copyPath, fs.constants.COPYFILE_EXCL);
  return copyPath;
}

async function markRollbackStarted(journalPath) {
  const journal = JSON.parse(await fs.readFile(journalPath, 'utf8'));
  if (typeof journal.rollbackStartedAt === 'string') return;
  journal.rollbackStartedAt = new Date().toISOString();
  await writeFileAtomic(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
}

async function readBufferIfPresent(file) {
  try {
    return await readFileNamed(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function summarizeRollback(results) {
  // Files a finished apply created and someone removed by hand: counted
  // apart (and only when there are any), never as "kept (edited)".
  const alreadyGone = results.filter((item) => item.createdGone).length;
  return {
    restored: results.filter((item) => item.restored).length,
    removed: results.filter((item) => item.removed).length,
    keptModified: results.filter((item) => item.action === 'keep_modified' && !item.createdGone).length,
    withoutBackup: results.filter((item) => item.action === 'no_backup').length,
    ...(alreadyGone > 0 ? { alreadyGone } : {})
  };
}

export function formatRollbackPlan(plan) {
  const header = `Target: ${plan.targetPath}`;
  const removedByHand = plan.operations.filter((item) => item.createdGone).length;
  const listed = plan.operations.filter((item) => item.action !== 'untouched' && !item.createdGone);
  // A journal always has something to undo: at least the journal itself and,
  // when the run wrote it, install-state.
  if (plan.source === 'leftovers') {
    const removals = [`remove ${applyLockRelativePath} (the lock the stopped run left)`, ...plan.temporaryFiles.map((file) => `remove ${file} (temporary file of the stopped run)`), ...plan.removedFolders.map((folder) => `remove folder ${folder} (created by the stopped run, empty)`)];
    return [`${header}`, `A workflow-kit ${plan.stoppedRun} that started ${plan.stoppedAt} was stopped before it finished${plan.stoppedRun === 'apply' ? ' and before it wrote its record' : ''}. This rollback removes only what it left behind (nothing else changes; folders that hold anything stay) and does not undo any apply.${plan.previousJournal ? ' The record of the last finished apply is not touched: run rollback again after this one to undo that apply.' : plan.olderBackups > 0 ? ` No record of an applied run is left, so a second rollback has nothing to undo. ${plan.olderBackups} backup file(s) of earlier runs stay next to managed files; ${code(kitCommand(plan.targetPath, 'rollback', '--from-backups'))} (a dry run) lists them.` : ' Nothing else is left to roll back.'}${plan.fromBackupsDeferred ? ' --from-backups was not applied: this run only cleans up. Run the same command again to restore the backups.' : ''}`, ...removals].join('\n');
  }
  if (plan.source === 'backups' && (plan.availableBackups?.length ?? 0) > 0) {
    const backups = plan.availableBackups.map((item) => `- ${item.relativePath} <- ${path.basename(item.backupPath)} (backup taken ${stampAsDate(item.backupStamp)})`);
    return [header, `No apply journal found, so there is no applied run to undo. Nothing is restored. ${backups.length} backup file(s) of earlier runs sit next to managed files:`, ...backups, `They may come from a run older than the one you mean to undo (for example the original init). If a rollback already succeeded here, the project is back in its previous state and there is nothing more to do. Restoring them takes each file back to an older copy: an adapter may lose the kit block or go back to an older one, which ${code(kitCommand(plan.targetPath, 'update'))} can put back with --edited <path>=split. To restore the newest backup of each file anyway, run ${code(kitCommand(plan.targetPath, 'rollback', '--from-backups'))} (a dry run; then add --apply --yes).`].join('\n');
  }
  if (plan.source === 'backups' && listed.length === 0 && (plan.matchingBackups ?? 0) > 0) {
    return `${header}\nNothing to restore: ${plan.matchingBackups} backup file(s) of earlier runs sit next to managed files, and each managed file already has the content of its newest backup. No apply journal is there either, so there is no applied run to undo. To see the state of the kit, run ${code(kitCommand(plan.targetPath, 'doctor'))}.`;
  }
  if (plan.source !== 'journal' && listed.length === 0) {
    const checked = plan.checkedFiles === undefined ? 'the managed paths' : `the ${plan.checkedFiles} managed file(s) install-state lists`;
    return `${header}\nNo applied run or workflow-kit backup files found for managed paths. Nothing to roll back. Checked: ${applyJournalRelativePath} (the record of the last apply) is not there, and no *.workflow-kit-backup-* file sits next to ${checked}. To see the state of the kit, run ${code(kitCommand(plan.targetPath, 'doctor'))}; to bring the kit files to this version, run ${code(kitCommand(plan.targetPath, 'update'))} (dry run first).`;
  }

  const lines = listed.map((item) => {
    if (item.action === 'restore') return `restore ${item.relativePath} <- ${path.basename(item.backupPath)}${item.deleted ? ' (deleted by the last apply)' : ''}${item.keepsCopy ? ` (its current content is kept first as a ${beforeRollbackSuffix} copy)` : ''}`;
    if (item.action === 'remove') return `remove ${item.relativePath} (created by the last apply)`;
    if (item.action === 'keep_modified') return `keep ${item.relativePath} (${item.deleted ? 'recreated' : item.gone ? 'removed' : 'edited'} after the last apply; not touched${item.gone && item.keptBackup ? `; its backup ${path.basename(item.keptBackup)} stays` : ''})`;
    return `cannot restore ${item.relativePath} (${item.reason})`;
  });
  if (removedByHand > 0) lines.push(`${removedByHand} file(s) the last apply created were removed after it; nothing to remove for them.`);
  const untouched = plan.operations.filter((item) => item.action === 'untouched').length;
  if (untouched > 0) lines.push(`${untouched} file(s) the last apply did not change stay as they are${plan.operations.some((item) => item.action === 'untouched' && item.backupPath) ? '; the backups it took of them are removed' : ''}.`);
  let scope;
  if (plan.source === 'journal') {
    const state = plan.stateWritten
      ? `install-state returns to its previous content${plan.stateEdited ? ` (it was edited after that run, so its current content is kept first as a ${beforeRollbackSuffix} copy)` : ''}`
      : 'install-state stays as it is (the apply did not write it)';
    // Which run, named plainly: undoing an init removes what it installed.
    const command = plan.mode === 'init' ? '`init`' : plan.mode === 'update' ? '`update`' : 'apply';
    const run = `the last ${command} (applied ${plan.appliedAt ?? 'at an unknown date'}${plan.toolkitVersion ? ` by workflow-kit ${plan.toolkitVersion}` : ''}${plan.completed ? '' : ', which did not finish'})`;
    const initNote = plan.mode === 'init' ? ' That run is the install itself: rolling it back removes the files it installed.' : '';
    scope = `${plan.rollbackStartedAt ? `Finishes the rollback started ${plan.rollbackStartedAt}, which did not finish. ` : ''}Undoes ${run}; ${state}${listed.length === 0 ? '; no file needs restoring or removing' : ''}. The record of that apply is removed.${initNote}`;
  } else {
    scope = `--from-backups: restoring the newest backup of each managed file (no apply journal found, so these may come from a run older than the last one); the current content of each file it replaces is kept first as a ${beforeRollbackSuffix} copy. Created and moved files and install-state stay as they are. The kit stays installed: a restored adapter (such as CLAUDE.md) or .gitignore loses the kit block or lines the install added, and ${code(kitCommand(plan.targetPath, 'doctor'))} reports that until ${code(kitCommand(plan.targetPath, 'update'))} puts them back (for an adapter, with --edited <path>=split, which keeps your text). To return to this kit version, run ${code(kitCommand(plan.targetPath, 'update'))} (dry run first) and decide each pending file with --edited; \`--edited all=discard\` would also drop every kept edit and the own text of adapters (left in backups).`;
  }
  return [header, scope, ...lines].join('\n');
}

async function findLatestBackup(targetFile) {
  const dir = path.dirname(targetFile);
  const baseName = path.basename(targetFile);

  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }

  const backups = entries
    .filter((entry) => entry.startsWith(`${baseName}.workflow-kit-backup-`))
    .map((entry) => {
      const match = entry.slice(baseName.length).match(backupSuffixPattern);
      return match ? { backupPath: path.join(dir, entry), backupStamp: match[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.backupStamp.localeCompare(a.backupStamp));

  return backups[0] ?? null;
}
