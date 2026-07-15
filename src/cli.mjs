import { applyInstallPlan } from './apply.mjs';
import { buildInstallPlan, formatPlan } from './planner.mjs';
import { formatDoctorResult, runDoctor } from './doctor.mjs';
import { runTui } from './tui.mjs';

function printHelp() {
  return `Usage:\n  workflow-kit init [--target <path>] [--dry-run] [--apply --yes] [--runtime <list>]\n  workflow-kit doctor [--target <path>] [--runtime <list>]\n  workflow-kit tui\n`;
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, dryRun: true, apply: false, yes: false, runtime: 'neutral', overlay: 'all-metrics-full' };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--target') options.targetPath = rest[++index];
    else if (arg === '--output') options.outputPath = rest[++index];
    else if (arg === '--runtime') options.runtime = rest[++index];
    else if (arg === '--overlay') options.overlay = rest[++index];
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--apply') { options.apply = true; options.dryRun = false; }
    else if (arg === '--yes') options.yes = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

export async function runCli(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const options = parseArgs(argv);

  if (options.help || !options.command) {
    stdout.write(`${printHelp()}\n`);
    return 0;
  }

  if (options.command === 'init') {
    if (options.apply && !options.yes) {
      stderr.write('Refusing to apply without --yes. Run dry-run first, then use --apply --yes.\n');
      return 2;
    }

    const plan = await buildInstallPlan(options);
    stdout.write(`${options.apply ? 'Apply plan' : 'Dry-run plan'}\n${formatPlan(plan)}\n`);

    if (!options.apply) return 0;

    const applied = await applyInstallPlan(plan);
    const writeCount = applied.filter((item) => item.applied).length;
    const backupCount = applied.filter((item) => item.backupPath).length;
    stdout.write(`Applied writes: ${writeCount}\nBackups created: ${backupCount}\n`);
    return 0;
  }

  if (options.command === 'export') {
    if (options.outputPath) options.targetPath = options.outputPath;
    if (!options.targetPath) {
      stderr.write('Export requires --output <path>.\n');
      return 2;
    }
    if (options.apply && !options.yes) {
      stderr.write('Refusing to export without --yes. Run dry-run first, then use --apply --yes.\n');
      return 2;
    }

    const plan = await buildInstallPlan(options);
    stdout.write(`${options.apply ? 'Export apply plan' : 'Export dry-run plan'}\n${formatPlan(plan)}\n`);

    if (!options.apply) return 0;

    const applied = await applyInstallPlan(plan);
    const writeCount = applied.filter((item) => item.applied).length;
    const backupCount = applied.filter((item) => item.backupPath).length;
    stdout.write(`Exported files: ${writeCount}\nBackups created: ${backupCount}\n`);
    return 0;
  }

  if (options.command === 'doctor') {
    const result = await runDoctor(options);
    stdout.write(`${formatDoctorResult(result)}\n`);
    return result.ok ? 0 : 1;
  }

  if (options.command === 'tui') {
    const result = await runTui({ write: (message) => stdout.write(message) });
    return result.code;
  }

  stderr.write(`Unknown command: ${options.command}\n${printHelp()}\n`);
  return 2;
}
