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

const CAPABILITY_OPTIONS = [
  { value: 'context7', label: 'Context7', description: 'Up-to-date docs MCP.' },
  { value: 'engram', label: 'Engram', description: 'Durable memory MCP.' },
  { value: 'codebase-memory-mcp', label: 'Codebase Memory MCP', description: 'Code graph and structural search MCP.' },
  { value: 'skip', label: 'Skip', description: 'Return to install flow.' }
];

const CAPABILITY_SCOPE_OPTIONS = [
  { value: 'user/global', label: 'User/global', description: 'Available across projects.' },
  { value: 'repo/project', label: 'Repo/project', description: 'Configured in this repository only.' },
  { value: 'hybrid', label: 'Hybrid', description: 'Installed globally and attached in this repository.' }
];

const CAPABILITY_INTENT_OPTIONS = [
  { value: 'attach-only', label: 'Attach-only', description: 'Tool already available in runtime; only wire it to the flow.' },
  { value: 'install+attach', label: 'Install + attach', description: 'Install then wire it to the neutral flow.' }
];

const INSTALL_PACKAGE_OPTIONS = [
  {
    value: 'fhh-ia-ecosystem-full',
    label: 'Full FHH IA Ecosystem (recommended)',
    description: 'Complete .agents tree, skills, manifests, integrations, memory and workflow metadata.'
  },
  {
    value: 'starter',
    label: 'Starter overlay',
    description: 'Portable core plus starter repo overlay. Smaller surface than full.'
  },
  {
    value: 'none',
    label: 'Portable core only',
    description: 'Only portable core files. No repo overlay content.'
  }
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
  const packageLabel = plan.overlay === 'fhh-ia-ecosystem-full'
    ? 'Full FHH IA Ecosystem (recommended)'
    : plan.overlay === 'starter'
      ? 'Starter overlay'
      : 'Portable core only';

  renderBox(write, paint, 'Mission control', [
    `Target         : ${plan.targetPath}`,
    `Runtimes       : ${runtimeLabel}`,
    `Install package: ${packageLabel}`,
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
    step: 4,
    total: 5,
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

  write(`\n${paint.bold('Optional capabilities')}\n`);
  write(`  ${paint.dim('You can attach external capabilities later (for example: Engram, Context7, codebase-memory-mcp).')}\n`);
  write(`  ${paint.dim('Follow the neutral policy in .agents/integrations/README: classify intent, confirm source/scope, then install+attach or attach-only.')}\n`);
  write(`  ${paint.dim('No optional capability install command runs automatically from this TUI.')}\n`);
  write('\n');
}

function runtimeSet(runtimeList = '') {
  return new Set(String(runtimeList).split(',').map((item) => item.trim()).filter(Boolean));
}

function defaultIntentFor(capability) {
  if (capability === 'context7' || capability === 'engram') return 'attach-only';
  return 'install+attach';
}

function capabilityGuide({ capability, scope, intent, runtimes }) {
  if (capability === 'context7') {
    const commands = [
      'VS Code MCP (workspace .vscode/mcp.json):',
      '{',
      '  "servers": {',
      '    "context7": {',
      '      "type": "stdio",',
      '      "command": "npx",',
      '      "args": ["-y", "@upstash/context7-mcp@latest", "--api-key", "YOUR_API_KEY"]',
      '    }',
      '  }',
      '}',
      '',
      'Codex (~/.codex/config.toml):',
      '[mcp_servers.context7]',
      'command = "npx"',
      'args = ["-y", "@upstash/context7-mcp", "--api-key", "YOUR_API_KEY"]',
      'startup_timeout_ms = 20_000',
      '',
      'Copilot CLI (~/.copilot/mcp-config.json):',
      '{',
      '  "mcpServers": {',
      '    "context7": {',
      '      "type": "local",',
      '      "command": "npx",',
      '      "args": ["-y", "@upstash/context7-mcp", "--api-key", "YOUR_API_KEY"]',
      '    }',
      '  }',
      '}'
    ];

    return {
      source: 'upstash/context7 (packages/mcp/README.md)',
      effect: 'Adds Context7 docs tools (resolve-library-id + get-library-docs).',
      commands,
      notes: [
        'Node.js >= 18 is required by Context7 MCP.',
        'Use official source by default unless user requests another source.'
      ],
      scope,
      intent,
      runtimeHint: `Detected runtimes: ${[...runtimes].join(', ') || 'neutral'}`
    };
  }

  if (capability === 'engram') {
    const commands = [
      'Install Engram binary (macOS/Linux):',
      'brew install gentleman-programming/tap/engram',
      '',
      'Then setup by runtime:',
      'engram setup codex',
      'engram setup vscode-copilot',
      '',
      'Workspace MCP alternative (.vscode/mcp.json):',
      '{',
      '  "servers": {',
      '    "engram": {',
      '      "command": "engram",',
      '      "args": ["mcp"]',
      '    }',
      '  }',
      '}',
      '',
      'CLI one-liner:',
      'code --add-mcp "{\"name\":\"engram\",\"command\":\"engram\",\"args\":[\"mcp\"]}"'
    ];

    return {
      source: 'gentleman-programming/engram (docs/INSTALLATION.md + docs/AGENT-SETUP.md)',
      effect: 'Enables durable memory tools (mem_save, mem_search, mem_context, mem_session_summary).',
      commands,
      notes: [
        'For Codex/Copilot/VS Code, Engram MCP runs as stdio via engram mcp.',
        'No install command should run without explicit approval.'
      ],
      scope,
      intent,
      runtimeHint: `Detected runtimes: ${[...runtimes].join(', ') || 'neutral'}`
    };
  }

  const commands = [
    'Install package:',
    'npm install -g codebase-memory-mcp',
    '',
    'Configure detected coding agents:',
    'codebase-memory-mcp install',
    '',
    'Optional quick config:',
    'codebase-memory-mcp config set auto_index true',
    '',
    'Manual MCP entry example:',
    '{',
    '  "mcpServers": {',
    '    "codebase-memory-mcp": {',
    '      "command": "codebase-memory-mcp",',
    '      "args": []',
    '    }',
    '  }',
    '}'
  ];

  return {
    source: 'DeusData/codebase-memory-mcp (pkg/npm/README.md + README.md)',
    effect: 'Adds structural code graph MCP tools for indexing/search/trace.',
    commands,
    notes: [
      'Installer mutates local agent configs; confirm scope before running.',
      'Restart the coding agent after install/setup.'
    ],
    scope,
    intent,
    runtimeHint: `Detected runtimes: ${[...runtimes].join(', ') || 'neutral'}`
  };
}

function renderCapabilityGuide(write, paint, guide, capability) {
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
    let overlay = FULL_OVERLAY;

    if (scriptedMode) {
      renderStageHeader(write, paint, {
        step: 1,
        total: 5,
        title: 'Target selection',
        subtitle: 'Choose where the workflow package will be installed.'
      });

      targetPath = valueOrDefault(await ask('Target path [.]: '), '.');
      write('\n');

      renderStageHeader(write, paint, {
        step: 2,
        total: 5,
        title: 'Install package',
        subtitle: 'Choose what package you want to install. Full is the recommended default.'
      });

      overlay = await selectOption({
        ask,
        write,
        paint,
        title: 'Select install package',
        defaultIndex: 0,
        options: INSTALL_PACKAGE_OPTIONS
      });

      renderStageHeader(write, paint, {
        step: 3,
        total: 5,
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

      const packageSummary = overlay === 'fhh-ia-ecosystem-full'
        ? 'Full FHH IA Ecosystem flow selected (recommended).'
        : overlay === 'starter'
          ? 'Starter overlay selected.'
          : 'Portable core only selected.';
      write(`${renderChip(paint, 'INSTALL PACKAGE', overlay === 'fhh-ia-ecosystem-full' ? 'green' : 'yellow')} ${paint.dim(packageSummary)}\n\n`);
    } else {
      renderStageHeader(write, paint, {
        step: 1,
        total: 5,
        title: 'Target selection',
        subtitle: 'Choose where the workflow package will be installed.'
      });

      targetPath = valueOrDefault(await promptInput({
        message: 'Target path',
        default: '.'
      }), '.');

      renderStageHeader(write, paint, {
        step: 2,
        total: 5,
        title: 'Install package',
        subtitle: 'Choose what package you want to install. Full is the recommended default.'
      });

      overlay = await promptSelect({
        message: 'Select install package',
        choices: toInquirerChoices(INSTALL_PACKAGE_OPTIONS),
        default: FULL_OVERLAY
      });

      renderStageHeader(write, paint, {
        step: 3,
        total: 5,
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

      const packageSummary = overlay === 'fhh-ia-ecosystem-full'
        ? 'Full FHH IA Ecosystem flow selected (recommended).'
        : overlay === 'starter'
          ? 'Starter overlay selected.'
          : 'Portable core only selected.';
      write(`${renderChip(paint, 'INSTALL PACKAGE', overlay === 'fhh-ia-ecosystem-full' ? 'green' : 'yellow')} ${paint.dim(packageSummary)}\n\n`);
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

    let wantCapabilityGuide = false;
    if (scriptedMode) {
      wantCapabilityGuide = isYes(await ask('Open optional capability setup guide? [no]: '));
    } else {
      wantCapabilityGuide = await promptConfirm({
        message: 'Open optional capability setup guide?',
        default: false
      });
    }

    if (wantCapabilityGuide) {
      const chosenCapability = scriptedMode
        ? await selectOption({
          ask,
          write,
          paint,
          title: 'Select optional capability',
          defaultIndex: 0,
          options: CAPABILITY_OPTIONS
        })
        : await promptSelect({
          message: 'Select optional capability',
          choices: toInquirerChoices(CAPABILITY_OPTIONS),
          default: 'context7'
        });

      if (chosenCapability !== 'skip') {
        const chosenScope = scriptedMode
          ? await selectOption({
            ask,
            write,
            paint,
            title: 'Select capability scope',
            defaultIndex: 2,
            options: CAPABILITY_SCOPE_OPTIONS
          })
          : await promptSelect({
            message: 'Select capability scope',
            choices: toInquirerChoices(CAPABILITY_SCOPE_OPTIONS),
            default: 'hybrid'
          });

        const intentDefault = defaultIntentFor(chosenCapability);
        const intentOptions = CAPABILITY_INTENT_OPTIONS.map((item) => ({
          ...item,
          label: item.value === intentDefault ? `${item.label} (recommended)` : item.label
        }));

        const chosenIntent = scriptedMode
          ? await selectOption({
            ask,
            write,
            paint,
            title: 'Select install mode',
            defaultIndex: intentDefault === 'attach-only' ? 0 : 1,
            options: intentOptions
          })
          : await promptSelect({
            message: 'Select install mode',
            choices: toInquirerChoices(intentOptions),
            default: intentDefault
          });

        const guide = capabilityGuide({
          capability: chosenCapability,
          scope: chosenScope,
          intent: chosenIntent,
          runtimes: runtimeSet(runtime)
        });

        write('\n');
        renderCapabilityGuide(write, paint, guide, chosenCapability);
      }
    }

    let shouldApply = false;
    renderStageHeader(write, paint, {
      step: 5,
      total: 5,
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
