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
      pureWhite: (value) => value,
      copper: (value) => value,
      copperInk: (value) => value,
      indigo: (value) => value,
      indigoDeep: (value) => value,
      cream: (value) => value,
      slate: (value) => value,
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
  const IDENTITY = {
    copper: [255, 102, 163],
    copperInk: [92, 34, 62],
    indigo: [114, 182, 209],
    indigoDeep: [72, 124, 151],
    cream: [238, 231, 219],
    slate: [150, 161, 174],
    coralAlert: [255, 84, 153]
  };
  const rgbTone = (tone, value) => wrapRgb(tone[0], tone[1], tone[2], value);

  return {
    bold: (value) => wrap(1, value),
    dim: (value) => wrap(2, value),
    pureWhite: (value) => wrap(97, value),
    copper: (value) => rgbTone(IDENTITY.copper, value),
    copperInk: (value) => rgbTone(IDENTITY.copperInk, value),
    indigo: (value) => rgbTone(IDENTITY.indigo, value),
    indigoDeep: (value) => rgbTone(IDENTITY.indigoDeep, value),
    cream: (value) => rgbTone(IDENTITY.cream, value),
    slate: (value) => rgbTone(IDENTITY.slate, value),
    cyan: (value) => rgbTone(IDENTITY.indigo, value),
    magenta: (value) => rgbTone(IDENTITY.copper, value),
    green: (value) => rgbTone(IDENTITY.copper, value),
    yellow: (value) => rgbTone(IDENTITY.copperInk, value),
    red: (value) => rgbTone(IDENTITY.coralAlert, value),
    blue: (value) => rgbTone(IDENTITY.indigoDeep, value),
    white: (value) => rgbTone(IDENTITY.cream, value),
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
  write(`${renderChip(paint, `STEP ${step}`, 'copper')} ${paint.bold(title)}\n`);
  write(`${renderProgressBar(paint, step, total)}\n`);
  if (subtitle) write(`${paint.dim(subtitle)}\n`);
  write('\n');
}

const INTRO_PALETTE = {
  cream: [238, 231, 219],
  copperBright: [255, 132, 188],
  copper: [255, 102, 163],
  ember: [186, 62, 122],
  blue: [114, 182, 209],
  slate: [150, 161, 174],
  deep: [46, 66, 82]
};

const INTRO_PROFILES = {
  standard: {
    revealDelay: 30,
    revealPause: 90,
    frameStep: 3,
    cinematicFrames: 9,
    frameDurations: [98, 88, 82, 78, 82, 92, 108, 132, 168],
    rail: false,
    flowIntensity: 0.78
  },
  cinematic: {
    revealDelay: 42,
    revealPause: 120,
    frameStep: 4,
    cinematicFrames: 14,
    frameDurations: [120, 102, 92, 84, 78, 74, 74, 78, 86, 96, 112, 134, 162, 204],
    rail: true,
    flowIntensity: 1
  }
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

function gradientTextWeighted(paint, text, start, end, exponent = 1) {
  const length = Math.max(1, text.length - 1);
  let out = '';

  for (let index = 0; index < text.length; index += 1) {
    const rawRatio = index / length;
    const ratio = Math.pow(rawRatio, exponent);
    const rgb = mixRgb(start, end, ratio);
    out += paint.rgb(rgb[0], rgb[1], rgb[2], text[index]);
  }

  return out;
}

function renderSweepTitle(paint, title, frame) {
  const sweepCenter = frame % title.length;
  let out = '';

  for (let index = 0; index < title.length; index += 1) {
    const distance = Math.abs(index - sweepCenter);
    const base = mixRgb(INTRO_PALETTE.ember, INTRO_PALETTE.copper, index / Math.max(1, title.length - 1));
    const highlightStrength = Math.max(0, 1 - distance / 7);
    const rgb = mixRgb(base, INTRO_PALETTE.copperBright, highlightStrength * 0.7);
    out += paint.rgb(rgb[0], rgb[1], rgb[2], title[index]);
  }

  return out;
}

function renderBrandTitle(paint, frame, frameStep) {
  const left = renderSweepTitle(paint, 'FHH ', frame * frameStep);
  const ia = paint.pureWhite('IA');
  const right = renderSweepTitle(paint, ' ECOSYSTEM', frame * frameStep + 5);
  return `${left}${ia}${right}`;
}

function renderFlowLine(paint, frame, intensity = 1) {
  const phases = ['target', 'runtimes', 'preview', 'apply'];
  const active = frame % phases.length;
  const rendered = phases.map((phase, index) => {
    if (index === active) return introTone(paint, 'copperBright', phase);
    if (index === (active + phases.length - 1) % phases.length && intensity > 0.7) return introTone(paint, 'copper', phase);
    return introTone(paint, 'blue', phase);
  });
  return `${introTone(paint, 'slate', 'flow')} ${rendered.join(introTone(paint, 'slate', ' -> '))}`;
}

function resolveIntroProfile(profile) {
  return INTRO_PROFILES[profile] ?? INTRO_PROFILES.standard;
}

function renderLogoFrame(paint, frame = 0, { profile = 'standard' } = {}) {
  const introProfile = resolveIntroProfile(profile);
  const title = 'FHH IA ECOSYSTEM';
  const subtitle = 'ecosystem install presentation';
  const borderChars = ['=', '-', '='];
  const borderChar = borderChars[frame % borderChars.length];
  const borderStart = frame % 2 === 0 ? INTRO_PALETTE.copper : INTRO_PALETTE.ember;
  const borderEnd = frame % 2 === 0
    ? mixRgb(INTRO_PALETTE.copper, INTRO_PALETTE.blue, 0.24)
    : mixRgb(INTRO_PALETTE.ember, INTRO_PALETTE.deep, 0.3);
  const border = gradientTextWeighted(paint, borderChar.repeat(76), borderStart, borderEnd, 2.35);
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
    const sweepRatio = ((frame * 1.05 + index) % 12) / 12;
    const start = mixRgb(INTRO_PALETTE.ember, INTRO_PALETTE.copper, sweepRatio * 0.62);
    const end = mixRgb(INTRO_PALETTE.copper, INTRO_PALETTE.copperBright, 0.32 + sweepRatio * 0.22);
    return gradientText(paint, line, start, end);
  });

  return [
    border,
    `${renderBrandTitle(paint, frame, introProfile.frameStep)} ${introTone(paint, 'copperBright', '[live]')}`,
    introTone(paint, 'slate', subtitle),
    '',
    ...heroLines,
    '',
    renderFlowLine(paint, frame, introProfile.flowIntensity),
    border
  ];
}

export async function animateIntro(write, paint, { animate = true, profile = 'standard' } = {}) {
  const introProfile = resolveIntroProfile(profile);

  if (animate) {
    const revealLines = renderLogoFrame(paint, 0, { profile });

    for (let index = 0; index < revealLines.length; index += 1) {
      write(`${paint.dim(revealLines[index])}\n`);
      await sleep(introProfile.revealDelay);
    }

    await sleep(introProfile.revealPause);
    write(`\u001b[${revealLines.length}A`);

    const cinematicFrames = introProfile.cinematicFrames;
    const frameDurations = introProfile.frameDurations;
    for (let frame = 0; frame < cinematicFrames; frame += 1) {
      const frameLines = renderLogoFrame(paint, frame + 1, { profile });
      write(`${frameLines.join('\n')}\n`);
      if (frame < cinematicFrames - 1) {
        write(`\u001b[${frameLines.length}A`);
        await sleep(frameDurations[frame]);
      }
    }
  } else {
    const lines = renderLogoFrame(paint, 1, { profile });
    write(`${lines.join('\n')}\n`);
  }

  write(`${paint.bold(`${introTone(paint, 'copper', 'FHH ')}${paint.pureWhite('IA')}${introTone(paint, 'copper', ' Ecosystem')}`)} ${paint.dim(':: launch console')}\n`);
  write(`${paint.dim('Presentacion del workflow: diseña, implementa y valida con IA de forma guiada.')}\n\n`);
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
  const discoveredSkills = Array.isArray(plan.discoveredSkillEntries) ? plan.discoveredSkillEntries.length : 0;
  const rows = [
    `Target         : ${plan.targetPath}`,
    `Toolkit version: ${plan.toolkitVersion ?? 'unknown'}`,
    `Managed target : ${plan.previousToolkitVersion ?? 'none recorded'}`,
    `Runtimes       : ${runtimeLabel}`,
    `${packageLine}: ${packageLabel}`,
    `Local skills   : ${discoveredSkills} auto-discovered`
  ];

  if (plan.mode !== 'export') {
    rows.push('Legacy docs   : Manual migration map only');
  }

  rows.push(
    `Total actions  : ${totalOps}`,
    `Create         : ${plan.summary.create}`,
    `No change      : ${plan.summary.unchanged}`,
    `Merge safe     : ${plan.summary.merge_with_backup}`,
    `Overwrite safe : ${plan.summary.overwrite_with_backup}`
  );

  renderBox(write, paint, 'Mission control', rows);

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
      const tone = item.operation === 'create'
        ? 'green'
        : item.operation === 'unchanged'
          ? 'blue'
          : 'yellow';
      write(`  ${renderChip(paint, item.operation, tone)} ${item.relativePath}\n`);
    });
    if (plan.operations.length > previewOps.length) {
      write(`  ${paint.dim(`... ${plan.operations.length - previewOps.length} more operations`)}\n`);
    }
  }

  if (plan.mode !== 'export') {
    write(`\n${paint.bold('What happens automatically')}\n`);
    write(`  ${paint.dim('Skills found in .agents/skills/**/SKILL.md are auto-registered into registry.json.')}\n`);
    write(`  ${paint.dim('Legacy docs are not moved automatically; workflow-kit only creates the migration map.')}\n`);
  }

  write(`\n${paint.bold('Optional capabilities')}\n`);
  write(`  ${paint.dim('You can attach external capabilities later (for example: Engram, Context7, codebase-memory-mcp).')}\n`);
  write(`  ${paint.dim('Follow the neutral policy in .agents/integrations/README: classify intent, confirm source/scope, then install+attach or attach-only.')}\n`);
  write(`  ${paint.dim('No optional capability install command runs automatically from this TUI.')}\n`);
  write('\n');
}

export function colorizeFullPlanPreview(paint, formattedPlan) {
  const withTone = (tone, value, fallback = 'white') => {
    const paintFn = paint[tone] ?? paint[fallback] ?? ((raw) => raw);
    return paintFn(value);
  };

  const toneForOperation = {
    create: 'copper',
    unchanged: 'indigo',
    merge_with_backup: 'copperInk',
    overwrite_with_backup: 'copperInk',
    skip_modified: 'copperInk',
    skip_unmanaged: 'copperInk',
    adopt_existing: 'indigo'
  };

  const colorKeyValueLine = (line, key, valueTone = 'cream') => {
    const prefix = `${key}: `;
    if (!line.startsWith(prefix)) return null;
    const value = line.slice(prefix.length);
    return `${withTone('indigo', `${key}:`, 'cyan')} ${withTone(valueTone, value, 'white')}`;
  };

  return String(formattedPlan)
    .split('\n')
    .map((line) => {
      if (line.length === 0) return line;

      const targetLine = colorKeyValueLine(line, 'Target');
      if (targetLine) return targetLine;

      const modeLine = colorKeyValueLine(line, 'Mode', 'copper');
      if (modeLine) return modeLine;

      const runtimesLine = colorKeyValueLine(line, 'Runtimes', 'indigo');
      if (runtimesLine) return runtimesLine;

      const overlayLine = colorKeyValueLine(line, 'Overlay', 'copper');
      if (overlayLine) return overlayLine;

      if (line === 'Operations:') {
        return withTone('indigo', 'Operations:', 'cyan');
      }

      const operationMatch = line.match(/^\-\s([^:]+):\s(.+)$/);
      if (operationMatch) {
        const operation = operationMatch[1];
        const relativePath = operationMatch[2];
        const tone = toneForOperation[operation] ?? 'cream';
        return `- ${withTone(tone, operation)}: ${withTone('cream', relativePath, 'white')}`;
      }

      if (line.startsWith('Summary: ')) {
        const payload = line.slice('Summary: '.length);
        const items = payload.split(', ').map((item) => {
          const [key, value] = item.split('=');
          const tone = toneForOperation[key] ?? 'cream';
          return `${withTone(tone, key)}=${paint.bold(value)}`;
        });
        return `${withTone('indigo', 'Summary:', 'cyan')} ${items.join(', ')}`;
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