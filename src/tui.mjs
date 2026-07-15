import readline from 'node:readline/promises';
import { input as promptInput, select as promptSelect, confirm as promptConfirm } from '@inquirer/prompts';
import { stdin as input, stdout as output } from 'node:process';
import { applyInstallPlan } from './apply.mjs';
import { buildInstallPlan, formatPlan } from './planner.mjs';

const RUNTIME_OPTIONS = [
  { value: 'neutral', label: 'Neutral core only', description: 'Portable .agents core only.' },
  { value: 'codex', label: 'Codex', description: 'Neutral core + Codex adapter.' },
  { value: 'copilot', label: 'GitHub Copilot', description: 'Neutral core + Copilot adapter.' },
  { value: 'claude', label: 'Claude Code', description: 'Neutral core + Claude adapter.' },
  { value: 'codex,copilot', label: 'Codex + Copilot', description: 'Common mixed setup.' },
  { value: 'codex,copilot,claude', label: 'All adapters', description: 'Install all runtime adapters.' },
  { value: 'custom', label: 'Custom list', description: 'Type your own comma-separated runtime list.' }
];

const OVERLAY_OPTIONS = [
  { value: 'none', label: 'No overlay', description: 'Portable core + adapters only.' },
  { value: 'starter', label: 'Starter overlay', description: 'Minimal local placeholders.' },
  { value: 'all-metrics-full', label: 'All Metrics full overlay', description: 'Complete .agents2-derived overlay.' }
];

function valueOrDefault(value, fallback) {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function isYes(value) {
  return ['y', 'yes', 's', 'si', 'sí'].includes(String(value ?? '').trim().toLowerCase());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function supportsColor() {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(output.isTTY);
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
      red: (value) => value,
      rgb: (_r, _g, _b, value) => value
    };
  }

  const wrap = (code, value) => `\u001b[${code}m${value}\u001b[0m`;
  const wrapRgb = (r, g, b, value) => `\u001b[38;2;${r};${g};${b}m${value}\u001b[0m`;
  return {
    bold: (value) => wrap(1, value),
    dim: (value) => wrap(2, value),
    cyan: (value) => wrap(36, value),
    magenta: (value) => wrap(35, value),
    green: (value) => wrap(32, value),
    yellow: (value) => wrap(33, value),
    red: (value) => wrap(31, value),
    rgb: (r, g, b, value) => wrapRgb(r, g, b, value)
  };
}

function gradientLine(text, paint, startRgb, endRgb) {
  const length = Math.max(1, text.length - 1);
  let out = '';

  for (let index = 0; index < text.length; index += 1) {
    const ratio = index / length;
    const red = Math.round(startRgb[0] + (endRgb[0] - startRgb[0]) * ratio);
    const green = Math.round(startRgb[1] + (endRgb[1] - startRgb[1]) * ratio);
    const blue = Math.round(startRgb[2] + (endRgb[2] - startRgb[2]) * ratio);
    out += paint.rgb(red, green, blue, text[index]);
  }

  return out;
}

async function animateIntro(write, paint, { animate = true } = {}) {
  const logo = [
    'FFFFFFFFF  HH   HH  HH   HH',
    'FF         HH   HH  HH   HH',
    'FFFFFFF    HHHHHHH  HHHHHHH',
    'FF         HH   HH  HH   HH',
    'FF         HH   HH  HH   HH'
  ];

  const palettes = [
    [[52, 152, 219], [155, 89, 182]],
    [[26, 188, 156], [46, 204, 113]],
    [[241, 196, 15], [230, 126, 34]],
    [[231, 76, 60], [192, 57, 43]],
    [[142, 68, 173], [52, 152, 219]]
  ];

  if (animate) {
    for (let index = 0; index < logo.length; index += 1) {
      const [startRgb, endRgb] = palettes[index % palettes.length];
      write(`${gradientLine(logo[index], paint, startRgb, endRgb)}\n`);
      await sleep(70);
    }
  } else {
    logo.forEach((line, index) => {
      const [startRgb, endRgb] = palettes[index % palettes.length];
      write(`${gradientLine(line, paint, startRgb, endRgb)}\n`);
    });
  }

  write(`${paint.bold(paint.magenta('FHH workflow'))}\n`);
  write(`${paint.dim('Modern install assistant: preview first, then apply safely with backups.') }\n`);
  write(`${paint.dim('No files are written unless you explicitly confirm.')}\n\n`);
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

function toInquirerChoices(options) {
  return options.map((option) => ({
    name: option.label,
    value: option.value,
    description: option.description
  }));
}

function renderBox(write, paint, title, rows) {
  const allRows = [title, ...rows];
  const width = Math.max(...allRows.map((line) => line.length)) + 2;
  write(`${paint.cyan(`+${'-'.repeat(width)}+`)}\n`);
  write(`${paint.cyan('|')} ${paint.bold(title.padEnd(width - 1))}${paint.cyan('|')}\n`);
  write(`${paint.cyan(`+${'-'.repeat(width)}+`)}\n`);
  rows.forEach((row) => {
    write(`${paint.cyan('|')} ${row.padEnd(width - 1)}${paint.cyan('|')}\n`);
  });
  write(`${paint.cyan(`+${'-'.repeat(width)}+`)}\n`);
}

async function withSpinner({ write, paint, label, enabled }, action) {
  if (!enabled) return action();

  const frames = ['-', '\\', '|', '/'];
  let index = 0;
  let active = true;
  write(`${paint.dim(`${label} ${frames[0]}`)}`);

  const timer = setInterval(() => {
    index = (index + 1) % frames.length;
    write(`\r${paint.dim(`${label} ${frames[index]}`)}`);
  }, 90);

  try {
    const result = await action();
    active = false;
    clearInterval(timer);
    write(`\r${paint.green(`${label} done`)}\n`);
    return result;
  } catch (error) {
    active = false;
    clearInterval(timer);
    write(`\r${paint.red(`${label} failed`)}\n`);
    throw error;
  } finally {
    if (active) clearInterval(timer);
  }
}

function renderSummary(write, paint, plan) {
  renderBox(write, paint, 'Plan summary', [
    `Target    : ${plan.targetPath}`,
    `Runtimes  : ${plan.runtimes.join(', ')}`,
    `Overlay   : ${plan.overlay}`,
    `Create    : ${plan.summary.create}`,
    `Unchanged : ${plan.summary.unchanged}`,
    `Overwrite : ${plan.summary.overwrite_with_backup}`
  ]);
  write('\n');

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
  const colorEnabled = options.color === false ? false : supportsColor();
  const paint = createPainter(colorEnabled);
  const animate = options.animate ?? !options.ask;
  let close = async () => {};
  let ask = options.ask;
  const scriptedMode = Boolean(options.ask);

  if (!ask) {
    const rl = readline.createInterface({ input, output });
    ask = (question) => rl.question(question);
    close = async () => rl.close();
  }

  try {
    await animateIntro(write, paint, { animate });

    let targetPath;
    let runtime;
    let overlay;

    if (scriptedMode) {
      targetPath = valueOrDefault(await ask('Target path [.]: '), '.');
      write('\n');

      const runtimePreset = await selectOption({
        ask,
        write,
        paint,
        title: 'Select runtimes',
        defaultIndex: 0,
        options: RUNTIME_OPTIONS
      });

      runtime = runtimePreset === 'custom'
        ? valueOrDefault(await ask('Custom runtimes [neutral]: '), 'neutral')
        : runtimePreset;

      write('\n');
      overlay = await selectOption({
        ask,
        write,
        paint,
        title: 'Select overlay',
        defaultIndex: 0,
        options: OVERLAY_OPTIONS
      });
    } else {
      targetPath = valueOrDefault(await promptInput({
        message: 'Target path',
        default: '.'
      }), '.');

      const runtimePreset = await promptSelect({
        message: 'Select runtimes',
        choices: toInquirerChoices(RUNTIME_OPTIONS),
        default: 'neutral'
      });

      runtime = runtimePreset === 'custom'
        ? valueOrDefault(await promptInput({
          message: 'Custom runtimes (comma-separated)',
          default: 'neutral'
        }), 'neutral')
        : runtimePreset;

      overlay = await promptSelect({
        message: 'Select overlay',
        choices: toInquirerChoices(OVERLAY_OPTIONS),
        default: 'none'
      });
    }

    const plan = await withSpinner({
      write,
      paint,
      label: 'Building plan',
      enabled: animate
    }, async () => buildInstallPlan({ targetPath, runtime, overlay }));

    renderSummary(write, paint, plan);

    let showFullPreview = false;
    if (scriptedMode) {
      showFullPreview = isYes(await ask('Show full operation list? [no]: '));
    } else {
      showFullPreview = await promptConfirm({
        message: 'Show full operation list?',
        default: false
      });
    }

    if (showFullPreview) {
      write(`\n${paint.bold('Full preview')}\n${formatPlan(plan)}\n\n`);
    }

    let shouldApply = false;
    if (scriptedMode) {
      shouldApply = isYes(await ask(paint.bold('Apply these changes? Type yes to write files [no]: ')));
    } else {
      shouldApply = await promptConfirm({
        message: 'Apply these changes now?',
        default: false
      });
    }

    if (!shouldApply) {
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
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      write(`\n${paint.yellow('Canceled by user. No files were written.')}\n`);
      return { code: 0, applied: false };
    }
    throw error;
  } finally {
    await close();
  }
}
