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

function createPainter(enabled = true) {
  if (!enabled) {
    return {
      bold: (value) => value,
      dim: (value) => value,
      cyan: (value) => value,
      magenta: (value) => value,
      green: (value) => value,
      yellow: (value) => value,
      red: (value) => value
    };
  }

  const wrap = (code, value) => `\u001b[${code}m${value}\u001b[0m`;
  return {
    bold: (value) => wrap(1, value),
    dim: (value) => wrap(2, value),
    cyan: (value) => wrap(36, value),
    magenta: (value) => wrap(35, value),
    green: (value) => wrap(32, value),
    yellow: (value) => wrap(33, value),
    red: (value) => wrap(31, value)
  };
}

function renderBanner(write, paint) {
  const logo = [
    'FFFFFFFF HH   HH HH   HH',
    'FF       HH   HH HH   HH',
    'FFFFF    HHHHHHH HHHHHHH',
    'FF       HH   HH HH   HH',
    'FF       HH   HH HH   HH'
  ].join('\n');

  write(`${paint.cyan(logo)}\n`);
  write(`${paint.bold(paint.magenta('FHH workflow'))}\n`);
  write(`${paint.dim('Dry-run first. No files are written unless you confirm explicitly.')}\n\n`);
}

async function selectOption({ ask, write, paint, title, options, defaultIndex = 0 }) {
  write(`${paint.bold(title)}\n`);
  options.forEach((option, index) => {
    const defaultMark = index === defaultIndex ? paint.dim(' (default)') : '';
    write(`  ${index + 1}) ${option.label}${defaultMark}\n`);
    if (option.description) write(`     ${paint.dim(option.description)}\n`);
  });

  while (true) {
    const answer = valueOrDefault(await ask(`Choose [${defaultIndex + 1}]: `), String(defaultIndex + 1));
    const numeric = Number.parseInt(answer, 10);

    if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= options.length) {
      write('\n');
      return options[numeric - 1].value;
    }

    const byValue = options.find((option) => option.value === answer.trim());
    if (byValue) {
      write('\n');
      return byValue.value;
    }

    write(`${paint.yellow('Invalid choice. Please select one of the listed options.')}\n`);
  }
}

function renderSummary(write, paint, plan) {
  write(`${paint.bold('Plan summary')}\n`);
  write(`  Target   : ${plan.targetPath}\n`);
  write(`  Runtimes : ${plan.runtimes.join(', ')}\n`);
  write(`  Overlay  : ${plan.overlay}\n`);
  write(`  Create   : ${paint.green(String(plan.summary.create))}\n`);
  write(`  Unchanged: ${paint.cyan(String(plan.summary.unchanged))}\n`);
  write(`  Overwrite: ${paint.yellow(String(plan.summary.overwrite_with_backup))}\n`);

  const previewOps = plan.operations.slice(0, 8);
  if (previewOps.length > 0) {
    write(`${paint.bold('Preview operations')}\n`);
    previewOps.forEach((item) => {
      write(`  - ${item.operation}: ${item.relativePath}\n`);
    });
    if (plan.operations.length > previewOps.length) {
      write(`  ${paint.dim(`... ${plan.operations.length - previewOps.length} more operations`)}\n`);
    }
  }
  write('\n');
}

export async function runTui(options = {}) {
  const write = options.write ?? ((message) => output.write(message));
  const paint = createPainter(options.color !== false);
  let close = async () => {};
  let ask = options.ask;

  if (!ask) {
    const rl = readline.createInterface({ input, output });
    ask = (question) => rl.question(question);
    close = async () => rl.close();
  }

  try {
    renderBanner(write, paint);

    const targetPath = valueOrDefault(await ask('Target path [.]: '), '.');
    write('\n');

    const runtimePreset = await selectOption({
      ask,
      write,
      paint,
      title: 'Select runtimes',
      defaultIndex: 0,
      options: [
        { value: 'neutral', label: 'Neutral core only', description: 'Portable .agents core only.' },
        { value: 'codex', label: 'Codex', description: 'Neutral core + Codex adapter.' },
        { value: 'copilot', label: 'GitHub Copilot', description: 'Neutral core + Copilot adapter.' },
        { value: 'claude', label: 'Claude Code', description: 'Neutral core + Claude adapter.' },
        { value: 'codex,copilot', label: 'Codex + Copilot', description: 'Common mixed setup.' },
        { value: 'codex,copilot,claude', label: 'All adapters', description: 'Install all runtime adapters.' },
        { value: 'custom', label: 'Custom list', description: 'Type your own comma-separated runtime list.' }
      ]
    });

    const runtime = runtimePreset === 'custom'
      ? valueOrDefault(await ask('Custom runtimes [neutral]: '), 'neutral')
      : runtimePreset;

    write('\n');
    const overlay = await selectOption({
      ask,
      write,
      paint,
      title: 'Select overlay',
      defaultIndex: 0,
      options: [
        { value: 'none', label: 'No overlay', description: 'Portable core + adapters only.' },
        { value: 'starter', label: 'Starter overlay', description: 'Minimal local placeholders.' },
        { value: 'all-metrics-full', label: 'All Metrics full overlay', description: 'Complete .agents2-derived overlay.' }
      ]
    });

    const plan = await buildInstallPlan({ targetPath, runtime, overlay });
    renderSummary(write, paint, plan);

    const showFullPreview = await ask('Show full operation list? [no]: ');
    if (isYes(showFullPreview)) {
      write(`\n${paint.bold('Full preview')}\n${formatPlan(plan)}\n\n`);
    }

    const confirmation = await ask(paint.bold('Apply these changes? Type yes to write files [no]: '));
    if (!isYes(confirmation)) {
      write(`${paint.yellow('Aborted. No files were written.')}\n`);
      return { code: 0, applied: false, plan };
    }

    const applied = await applyInstallPlan(plan);
    const writeCount = applied.filter((item) => item.applied).length;
    const backupCount = applied.filter((item) => item.backupPath).length;
    write(`\n${paint.green('Apply completed successfully.')}\n`);
    write(`Applied writes: ${paint.green(String(writeCount))}\n`);
    write(`Backups created: ${paint.yellow(String(backupCount))}\n`);
    return { code: 0, applied: true, plan, appliedOperations: applied };
  } finally {
    await close();
  }
}
