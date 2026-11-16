export function printHelp() {
  return `Usage:\n  workflow-kit init [--target <path>] [--dry-run] [--apply --yes] [--runtime <list>] [--profile <runtime>=<calidad|costo>,...] [--stack none|rails-react] [--diff] [--backup-mode required|none]\n  workflow-kit update [--target <path>] [--dry-run] [--apply --yes] [--runtime <list>] [--profile <runtime>=<calidad|costo>,...] [--stack none|rails-react] [--diff] [--adopt-existing] [--backup-mode required|none]\n  workflow-kit upgrade [--ref <git-ref>] [--package-manager bun] [--dry-run] [--apply --yes]\n  workflow-kit export [--output <path>] [--dry-run] [--apply --yes] [--runtime <list>] [--backup-mode required|none]\n  workflow-kit doctor [--target <path>] [--runtime <list>]\n  workflow-kit rollback [--target <path>] [--dry-run] [--apply --yes]\n  workflow-kit tui\n  workflow-kit --help | --version\n\nWithout --apply --yes every command is a dry run and writes nothing.\n`;
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
    if (Object.hasOwn(valueFlags, arg)) {
      const value = rest[index + 1];
      // A flag name where a value belongs means the value was forgotten; using
      // it would, for example, install into the current directory by accident.
      if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[valueFlags[arg]] = value;
      index += 1;
    }
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
