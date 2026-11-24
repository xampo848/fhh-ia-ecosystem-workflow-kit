import path from 'node:path';
import { applyInstallPlan } from '../apply.mjs';
import { formatDoctorResult, runDoctor } from '../doctor.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan } from '../planner.mjs';
import { formatPluginInstallSteps } from '../plugin-mode.mjs';
import { renderPlanDiffs } from '../plan-insight.mjs';
import { applyRollbackPlan, buildRollbackPlan, formatRollbackPlan, summarizeRollback } from '../rollback.mjs';
import { runTui } from '../tui.mjs';
import { buildUpgradePlan, commandExists, formatUpgradePlan, resolveUpgradePackageManager, runUpgradePlan } from '../upgrade.mjs';
import packageJson from '../../package.json' with { type: 'json' };
import { yesGuardMessage } from './guards.mjs';
import { formatExportApplySummary, formatInitApplySummary, formatUpdateApplySummary } from './summaries.mjs';

export async function runInitCommand(options, { stdout, stderr }) {
  const guardMessage = yesGuardMessage(options, 'apply');
  if (guardMessage) {
    stderr.write(guardMessage);
    return 2;
  }

  // options.mode (repo by default, or plugin) reaches the planner as given.
  const plan = await buildInstallPlan({ ...options, mode: options.mode ?? 'repo', toolkitVersion: packageJson.version });
  stdout.write(`${options.apply ? 'Apply plan' : 'Dry-run plan'}\n${formatPlan(plan)}\n`);
  if (options.diff) stdout.write(`\nDiff of files that would change:\n${await renderPlanDiffs(plan)}\n`);

  if (!options.apply) return 0;

  const applied = await applyInstallPlan(plan);
  stdout.write(formatInitApplySummary(applied));
  if (plan.nextInstallState.mode === 'plugin') stdout.write(formatPluginInstallSteps(plan.runtimes));
  return 0;
}

export async function runUpdateCommand(options, { stdout, stderr }) {
  const guardMessage = yesGuardMessage(options, 'apply update');
  if (guardMessage) {
    stderr.write(guardMessage);
    return 2;
  }

  const plan = await buildUpdatePlan({ ...options, toolkitVersion: packageJson.version });
  stdout.write(`${options.apply ? 'Update apply plan' : 'Update dry-run plan'}\n${formatPlan(plan)}\n`);
  if (options.diff) stdout.write(`\nDiff of files that would change:\n${await renderPlanDiffs(plan)}\n`);

  if (!options.apply) return 0;

  const applied = await applyInstallPlan(plan);
  stdout.write(formatUpdateApplySummary(applied));
  return 0;
}

export async function runUpgradeCommand(options, { stdout, stderr }) {
  const guardMessage = yesGuardMessage(options, 'apply toolkit upgrade');
  if (guardMessage) {
    stderr.write(guardMessage);
    return 2;
  }

  const packageManager = await resolveUpgradePackageManager(options.packageManager, commandExists);
  const plan = buildUpgradePlan({ ...options, packageManager });
  stdout.write(`${options.apply ? 'Toolkit upgrade apply plan' : 'Toolkit upgrade dry-run plan'}\n${formatUpgradePlan(plan)}\n`);

  if (!options.apply) return 0;

  const result = await runUpgradePlan(plan, { stdout, stderr });
  if (!result.ok) {
    stderr.write(`Toolkit upgrade failed${result.code === null ? '' : ` with exit code ${result.code}`}.\n`);
    return 2;
  }

  stdout.write(`Toolkit upgrade completed from ${plan.spec}.\n`);
  stdout.write('Next step: re-run workflow-kit update --target <repo> --apply --yes with the refreshed toolkit.\n');
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
  stdout.write(`${options.apply ? 'Export apply plan' : 'Export dry-run plan'}\n${formatPlan(plan)}\n`);

  if (!options.apply) return 0;

  const applied = await applyInstallPlan(plan);
  stdout.write(formatExportApplySummary(applied));
  return 0;
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

  if (!options.apply || plan.operations.length === 0) return 0;

  const results = await applyRollbackPlan(plan);
  const summary = summarizeRollback(results);
  stdout.write(`Restored files: ${summary.restored}\nRemoved created files: ${summary.removed}\nKept (edited after the apply): ${summary.keptModified}\nNot restorable (no backup): ${summary.withoutBackup}\n`);
  const copies = results.filter((item) => item.keptCopy).map((item) => path.relative(plan.targetPath, item.keptCopy).split(path.sep).join('/'));
  if (copies.length > 0) stdout.write(`Copies of the replaced content (${copies.length}):\n${copies.map((copy) => `- ${copy}`).join('\n')}\n`);
  return 0;
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
