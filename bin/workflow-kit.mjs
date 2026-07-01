#!/usr/bin/env node
import { runCli } from '../src/cli.mjs';

try {
  const code = await runCli();
  process.exitCode = code;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
