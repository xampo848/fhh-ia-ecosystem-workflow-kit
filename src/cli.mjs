import { parseArgs, printHelp } from './cli/args.mjs';
import { commandHandlers } from './cli/commands.mjs';
import packageJson from '../package.json' with { type: 'json' };

export { parseArgs };

export async function runCli(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    stderr.write(`${error.message}\nRun workflow-kit --help to see the available commands and flags.\n`);
    return 2;
  }

  if (options.version) {
    stdout.write(`${packageJson.version}\n`);
    return 0;
  }

  if (options.help || !options.command) {
    stdout.write(`${printHelp(options.command)}\n`);
    return 0;
  }

  const handler = commandHandlers[options.command];
  if (!handler) {
    stderr.write(`Unknown command: ${options.command}\n${printHelp()}\n`);
    return 2;
  }

  try {
    return await handler(options, { stdout, stderr });
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 2;
  }
}
