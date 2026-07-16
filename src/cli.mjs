import { parseArgs, printHelp } from './cli/args.mjs';
import { commandHandlers } from './cli/commands.mjs';

export { parseArgs };

export async function runCli(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const options = parseArgs(argv);

  if (options.help || !options.command) {
    stdout.write(`${printHelp()}\n`);
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
