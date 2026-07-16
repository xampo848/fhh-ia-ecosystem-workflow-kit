import { applyInstallPlan } from '../apply.mjs';
import { formatDoctorResult, runDoctor } from '../doctor.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan } from '../planner.mjs';
import { runTui } from '../tui.mjs';
import packageJson from '../../package.json' with { type: 'json' };
import { yesGuardMessage } from './guards.mjs';
import { formatExportApplySummary, formatInitApplySummary, formatUpdateApplySummary } from './summaries.mjs';

export async function runInitCommand(options, { stdout, stderr }) {
  const guardMessage = yesGuardMessage(options, 'apply');
  if (guardMessage) {
    stderr.write(guardMessage);
    return 2;
  }

  const plan = await buildInstallPlan({ ...options, toolkitVersion: packageJson.version });
  stdout.write(`${options.apply ? 'Apply plan' : 'Dry-run plan'}\n${formatPlan(plan)}\n`);

  if (!options.apply) return 0;

  const applied = await applyInstallPlan(plan);
  stdout.write(formatInitApplySummary(applied));
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

  if (!options.apply) return 0;

  const applied = await applyInstallPlan(plan);
  stdout.write(formatUpdateApplySummary(applied));
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

  const plan = await buildInstallPlan({ ...options, toolkitVersion: packageJson.version });
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

export async function runTuiCommand(_options, { stdout }) {
  const result = await runTui({ write: (message) => stdout.write(message) });
  return result.code;
}

export const commandHandlers = {
  init: runInitCommand,
  update: runUpdateCommand,
  export: runExportCommand,
  doctor: runDoctorCommand,
  tui: runTuiCommand
};
