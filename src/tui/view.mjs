import { installPackageDetails } from './model.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function supportsColor() {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout.isTTY);
}

export function createPainter(enabled = true) {
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

export function renderChip(paint, label, tone = 'cyan') {
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

export function renderStageHeader(write, paint, { step, total, title, subtitle }) {
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
    '      ██  ██   ██           ██   ████        ██    ██    ██      ██  ██  ██',
    '      ██  ██   ██      ███████    ██    ███████    ██    ███████ ██      ██'
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

export async function animateIntro(write, paint, { animate = true } = {}) {
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
    write(`${introTone(paint, 'cream', 'mode:')} ${introTone(paint, 'blue', 'install')} ${introTone(paint, 'slate', '|')} ${introTone(paint, 'purple', 'update')} ${introTone(paint, 'slate', '|')} ${introTone(paint, 'blue', 'upgrade')} ${introTone(paint, 'slate', '|')} ${introTone(paint, 'purple', 'preview-first')}\n`);
    write(`${paint.dim('High-fidelity workflow assistant: install, update, or upgrade safely with previews and backups.')}\n`);
  write(`${paint.dim('No files are written unless you explicitly confirm.')}\n\n`);
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
  const { label: packageLabel } = installPackageDetails(plan.overlay);
  const packageLine = plan.mode === 'update' ? 'Update package' : 'Install package';

  renderBox(write, paint, 'Mission control', [
    `Target         : ${plan.targetPath}`,
    `Toolkit version: ${plan.toolkitVersion ?? 'unknown'}`,
    `Managed target : ${plan.previousToolkitVersion ?? 'none recorded'}`,
    `Runtimes       : ${runtimeLabel}`,
    `${packageLine}: ${packageLabel}`,
    `Total actions  : ${totalOps}`,
    `Create         : ${plan.summary.create}`,
    `No change      : ${plan.summary.unchanged}`,
    `Merge safe     : ${plan.summary.merge_with_backup}`,
    `Overwrite safe : ${plan.summary.overwrite_with_backup}`
  ]);

  write('\n');
  write(`${renderChip(paint, `${plan.summary.create} create`, 'green')} `);
  write(`${renderChip(paint, `${plan.summary.unchanged} unchanged`, 'blue')} `);
  write(`${renderChip(paint, `${plan.summary.merge_with_backup} backup merge`, 'yellow')} `);
  write(`${renderChip(paint, `${plan.summary.overwrite_with_backup} backup overwrite`, 'yellow')}\n\n`);
}

export function renderSummary(write, paint, plan) {
  renderStageHeader(write, paint, {
    step: 4,
    total: 5,
    title: 'Plan preview',
    subtitle: plan.mode === 'update'
      ? 'Review the managed update blueprint before deciding whether to write files.'
      : 'Review the install blueprint before deciding whether to write files.'
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

  write(`\n${paint.bold('Optional capabilities')}\n`);
  write(`  ${paint.dim('You can attach external capabilities later (for example: Engram, Context7, codebase-memory-mcp).')}\n`);
  write(`  ${paint.dim('Follow the neutral policy in .agents/integrations/README: classify intent, confirm source/scope, then install+attach or attach-only.')}\n`);
  write(`  ${paint.dim('No optional capability install command runs automatically from this TUI.')}\n`);
  write('\n');
}

export function colorizeFullPlanPreview(paint, formattedPlan) {
  const toneForOperation = {
    create: 'green',
    unchanged: 'blue',
    merge_with_backup: 'yellow',
    overwrite_with_backup: 'yellow',
    skip_modified: 'yellow',
    skip_unmanaged: 'yellow',
    adopt_existing: 'cyan'
  };

  const colorKeyValueLine = (line, key, valueTone = 'white') => {
    const prefix = `${key}: `;
    if (!line.startsWith(prefix)) return null;
    const value = line.slice(prefix.length);
    return `${paint.cyan(`${key}:`)} ${paint[valueTone](value)}`;
  };

  return String(formattedPlan)
    .split('\n')
    .map((line) => {
      if (line.length === 0) return line;

      const targetLine = colorKeyValueLine(line, 'Target');
      if (targetLine) return targetLine;

      const modeLine = colorKeyValueLine(line, 'Mode', 'magenta');
      if (modeLine) return modeLine;

      const runtimesLine = colorKeyValueLine(line, 'Runtimes', 'blue');
      if (runtimesLine) return runtimesLine;

      const overlayLine = colorKeyValueLine(line, 'Overlay', 'magenta');
      if (overlayLine) return overlayLine;

      if (line === 'Operations:') {
        return paint.cyan('Operations:');
      }

      const operationMatch = line.match(/^\-\s([^:]+):\s(.+)$/);
      if (operationMatch) {
        const operation = operationMatch[1];
        const relativePath = operationMatch[2];
        const tone = toneForOperation[operation] ?? 'white';
        return `- ${paint[tone](operation)}: ${paint.white(relativePath)}`;
      }

      if (line.startsWith('Summary: ')) {
        const payload = line.slice('Summary: '.length);
        const items = payload.split(', ').map((item) => {
          const [key, value] = item.split('=');
          const tone = toneForOperation[key] ?? 'white';
          return `${paint[tone](key)}=${paint.bold(value)}`;
        });
        return `${paint.cyan('Summary:')} ${items.join(', ')}`;
      }

      return paint.dim(line);
    })
    .join('\n');
}

export function renderCapabilityGuide(write, paint, guide, capability) {
  renderBox(write, paint, 'Capability confirmation', [
    `Capability : ${capability}`,
    `Source     : ${guide.source}`,
    `Scope      : ${guide.scope}`,
    `Mode       : ${guide.intent}`,
    `Effect     : ${guide.effect}`,
    `${guide.runtimeHint}`
  ]);
  write('\n');
  write(`${paint.bold('Recommended commands (official docs)')}\n`);
  write(`${guide.commands.join('\n')}\n\n`);
  write(`${paint.bold('Notes')}\n`);
  guide.notes.forEach((note) => write(`- ${note}\n`));
  write('\n');
}