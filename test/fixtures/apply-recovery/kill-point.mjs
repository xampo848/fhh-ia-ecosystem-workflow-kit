// Preload (`node --import`) for test/killed-run-recovery.test.mjs: SIGKILLs a
// real CLI process at one exact point. WORKFLOW_KIT_TEST_KILL_AT is:
// - `before-journal`: right before the journal is first renamed into place
//   (the apply holds its lock and wrote nothing else);
// - `after-journal-removed`: right after a rollback deleted the journal and
//   before it removes the folders and the lock.
// Without the variable it changes nothing.
import fs from 'node:fs/promises';

const point = process.env.WORKFLOW_KIT_TEST_KILL_AT;
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isJournal = (file) => String(file).endsWith('last-apply.json');

if (point === 'before-journal') {
  const rename = fs.rename;
  fs.rename = async (from, to) => {
    if (isJournal(to)) {
      process.kill(process.pid, 'SIGKILL');
      await pause(1000);
    }
    return rename(from, to);
  };
}

if (point === 'after-journal-removed') {
  const rm = fs.rm;
  fs.rm = async (file, ...rest) => {
    const result = await rm(file, ...rest);
    if (isJournal(file)) {
      process.kill(process.pid, 'SIGKILL');
      await pause(1000);
    }
    return result;
  };
}
