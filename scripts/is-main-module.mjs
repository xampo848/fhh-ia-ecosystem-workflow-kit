import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// True when the module at `moduleUrl` is the script Node was asked to run.
// Both sides go through realpath: a script run through a symbolic link (the
// temporary folders on macOS are one) would otherwise skip its main and exit 0
// without doing anything, so a broken validator would pass silently.
export function isMainModule(moduleUrl, invokedPath = process.argv[1]) {
  if (!invokedPath) return false;
  try {
    return realpathSync(invokedPath) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
