import fs from 'node:fs/promises';
import path from 'node:path';
import { applyInstallPlan, applyJournalRelativePath, interruptedCode } from '../apply.mjs';
import { formatDoctorResult, runDoctor } from '../doctor.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan } from '../planner.mjs';
import { describeEnvironmentError } from '../fs-safety.mjs';
import { code, formatPluginInstallSteps, kitCommand, rollbackCommand } from '../plugin-mode.mjs';
import { renderPlanDiffs } from '../plan-insight.mjs';
import { applyRollbackPlan, buildRollbackPlan, formatRollbackPlan, summarizeRollback } from '../rollback.mjs';
import { runTui } from '../tui.mjs';
import { buildUpgradePlan, commandExists, formatUpgradePlan, normalizePackageManager, resolveUpgradePackageManager, runUpgradePlan } from '../upgrade.mjs';
import packageJson from '../../package.json' with { type: 'json' };
import { yesGuardMessage } from './guards.mjs';
import { formatExportApplySummary, formatInitApplySummary, formatPlanNotices, formatUpdateApplySummary } from './summaries.mjs';

// Ctrl-C or SIGTERM during an apply or a rollback stops it between two files
// instead of in the middle of one; the journal already lists the run, so
// rollback undoes it (or, for a rollback, finishes it). A second signal ends
// the process at once (the journal still covers it). The exit code follows
// the signal: 130 for SIGINT, 143 for SIGTERM. Returns that code, or the
// result.
const signalExitCodes = { SIGINT: 130, SIGTERM: 143 };

// A file-system problem during an apply or a rollback (a read-only folder, a
// file nobody may write) names the path and what to do, and says what state
// the run left: the journal tells whether it wrote anything.
async function explainApplyFailure(error, targetPath, { rollback }) {
  const description = describeEnvironmentError(error, targetPath);
  if (description === null) return error;
  let journal = null;
  try {
    journal = JSON.parse(await fs.readFile(path.join(path.resolve(targetPath), applyJournalRelativePath), 'utf8'));
  } catch {
    // No journal, or none that can be read: the run did not get to write one.
  }
  const unfinished = journal !== null && typeof journal === 'object' && (journal.completed === false || typeof journal.rollbackStartedAt === 'string');
  let next;
  if (rollback) {
    next = unfinished
      ? `The rollback stopped partway and its record stays: fix that, then run ${rollbackCommand(targetPath)} again to finish it.`
      : `Fix that, then run ${code(kitCommand(targetPath, 'rollback'))} (a dry run) to see what is left to roll back, and ${rollbackCommand(targetPath)} to do it.`;
  } else if (unfinished) {
    next = `The run stopped partway and its record says it did not finish: run ${rollbackCommand(targetPath)} to undo what it wrote, fix that, then run this command again.`;
  } else {
    next = 'The run stopped before it changed any file of the kit, so there is nothing to roll back. Fix that, then run this command again.';
  }
  return Object.assign(new Error(`${description}. ${next}`), { code: error.code, cause: error });
}

async function applyWithInterrupts(apply, stderr, { targetPath, rollback = false } = {}) {
  const controller = new AbortController();
  let received = null;
  const onSignal = (signal) => {
    if (controller.signal.aborted) process.exit(signalExitCodes[signal]);
    received = signal;
    stderr.write(`\nStopping after the file being written (${signal}). ${signal === 'SIGINT' ? 'Press Ctrl-C again' : 'Send SIGTERM again'} to stop at once.\n`);
    controller.abort();
  };
  const signals = Object.keys(signalExitCodes);
  for (const signal of signals) process.on(signal, onSignal);
  try {
    return { result: await apply(controller.signal) };
  } catch (error) {
    if (error.code !== interruptedCode) throw targetPath === undefined ? error : await explainApplyFailure(error, targetPath, { rollback });
    stderr.write(`${error.message}\n`);
    return { code: signalExitCodes[received] ?? signalExitCodes.SIGINT };
  } finally {
    for (const signal of signals) process.off(signal, onSignal);
  }
}

// A project-scoped plugin install runs inside the repository: the printed
// step goes there first, so it works from any folder as printed.
const pluginInstallStepsIn = (plan) => formatPluginInstallSteps(plan.runtimes, plan.targetPath);

export async function runInitCommand(options, { stdout, stderr }) {
  const guardMessage = yesGuardMessage(options, 'apply');
  if (guardMessage) {
    stderr.write(guardMessage);
    return 2;
  }

  // options.mode (repo by default, or plugin) reaches the planner as given.
  const plan = await buildInstallPlan({ ...options, mode: options.mode ?? 'repo', toolkitVersion: packageJson.version });
  stdout.write(`${options.apply ? 'Apply plan' : 'Dry-run plan'}\n${summarizedPlan(formatPlan(plan), options)}\n`);
  if (options.diff) stdout.write(`\nDiff of files that would change:\n${await renderPlanDiffs(plan)}\n`);

  if (!options.apply) return 0;

  const { result: applied, code } = await applyWithInterrupts((signal) => applyInstallPlan(plan, { signal }), stderr, { targetPath: plan.targetPath });
  if (code !== undefined) return code;
  stdout.write(formatInitApplySummary(applied) + formatPlanNotices(plan));
  if (plan.nextInstallState.mode === 'plugin') stdout.write(pluginInstallStepsIn(plan));
  return 0;
}

export async function runUpdateCommand(options, { stdout, stderr }) {
  const guardMessage = yesGuardMessage(options, 'apply update');
  if (guardMessage) {
    stderr.write(guardMessage);
    return 2;
  }

  // options.mode (when given) reaches the planner, which resolves it against
  // the recorded mode.
  const plan = await buildUpdatePlan({ ...options, toolkitVersion: packageJson.version });
  stdout.write(`${options.apply ? 'Update apply plan' : 'Update dry-run plan'}\n${summarizedPlan(formatPlan(plan), options)}\n`);
  if (options.diff) stdout.write(`\nDiff of files that would change:\n${await renderPlanDiffs(plan)}\n`);

  if (!options.apply) return 0;

  const { result: applied, code } = await applyWithInterrupts((signal) => applyInstallPlan(plan, { signal }), stderr, { targetPath: plan.targetPath });
  if (code !== undefined) return code;
  stdout.write(formatUpdateApplySummary(applied) + formatPlanNotices(plan));
  if (plan.nextInstallState.mode === 'plugin') stdout.write(pluginInstallStepsIn(plan));
  return 0;
}

export async function runUpgradeCommand(options, { stdout, stderr }) {
  const guardMessage = yesGuardMessage(options, 'apply workflow-kit upgrade');
  if (guardMessage) {
    stderr.write(guardMessage);
    return 2;
  }

  // A value that is not a supported manager stops in a dry run too: it is a
  // wrong flag, not a missing install.
  if (options.packageManager !== undefined) normalizePackageManager(options.packageManager);

  // A dry run executes nothing, so a missing package manager is only a note.
  let packageManager;
  let missingManager = null;
  try {
    packageManager = await resolveUpgradePackageManager(options.packageManager, commandExists);
  } catch (error) {
    if (options.apply) throw error;
    missingManager = error.message;
  }
  const plan = buildUpgradePlan({ ...options, packageManager });
  stdout.write(`${options.apply ? 'workflow-kit upgrade apply plan' : 'workflow-kit upgrade dry-run plan'}\n${formatUpgradePlan(plan)}\n`);
  if (missingManager) stdout.write(`Note: ${missingManager} Install it before running this command with --apply --yes.\n`);

  if (!options.apply) return 0;

  const result = await runUpgradePlan(plan, { stdout, stderr });
  if (!result.ok) {
    stderr.write(`workflow-kit upgrade failed${result.code === null ? '' : ` with exit code ${result.code}`}.\n`);
    return 2;
  }

  stdout.write(`workflow-kit upgraded from ${plan.spec}.\n`);
  stdout.write('Next step: in each repository, run `workflow-kit update --target <repo>` (dry run), then the same command with --apply --yes.\n');
  return 0;
}

export async function runExportCommand(options, { stdout, stderr }) {
  if (options.outputPath) options.targetPath = options.outputPath;
  if (!options.targetPath) {
    stderr.write('Export requires --output <path>.\n');
    return 2;
  }

  const guardMessage = yesGuardMessage(options, 'export');
  if (guardMessage) {
    stderr.write(guardMessage);
    return 2;
  }

  const plan = await buildInstallPlan({ ...options, export: true, ensureWorkspaceIgnore: false, recordJournal: false, toolkitVersion: packageJson.version });
  stdout.write(`${options.apply ? 'Export apply plan' : 'Export dry-run plan'}\n${summarizedPlan(formatPlan(plan), options)}\n`);

  if (!options.apply) return 0;

  const { result: applied, code } = await applyWithInterrupts((signal) => applyInstallPlan(plan, { signal }), stderr, { targetPath: plan.targetPath });
  if (code !== undefined) return code;
  stdout.write(formatExportApplySummary(applied));
  return 0;
}

// A plan lists hundreds of files that need no attention (created as they
// ship, or unchanged). Each such kind is one line with its count unless --all
// asks for every file; a line that carries a note or a decision is always
// listed, and so is every project file the plan leaves alone.
const quietLines = [
  { prefix: '- create: ', note: '', summary: (count) => `- create: ${count} file(s) (add --all to list them)` },
  { prefix: '- unchanged: ', note: '', summary: (count) => `- unchanged: ${count} file(s) (add --all to list them)` }
];
const quietThreshold = 3;
function summarizedPlan(text, options) {
  if (options.all) return text;
  const kindOf = (line) => quietLines.find((kind) => line.startsWith(kind.prefix) && !line.slice(kind.prefix.length).includes(' '));
  const lines = text.split('\n');
  const counts = new Map();
  for (const line of lines) {
    const kind = kindOf(line);
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const written = new Set();
  const out = [];
  for (const line of lines) {
    const kind = kindOf(line);
    if (!kind || counts.get(kind) <= quietThreshold) {
      out.push(line);
    } else if (!written.has(kind)) {
      written.add(kind);
      out.push(kind.summary(counts.get(kind)));
    }
  }
  return out.join('\n');
}

export async function runDoctorCommand(options, { stdout }) {
  const result = await runDoctor(options);
  stdout.write(`${formatDoctorResult(result)}\n`);
  return result.ok ? 0 : 1;
}

export async function runRollbackCommand(options, { stdout, stderr }) {
  const guardMessage = yesGuardMessage(options, 'apply rollback');
  if (guardMessage) {
    stderr.write(guardMessage);
    return 2;
  }

  const plan = await buildRollbackPlan(options);
  stdout.write(`${options.apply ? 'Rollback apply plan' : 'Rollback dry-run plan'}\n${formatRollbackPlan(plan)}\n`);
  // One fixed last line, so a script never has to read the prose above.
  const outcome = rollbackOutcome(plan);
  const result = (line) => stdout.write(`Result: ${line}\n`);

  // A journal is always applied, even with no file left to restore: the
  // previous state comes back and the record of the unfinished run goes, so
  // the next update is not stopped by it again.
  if (!options.apply) {
    result(`dry-run (would be: ${outcome})`);
    return 0;
  }
  if (plan.operations.length === 0 && plan.source === 'backups') {
    // Asked to apply, and backups that could be restored were left alone:
    // a script must be able to tell this from "there was nothing to undo".
    if (outcome !== 'backups-not-restored') {
      result(outcome);
      return 0;
    }
    stderr.write('Exit code 3: backups exist and none was restored. Add --from-backups to restore them.\n');
    result(outcome);
    return 3;
  }

  // A rollback that stops partway still says so on its last line.
  let applied;
  try {
    applied = await applyWithInterrupts((signal) => applyRollbackPlan(plan, { signal }), stderr, { targetPath: plan.targetPath, rollback: true });
  } catch (error) {
    result('failed');
    throw error;
  }
  const { result: results, code } = applied;
  if (code !== undefined) {
    result('interrupted');
    return code;
  }
  const summary = summarizeRollback(results);
  stdout.write(`Restored files: ${summary.restored}\nRemoved created files: ${summary.removed}\nKept (edited after the apply): ${summary.keptModified}\nNot restorable (no backup): ${summary.withoutBackup}\n${summary.alreadyGone > 0 ? `Already removed by hand: ${summary.alreadyGone}\n` : ''}`);
  const copies = results.filter((item) => item.keptCopy).map((item) => path.relative(plan.targetPath, item.keptCopy).split(path.sep).join('/'));
  if (copies.length > 0) stdout.write(`Copies of the replaced content (${copies.length}):\n${copies.map((copy) => `- ${copy}`).join('\n')}\n`);
  result(outcome);
  return 0;
}

// What a rollback plan amounts to, as one word for the Result line.
function rollbackOutcome(plan) {
  if (plan.source === 'leftovers') return 'cleaned-up';
  if (plan.source === 'journal') return 'rolled-back';
  if (plan.operations.length > 0) return 'restored-from-backups';
  return (plan.availableBackups?.length ?? 0) > 0 ? 'backups-not-restored' : 'nothing-to-undo';
}

export async function runTuiCommand(_options, { stdout }) {
  const result = await runTui({ write: (message) => stdout.write(message) });
  return result.code;
}

export const commandHandlers = {
  init: runInitCommand,
  update: runUpdateCommand,
  upgrade: runUpgradeCommand,
  export: runExportCommand,
  doctor: runDoctorCommand,
  rollback: runRollbackCommand,
  tui: runTuiCommand
};
