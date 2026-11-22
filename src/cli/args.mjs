import { editedDecisions } from '../planner.mjs';

export function printHelp() {
  return `Usage:\n  workflow-kit init [--target <path>] [--dry-run] [--apply --yes] [--runtime <list>] [--profile <runtime>=<calidad|equilibrado|costo>,...] [--stack none|rails-react] [--diff] [--backup-mode required|none]\n  workflow-kit update [--target <path>] [--dry-run] [--apply --yes] [--runtime <list>] [--profile <runtime>=<calidad|equilibrado|costo>,...] [--stack none|rails-react] [--diff] [--adopt-existing] [--backup-mode required|none] [--edited <path>=<decision>]... [--edited all=<decision>]\n  workflow-kit upgrade [--ref <git-ref>] [--package-manager bun] [--dry-run] [--apply --yes]\n  workflow-kit export [--output <path>] [--dry-run] [--apply --yes] [--runtime <list>] [--backup-mode required|none]\n  workflow-kit doctor [--target <path>] [--runtime <list>]\n  workflow-kit rollback [--target <path>] [--dry-run] [--apply --yes]\n  workflow-kit tui\n  workflow-kit --help | --version\n\nCommands:\n  init      Install the workflow into a project\n  update    Update the workflow installed in a project to this workflow-kit version\n  upgrade   Update workflow-kit itself (this tool) on this machine; projects are not changed\n  export    Write the workflow files into a folder without touching any project\n  doctor    Check the workflow installed in a project (read-only)\n  rollback  Undo the last init or update applied to a project\n  tui       Guided menu for all of the above\n\nWithout --apply --yes every command is a dry run and writes nothing.\nupdate --edited decides on a file the dry run lists as pending (repeat the flag per file, or use all=):\nkeep leaves it as it is, discard takes the kit version, shadow moves the edit to a project shadow (only while\nmigrating from install-state 1.0.0), split keeps the own lines of an adapter without markers below the new block.\n`;
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
  '--stack': 'stack'
};

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
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const takeValue = () => {
      const value = rest[index + 1];
      // A flag name where a value belongs means the value was forgotten; using
      // it would, for example, install into the current directory by accident.
      if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };
    if (Object.hasOwn(valueFlags, arg)) options[valueFlags[arg]] = takeValue();
    else if (arg === '--edited') parseEdited(takeValue(), (options.edited ??= {}));
    else if (arg === '--diff') options.diff = true;
    else if (arg === '--dry-run') explicitDryRun = true;
    else if (arg === '--apply') { options.apply = true; options.dryRun = false; }
    else if (arg === '--yes') options.yes = true;
    else if (arg === '--adopt-existing') options.adoptExisting = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (explicitDryRun && options.apply) {
    throw new Error('Use either --dry-run or --apply, not both. Nothing was written.');
  }

  return options;
}
