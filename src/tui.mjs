import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { applyInstallPlan } from './apply.mjs';
import { countAppliedOperations } from './cli/summaries.mjs';
import { writingOperations } from './fs-safety.mjs';
import { formatDoctorResult, runDoctor } from './doctor.mjs';
import { lineDiff } from './plan-insight.mjs';
import { buildInstallPlan, buildUpdatePlan, detectStackPack, formatPlan, readManagedInstallState, selectPlanOperations } from './planner.mjs';
import { formatPluginInstallSteps } from './plugin-mode.mjs';
import {
  createCapabilityGuide,
  defaultIntentFor,
  installModeQuestion,
  installPackageDetails,
  modelProfileQuestions,
  stackPackQuestion,
  runtimeSet,
  selectedCapabilityList,
  selectedRuntimeList
} from './tui/model.mjs';
import { createInteractivePrompter, createScriptedPrompter } from './tui/session.mjs';

async function askModelProfiles({ prompter, runtime, env, write, paint }) {
  const answers = [];
  for (const question of modelProfileQuestions(runtime, env)) {
    if (question.hint) write(`${paint.dim(question.hint)}\n`);
    const value = await prompter.chooseOption({
      title: question.title,
      options: question.options,
      defaultIndex: question.defaultIndex,
      defaultValue: question.options[question.defaultIndex].value
    });
    answers.push(`${question.runtime}=${value}`);
  }
  return answers.length > 0 ? answers.join(',') : undefined;
}
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
import { buildUpgradePlan, commandExists as upgradeCommandExists, currentToolkitMetadata, formatUpgradePlan, globalUpgradeWorkingDirectory, resolveUpgradePackageManager, runUpgradePlan } from './upgrade.mjs';

const RUNTIME_OPTIONS = [
  { value: 'neutral', label: 'No extra adapters', description: 'Install full workflow content without runtime adapters.' },
  { value: 'codex', label: 'Codex', description: 'Full workflow + Codex adapter.' },
  { value: 'copilot', label: 'GitHub Copilot', description: 'Full workflow + Copilot adapter.' },
  { value: 'claude', label: 'Claude Code', description: 'Full workflow + Claude adapter.' },
  { value: 'antigravity', label: 'Antigravity', description: 'Full workflow + Antigravity adapter.' },
  { value: 'all', label: 'Install all adapters', description: 'Codex, GitHub Copilot, Claude Code and Antigravity.' },
  { value: 'custom', label: 'Custom list', description: 'Type your own comma-separated runtime list.' }
];

// Update and doctor work on an existing install: start from the runtimes it
// recorded, so accepting the defaults never drops an installed adapter.
async function storedRuntimeDefaults(mode, targetPath) {
  const fallback = { values: ['neutral'], custom: 'neutral' };
  if (mode !== 'update' && mode !== 'doctor') return fallback;
  let stored;
  try {
    stored = (await readManagedInstallState(targetPath ?? '.'))?.runtimes;
  } catch {
    return fallback;
  }
  if (!Array.isArray(stored) || stored.length === 0) return fallback;
  const known = new Set(RUNTIME_OPTIONS.map((option) => option.value));
  return stored.every((runtime) => known.has(runtime))
    ? { values: stored, custom: stored.join(',') }
    : { values: ['custom'], custom: stored.join(',') };
}

const CAPABILITY_OPTIONS = [
  { value: 'context7', label: 'Context7', description: 'Up-to-date docs MCP.' },
  { value: 'engram', label: 'Engram', description: 'Durable memory MCP.' },
  { value: 'codebase-memory-mcp', label: 'Codebase Memory MCP', description: 'Code graph and structural search MCP.' },
  { value: 'all', label: 'Set up all optional capabilities', description: 'Context7, Engram and Codebase Memory MCP.' }
];

const CAPABILITY_SCOPE_OPTIONS = [
  { value: 'user/global', label: 'All my projects (global)', description: 'Installed once for your user; available in every project.' },
  { value: 'repo/project', label: 'This project only', description: 'Configured only in this repository.' },
  { value: 'hybrid', label: 'Both (global + this project)', description: 'Installed for your user and connected in this repository.' }
];

const CAPABILITY_INTENT_OPTIONS = [
  { value: 'attach-only', label: 'Already installed: just connect', description: 'The tool is already on this machine; only connect it to the workflow.' },
  { value: 'install+attach', label: 'Install and connect', description: 'Install the tool, then connect it to the workflow.' }
];

const TUI_MODE_OPTIONS = [
  { value: 'install', label: 'Instalar el workflow en un proyecto', description: 'Copia el workflow completo (skills, reglas y adaptadores) al repo que elijas. Al final ofrece herramientas opcionales.' },
  { value: 'update', label: 'Actualizar el workflow de un proyecto', description: 'Pone en un repo la versión del workflow que trae tu workflow-kit actual. Protege tus cambios y crea backups. No actualiza workflow-kit.' },
  { value: 'export', label: 'Exportar el workflow a una carpeta', description: 'Genera los archivos del workflow en una carpeta aparte, sin tocar ningún proyecto.' },
  { value: 'doctor', label: 'Revisar el workflow de un proyecto (doctor)', description: 'Solo lectura: comprueba que el workflow del repo esté completo y al día.' },
  { value: 'upgrade-toolkit', label: 'Actualizar workflow-kit (esta herramienta)', description: 'Instala en esta máquina la última versión de workflow-kit desde GitHub. No cambia ningún proyecto: después usa «Actualizar el workflow de un proyecto» en cada repo.' },
  { value: 'capabilities-only', label: 'Instalar solo herramientas opcionales (MCP)', description: 'Instala o conecta Context7, Engram o Codebase Memory sin tocar los archivos del workflow.' }
];

const FULL_OVERLAY = 'fhh-ia-ecosystem-full';
// Every operation that changes a file, deletes included, can be deselected.
const WRITE_OPERATIONS = writingOperations;

const defaultCommandExists = upgradeCommandExists;

function explainExistingRepoBehavior(write, paint) {
  write(`${paint.bold('Existing repo behavior')}\n`);
  write(`${paint.dim('- Own skills go to .agents/project/skills/<name>/ with a row in .agents/project/index.md; SKILL.md files under .agents/skills/ that the kit does not ship are not registered.')}\n`);
  write(`${paint.dim('- Old docs are never moved automatically by the TUI.')}\n`);
  write(`${paint.dim('- Review docs/workflow/migration/legacy-docs-map.md and relocate docs manually if needed.')}\n\n`);
}

// Files with your own edits (PRD manifest-updater 2.4, D5): one question for
// all of them, or one per file offering only the decisions that apply to it.
const EDITED_FILES_QUESTION = 'Some workflow files in this project have your own edits. What should the update do with them?';
const EDITED_FILES_OPTIONS = [
  { value: 'keep', label: 'Keep my edits (recommended)', description: 'Every edited file stays as it is and stays pending; the update changes nothing in them.' },
  { value: 'replace-all', label: 'Replace all edited files with the kit version', description: 'Every edited kit file gets the kit version. An adapter without markers keeps your own text outside the new markers, or stays pending when that is not possible (for example Windows line endings). A backup copy of your version is saved first.' },
  { value: 'file-by-file', label: 'Decide file by file', description: 'One question per edited file, with only the choices that apply to it and a short diff.' }
];
const EDITED_DECISION_OPTIONS = {
  keep: () => ({ label: 'Keep my edits in this file', description: 'The file stays as it is and stays pending.' }),
  discard: () => ({ label: 'Take the kit version', description: 'The file gets the kit version; a backup copy of your version is saved first.' }),
  shadow: (relativePath) => ({
    label: 'Move my version to a project shadow',
    description: `Copy your version to .agents/project/shadows/${path.posix.basename(path.posix.dirname(relativePath))}/ and take the kit version.`
  }),
  split: () => ({ label: 'Split: kit block plus my text', description: 'The file gets the kit block between markers; your own text stays outside the markers.' })
};
const EDITED_DIFF_MAX_LINES = 12;

// Pending files with decisions are asked; the rest (own skills that cannot
// move, files edited after the kit retired them...) are only listed.
function pendingEditedFiles(plan) {
  const decidable = plan.operations.filter((item) => item.operation === 'skip_modified' && item.decisions?.length > 0);
  const asked = new Set(decidable.map((item) => item.relativePath));
  const listed = new Map();
  const migrationPending = (plan.migrations ?? []).flatMap((item) => item.pending ?? []);
  for (const item of [...migrationPending, ...plan.operations.filter((operation) => operation.operation === 'skip_modified')]) {
    if (!asked.has(item.relativePath) && !listed.has(item.relativePath)) listed.set(item.relativePath, item.reason);
  }
  return { decidable, listed: [...listed].map(([relativePath, reason]) => ({ relativePath, reason })) };
}

// Returns the --edited map for the chosen decisions, or undefined to keep
// every edit pending.
async function askEditedFileDecisions({ plan, prompter, write, paint }) {
  const { decidable, listed } = pendingEditedFiles(plan);
  if (listed.length > 0) {
    write(`\n${paint.copperInk(`${listed.length} file(s) stay pending; there is no choice to make for them here:`)}\n`);
    listed.forEach((item) => write(`  - ${item.relativePath}${item.reason ? ` (${item.reason})` : ''}\n`));
  }
  if (decidable.length === 0) return undefined;

  write(`\n${paint.copperInk(`Detected ${decidable.length} managed file(s) with local edits.`)}\n`);
  const policy = await prompter.chooseOption({
    title: EDITED_FILES_QUESTION,
    defaultValue: 'keep',
    defaultIndex: 0,
    options: EDITED_FILES_OPTIONS
  });
  if (policy === 'keep') return undefined;
  // Replace all: split where it applies (it keeps own adapter text); an
  // unmarked adapter split cannot keep stays pending; discard elsewhere.
  if (policy === 'replace-all') {
    const decisions = {};
    for (const item of decidable) {
      if (item.decisions.includes('split')) decisions[item.relativePath] = 'split';
      else if (item.reason === 'unmarked_adapter') write(`${paint.copperInk(`${item.relativePath} stays pending: Replace all cannot keep its own text (split does not apply). Decide it file by file or with --edited.`)}\n`);
      else decisions[item.relativePath] = 'discard';
    }
    return Object.keys(decisions).length > 0 ? decisions : undefined;
  }

  const edited = {};
  for (const item of decidable) {
    const diff = lineDiff(await fs.readFile(item.targetFile, 'utf8'), item.content ?? '', { maxLines: EDITED_DIFF_MAX_LINES });
    write(`\n${paint.bold(item.relativePath)} ${paint.dim(`(taking the kit version changes +${diff.added} -${diff.removed} lines)`)}\n`);
    write(`${paint.dim(diff.lines.join('\n'))}\n\n`);
    edited[item.relativePath] = await prompter.chooseOption({
      title: `${item.relativePath}: what should the update do with your edits?`,
      defaultValue: 'keep',
      defaultIndex: 0,
      options: item.decisions.map((decision) => ({ value: decision, ...EDITED_DECISION_OPTIONS[decision](item.relativePath) }))
    });
  }
  return edited;
}

function isWriteOperation(item) {
  return WRITE_OPERATIONS.has(item.operation);
}

function selectedPathsFromPlan(plan) {
  return plan.operations.map((item) => item.relativePath);
}

function defaultRunCommand({ command, args, cwd, write, paint }) {
  return new Promise((resolve) => {
    write(`${paint.dim(`$ ${command} ${args.join(' ')}`)}\n`);
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.on('data', (chunk) => {
      write(`${paint.dim(String(chunk))}`);
    });

    child.stderr.on('data', (chunk) => {
      write(`${paint.copperInk(String(chunk))}`);
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

function buildCapabilityInstallSteps({ capability, intent, runtimes, cwd }) {
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
    const installStep = {
      label: 'Install codebase-memory-mcp (official installer with UI)',
      command: 'bash',
      args: ['-lc', 'curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --ui']
    };

    return {
      capability,
      steps: [
        installStep,
        { label: 'Attach codebase-memory-mcp to detected runtimes', command: 'codebase-memory-mcp', args: ['install'] },
        {
          label: 'Index current project with codebase-memory-mcp',
          command: 'codebase-memory-mcp',
          args: ['cli', 'index_repository', JSON.stringify({ repo_path: cwd })]
        }
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

  const runtimeList = Array.isArray(runtimes) ? runtimes : [...runtimes];
  const runtimeSetForInstall = runtimeSet(runtimeList.join(','));
  const queue = [];
  for (const selection of selections) {
    const item = buildCapabilityInstallSteps({
      capability: selection.capability,
      intent: selection.intent,
      runtimes: runtimeSetForInstall,
      cwd
    });
    // Each capability needs only its own package installer (bun or brew). A
    // missing one skips that capability instead of failing the whole run,
    // which by now has already applied the workflow files.
    const installer = item.steps[0]?.command;
    if ((installer === 'bun' || installer === 'brew') && !(await commandExists(installer))) {
      queue.push({ ...item, steps: [], skipped: `${installer} is required in PATH to install it.` });
    } else {
      queue.push(item);
    }
  }

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
      notes
    };
  }

  write(`\n${paint.bold('Automatic optional capability install')}\n`);

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const item of runnable) {
    write(`${paint.bold(`\n- ${item.capability}`)}\n`);
    for (const step of item.steps) {
      attempted += 1;
      write(`${paint.indigo(`  -> ${step.label}`)}\n`);
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
      write(`${paint.copper('  done')}\n`);
    }
  }

  return {
    attempted,
    succeeded,
    failed,
    skipped,
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
    write(`\r${paint.copper(`${label} done`)}\n`);
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

// Install plans as if nothing were installed, and init stops over an
// existing install: say so right after the target is chosen, before asking
// about runtimes, profile or stack. An unusable state is left to the planner.
async function stopInstallOverExistingInstall({ mode, targetPath, write, paint }) {
  if (mode !== 'install') return false;
  let state = null;
  try {
    state = await readManagedInstallState(targetPath);
  } catch {
    return false;
  }
  if (!state) return false;
  write(`${paint.copperInk(`.agents/workflow-kit/install-state.json already records an install (runtimes: ${(state.runtimes ?? []).join(', ') || 'none'}). Choose Update to bring it to this version (or run workflow-kit update; --runtime, --stack and --profile change those choices). Install would reset them. Nothing was written.`)}\n`);
  return true;
}

export async function runTui(options = {}) {
  const write = options.write ?? ((message) => process.stdout.write(message));
  const colorEnabled = options.color === false ? false : supportsColor();
  const paint = createPainter(colorEnabled);
  const animate = options.animate ?? !options.ask;
  const scriptedMode = Boolean(options.ask);
  const advancedApplyPrompts = !scriptedMode || options.enableScriptedAdvancedPrompts === true;
  const introProfile = options.introProfile
    ?? process.env.WK_TUI_INTRO_PROFILE
    ?? (scriptedMode ? 'standard' : 'cinematic');
  const commandExists = options.commandExists ?? defaultCommandExists;
  const runCommand = options.runCommand ?? defaultRunCommand;
  const runUpgradeExecutor = options.runUpgradeExecutor ?? runUpgradePlan;
  // options.prompter stands in for the interactive prompter (tests).
  const prompter = scriptedMode
    ? createScriptedPrompter({ ask: options.ask, write, paint })
    : options.prompter ?? createInteractivePrompter();

  try {
    await animateIntro(write, paint, { animate, profile: introProfile });

    renderStageHeader(write, paint, {
      step: 1,
      total: 6,
      title: '¿Qué quieres hacer?',
      subtitle: 'Proyecto: instalar, actualizar, exportar o revisar su workflow. Herramienta: actualizar workflow-kit en esta máquina.'
    });

    const mode = scriptedMode
      ? await prompter.chooseOption({
        title: 'Elige una opción',
        defaultIndex: 0,
        options: TUI_MODE_OPTIONS
      })
      : await prompter.chooseOption({
        title: 'Elige una opción',
        options: TUI_MODE_OPTIONS,
        defaultValue: 'install'
      });

    let targetPath;
    let runtime;
    let overlay = FULL_OVERLAY;
    if (mode === 'doctor') {
      renderStageHeader(write, paint, {
        step: 2,
        total: 4,
        title: 'Target selection',
        subtitle: 'Choose the project whose workflow should be checked. Nothing is written.'
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
        defaultValues: (await storedRuntimeDefaults(mode, targetPath)).values
      });

      const customRuntimes = runtimeChoices.includes('custom')
        ? await prompter.promptText(scriptedMode ? 'Custom runtimes [neutral]: ' : 'Custom runtimes (comma-separated)', (await storedRuntimeDefaults(mode, targetPath)).custom)
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
        title: 'workflow-kit source',
        subtitle: 'Choose the Git branch or tag to install workflow-kit from. No project is changed.'
      });

      const ref = scriptedMode
        ? await prompter.promptText(`Git ref [${metadata.defaultUpgradeRef}]: `, metadata.defaultUpgradeRef)
        : await prompter.promptText('Git ref (branch or tag)', metadata.defaultUpgradeRef);

      const packageManager = await resolveUpgradePackageManager(undefined, commandExists);
      const upgradePlan = buildUpgradePlan({ ref, packageManager });

      renderStageHeader(write, paint, {
        step: 3,
        total: 4,
        title: 'Update preview',
        subtitle: 'This updates workflow-kit itself on this machine. Projects stay as they are until you update each one.'
      });

      write(`${formatUpgradePlan(upgradePlan)}\n\n`);

      renderStageHeader(write, paint, {
        step: 4,
        total: 4,
        title: 'Update workflow-kit',
        subtitle: 'The current process will remain on the old code until you launch workflow-kit again.'
      });

      const shouldUpgrade = scriptedMode
        ? await prompter.confirm('Update workflow-kit on this machine now? Type yes to continue [no]: ')
        : await prompter.confirm('Update workflow-kit on this machine now?', false);

      if (!shouldUpgrade) {
        write(`${paint.copperInk('Aborted. workflow-kit was not changed.')}\n`);
        return { code: 0, applied: false, mode, upgradePlan };
      }

      const result = await runUpgradeExecutor(upgradePlan, {
        cwd: globalUpgradeWorkingDirectory(),
        stdout: { write: (chunk) => write(paint.dim(String(chunk))) },
        stderr: { write: (chunk) => write(paint.copperInk(String(chunk))) }
      });

      if (!result.ok) {
        write(`${paint.red('workflow-kit update failed.')}\n`);
        return { code: 2, applied: false, mode, upgradePlan, upgradeResult: result };
      }

      write(`${paint.copper('workflow-kit updated.')} ${renderChip(paint, 'RESTART NEXT', 'copper')}\n`);
      write(`${paint.dim('Next step: launch workflow-kit again and choose «Actualizar el workflow de un proyecto» in each project.') }\n`);
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
        defaultValues: (await storedRuntimeDefaults(mode, targetPath)).values
      });

      const customRuntimes = runtimeChoices.includes('custom')
        ? await prompter.promptText(scriptedMode ? 'Custom runtimes [neutral]: ' : 'Custom runtimes (comma-separated)', (await storedRuntimeDefaults(mode, targetPath)).custom)
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
          cwd: path.resolve(targetPath ?? '.'),
          write,
          paint,
          commandExists,
          runCommand
        });

        write(`\n${paint.bold('Optional capabilities auto-install summary')}\n`);
        write(`Commands attempted: ${capabilityInstallResult.attempted}\n`);
        write(`Commands succeeded: ${paint.copper(String(capabilityInstallResult.succeeded))}\n`);
        write(`Commands failed: ${capabilityInstallResult.failed > 0 ? paint.red(String(capabilityInstallResult.failed)) : paint.copper('0')}\n`);
        if (capabilityInstallResult.skipped.length > 0) {
          write(`${paint.copperInk('Skipped capabilities:')}\n`);
          capabilityInstallResult.skipped.forEach((item) => {
            write(`- ${item.capability}: ${item.reason}\n`);
          });
        }
        if (capabilityInstallResult.notes.length > 0) {
          write(`${paint.copperInk('Manual configuration required:')}\n`);
          for (const note of capabilityInstallResult.notes) {
            write(`- ${note}\n`);
          }
        }
      }

      write(`${paint.copper('Capabilities flow completed.')} ${renderChip(paint, 'SYSTEM READY', 'copper')}\n`);
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
          ? 'Choose the project whose workflow files should be updated to this workflow-kit version.'
          : mode === 'export'
            ? 'Choose where the workflow package should be exported.'
            : 'Choose where the workflow package will be installed.'
      });

      targetPath = await prompter.promptText(mode === 'export' ? 'Output path [.]: ' : 'Target path [.]: ', '.');
      write('\n');
      if (await stopInstallOverExistingInstall({ mode, targetPath, write, paint })) return { code: 1, applied: false, mode };

      renderStageHeader(write, paint, {
        step: 3,
        total: 6,
        title: mode === 'update' ? 'Update package' : mode === 'export' ? 'Export package' : 'Install package',
        subtitle: mode === 'update'
          ? 'Managed files will be updated selectively, with backups and protected skips.'
          : mode === 'export'
            ? 'workflow-kit will write the workflow files into the output folder; no project is touched.'
          : 'workflow-kit installs the complete FHH IA Ecosystem workflow by default.'
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
        defaultValues: (await storedRuntimeDefaults(mode, targetPath)).values,
        options: RUNTIME_OPTIONS
      });

      const customRuntimes = runtimeChoices.includes('custom')
        ? await prompter.promptText('Custom runtimes [neutral]: ', (await storedRuntimeDefaults(mode, targetPath)).custom)
        : '';
      runtime = selectedRuntimeList(runtimeChoices, customRuntimes).join(',');

      if (mode !== 'export') explainExistingRepoBehavior(write, paint);
    } else {
      renderStageHeader(write, paint, {
        step: 2,
        total: 6,
        title: 'Target selection',
        subtitle: mode === 'update'
          ? 'Choose the project whose workflow files should be updated to this workflow-kit version.'
          : mode === 'export'
            ? 'Choose where the workflow package should be exported.'
            : 'Choose where the workflow package will be installed.'
      });

      targetPath = await prompter.promptText(mode === 'export' ? 'Output path' : 'Target path', '.');
      if (await stopInstallOverExistingInstall({ mode, targetPath, write, paint })) return { code: 1, applied: false, mode };

      renderStageHeader(write, paint, {
        step: 3,
        total: 6,
        title: mode === 'update' ? 'Update package' : mode === 'export' ? 'Export package' : 'Install package',
        subtitle: mode === 'update'
          ? 'Managed files will be updated selectively, with backups and protected skips.'
          : mode === 'export'
            ? 'workflow-kit will write the workflow files into the output folder; no project is touched.'
          : 'workflow-kit installs the complete FHH IA Ecosystem workflow by default.'
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
        defaultValues: (await storedRuntimeDefaults(mode, targetPath)).values
      });

      const customRuntimes = runtimeChoices.includes('custom')
        ? await prompter.promptText('Custom runtimes (comma-separated)', (await storedRuntimeDefaults(mode, targetPath)).custom)
        : '';
      runtime = selectedRuntimeList(runtimeChoices, customRuntimes).join(',');

      if (mode !== 'export') explainExistingRepoBehavior(write, paint);

    }

    // PRD plugin-mode-pilot 2.6: an interactive install asks the install mode
    // when every chosen runtime has a plugin. Scripted runs keep repo; update
    // keeps the recorded mode (the planner reads it from install-state).
    let installMode;
    const modeQuestion = mode === 'install' && !scriptedMode ? installModeQuestion(runtime) : null;
    if (modeQuestion) {
      installMode = await prompter.chooseOption({
        title: modeQuestion.title,
        options: modeQuestion.options,
        defaultIndex: modeQuestion.defaultIndex,
        defaultValue: modeQuestion.options[modeQuestion.defaultIndex].value
      });
    }

    // D-07: ask the billing model once per subscription-capable runtime on
    // install/export; update keeps the profile stored in install-state.
    const profile = mode === 'update'
      ? undefined
      : await askModelProfiles({ prompter, runtime, env: options.env ?? process.env, write, paint });

    // Asked in an interactive install, and in an interactive update whose
    // install-state has no recorded stack (installs from before stack packs).
    // The detected stack is preselected; scripted runs and adopt-existing keep
    // the requested, recorded or detected value and show it in the summary.
    let stack = options.stack;
    const recordedState = mode === 'update' ? await readManagedInstallState(targetPath) : null;
    const stackUndecided = mode === 'install' || (recordedState !== null && recordedState.stackPack === undefined);
    if (stackUndecided && !scriptedMode && stack === undefined) {
      const question = stackPackQuestion({ detected: await detectStackPack(targetPath) });
      stack = await prompter.chooseOption({
        title: question.title,
        options: question.options,
        defaultIndex: question.defaultIndex,
        defaultValue: question.options[question.defaultIndex].value
      });
    }

    // The --edited decisions on files with your own edits.
    let edited;
    let backupMode = 'required';
    let adoptExistingAnswer;

    const buildPlan = async ({ edited: editedValue, backupMode: backupModeValue = 'required' } = {}) => {
      if (mode === 'update') {
        try {
          return await buildUpdatePlan({
            targetPath,
            runtime,
            overlay,
            stack,
            edited: editedValue,
            backupMode: backupModeValue,
            toolkitVersion: currentToolkitMetadata().version
          });
        } catch (error) {
          if (!/No install state found\./.test(String(error?.message ?? ''))) throw error;

          // Asked once: the plan is rebuilt when the user changes options.
          if (adoptExistingAnswer === undefined) {
            write(`\n${paint.copperInk('No install state found for this repository.')}\n`);
            adoptExistingAnswer = scriptedMode
              ? await prompter.confirm('Bootstrap a safe baseline with adopt-existing? Type yes to continue [no]: ')
              : await prompter.confirm('Bootstrap a safe baseline with adopt-existing?', true);
          }

          if (!adoptExistingAnswer) throw error;

          return buildUpdatePlan({
            targetPath,
            runtime,
            overlay,
            stack,
            adoptExisting: true,
            edited: editedValue,
            backupMode: backupModeValue,
            toolkitVersion: currentToolkitMetadata().version
          });
        }
      }

      return buildInstallPlan({
        targetPath,
        runtime,
        overlay,
        profile,
        stack,
        mode: installMode,
        export: mode === 'export',
        ensureWorkspaceIgnore: mode !== 'export',
        recordJournal: mode !== 'export',
        backupMode: backupModeValue,
        toolkitVersion: currentToolkitMetadata().version
      });
    };

    let plan = await withSpinner({
      write,
      paint,
      label: 'Building plan',
      enabled: animate
    }, () => buildPlan({ edited, backupMode }));

    if (mode === 'update') {
      edited = await askEditedFileDecisions({ plan, prompter, write, paint });
      if (edited) {
        plan = await withSpinner({
          write,
          paint,
          label: 'Rebuilding plan with your decisions on edited files',
          enabled: animate
        }, () => buildPlan({ edited, backupMode }));
      }
    }

    if (advancedApplyPrompts) {
      const selectedBackupMode = await prompter.chooseOption({
        title: 'Backup mode for write operations',
        defaultValue: backupMode,
        defaultIndex: 0,
        options: [
          {
            label: 'Safe (with backup) - recommended',
            value: 'required',
            description: 'Create a backup file before overwrite/merge writes.'
          },
          {
            label: 'Fast (no backup)',
            value: 'none',
            description: 'Write directly without backup files.'
          }
        ]
      });

      if (selectedBackupMode !== backupMode) {
        backupMode = selectedBackupMode;
        plan = await withSpinner({
          write,
          paint,
          label: `Rebuilding plan with backup mode: ${backupMode}`,
          enabled: animate
        }, () => buildPlan({ edited, backupMode }));
      }

      // The layout migration and a mode switch are applied whole
      // (selectPlanOperations keeps them): their files are not offered;
      // retired deletes are.
      const migrationWrites = plan.operations.filter((item) => item.migration && isWriteOperation(item)).length;
      const wholeBlock = plan.modeSwitch ? 'The mode switch' : 'The layout migration';
      if (migrationWrites > 0) write(`${paint.dim(`${wholeBlock} (${migrationWrites} files) is applied as one block and is not listed here.`)}\n`);
      const writableOperations = plan.operations.filter((item) => isWriteOperation(item) && !item.migration);
      if (writableOperations.length > 0) {
        const selectedWritablePaths = await prompter.chooseOptions({
          title: 'Select files to modify',
          options: writableOperations.map((item) => ({
            label: `${item.relativePath} (${item.operation})`,
            value: item.relativePath,
            description: item.operation
          })),
          defaultValues: writableOperations.map((item) => item.relativePath)
        });

        const selectedWritableSet = new Set(selectedWritablePaths);
        const selectedPaths = selectedPathsFromPlan(plan).filter((relativePath) => {
          const operation = plan.operations.find((item) => item.relativePath === relativePath);
          if (!operation) return false;
          if (!isWriteOperation(operation) || operation.migration) return true;
          return selectedWritableSet.has(relativePath);
        });

        plan = selectPlanOperations(plan, selectedPaths);
      }
    }

    renderSummary(write, paint, plan);

    let showFullPreview = false;
    if (scriptedMode) {
      showFullPreview = await prompter.confirm('Show full operation list? [no]: ');
    } else {
      showFullPreview = await prompter.confirm('Show full operation list?', false);
    }

    if (showFullPreview) {
      const fullPreview = colorizeFullPlanPreview(paint, formatPlan(plan));
      write(`\n${paint.indigo(paint.bold('Full preview'))}\n${fullPreview}\n\n`);
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
      write(`${paint.copperInk(mode === 'export' ? 'Aborted. No files were exported.' : 'Aborted. No files were written.')}\n`);
      return { code: 0, applied: false, plan };
    }

    const applied = await applyInstallPlan(plan);
    const { writeCount, backupCount, modifiedSkips, unmanagedSkips, adopted, retiredDeleted, projectFilesMoved } = countAppliedOperations(applied);
    write(`\n${paint.copper(mode === 'export' ? 'Export completed successfully.' : 'Apply completed successfully.')} ${renderChip(paint, 'SYSTEM READY', 'copper')}\n`);
    write(`${mode === 'export' ? 'Exported files' : 'Applied writes'}: ${paint.copper(String(writeCount))}\n`);
    write(`Backups created: ${paint.copperInk(String(backupCount))}\n`);
    if (mode === 'update') {
      write(`Protected local edits (skipped): ${paint.copperInk(String(modifiedSkips))}\n`);
      write(`Unmanaged files (skipped): ${paint.copperInk(String(unmanagedSkips))}\n`);
      write(`Adopted baseline files: ${paint.indigo(String(adopted))}\n`);
      write(`Retired files deleted (backup kept): ${paint.copperInk(String(retiredDeleted))}\n`);
      write(`Project files moved to .agents/project/: ${paint.copperInk(String(projectFilesMoved))}\n`);
    }

    // Verify the result right away so a broken install or update is visible
    // here and not in the next AI session.
    if (mode !== 'export') {
      const doctorResult = await runDoctor({ targetPath, runtime, overlay });
      const errors = doctorResult.diagnostics.filter((item) => item.severity === 'error');
      const warnings = doctorResult.diagnostics.filter((item) => item.severity !== 'error');
      const healthy = doctorResult.ok;
      write(`Doctor: ${healthy ? paint.copper('ok') : paint.copperInk('failed')} (${errors.length} errors, ${warnings.length} warnings, ${doctorResult.missing.length} missing files)\n`);
      for (const item of [...errors, ...warnings].slice(0, 8)) {
        write(`  - [${item.code}] ${item.path}\n`);
      }
      if (!healthy || warnings.length > 0) write(`${paint.dim('Run workflow-kit doctor --target <repo> for the full messages.')}\n`);
    }

    // Plugin mode: the repository only declares the plugin; print how to install it.
    if (plan.nextInstallState?.mode === 'plugin') write(formatPluginInstallSteps(plan.runtimes));

    let capabilityInstallResult = null;
    if (shouldAutoInstallCapabilities) {
      capabilityInstallResult = await runCapabilityAutoInstall({
        selections: capabilitySelections.filter((item) => item.intent === 'install+attach'),
        runtimes: plan.runtimes,
        cwd: path.resolve(targetPath ?? '.'),
        write,
        paint,
        commandExists,
        runCommand
      });

      write(`\n${paint.bold('Optional capabilities auto-install summary')}\n`);
      write(`Commands attempted: ${capabilityInstallResult.attempted}\n`);
      write(`Commands succeeded: ${paint.copper(String(capabilityInstallResult.succeeded))}\n`);
      write(`Commands failed: ${capabilityInstallResult.failed > 0 ? paint.red(String(capabilityInstallResult.failed)) : paint.copper('0')}\n`);
      if (capabilityInstallResult.skipped.length > 0) {
        write(`${paint.copperInk('Skipped capabilities:')}\n`);
        capabilityInstallResult.skipped.forEach((item) => {
          write(`- ${item.capability}: ${item.reason}\n`);
        });
      }
      if (capabilityInstallResult.notes.length > 0) {
        write(`${paint.copperInk('Manual configuration required:')}\n`);
        for (const note of capabilityInstallResult.notes) {
          write(`- ${note}\n`);
        }
      }
    }

    write(`${paint.dim(mode === 'update'
      ? "The project's workflow files now match this workflow-kit version."
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
  }
}
