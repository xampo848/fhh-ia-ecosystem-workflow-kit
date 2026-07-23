import { spawn } from 'node:child_process';
import { applyInstallPlan } from './apply.mjs';
import { formatDoctorResult, runDoctor } from './doctor.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan } from './planner.mjs';
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
import { buildUpgradePlan, commandExists as upgradeCommandExists, currentToolkitMetadata, formatUpgradePlan, resolveUpgradePackageManager } from './upgrade.mjs';

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

const TUI_MODE_OPTIONS = [
  { value: 'install', label: 'Instalar workflow en este repo', description: 'Instala el workflow completo y luego ofrece capabilities opcionales.' },
  { value: 'update', label: 'Actualizar workflow en este repo', description: 'Actualiza solo archivos gestionados, con backups y proteccion de cambios locales.' },
  { value: 'export', label: 'Exportar workflow a una carpeta', description: 'Genera una copia del paquete del workflow en un directorio de salida.' },
  { value: 'doctor', label: 'Auditar un repo con doctor', description: 'Valida archivos esperados, drift local y diagnosticos semanticos del workflow.' },
  { value: 'upgrade-toolkit', label: 'Actualizar toolkit en esta maquina', description: 'Actualiza el binario global desde GitHub para luego re-ejecutar update en los repos.' },
  { value: 'capabilities-only', label: 'Instalar solo capabilities opcionales', description: 'Revisa e instala capabilities sin tocar archivos del workflow.' }
];

const FULL_OVERLAY = 'fhh-ia-ecosystem-full';

const defaultCommandExists = upgradeCommandExists;

function explainExistingRepoBehavior(write, paint) {
  write(`${paint.bold('Existing repo behavior')}\n`);
  write(`${paint.dim('- Local .agents/skills/**/SKILL.md files will be auto-registered into registry.json.')}\n`);
  write(`${paint.dim('- Old docs stay in place unless you explicitly opt in to relocate them.')}\n`);
  write(`${paint.dim('- Any relocation creates backups and skips occupied destinations.')}\n\n`);
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
  throw new Error('bun is required to install optional capabilities.');
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
    const installStep = { label: 'Install @upstash/context7-mcp', command: 'bun', args: ['add', '-g', '@upstash/context7-mcp'] };

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
    const installStep = { label: 'Install codebase-memory-mcp', command: 'bun', args: ['add', '-g', 'codebase-memory-mcp'] };

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
  const runtimeList = Array.isArray(runtimes) ? runtimes : [...runtimes];
  const runtimeSetForInstall = runtimeSet(runtimeList.join(','));
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

async function collectCapabilitiesFlow({
  prompter,
  scriptedMode,
  write,
  paint,
  runtime,
  askOpenGuide = true
}) {
  let wantCapabilityGuide = !askOpenGuide;
  if (askOpenGuide) {
    if (scriptedMode) {
      wantCapabilityGuide = await prompter.confirm('Open optional capability setup guide? [no]: ');
    } else {
      wantCapabilityGuide = await prompter.confirm('Open optional capability setup guide?', false);
    }
  }

  const capabilitySelections = [];
  let shouldAutoInstallCapabilities = false;

  if (!wantCapabilityGuide) {
    return { capabilitySelections, shouldAutoInstallCapabilities };
  }

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
  if (capabilities.length === 0) {
    return { capabilitySelections, shouldAutoInstallCapabilities };
  }

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

  return { capabilitySelections, shouldAutoInstallCapabilities };
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

    renderStageHeader(write, paint, {
      step: 1,
      total: 6,
      title: 'Indice de flujo',
      subtitle: 'Elige el modo segun lo que quieras hacer en esta sesion.'
    });

    const mode = scriptedMode
      ? await prompter.chooseOption({
        title: 'Selecciona una opcion',
        defaultIndex: 0,
        options: TUI_MODE_OPTIONS
      })
      : await prompter.chooseOption({
        title: 'Selecciona una opcion',
        options: TUI_MODE_OPTIONS,
        defaultValue: 'full'
      });

    let targetPath;
    let runtime;
    let overlay = FULL_OVERLAY;
    let migrateLegacyDocs = false;

    if (mode === 'doctor') {
      renderStageHeader(write, paint, {
        step: 2,
        total: 4,
        title: 'Target selection',
        subtitle: 'Choose which repository should be audited against the expected toolkit surface.'
      });

      targetPath = scriptedMode
        ? await prompter.promptText('Target path [.]: ', '.')
        : await prompter.promptText('Target path', '.');

      renderStageHeader(write, paint, {
        step: 3,
        total: 4,
        title: 'Runtime adapters',
        subtitle: 'Select runtimes so doctor validates the correct adapter surface.'
      });

      const runtimeChoices = await prompter.chooseOptions({
        title: 'Select one or more runtimes',
        options: RUNTIME_OPTIONS,
        defaultValues: ['neutral']
      });

      const customRuntimes = runtimeChoices.includes('custom')
        ? await prompter.promptText(scriptedMode ? 'Custom runtimes [neutral]: ' : 'Custom runtimes (comma-separated)', 'neutral')
        : '';
      runtime = selectedRuntimeList(runtimeChoices, customRuntimes).join(',');

      renderStageHeader(write, paint, {
        step: 4,
        total: 4,
        title: 'Doctor results',
        subtitle: 'Review repository health before deciding whether to run install, update, or manual fixes.'
      });

      const doctorResult = await runDoctor({
        targetPath,
        runtime,
        overlay
      });
      write(`${formatDoctorResult(doctorResult)}\n`);
      return {
        code: doctorResult.ok ? 0 : 1,
        applied: false,
        mode,
        doctorResult
      };
    }

    if (mode === 'upgrade-toolkit') {
      const metadata = currentToolkitMetadata();

      renderStageHeader(write, paint, {
        step: 2,
        total: 4,
        title: 'Upgrade source',
        subtitle: 'Choose which Git ref should refresh the globally installed toolkit.'
      });

      const ref = scriptedMode
        ? await prompter.promptText(`Git ref [${metadata.defaultUpgradeRef}]: `, metadata.defaultUpgradeRef)
        : await prompter.promptText('Git ref (branch or tag)', metadata.defaultUpgradeRef);

      const packageManager = await resolveUpgradePackageManager(undefined, commandExists);
      const upgradePlan = buildUpgradePlan({ ref, packageManager });

      renderStageHeader(write, paint, {
        step: 3,
        total: 4,
        title: 'Upgrade preview',
        subtitle: 'This updates the toolkit binary first. Repository updates happen in a second invocation.'
      });

      write(`${formatUpgradePlan(upgradePlan)}\n\n`);

      renderStageHeader(write, paint, {
        step: 4,
        total: 4,
        title: 'Run upgrade',
        subtitle: 'The current process will remain on the old code until you launch workflow-kit again.'
      });

      const shouldUpgrade = scriptedMode
        ? await prompter.confirm('Run toolkit upgrade now? Type yes to continue [no]: ')
        : await prompter.confirm('Run toolkit upgrade now?', false);

      if (!shouldUpgrade) {
        write(`${paint.yellow('Aborted. Toolkit binary was not changed.')}\n`);
        return { code: 0, applied: false, mode, upgradePlan };
      }

      const result = await runCommand({
        command: upgradePlan.command,
        args: upgradePlan.args,
        cwd: process.cwd(),
        write,
        paint
      });

      if (!result.ok) {
        write(`${paint.red('Toolkit upgrade failed.')}\n`);
        return { code: 2, applied: false, mode, upgradePlan, upgradeResult: result };
      }

      write(`${paint.green('Toolkit upgrade completed.')} ${renderChip(paint, 'RESTART NEXT', 'green')}\n`);
      write(`${paint.dim('Next step: launch workflow-kit again and run update for each target repository.') }\n`);
      return { code: 0, applied: false, mode, upgradePlan, upgradeResult: result };
    }

    if (mode === 'capabilities-only') {
      renderStageHeader(write, paint, {
        step: 2,
        total: 4,
        title: 'Working directory',
        subtitle: 'Directory used as execution context for optional capability commands.'
      });

      targetPath = scriptedMode
        ? await prompter.promptText('Working directory [.]: ', '.')
        : await prompter.promptText('Working directory', '.');

      renderStageHeader(write, paint, {
        step: 3,
        total: 4,
        title: 'Runtime adapters',
        subtitle: 'Select runtimes so capability guides and attach steps are contextualized.'
      });

      const runtimeChoices = await prompter.chooseOptions({
        title: 'Select one or more runtimes',
        options: RUNTIME_OPTIONS,
        defaultValues: ['neutral']
      });

      const customRuntimes = runtimeChoices.includes('custom')
        ? await prompter.promptText(scriptedMode ? 'Custom runtimes [neutral]: ' : 'Custom runtimes (comma-separated)', 'neutral')
        : '';
      runtime = selectedRuntimeList(runtimeChoices, customRuntimes).join(',');

      renderStageHeader(write, paint, {
        step: 4,
        total: 4,
        title: 'Optional capabilities',
        subtitle: 'Review, configure and optionally auto-install selected capabilities.'
      });

      const { capabilitySelections, shouldAutoInstallCapabilities } = await collectCapabilitiesFlow({
        prompter,
        scriptedMode,
        write,
        paint,
        runtime,
        askOpenGuide: false
      });

      let capabilityInstallResult = null;
      if (shouldAutoInstallCapabilities) {
        capabilityInstallResult = await runCapabilityAutoInstall({
          selections: capabilitySelections.filter((item) => item.intent === 'install+attach'),
          runtimes: runtimeSet(runtime),
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

      write(`${paint.green('Capabilities flow completed.')} ${renderChip(paint, 'SYSTEM READY', 'green')}\n`);
      return {
        code: 0,
        applied: false,
        mode,
        runtimes: [...runtimeSet(runtime)],
        capabilitySelections,
        capabilityInstallResult
      };
    }

    if (scriptedMode) {
      renderStageHeader(write, paint, {
        step: 2,
        total: 6,
        title: 'Target selection',
        subtitle: mode === 'update'
          ? 'Choose which repository should be reconciled with the current toolkit surface.'
          : mode === 'export'
            ? 'Choose where the workflow package should be exported.'
            : 'Choose where the workflow package will be installed.'
      });

      targetPath = await prompter.promptText(mode === 'export' ? 'Output path [.]: ' : 'Target path [.]: ', '.');
      write('\n');

      renderStageHeader(write, paint, {
        step: 3,
        total: 6,
        title: mode === 'update' ? 'Update package' : mode === 'export' ? 'Export package' : 'Install package',
        subtitle: mode === 'update'
          ? 'Managed files will be updated selectively, with backups and protected skips.'
          : mode === 'export'
            ? 'The toolkit will render the selected package into the output directory without using repo state.'
          : 'The toolkit now installs the complete FHH IA Ecosystem package by default.'
      });
      const packageDetails = installPackageDetails(overlay);
      write(`${renderChip(paint, 'INSTALL PACKAGE', packageDetails.tone)} ${paint.dim(packageDetails.summary)}\n\n`);

      renderStageHeader(write, paint, {
        step: 4,
        total: 6,
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

      if (mode !== 'export') {
        explainExistingRepoBehavior(write, paint);
        migrateLegacyDocs = await prompter.confirm('Move old docs into docs/workflow now when destination paths are free? Backups will be created [no]: ');
      }
    } else {
      renderStageHeader(write, paint, {
        step: 2,
        total: 6,
        title: 'Target selection',
        subtitle: mode === 'update'
          ? 'Choose which repository should be reconciled with the current toolkit surface.'
          : mode === 'export'
            ? 'Choose where the workflow package should be exported.'
            : 'Choose where the workflow package will be installed.'
      });

      targetPath = await prompter.promptText(mode === 'export' ? 'Output path' : 'Target path', '.');

      renderStageHeader(write, paint, {
        step: 3,
        total: 6,
        title: mode === 'update' ? 'Update package' : mode === 'export' ? 'Export package' : 'Install package',
        subtitle: mode === 'update'
          ? 'Managed files will be updated selectively, with backups and protected skips.'
          : mode === 'export'
            ? 'The toolkit will render the selected package into the output directory without using repo state.'
          : 'The toolkit now installs the complete FHH IA Ecosystem package by default.'
      });
      const packageDetails = installPackageDetails(overlay);
      write(`${renderChip(paint, 'INSTALL PACKAGE', packageDetails.tone)} ${paint.dim(packageDetails.summary)}\n\n`);

      renderStageHeader(write, paint, {
        step: 4,
        total: 6,
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

      if (mode !== 'export') {
        explainExistingRepoBehavior(write, paint);
        migrateLegacyDocs = await prompter.confirm('Move old docs into docs/workflow now when destination paths are free? Backups will be created.', false);
      }

    }

    const buildPlan = async () => {
      if (mode === 'update') {
        try {
          return await buildUpdatePlan({
            targetPath,
            runtime,
            overlay,
            migrateLegacyDocs,
            toolkitVersion: currentToolkitMetadata().version
          });
        } catch (error) {
          if (!/No install state found\./.test(String(error?.message ?? ''))) throw error;

          write(`\n${paint.yellow('No install state found for this repository.')}\n`);
          const adoptExisting = scriptedMode
            ? await prompter.confirm('Bootstrap a safe baseline with adopt-existing? Type yes to continue [no]: ')
            : await prompter.confirm('Bootstrap a safe baseline with adopt-existing?', true);

          if (!adoptExisting) throw error;

          return buildUpdatePlan({
            targetPath,
            runtime,
            overlay,
            adoptExisting: true,
            migrateLegacyDocs,
            toolkitVersion: currentToolkitMetadata().version
          });
        }
      }

      return buildInstallPlan({
        targetPath,
        runtime,
        overlay,
        migrateLegacyDocs,
        toolkitVersion: currentToolkitMetadata().version
      });
    };

    const plan = await withSpinner({
      write,
      paint,
      label: 'Building plan',
      enabled: animate
    }, buildPlan);

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

    const { capabilitySelections, shouldAutoInstallCapabilities } = await collectCapabilitiesFlow({
      prompter,
      scriptedMode,
      write,
      paint,
      runtime,
      askOpenGuide: true
    });

    let shouldApply = false;
    renderStageHeader(write, paint, {
      step: 6,
      total: 6,
      title: 'Apply confirmation',
      subtitle: 'Nothing is written until you explicitly confirm this final step.'
    });

    if (scriptedMode) {
      shouldApply = await prompter.confirm(paint.bold('Apply these changes? Type yes to write files [no]: '));
    } else {
      shouldApply = await prompter.confirm('Apply these changes now?', false);
    }

    if (!shouldApply) {
      write(`${paint.yellow(mode === 'export' ? 'Aborted. No files were exported.' : 'Aborted. No files were written.')}\n`);
      return { code: 0, applied: false, plan };
    }

    const applied = await applyInstallPlan(plan);
    const writeCount = applied.filter((item) => item.applied).length;
    const backupCount = applied.filter((item) => item.backupPath).length;
    const modifiedSkips = applied.filter((item) => item.operation === 'skip_modified').length;
    const unmanagedSkips = applied.filter((item) => item.operation === 'skip_unmanaged').length;
    const adopted = applied.filter((item) => item.operation === 'adopt_existing').length;
    const relocatedDocs = applied.filter((item) => item.operation === 'move_with_backup').length;
    write(`\n${paint.green(mode === 'export' ? 'Export completed successfully.' : 'Apply completed successfully.')} ${renderChip(paint, 'SYSTEM READY', 'green')}\n`);
    write(`${mode === 'export' ? 'Exported files' : 'Applied writes'}: ${paint.green(String(writeCount))}\n`);
    write(`Backups created: ${paint.yellow(String(backupCount))}\n`);
    if (mode !== 'export') {
      write(`Legacy docs relocated: ${paint.cyan(String(relocatedDocs))}\n`);
    }
    if (mode === 'update') {
      write(`Protected local edits (skipped): ${paint.yellow(String(modifiedSkips))}\n`);
      write(`Unmanaged files (skipped): ${paint.yellow(String(unmanagedSkips))}\n`);
      write(`Adopted baseline files: ${paint.cyan(String(adopted))}\n`);
    }

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

    write(`${paint.dim(mode === 'update'
      ? 'The target repository has been reconciled against the current managed toolkit surface.'
      : mode === 'export'
        ? 'The output directory now contains the complete FHH IA Ecosystem workflow package.'
        : 'The target repository now has the complete FHH IA Ecosystem workflow package installed.') }\n`);
    return {
      code: 0,
      applied: true,
      mode,
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
