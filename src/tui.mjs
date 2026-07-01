import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { applyInstallPlan } from './apply.mjs';
import { buildInstallPlan, formatPlan } from './planner.mjs';

function valueOrDefault(value, fallback) {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function isYes(value) {
  return ['y', 'yes', 's', 'si', 'sí'].includes(String(value ?? '').trim().toLowerCase());
}

export async function runTui(options = {}) {
  const write = options.write ?? ((message) => output.write(message));
  let close = async () => {};
  let ask = options.ask;

  if (!ask) {
    const rl = readline.createInterface({ input, output });
    ask = (question) => rl.question(question);
    close = async () => rl.close();
  }

  try {
    write('All Metrics Workflow Kit installer\n');
    write('Dry-run preview happens before any write. Default confirmation is no.\n\n');

    const targetPath = valueOrDefault(await ask('Target path [.]: '), '.');
    const runtime = valueOrDefault(await ask('Runtimes (neutral,codex,copilot,claude) [neutral]: '), 'neutral');
    const overlay = valueOrDefault(await ask('Overlay (none|starter) [none]: '), 'none');

    const plan = await buildInstallPlan({ targetPath, runtime, overlay });
    write(`\nPreview\n${formatPlan(plan)}\n\n`);

    const confirmation = await ask('Apply these changes? Type yes to write files [no]: ');
    if (!isYes(confirmation)) {
      write('Aborted. No files were written.\n');
      return { code: 0, applied: false, plan };
    }

    const applied = await applyInstallPlan(plan);
    const writeCount = applied.filter((item) => item.applied).length;
    const backupCount = applied.filter((item) => item.backupPath).length;
    write(`Applied writes: ${writeCount}\nBackups created: ${backupCount}\n`);
    return { code: 0, applied: true, plan, appliedOperations: applied };
  } finally {
    await close();
  }
}
