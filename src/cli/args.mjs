import { editedDecisions } from '../planner.mjs';
import { code, installModes, shellWord } from '../plugin-mode.mjs';
import { pluginRuntimes, supportedRuntimes } from '../runtime-matrix.mjs';

const usageLines = {
  init: 'workflow-kit init [--target <path>] [--dry-run] [--apply --yes] [--mode repo|plugin] [--runtime <list>] [--profile <runtime>=<calidad|equilibrado|costo>,...] [--stack none|rails-react] [--diff] [--backup-mode required|none]',
  update: 'workflow-kit update [--target <path>] [--dry-run] [--apply --yes] [--mode repo|plugin] [--runtime <list>] [--profile <runtime>=<calidad|equilibrado|costo>,...] [--stack none|rails-react] [--diff] [--adopt-existing] [--backup-mode required|none] [--edited <path>=<decision>]... [--edited all=<decision>]',
  upgrade: 'workflow-kit upgrade [--ref <git-ref>] [--package-manager bun] [--dry-run] [--apply --yes]',
  export: 'workflow-kit export --output <path> [--dry-run] [--apply --yes] [--runtime <list>] [--profile <runtime>=<calidad|equilibrado|costo>,...] [--stack none|rails-react] [--backup-mode required|none]',
  doctor: 'workflow-kit doctor [--target <path>] [--runtime <list>]',
  rollback: 'workflow-kit rollback [--target <path>] [--dry-run] [--apply --yes] [--from-backups]',
  tui: 'workflow-kit tui'
};

const commandSummaries = {
  init: 'Install the workflow into a project',
  update: 'Update the workflow installed in a project to this workflow-kit version',
  upgrade: 'Update workflow-kit itself (this tool) on this machine; projects are not changed',
  export: 'Write the workflow files into a folder without touching any project',
  doctor: 'Check the workflow installed in a project (read-only)',
  rollback: 'Undo the last init or update applied to a project',
  tui: 'Guided menu for install, update, export, doctor, upgrade and optional tools'
};

const runtimeNote = `--runtime takes a comma-separated list of: ${[...supportedRuntimes, 'neutral'].join(', ')} (neutral: no runtime adapter).`;
const dryRunNote = 'Without --apply --yes every command is a dry run and writes nothing.';
const editedNote = 'update --edited decides on a file the dry run lists as pending (repeat the flag per file, or use all=):\nkeep leaves it as it is (the next update lists it again), discard takes the kit version, shadow moves the edit to a project shadow (only while\nmigrating from install-state 1.0.0), split keeps the own lines of an adapter without markers below the new block.';
const modeNote = '--mode repo (the default for init) installs the kit files in the project. --mode plugin (runtimes claude, copilot)\ninstalls only the adapters, the project overlay and the plugin declaration: the kit runs as the plugin fhh,\nwhich each person installs once per clone.';

// The notes each command's own --help carries.
const commandNotes = {
  init: [runtimeNote, dryRunNote, modeNote],
  update: [runtimeNote, dryRunNote, editedNote, modeNote],
  upgrade: [dryRunNote],
  export: [runtimeNote, dryRunNote],
  doctor: [runtimeNote, 'doctor only reads: it never writes, so it takes no --apply, --yes or --dry-run.'],
  rollback: [dryRunNote, '--from-backups restores the newest backup of each managed file when there is no record of an applied run (a project installed before 0.17.0, or a removed record). Without it, rollback only lists those backups: they may come from a run older than the one you mean to undo.'],
  tui: ['The menu needs an interactive terminal; in scripts use the other commands.']
};

export function printHelp(command) {
  if (Object.hasOwn(usageLines, command)) {
    return `Usage:\n  ${usageLines[command]}\n\n${command}: ${commandSummaries[command]}.\n\n${commandNotes[command].join('\n')}\n`;
  }
  const commands = Object.entries(commandSummaries).map(([name, summary]) => `  ${name.padEnd(9)} ${summary}`).join('\n');
  return `Usage:\n${Object.values(usageLines).map((line) => `  ${line}`).join('\n')}\n  workflow-kit --help | --version\n  workflow-kit <command> --help\n\nCommands:\n${commands}\n\n${runtimeNote}\n${dryRunNote}\n${editedNote}\n${modeNote}\n`;
}

const valueFlags = {
  '--target': 'targetPath',
  '--output': 'outputPath',
  '--runtime': 'runtime',
  '--overlay': 'overlay',
  '--ref': 'ref',
  '--package-manager': 'packageManager',
  '--backup-mode': 'backupMode',
  '--profile': 'profile',
  '--stack': 'stack',
  '--mode': 'mode'
};

// The flags each command reads. Any other flag is an error, never dropped:
// `init --output <dir>` would otherwise install into the current folder.
// --overlay has one value and stays accepted where it is read (not in --help).
const applyFlags = ['--dry-run', '--apply', '--yes'];
const commandFlags = {
  init: ['--target', '--runtime', '--overlay', '--profile', '--stack', '--mode', '--diff', '--backup-mode', ...applyFlags],
  update: ['--target', '--runtime', '--overlay', '--profile', '--stack', '--mode', '--diff', '--backup-mode', '--adopt-existing', '--edited', ...applyFlags],
  upgrade: ['--ref', '--package-manager', ...applyFlags],
  export: ['--output', '--runtime', '--overlay', '--profile', '--stack', '--backup-mode', ...applyFlags],
  doctor: ['--target', '--runtime', '--overlay'],
  rollback: ['--target', '--from-backups', ...applyFlags],
  tui: []
};

function assertFlagApplies(command, flag) {
  const allowed = commandFlags[command];
  // An unknown command is reported by its own message; --mode has its own.
  if (!allowed || flag === '--mode' || allowed.includes(flag)) return;
  const hint = flag === '--output' && command !== 'export'
    ? ' To choose the project folder, use --target <path>.'
    : flag === '--target' && command === 'export' ? ' export writes into --output <path>.' : '';
  const accepted = allowed.filter((item) => item !== '--overlay');
  throw new Error(`${flag} does not apply to ${command}.${hint} ${command} accepts ${accepted.length > 0 ? accepted.join(', ') : 'no flags'} (see workflow-kit ${command} --help). Nothing was written.`);
}

// --runtime is checked here, so an empty list never falls back to neutral.
function assertRuntimeList(value) {
  const items = value.split(',').map((item) => item.trim());
  const valid = [...supportedRuntimes, 'neutral'];
  if (items.some((item) => item === '')) throw new Error(`Invalid --runtime "${value}": the list has an empty entry. Use a comma-separated list of: ${valid.join(', ')}. Nothing was written.`);
  const unknown = items.filter((item) => !valid.includes(item));
  if (unknown.length > 0) throw new Error(`Unsupported runtime: ${unknown.join(', ')}. Use a comma-separated list of: ${valid.join(', ')}. Nothing was written.`);
}

// A profile only for runtimes the same command line selects (update without
// --runtime checks it against the recorded runtimes, in resolveModelProfiles).
// The values are checked by the planner, after the paths (as in 558e9fb).
function assertProfileRuntimes(profile, runtime, command, mode) {
  // Without --runtime, update uses the recorded runtimes and plugin mode
  // stops on its own ("plugin mode needs --runtime").
  if (runtime === undefined && (command === 'update' || mode === 'plugin')) return;
  const named = profile.split(',').map((token) => token.split('=')[0].trim()).filter(Boolean);
  const selected = String(runtime ?? 'neutral').split(',').map((item) => item.trim());
  const outside = [...new Set(named.filter((item) => !selected.includes(item)))];
  if (outside.length === 0) return;
  const why = runtime === undefined ? `${command} without --runtime installs neutral` : `--runtime is ${runtime}`;
  throw new Error(`--profile names ${outside.join(', ')}, which this ${command} does not install (${why}), so the profile would be ignored. Add the runtime to --runtime or drop it from --profile. Nothing was written.`);
}

// --mode chooses where the kit lives (PRD plugin-mode-pilot 2.4) and only
// init and update install anything.
const modeCommands = ['init', 'update'];

// A shell-ready command line between backticks, so a stop can name the command
// that works.
function commandLine(args) {
  return code(['workflow-kit', ...args].map(shellWord).join(' '));
}

function withoutMode(args) {
  return args.filter((arg, index) => arg !== '--mode' && args[index - 1] !== '--mode');
}

function withoutRuntime(args) {
  return args.filter((arg, index) => arg !== '--runtime' && args[index - 1] !== '--runtime');
}

// A suggestion after a wrong --mode value is a dry run: it never applies.
function asDryRun(args) {
  return args.filter((arg) => arg !== '--apply' && arg !== '--yes');
}

function assertModeOption(command, rest, mode) {
  const valid = `Valid values: ${installModes.join(', ')}; --mode applies only to ${modeCommands.join(' and ')}.`;
  if (command === 'export') {
    throw new Error(`export has no install mode: it writes a copy of the kit into a folder. Run \`workflow-kit export --output <path>\` without --mode. Nothing was written.`);
  }
  if (!modeCommands.includes(command)) {
    throw new Error(`--mode does not apply to ${command}. ${valid} Run ${commandLine([command, ...withoutMode(rest)])} without it. Nothing was written.`);
  }
  // A wrong value never picks a mode for the user: update keeps the mode the
  // install records, and init names each mode the requested runtimes allow.
  // Every named command must run: a runtime without a plugin rules plugin mode
  // out for init (T3) and, on a plugin install, stops update (T14), so update
  // is named without --runtime (the recorded runtimes).
  if (!installModes.includes(mode)) {
    const runtimeAt = rest.indexOf('--runtime');
    const runtimes = runtimeAt >= 0 ? String(rest[runtimeAt + 1] ?? '').split(',').map((item) => item.trim()).filter(Boolean) : [];
    const allHavePlugin = runtimes.length > 0 && runtimes.every((runtime) => pluginRuntimes.includes(runtime));
    const base = asDryRun(withoutMode(rest));
    const updateArgs = runtimeAt >= 0 && !allHavePlugin ? withoutRuntime(base) : base;
    const next = command === 'update'
      ? `Without --mode, update keeps the mode${updateArgs === base ? '' : ' and the runtimes'} this install records; see its plan with ${commandLine([command, ...updateArgs])}.`
      : `See the plan ${allHavePlugin ? 'of each mode ' : ''}with ${installModes.filter((value) => value !== 'plugin' || allHavePlugin).map((value) => commandLine([command, ...base, '--mode', value])).join(' or ')}.`;
    throw new Error(`Unsupported --mode value "${mode}". ${valid} ${next} Nothing was written.`);
  }
}

// --edited <path>=<decision> or all=<decision>; the planner checks that the
// decision applies to that path.
function parseEdited(value, edited) {
  const separator = value.lastIndexOf('=');
  const relativePath = value.slice(0, separator);
  const decision = value.slice(separator + 1);
  if (separator <= 0 || decision === '') throw new Error(`Invalid --edited ${value}: use --edited <path>=<decision> or --edited all=<decision>.`);
  if (!editedDecisions.includes(decision)) throw new Error(`Invalid --edited ${value}: unknown decision ${decision}. Use one of: ${editedDecisions.join(', ')}.`);
  if (Object.hasOwn(edited, relativePath)) throw new Error(`--edited ${relativePath} is given more than once.`);
  edited[relativePath] = decision;
}

export function parseArgs(argv) {
  const [first, ...rest] = argv;
  // runtime stays undefined unless passed: init/export default to neutral, while
  // update and doctor reuse the runtimes stored in install-state.
  const options = { command: first, dryRun: true, apply: false, yes: false, overlay: 'fhh-ia-ecosystem-full' };

  if (first === '--help' || first === '-h' || first === 'help') {
    return { ...options, command: undefined, help: true };
  }
  if (first === '--version' || first === '-v' || first === 'version') {
    return { ...options, command: undefined, version: true };
  }

  let explicitDryRun = false;
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const takeValue = () => {
      const value = rest[index + 1];
      // A flag name where a value belongs means the value was forgotten; using
      // it would, for example, install into the current directory by accident.
      if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      // An empty value (an unset shell variable) is never a default either.
      if (value.trim() === '') throw new Error(`Empty value for ${arg}: give it a value or leave the flag out. Nothing was written.`);
      index += 1;
      return value;
    };
    const known = Object.hasOwn(valueFlags, arg) || ['--edited', '--diff', '--dry-run', '--apply', '--yes', '--adopt-existing', '--from-backups'].includes(arg);
    if (known) assertFlagApplies(first, arg);
    if (Object.hasOwn(valueFlags, arg)) {
      // A value flag given twice would keep only one of them without a word.
      if (seen.has(arg)) throw new Error(`${arg} is given more than once; give it once. Nothing was written.`);
      seen.add(arg);
      options[valueFlags[arg]] = takeValue();
    } else if (arg === '--edited') parseEdited(takeValue(), (options.edited ??= {}));
    else if (arg === '--diff') options.diff = true;
    else if (arg === '--dry-run') explicitDryRun = true;
    else if (arg === '--apply') { options.apply = true; options.dryRun = false; }
    else if (arg === '--yes') options.yes = true;
    else if (arg === '--adopt-existing') options.adoptExisting = true;
    else if (arg === '--from-backups') options.fromBackups = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.runtime !== undefined) assertRuntimeList(options.runtime);
  if (options.profile !== undefined) assertProfileRuntimes(options.profile, options.runtime, first, options.mode);
  if (options.mode !== undefined) assertModeOption(first, rest, options.mode);

  if (explicitDryRun && options.apply) {
    throw new Error('Use either --dry-run or --apply, not both. Nothing was written.');
  }

  return options;
}
