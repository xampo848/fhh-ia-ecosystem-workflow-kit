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
  { value: 'antigravity', label: 'Antigravity', description: 'Neutral core + Antigravity adapter.' },
  { value: 'codex,copilot', label: 'Codex + Copilot', description: 'Common mixed setup.' },
  { value: 'codex,copilot,claude,antigravity', label: 'All adapters', description: 'Install all runtime adapters.' },
  { value: 'custom', label: 'Custom list', description: 'Type your own comma-separated runtime list.' }
];

const FULL_OVERLAY = 'fhh-ia-ecosystem-full';

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
      blue: (value) => value,
      white: (value) => value,
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
    blue: (value) => wrap(34, value),
    white: (value) => wrap(37, value),
    rgb: (r, g, b, value) => wrapRgb(r, g, b, value)
  };
}

function renderChip(paint, label, tone = 'cyan') {
  const painter = paint[tone] ?? paint.cyan;
  return painter(`[ ${label} ]`);
}

function renderProgressBar(paint, current, total, width = 28) {
  const safeTotal = Math.max(total, 1);
  const ratio = Math.max(0, Math.min(1, current / safeTotal));
  const filled = Math.round(width * ratio);
  const empty = width - filled;
  const bar = `${'='.repeat(filled)}${'-'.repeat(empty)}`;
  return `${paint.cyan(bar)} ${paint.bold(`${current}/${total}`)}`;
}

function renderStageHeader(write, paint, { step, total, title, subtitle }) {
  write(`${renderChip(paint, `STEP ${step}`, 'magenta')} ${paint.bold(title)}\n`);
  write(`${renderProgressBar(paint, step, total)}\n`);
  if (subtitle) write(`${paint.dim(subtitle)}\n`);
  write('\n');
}

const INTRO_PALETTE = {
  cream: [242, 233, 210],
  purple: [135, 117, 222],
  blue: [95, 150, 236],
  slate: [153, 157, 177],
  deep: [49, 72, 121]
};

function introTone(paint, tone, text) {
  const [r, g, b] = INTRO_PALETTE[tone] ?? INTRO_PALETTE.slate;
  return paint.rgb(r, g, b, text);
}

function mixRgb(start, end, ratio) {
  return [
    Math.round(start[0] + (end[0] - start[0]) * ratio),
    Math.round(start[1] + (end[1] - start[1]) * ratio),
    Math.round(start[2] + (end[2] - start[2]) * ratio)
  ];
}

function gradientText(paint, text, start, end) {
  const length = Math.max(1, text.length - 1);
  let out = '';

  for (let index = 0; index < text.length; index += 1) {
    const rgb = mixRgb(start, end, index / length);
    out += paint.rgb(rgb[0], rgb[1], rgb[2], text[index]);
  }

  return out;
}

function renderSweepTitle(paint, title, frame) {
  const sweepCenter = frame % title.length;
  let out = '';

  for (let index = 0; index < title.length; index += 1) {
    const distance = Math.abs(index - sweepCenter);
    const base = mixRgb(INTRO_PALETTE.deep, INTRO_PALETTE.blue, index / Math.max(1, title.length - 1));
    const highlightStrength = Math.max(0, 1 - distance / 8);
    const rgb = mixRgb(base, INTRO_PALETTE.cream, highlightStrength);
    out += paint.rgb(rgb[0], rgb[1], rgb[2], title[index]);
  }

  return out;
}

function renderLogoFrame(paint, frame = 0) {
  const title = 'FHH IA ECOSYSTEM';
  const subtitle = 'ecosystem install presentation';
  const borderChar = frame % 2 === 0 ? '=' : '-';
  const border = gradientText(paint, borderChar.repeat(76), INTRO_PALETTE.purple, INTRO_PALETTE.blue);
  const hero = [
    '            ████████  ██   ██  ██   ██',
    '            ██        ██   ██  ██   ██',
    '            ██████    ███████  ███████',
    '            ██        ██   ██  ██   ██',
    '            ██        ██   ██  ██   ██',
    ' ',
    '      ██   █████       ███████ ██    ██ ███████ ████████ ███████ ███    ███',
    '      ██  ██   ██      ██      ██    ██ ██         ██    ██      ████  ████',
    '      ██  ███████      ███████ ██    ██ ███████    ██    █████   ██ ████ ██',
    '      ██  ██   ██           ██  ██████       ██    ██    ██      ██  ██  ██',
    '      ██  ██   ██      ███████    ███   ███████    ██    ███████ ██      ██'
  ];

  const heroLines = hero.map((line, index) => {
    if (line.trim().length === 0) return line;
    const start = mixRgb(INTRO_PALETTE.purple, INTRO_PALETTE.blue, ((frame + index) % 8) / 8);
    const end = mixRgb(INTRO_PALETTE.blue, INTRO_PALETTE.cream, ((frame * 2 + index) % 10) / 10);
    return gradientText(paint, line, start, end);
  });

  return [
    border,
    `${renderSweepTitle(paint, title, frame * 5)} ${introTone(paint, 'purple', '[live]')}`,
    introTone(paint, 'slate', subtitle),
    '',
    ...heroLines,
    '',
    `${introTone(paint, 'cream', 'flow')} ${introTone(paint, 'blue', 'target -> runtimes -> preview -> apply')}`,
    border
  ];
}

async function animateIntro(write, paint, { animate = true } = {}) {
  if (animate) {
    const revealLines = renderLogoFrame(paint, 0);

    for (let index = 0; index < revealLines.length; index += 1) {
      write(`${paint.dim(revealLines[index])}\n`);
      await sleep(58);
    }

    await sleep(170);
    write(`\u001b[${revealLines.length}A`);

    const cinematicFrames = 10;
    const frameDurations = [130, 110, 100, 95, 95, 100, 110, 130, 160, 210];
    for (let frame = 0; frame < cinematicFrames; frame += 1) {
      const frameLines = renderLogoFrame(paint, frame + 1);
      write(`${frameLines.join('\n')}\n`);
      if (frame < cinematicFrames - 1) {
        write(`\u001b[${frameLines.length}A`);
        await sleep(frameDurations[frame]);
      }
    }
  } else {
    const lines = renderLogoFrame(paint, 1);
    write(`${lines.join('\n')}\n`);
  }

  write(`${paint.bold(introTone(paint, 'purple', 'FHH IA Ecosystem'))} ${paint.dim(':: launch console')}\n`);
  write(`${introTone(paint, 'cream', 'mode:')} ${introTone(paint, 'blue', 'full install')} ${introTone(paint, 'slate', '|')} ${introTone(paint, 'purple', 'preview-first')} ${introTone(paint, 'slate', '|')} ${introTone(paint, 'blue', 'backup-safe')}\n`);
  write(`${paint.dim('High-fidelity install assistant: inspect first, then apply safely with backups.')}\n`);
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

function renderDashboard(write, paint, plan) {
  const totalOps = plan.operations.length;
  const runtimeLabel = plan.runtimes.join(', ');

  renderBox(write, paint, 'Mission control', [
    `Target         : ${plan.targetPath}`,
    `Runtimes       : ${runtimeLabel}`,
    `Workflow pack  : ${plan.overlay}`,
    `Total actions  : ${totalOps}`,
    `Create         : ${plan.summary.create}`,
    `No change      : ${plan.summary.unchanged}`,
    `Overwrite safe : ${plan.summary.overwrite_with_backup}`
  ]);

  write('\n');
  write(`${renderChip(paint, `${plan.summary.create} create`, 'green')} `);
  write(`${renderChip(paint, `${plan.summary.unchanged} unchanged`, 'blue')} `);
  write(`${renderChip(paint, `${plan.summary.overwrite_with_backup} backup overwrite`, 'yellow')}\n\n`);
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
  renderStageHeader(write, paint, {
    step: 3,
    total: 4,
    title: 'Plan preview',
    subtitle: 'Review the install blueprint before deciding whether to write files.'
  });

  renderDashboard(write, paint, plan);

  const previewOps = plan.operations.slice(0, 8);
  if (previewOps.length > 0) {
    write(`${paint.bold('Preview operations')} ${paint.dim('(first 8)')}\n`);
    previewOps.forEach((item) => {
      const tone = item.operation === 'create' ? 'green' : item.operation === 'unchanged' ? 'blue' : 'yellow';
      write(`  ${renderChip(paint, item.operation, tone)} ${item.relativePath}\n`);
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
    const overlay = FULL_OVERLAY;

    if (scriptedMode) {
      renderStageHeader(write, paint, {
        step: 1,
        total: 4,
        title: 'Target selection',
        subtitle: 'Choose where the workflow package will be installed.'
      });

      targetPath = valueOrDefault(await ask('Target path [.]: '), '.');
      write('\n');

      renderStageHeader(write, paint, {
        step: 2,
        total: 4,
        title: 'Runtime adapters',
        subtitle: 'Select which editor or agent surfaces should be wired into the workflow.'
      });

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

      write(`${renderChip(paint, 'WORKFLOW PACKAGE', 'green')} ${paint.dim('complete FHH IA Ecosystem flow (full install).')}\n\n`);
    } else {
      renderStageHeader(write, paint, {
        step: 1,
        total: 4,
        title: 'Target selection',
        subtitle: 'Choose where the workflow package will be installed.'
      });

      targetPath = valueOrDefault(await promptInput({
        message: 'Target path',
        default: '.'
      }), '.');

      renderStageHeader(write, paint, {
        step: 2,
        total: 4,
        title: 'Runtime adapters',
        subtitle: 'Select which editor or agent surfaces should be wired into the workflow.'
      });

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

      write(`${renderChip(paint, 'WORKFLOW PACKAGE', 'green')} ${paint.dim('complete FHH IA Ecosystem flow (full install).')}\n\n`);
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
    renderStageHeader(write, paint, {
      step: 4,
      total: 4,
      title: 'Apply confirmation',
      subtitle: 'Nothing is written until you explicitly confirm this final step.'
    });

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
    write(`\n${paint.green('Apply completed successfully.')} ${renderChip(paint, 'SYSTEM READY', 'green')}\n`);
    write(`Applied writes: ${paint.green(String(writeCount))}\n`);
    write(`Backups created: ${paint.yellow(String(backupCount))}\n`);
    write(`${paint.dim('The target repository now has the complete FHH IA Ecosystem workflow package installed.')}\n`);
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
