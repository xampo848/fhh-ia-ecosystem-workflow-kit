import { spawn } from 'node:child_process';
import { applyInstallPlan } from './apply.mjs';
import { buildInstallPlan, formatPlan } from './planner.mjs';
import {
  createCapabilityGuide,
  defaultIntentFor,
  installPackageDetails,
  runtimeSet,
  selectedCapabilityList,
  selectedRuntimeList
} from './tui/model.mjs';
import { createInteractivePrompter, createScriptedPrompter } from './tui/session.mjs';
import {
  animateIntro,
  colorizeFullPlanPreview,
  createPainter,
  renderCapabilityGuide,
  renderChip,
  renderStageHeader,
  renderSummary,
  supportsColor
} from './tui/view.mjs';

const RUNTIME_OPTIONS = [
  { value: 'neutral', label: 'No extra adapters', description: 'Install full workflow content without runtime adapters.' },
  { value: 'codex', label: 'Codex', description: 'Full workflow + Codex adapter.' },
  { value: 'copilot', label: 'GitHub Copilot', description: 'Full workflow + Copilot adapter.' },
  { value: 'claude', label: 'Claude Code', description: 'Full workflow + Claude adapter.' },
  { value: 'antigravity', label: 'Antigravity', description: 'Full workflow + Antigravity adapter.' },
  { value: 'all', label: 'Install all adapters', description: 'Codex, GitHub Copilot, Claude Code and Antigravity.' },
  { value: 'custom', label: 'Custom list', description: 'Type your own comma-separated runtime list.' }
];

const CAPABILITY_OPTIONS = [
  { value: 'context7', label: 'Context7', description: 'Up-to-date docs MCP.' },
  { value: 'engram', label: 'Engram', description: 'Durable memory MCP.' },
  { value: 'codebase-memory-mcp', label: 'Codebase Memory MCP', description: 'Code graph and structural search MCP.' },
  { value: 'all', label: 'Set up all optional capabilities', description: 'Context7, Engram and Codebase Memory MCP.' }
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

const FULL_OVERLAY = 'fhh-ia-ecosystem-full';

function defaultCommandExists(command) {
  return new Promise((resolve) => {
    const child = spawn(command, ['--version'], { stdio: 'ignore' });
    child.on('error', (error) => {
      if (error && error.code === 'ENOENT') {
        resolve(false);
        return;
      }
      resolve(false);
    });
    child.on('exit', () => resolve(true));
  });
}

function defaultRunCommand({ command, args, cwd, write, paint }) {
  return new Promise((resolve) => {
    write(`${paint.dim(`$ ${command} ${args.join(' ')}`)}\n`);
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.on('data', (chunk) => {
      write(`${paint.dim(String(chunk))}`);
    });

    child.stderr.on('data', (chunk) => {
      write(`${paint.yellow(String(chunk))}`);
    });

    child.on('error', (error) => {
      const reason = error && error.code === 'ENOENT'
        ? `${command} is not available in PATH`
        : String(error?.message ?? error);
      write(`${paint.red(`Command failed to start: ${reason}`)}\n`);
      resolve({ ok: false, code: null, reason });
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ ok: true, code });
        return;
      }
      write(`${paint.red(`Command exited with code ${code}`)}\n`);
      resolve({ ok: false, code, reason: `exit-${code}` });
    });
  });
}

async function preferredPackageManager(commandExists) {
  if (await commandExists('bun')) return 'bun';
  return 'npm';
}

function buildCapabilityInstallSteps({ capability, intent, runtimes, packageManager }) {
  if (intent !== 'install+attach') {
    return {
      capability,
      steps: [],
      skipped: 'Selected mode is attach-only.',
      notes: []
    };
  }

  if (capability === 'context7') {
    const installStep = packageManager === 'bun'
      ? { label: 'Install @upstash/context7-mcp', command: 'bun', args: ['add', '-g', '@upstash/context7-mcp'] }
      : { label: 'Install @upstash/context7-mcp', command: 'npm', args: ['install', '-g', '@upstash/context7-mcp'] };

    return {
      capability,
      steps: [installStep],
      skipped: null,
      notes: [
        'Context7 still requires manual MCP configuration with your API key.',
        'Use the generated guide to add Context7 entries for your runtimes (Codex, Copilot, or workspace MCP).'
      ]
    };
  }

  if (capability === 'codebase-memory-mcp') {
    const installStep = packageManager === 'bun'
      ? { label: 'Install codebase-memory-mcp', command: 'bun', args: ['add', '-g', 'codebase-memory-mcp'] }
      : { label: 'Install codebase-memory-mcp', command: 'npm', args: ['install', '-g', 'codebase-memory-mcp'] };

    return {
      capability,
      steps: [
        installStep,
        { label: 'Attach codebase-memory-mcp to detected runtimes', command: 'codebase-memory-mcp', args: ['install'] }
      ],
      skipped: null,
      notes: []
    };
  }

  if (capability === 'engram') {
    const steps = [
      { label: 'Install engram', command: 'brew', args: ['install', 'gentleman-programming/tap/engram'] }
    ];

    if (runtimes.has('codex')) {
      steps.push({ label: 'Attach engram to Codex', command: 'engram', args: ['setup', 'codex'] });
    }
    if (runtimes.has('copilot')) {
      steps.push({ label: 'Attach engram to GitHub Copilot', command: 'engram', args: ['setup', 'vscode-copilot'] });
    }

    return {
      capability,
      steps,
      skipped: null,
      notes: []
    };
  }

  return {
    capability,
    steps: [],
    skipped: `Auto-install is not implemented for capability \"${capability}\".`,
    notes: []
  };
}

async function runCapabilityAutoInstall({ selections, runtimes, cwd, write, paint, commandExists, runCommand }) {
  if (selections.length === 0) {
    return {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      skipped: []
    };
  }

  const packageManager = await preferredPackageManager(commandExists);
  const runtimeSetForInstall = runtimeSet(runtimes.join(','));
  const queue = selections.map((selection) => buildCapabilityInstallSteps({
    capability: selection.capability,
    intent: selection.intent,
    runtimes: runtimeSetForInstall,
    packageManager
  }));

  const skipped = queue
    .filter((item) => item.steps.length === 0)
    .map((item) => ({ capability: item.capability, reason: item.skipped }));
  const notes = queue.flatMap((item) => item.notes ?? []);

  const runnable = queue.filter((item) => item.steps.length > 0);
  if (runnable.length === 0) {
    return {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      skipped,
      packageManager,
      notes
    };
  }

  write(`\n${paint.bold('Automatic optional capability install')}${paint.dim(` (preferred package manager: ${packageManager})`)}\n`);

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const item of runnable) {
    write(`${paint.bold(`\n- ${item.capability}`)}\n`);
    for (const step of item.steps) {
      attempted += 1;
      write(`${paint.cyan(`  -> ${step.label}`)}\n`);
      const result = await runCommand({
        command: step.command,
        args: step.args,
        cwd,
        write,
        paint
      });

      if (!result.ok) {
        failed += 1;
        write(`${paint.red(`  ! failed: ${step.command} ${step.args.join(' ')}`)}\n`);
        break;
      }

      succeeded += 1;
      write(`${paint.green('  done')}\n`);
    }
  }

  return {
    attempted,
    succeeded,
    failed,
    skipped,
    packageManager,
    notes
  };
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

export async function runTui(options = {}) {
  const write = options.write ?? ((message) => process.stdout.write(message));
  const colorEnabled = options.color === false ? false : supportsColor();
  const paint = createPainter(colorEnabled);
  const animate = options.animate ?? !options.ask;
  const scriptedMode = Boolean(options.ask);
  const commandExists = options.commandExists ?? defaultCommandExists;
  const runCommand = options.runCommand ?? defaultRunCommand;
  const prompter = scriptedMode
    ? createScriptedPrompter({ ask: options.ask, write, paint })
    : createInteractivePrompter();

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

      targetPath = await prompter.promptText('Target path [.]: ', '.');
      write('\n');

      renderStageHeader(write, paint, {
        step: 2,
        total: 5,
        title: 'Install package',
        subtitle: 'The toolkit now installs the complete FHH IA Ecosystem package by default.'
      });
      const packageDetails = installPackageDetails(overlay);
      write(`${renderChip(paint, 'INSTALL PACKAGE', packageDetails.tone)} ${paint.dim(packageDetails.summary)}\n\n`);

      renderStageHeader(write, paint, {
        step: 3,
        total: 5,
        title: 'Runtime adapters',
        subtitle: 'Select which editor or agent surfaces should be wired into the workflow.'
      });

      const runtimeChoices = await prompter.chooseOptions({
        title: 'Select one or more runtimes',
        defaultValues: ['neutral'],
        options: RUNTIME_OPTIONS
      });

      const customRuntimes = runtimeChoices.includes('custom')
        ? await prompter.promptText('Custom runtimes [neutral]: ', 'neutral')
        : '';
      runtime = selectedRuntimeList(runtimeChoices, customRuntimes).join(',');
    } else {
      renderStageHeader(write, paint, {
        step: 1,
        total: 5,
        title: 'Target selection',
        subtitle: 'Choose where the workflow package will be installed.'
      });

      targetPath = await prompter.promptText('Target path', '.');

      renderStageHeader(write, paint, {
        step: 2,
        total: 5,
        title: 'Install package',
        subtitle: 'The toolkit now installs the complete FHH IA Ecosystem package by default.'
      });
      const packageDetails = installPackageDetails(overlay);
      write(`${renderChip(paint, 'INSTALL PACKAGE', packageDetails.tone)} ${paint.dim(packageDetails.summary)}\n\n`);

      renderStageHeader(write, paint, {
        step: 3,
        total: 5,
        title: 'Runtime adapters',
        subtitle: 'Select which editor or agent surfaces should be wired into the workflow.'
      });

      const runtimeChoices = await prompter.chooseOptions({
        title: 'Select one or more runtimes',
        options: RUNTIME_OPTIONS,
        defaultValues: ['neutral']
      });

      const customRuntimes = runtimeChoices.includes('custom')
        ? await prompter.promptText('Custom runtimes (comma-separated)', 'neutral')
        : '';
      runtime = selectedRuntimeList(runtimeChoices, customRuntimes).join(',');

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
      showFullPreview = await prompter.confirm('Show full operation list? [no]: ');
    } else {
      showFullPreview = await prompter.confirm('Show full operation list?', false);
    }

    if (showFullPreview) {
      const fullPreview = colorizeFullPlanPreview(paint, formatPlan(plan));
      write(`\n${paint.cyan(paint.bold('Full preview'))}\n${fullPreview}\n\n`);
    }

    let wantCapabilityGuide = false;
    if (scriptedMode) {
      wantCapabilityGuide = await prompter.confirm('Open optional capability setup guide? [no]: ');
    } else {
      wantCapabilityGuide = await prompter.confirm('Open optional capability setup guide?', false);
    }

    const capabilitySelections = [];
    let shouldAutoInstallCapabilities = false;

    if (wantCapabilityGuide) {
      const chosenCapabilities = scriptedMode
        ? await prompter.chooseOptions({
          title: 'Select one or more optional capabilities',
          defaultValues: ['context7'],
          options: CAPABILITY_OPTIONS
        })
        : await prompter.chooseOptions({
          title: 'Select one or more optional capabilities',
          options: CAPABILITY_OPTIONS,
          defaultValues: ['context7']
        });

      const capabilities = selectedCapabilityList(chosenCapabilities);
      if (capabilities.length > 0) {
        const chosenScope = scriptedMode
          ? await prompter.chooseOption({
            title: 'Select capability scope',
            defaultIndex: 2,
            options: CAPABILITY_SCOPE_OPTIONS
          })
          : await prompter.chooseOption({
            title: 'Select capability scope',
            options: CAPABILITY_SCOPE_OPTIONS,
            defaultValue: 'hybrid'
          });

        for (const capability of capabilities) {
          const intentDefault = defaultIntentFor(capability);
          const intentOptions = CAPABILITY_INTENT_OPTIONS.map((item) => ({
            ...item,
            label: item.value === intentDefault ? `${item.label} (recommended)` : item.label
          }));

          const chosenIntent = scriptedMode
            ? await prompter.chooseOption({
              title: `Select install mode for ${capability}`,
              defaultIndex: intentDefault === 'attach-only' ? 0 : 1,
              options: intentOptions
            })
            : await prompter.chooseOption({
              title: `Select install mode for ${capability}`,
              options: intentOptions,
              defaultValue: intentDefault
            });

          const guide = createCapabilityGuide({
            capability,
            scope: chosenScope,
            intent: chosenIntent,
            runtimes: runtimeSet(runtime)
          });

          capabilitySelections.push({
            capability,
            scope: chosenScope,
            intent: chosenIntent
          });

          write('\n');
          renderCapabilityGuide(write, paint, guide, capability);
        }

        if (capabilitySelections.some((item) => item.intent === 'install+attach')) {
          if (scriptedMode) {
            shouldAutoInstallCapabilities = await prompter.confirm('Automatically run install commands for all install+attach optional capabilities? [no]: ');
          } else {
            shouldAutoInstallCapabilities = await prompter.confirm('Automatically run install commands for all install+attach optional capabilities?', false);
          }
        }
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
      shouldApply = await prompter.confirm(paint.bold('Apply these changes? Type yes to write files [no]: '));
    } else {
      shouldApply = await prompter.confirm('Apply these changes now?', false);
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

    let capabilityInstallResult = null;
    if (shouldAutoInstallCapabilities) {
      capabilityInstallResult = await runCapabilityAutoInstall({
        selections: capabilitySelections.filter((item) => item.intent === 'install+attach'),
        runtimes: plan.runtimes,
        cwd: targetPath,
        write,
        paint,
        commandExists,
        runCommand
      });

      write(`\n${paint.bold('Optional capabilities auto-install summary')}\n`);
      write(`Commands attempted: ${capabilityInstallResult.attempted}\n`);
      write(`Commands succeeded: ${paint.green(String(capabilityInstallResult.succeeded))}\n`);
      write(`Commands failed: ${capabilityInstallResult.failed > 0 ? paint.red(String(capabilityInstallResult.failed)) : paint.green('0')}\n`);
      if (capabilityInstallResult.skipped.length > 0) {
        write(`${paint.yellow('Skipped capabilities:')}\n`);
        capabilityInstallResult.skipped.forEach((item) => {
          write(`- ${item.capability}: ${item.reason}\n`);
        });
      }
      if (capabilityInstallResult.notes.length > 0) {
        write(`${paint.yellow('Manual configuration required:')}\n`);
        for (const note of capabilityInstallResult.notes) {
          write(`- ${note}\n`);
        }
      }
    }

    write(`${paint.dim('The target repository now has the complete FHH IA Ecosystem workflow package installed.')}\n`);
    return {
      code: 0,
      applied: true,
      plan,
      appliedOperations: applied,
      capabilityInstallResult
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      write(`\n${paint.yellow('Canceled by user. No files were written.')}\n`);
      return { code: 0, applied: false };
    }
    throw error;
  } finally {
  }
}
