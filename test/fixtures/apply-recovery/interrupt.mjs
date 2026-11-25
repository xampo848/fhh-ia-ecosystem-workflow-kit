// Preload (`node --import`) for test/apply-recovery.test.mjs: it makes a real
// CLI process stop in the middle of an apply. Set
// WORKFLOW_KIT_TEST_INTERRUPT_AFTER=<n> and WORKFLOW_KIT_TEST_INTERRUPT_SIGNAL
// (SIGINT, SIGTERM or SIGKILL): once the apply has renamed <n> files into
// place (the journal not counted), the process sends that signal to itself.
// WORKFLOW_KIT_TEST_COPY_DELAY=<ms> slows every copy (a backup), so a second
// run can start while the first one is still writing.
//
// Without those variables (as `node --test` loads every file under test/) it
// changes nothing.
import fs from 'node:fs/promises';

const after = Number(process.env.WORKFLOW_KIT_TEST_INTERRUPT_AFTER ?? 0);
const signal = process.env.WORKFLOW_KIT_TEST_INTERRUPT_SIGNAL;
const copyDelay = Number(process.env.WORKFLOW_KIT_TEST_COPY_DELAY ?? 0);
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

if (after > 0 && signal) {
  const rename = fs.rename;
  let renamed = 0;
  fs.rename = async (from, to) => {
    const result = await rename(from, to);
    if (!String(to).endsWith('last-apply.json')) {
      renamed += 1;
      if (renamed === after) {
        process.kill(process.pid, signal);
        // Lets a signal handler run before the apply goes on.
        await pause(200);
      }
    }
    return result;
  };
}

if (copyDelay > 0) {
  const copyFile = fs.copyFile;
  fs.copyFile = async (...args) => {
    await pause(copyDelay);
    return copyFile(...args);
  };
}
