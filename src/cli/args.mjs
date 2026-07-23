export function printHelp() {
  return `Usage:\n  workflow-kit init [--target <path>] [--dry-run] [--apply --yes] [--runtime <list>] [--migrate-legacy-docs]\n  workflow-kit update [--target <path>] [--dry-run] [--apply --yes] [--runtime <list>] [--adopt-existing] [--migrate-legacy-docs]\n  workflow-kit upgrade [--ref <git-ref>] [--package-manager bun] [--dry-run] [--apply --yes]\n  workflow-kit export [--output <path>] [--dry-run] [--apply --yes] [--runtime <list>]\n  workflow-kit doctor [--target <path>] [--runtime <list>]\n  workflow-kit tui\n`;
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, dryRun: true, apply: false, yes: false, runtime: 'neutral', overlay: 'fhh-ia-ecosystem-full' };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--target') options.targetPath = rest[++index];
    else if (arg === '--output') options.outputPath = rest[++index];
    else if (arg === '--runtime') options.runtime = rest[++index];
    else if (arg === '--overlay') options.overlay = rest[++index];
    else if (arg === '--ref') options.ref = rest[++index];
    else if (arg === '--package-manager') options.packageManager = rest[++index];
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--apply') { options.apply = true; options.dryRun = false; }
    else if (arg === '--yes') options.yes = true;
    else if (arg === '--adopt-existing') options.adoptExisting = true;
    else if (arg === '--migrate-legacy-docs') options.migrateLegacyDocs = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}
