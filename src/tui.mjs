import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { applyInstallPlan } from './apply.mjs';
import { countAppliedOperations } from './cli/summaries.mjs';
import { writingOperations } from './fs-safety.mjs';
import { formatDoctorResult, runDoctor } from './doctor.mjs';
import { lineDiff } from './plan-insight.mjs';
import { buildInstallPlan, buildUpdatePlan, detectStackPack, formatPlan, readManagedInstallState, selectPlanOperations } from './planner.mjs';
import { formatPluginInstallSteps, pluginName, shellWord } from './plugin-mode.mjs';
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
  { value: 'neutral', label: 'Sin adaptadores extra', description: 'Instala el workflow completo sin adaptadores de runtime.' },
  { value: 'codex', label: 'Codex', description: 'Agrega el adaptador de Codex, que lleva a Codex al workflow.' },
  { value: 'copilot', label: 'GitHub Copilot', description: 'Agrega el adaptador de Copilot, que lleva a Copilot al workflow (en el repositorio, o como plugin si eliges el modo plugin después).' },
  { value: 'claude', label: 'Claude Code', description: 'Agrega el adaptador de Claude Code, que lleva a Claude Code al workflow (en el repositorio, o como plugin si eliges el modo plugin después).' },
  { value: 'antigravity', label: 'Antigravity', description: 'Agrega el adaptador de Antigravity, que lleva a Antigravity al workflow.' },
  { value: 'all', label: 'Instalar todos los adaptadores', description: 'Codex, GitHub Copilot, Claude Code y Antigravity.' },
  { value: 'custom', label: 'Lista propia', description: 'Escribe tu propia lista de runtimes, separados por comas.' }
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
  { value: 'context7', label: 'Context7', description: 'MCP de documentación al día.' },
  { value: 'engram', label: 'Engram', description: 'MCP de memoria persistente.' },
  { value: 'codebase-memory-mcp', label: 'Codebase Memory MCP', description: 'MCP de grafo de código y búsqueda estructural.' },
  { value: 'all', label: 'Configurar todas las herramientas opcionales', description: 'Context7, Engram y Codebase Memory MCP.' }
];

const CAPABILITY_SCOPE_OPTIONS = [
  { value: 'user/global', label: 'Todos mis proyectos (global)', description: 'Se instala una vez para tu usuario; disponible en todos tus proyectos.' },
  { value: 'repo/project', label: 'Solo este proyecto', description: 'Se configura solo en este repositorio.' },
  { value: 'hybrid', label: 'Ambos (global + este proyecto)', description: 'Se instala para tu usuario y se conecta en este repositorio.' }
];

const CAPABILITY_INTENT_OPTIONS = [
  { value: 'attach-only', label: 'Ya instalada: solo conectar', description: 'La herramienta ya está en esta máquina; solo se conecta al workflow.' },
  { value: 'install+attach', label: 'Instalar y conectar', description: 'Instala la herramienta y después la conecta al workflow.' }
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
  write(`${paint.bold('Qué pasa en un repo existente')}\n`);
  write(`${paint.dim('- Las skills propias van a .agents/project/skills/<name>/ con una fila en .agents/project/index.md; un SKILL.md bajo .agents/skills/ que el kit no trae no se registra.')}\n`);
  write(`${paint.dim('- El TUI nunca mueve solo los docs antiguos.')}\n`);
  write(`${paint.dim('- Revisa docs/workflow/migration/legacy-docs-map.md y mueve los docs a mano si hace falta.')}\n\n`);
}

// Files with your own edits (PRD manifest-updater 2.4, D5): one question for
// all of them, or one per file offering only the decisions that apply to it.
const EDITED_FILES_QUESTION = 'Algunos archivos del workflow de este proyecto tienen ediciones tuyas. ¿Qué hace la actualización con ellos?';
const EDITED_FILES_OPTIONS = [
  { value: 'keep', label: 'Conservar mis ediciones (recomendado)', description: 'Cada archivo editado queda como está; la actualización no los cambia y la próxima actualización los vuelve a listar.' },
  { value: 'replace-all', label: 'Reemplazar todos los archivos editados por la versión del kit', description: 'Cada archivo del kit editado recibe la versión del kit. Un adaptador sin marcadores conserva tu texto fuera de los marcadores nuevos, o queda pendiente cuando no se puede (por ejemplo con finales de línea de Windows). Antes se guarda una copia de respaldo de tu versión.' },
  { value: 'file-by-file', label: 'Decidir archivo por archivo', description: 'Una pregunta por archivo editado, solo con las opciones que le aplican y un diff corto.' }
];
const EDITED_DECISION_OPTIONS = {
  keep: () => ({ label: 'Conservar mis ediciones en este archivo', description: 'El archivo queda como está; la próxima actualización lo vuelve a listar.' }),
  discard: () => ({ label: 'Tomar la versión del kit', description: 'El archivo recibe la versión del kit; antes se guarda una copia de respaldo de tu versión.' }),
  shadow: (relativePath) => ({
    label: 'Mover mi versión a un shadow del proyecto',
    description: `Copia tu versión a .agents/project/shadows/${path.posix.basename(path.posix.dirname(relativePath))}/ y toma la versión del kit.`
  }),
  split: () => ({ label: 'Dividir: bloque del kit más mi texto', description: 'El archivo recibe el bloque del kit entre marcadores; tu propio texto queda fuera de los marcadores.' })
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
    write(`\n${paint.copperInk(`${listed.length} archivo(s) quedan pendientes; aquí no hay nada que elegir para ellos:`)}\n`);
    listed.forEach((item) => write(`  - ${item.relativePath}${item.reason ? ` (${item.reason})` : ''}\n`));
  }
  if (decidable.length === 0) return undefined;

  write(`\n${paint.copperInk(`Se detectaron ${decidable.length} archivo(s) gestionados con ediciones locales.`)}\n`);
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
      if (!item.decisions.includes('discard')) write(`${paint.copperInk(`${item.relativePath} queda como está: es un enlace simbólico y el kit no escribe a través de enlaces. Reemplaza el enlace por un archivo normal para poder decidirlo.`)}\n`);
      else if (item.decisions.includes('split')) decisions[item.relativePath] = 'split';
      else if (item.reason === 'unmarked_adapter') write(`${paint.copperInk(`${item.relativePath} queda pendiente: «Reemplazar todos» no puede conservar su texto propio (split no aplica). Decídelo archivo por archivo o con --edited.`)}\n`);
      else decisions[item.relativePath] = 'discard';
    }
    return Object.keys(decisions).length > 0 ? decisions : undefined;
  }

  const edited = {};
  for (const item of decidable) {
    const diff = lineDiff(await fs.readFile(item.targetFile, 'utf8'), item.content ?? '', { maxLines: EDITED_DIFF_MAX_LINES });
    write(`\n${paint.bold(item.relativePath)} ${paint.dim(`(tomar la versión del kit cambia +${diff.added} -${diff.removed} líneas)`)}\n`);
    write(`${paint.dim(diff.lines.join('\n'))}\n\n`);
    edited[item.relativePath] = await prompter.chooseOption({
      title: `${item.relativePath}: ¿qué hace la actualización con tus ediciones?`,
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
        ? `${command} no está en el PATH`
        : String(error?.message ?? error);
      write(`${paint.red(`El comando no pudo iniciarse: ${reason}`)}\n`);
      resolve({ ok: false, code: null, reason });
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ ok: true, code });
        return;
      }
      write(`${paint.red(`El comando terminó con código ${code}`)}\n`);
      resolve({ ok: false, code, reason: `exit-${code}` });
    });
  });
}

function buildCapabilityInstallSteps({ capability, intent, runtimes, cwd }) {
  if (intent !== 'install+attach') {
    return {
      capability,
      steps: [],
      skipped: 'El modo elegido es solo conectar (attach-only).',
      notes: []
    };
  }

  if (capability === 'context7') {
    const installStep = { label: 'Instalar @upstash/context7-mcp', command: 'bun', args: ['add', '-g', '@upstash/context7-mcp'] };

    return {
      capability,
      steps: [installStep],
      skipped: null,
      notes: [
        'Context7 todavía requiere configurar el MCP a mano con tu API key.',
        'Usa la guía generada para agregar las entradas de Context7 de tus runtimes (Codex, Copilot o el MCP del workspace).'
      ]
    };
  }

  if (capability === 'codebase-memory-mcp') {
    const installStep = {
      label: 'Instalar codebase-memory-mcp (instalador oficial con UI)',
      command: 'bash',
      args: ['-lc', 'curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --ui']
    };

    return {
      capability,
      steps: [
        installStep,
        { label: 'Conectar codebase-memory-mcp a los runtimes detectados', command: 'codebase-memory-mcp', args: ['install'] },
        {
          label: 'Indexar el proyecto actual con codebase-memory-mcp',
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
      { label: 'Instalar engram', command: 'brew', args: ['install', 'gentleman-programming/tap/engram'] }
    ];

    if (runtimes.has('codex')) {
      steps.push({ label: 'Conectar engram a Codex', command: 'engram', args: ['setup', 'codex'] });
    }
    if (runtimes.has('copilot')) {
      steps.push({ label: 'Conectar engram a GitHub Copilot', command: 'engram', args: ['setup', 'vscode-copilot'] });
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
    skipped: `La instalación automática no existe para la herramienta \"${capability}\".`,
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
      queue.push({ ...item, steps: [], skipped: `Para instalarla hace falta ${installer} en el PATH.` });
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

  write(`\n${paint.bold('Instalación automática de herramientas opcionales')}\n`);

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
        write(`${paint.red(`  ! falló: ${step.command} ${step.args.join(' ')}`)}\n`);
        break;
      }

      succeeded += 1;
      write(`${paint.copper('  listo')}\n`);
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
    write(`\r${paint.copper(`${label} listo`)}\n`);
    return result;
  } catch (error) {
    active = false;
    clearInterval(timer);
    write(`\r${paint.red(`${label} falló`)}\n`);
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
      wantCapabilityGuide = await prompter.confirm('¿Abrir la guía de herramientas opcionales? [no]: ');
    } else {
      wantCapabilityGuide = await prompter.confirm('¿Abrir la guía de herramientas opcionales?', false);
    }
  }

  const capabilitySelections = [];
  let shouldAutoInstallCapabilities = false;

  if (!wantCapabilityGuide) {
    return { capabilitySelections, shouldAutoInstallCapabilities };
  }

  const chosenCapabilities = scriptedMode
    ? await prompter.chooseOptions({
      title: 'Elige una o más herramientas opcionales',
      defaultValues: ['context7'],
      options: CAPABILITY_OPTIONS
    })
    : await prompter.chooseOptions({
      title: 'Elige una o más herramientas opcionales',
      options: CAPABILITY_OPTIONS,
      defaultValues: ['context7']
    });

  const capabilities = selectedCapabilityList(chosenCapabilities);
  if (capabilities.length === 0) {
    return { capabilitySelections, shouldAutoInstallCapabilities };
  }

  const chosenScope = scriptedMode
    ? await prompter.chooseOption({
      title: 'Elige el alcance de la herramienta',
      defaultIndex: 2,
      options: CAPABILITY_SCOPE_OPTIONS
    })
    : await prompter.chooseOption({
      title: 'Elige el alcance de la herramienta',
      options: CAPABILITY_SCOPE_OPTIONS,
      defaultValue: 'hybrid'
    });

  for (const capability of capabilities) {
    const intentDefault = defaultIntentFor(capability);
    const intentOptions = CAPABILITY_INTENT_OPTIONS.map((item) => ({
      ...item,
      label: item.value === intentDefault ? `${item.label} (recomendado)` : item.label
    }));

    const chosenIntent = scriptedMode
      ? await prompter.chooseOption({
        title: `Elige cómo instalar ${capability}`,
        defaultIndex: intentDefault === 'attach-only' ? 0 : 1,
        options: intentOptions
      })
      : await prompter.chooseOption({
        title: `Elige cómo instalar ${capability}`,
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
      shouldAutoInstallCapabilities = await prompter.confirm('¿Ejecutar ahora los comandos de instalación de las herramientas opcionales marcadas «Instalar y conectar»? [no]: ');
    } else {
      shouldAutoInstallCapabilities = await prompter.confirm('¿Ejecutar ahora los comandos de instalación de las herramientas opcionales marcadas «Instalar y conectar»?', false);
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
  write(`${paint.copperInk(`.agents/workflow-kit/install-state.json ya registra una instalación (runtimes: ${(state.runtimes ?? []).join(', ') || 'ninguno'}). Elige «Actualizar el workflow de un proyecto» para llevarla a esta versión (o ejecuta workflow-kit update; --runtime, --stack y --profile cambian esas elecciones). Instalar las reiniciaría. No se escribió nada.`)}\n`);
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
  // The menu reads a terminal: without one (stdin at end of file, a pipe or
  // /dev/null) every prompt would end at once and look like a cancel with
  // exit 0, which a script reads as success. This error stays in English,
  // like the parser errors scripts read.
  const input = options.stdin ?? process.stdin;
  if (!scriptedMode && !options.prompter && !input.isTTY) {
    const writeError = options.writeError ?? ((message) => process.stderr.write(message));
    writeError('workflow-kit tui needs an interactive terminal (stdin is not one). In scripts, use the commands instead: init, update, export, doctor, rollback or upgrade (see workflow-kit --help). Nothing was written.\n');
    return { code: 2, applied: false };
  }
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
        title: 'Elegir el proyecto',
        subtitle: 'Elige el proyecto cuyo workflow quieres revisar. No se escribe nada.'
      });

      targetPath = scriptedMode
        ? await prompter.promptText('Ruta del proyecto [.]: ', '.')
        : await prompter.promptText('Ruta del proyecto', '.');

      renderStageHeader(write, paint, {
        step: 3,
        total: 4,
        title: 'Adaptadores de runtime',
        subtitle: 'Elige los runtimes para que doctor revise los adaptadores correctos.'
      });

      const runtimeChoices = await prompter.chooseOptions({
        title: 'Elige uno o más runtimes',
        options: RUNTIME_OPTIONS,
        defaultValues: (await storedRuntimeDefaults(mode, targetPath)).values
      });

      const customRuntimes = runtimeChoices.includes('custom')
        ? await prompter.promptText(scriptedMode ? 'Runtimes propios [neutral]: ' : 'Runtimes propios (separados por comas)', (await storedRuntimeDefaults(mode, targetPath)).custom)
        : '';
      runtime = selectedRuntimeList(runtimeChoices, customRuntimes).join(',');

      renderStageHeader(write, paint, {
        step: 4,
        total: 4,
        title: 'Resultado de doctor',
        subtitle: 'Revisa el estado del repositorio antes de decidir si instalar, actualizar o corregir a mano.'
      });

      const doctorResult = await runDoctor({
        targetPath,
        runtime,
        overlay,
        commandExecutor: options.commandExecutor
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
        title: 'Origen de workflow-kit',
        subtitle: 'Elige la rama o el tag de Git desde el que instalar workflow-kit. No cambia ningún proyecto.'
      });

      const ref = scriptedMode
        ? await prompter.promptText(`Ref de Git [${metadata.defaultUpgradeRef}]: `, metadata.defaultUpgradeRef)
        : await prompter.promptText('Ref de Git (rama o tag)', metadata.defaultUpgradeRef);

      const packageManager = await resolveUpgradePackageManager(undefined, commandExists);
      const upgradePlan = buildUpgradePlan({ ref, packageManager });

      renderStageHeader(write, paint, {
        step: 3,
        total: 4,
        title: 'Vista previa de la actualización',
        subtitle: 'Esto actualiza workflow-kit en esta máquina. Los proyectos quedan como están hasta que actualices cada uno.'
      });

      write(`${formatUpgradePlan(upgradePlan)}\n\n`);

      renderStageHeader(write, paint, {
        step: 4,
        total: 4,
        title: 'Actualizar workflow-kit',
        subtitle: 'Este proceso sigue con el código anterior hasta que vuelvas a abrir workflow-kit.'
      });

      const shouldUpgrade = scriptedMode
        ? await prompter.confirm('¿Actualizar workflow-kit en esta máquina ahora? Escribe sí para continuar [no]: ')
        : await prompter.confirm('¿Actualizar workflow-kit en esta máquina ahora?', false);

      if (!shouldUpgrade) {
        write(`${paint.copperInk('Cancelado. workflow-kit no cambió.')}\n`);
        return { code: 0, applied: false, mode, upgradePlan };
      }

      const result = await runUpgradeExecutor(upgradePlan, {
        cwd: globalUpgradeWorkingDirectory(),
        stdout: { write: (chunk) => write(paint.dim(String(chunk))) },
        stderr: { write: (chunk) => write(paint.copperInk(String(chunk))) }
      });

      if (!result.ok) {
        write(`${paint.red('La actualización de workflow-kit falló.')}\n`);
        return { code: 2, applied: false, mode, upgradePlan, upgradeResult: result };
      }

      write(`${paint.copper('workflow-kit actualizado.')} ${renderChip(paint, 'REINICIA DESPUÉS', 'copper')}\n`);
      write(`${paint.dim('Siguiente paso: abre workflow-kit de nuevo y elige «Actualizar el workflow de un proyecto» en cada proyecto.') }\n`);
      return { code: 0, applied: false, mode, upgradePlan, upgradeResult: result };
    }

    if (mode === 'capabilities-only') {
      renderStageHeader(write, paint, {
        step: 2,
        total: 4,
        title: 'Carpeta de trabajo',
        subtitle: 'Carpeta donde se ejecutan los comandos de las herramientas opcionales.'
      });

      targetPath = scriptedMode
        ? await prompter.promptText('Carpeta de trabajo [.]: ', '.')
        : await prompter.promptText('Carpeta de trabajo', '.');

      renderStageHeader(write, paint, {
        step: 3,
        total: 4,
        title: 'Adaptadores de runtime',
        subtitle: 'Elige los runtimes para que las guías y los pasos de conexión se ajusten a ellos.'
      });

      const runtimeChoices = await prompter.chooseOptions({
        title: 'Elige uno o más runtimes',
        options: RUNTIME_OPTIONS,
        defaultValues: (await storedRuntimeDefaults(mode, targetPath)).values
      });

      const customRuntimes = runtimeChoices.includes('custom')
        ? await prompter.promptText(scriptedMode ? 'Runtimes propios [neutral]: ' : 'Runtimes propios (separados por comas)', (await storedRuntimeDefaults(mode, targetPath)).custom)
        : '';
      runtime = selectedRuntimeList(runtimeChoices, customRuntimes).join(',');

      renderStageHeader(write, paint, {
        step: 4,
        total: 4,
        title: 'Herramientas opcionales',
        subtitle: 'Revisa, configura y, si quieres, instala las herramientas elegidas.'
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

        write(`\n${paint.bold('Resumen de la instalación automática de herramientas opcionales')}\n`);
        write(`Comandos intentados: ${capabilityInstallResult.attempted}\n`);
        write(`Comandos exitosos: ${paint.copper(String(capabilityInstallResult.succeeded))}\n`);
        write(`Comandos fallidos: ${capabilityInstallResult.failed > 0 ? paint.red(String(capabilityInstallResult.failed)) : paint.copper('0')}\n`);
        if (capabilityInstallResult.skipped.length > 0) {
          write(`${paint.copperInk('Herramientas omitidas:')}\n`);
          capabilityInstallResult.skipped.forEach((item) => {
            write(`- ${item.capability}: ${item.reason}\n`);
          });
        }
        if (capabilityInstallResult.notes.length > 0) {
          write(`${paint.copperInk('Configuración manual necesaria:')}\n`);
          for (const note of capabilityInstallResult.notes) {
            write(`- ${note}\n`);
          }
        }
      }

      write(`${paint.copper('Flujo de herramientas completado.')} ${renderChip(paint, 'SISTEMA LISTO', 'copper')}\n`);
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
        title: 'Elegir el proyecto',
        subtitle: mode === 'update'
          ? 'Elige el proyecto cuyos archivos del workflow quieres llevar a esta versión de workflow-kit.'
          : mode === 'export'
            ? 'Elige dónde exportar el paquete del workflow.'
            : 'Elige dónde instalar el paquete del workflow.'
      });

      targetPath = await prompter.promptText(mode === 'export' ? 'Carpeta de salida [.]: ' : 'Ruta del proyecto [.]: ', '.');
      write('\n');
      if (await stopInstallOverExistingInstall({ mode, targetPath, write, paint })) return { code: 1, applied: false, mode };

      renderStageHeader(write, paint, {
        step: 3,
        total: 6,
        title: mode === 'update' ? 'Paquete a actualizar' : mode === 'export' ? 'Paquete a exportar' : 'Paquete a instalar',
        subtitle: mode === 'update'
          ? 'Los archivos gestionados se actualizan uno por uno, con backups y sin tocar tus ediciones.'
          : mode === 'export'
            ? 'workflow-kit escribe los archivos del workflow en la carpeta de salida; no toca ningún proyecto.'
          : 'workflow-kit instala por defecto el workflow completo de FHH IA Ecosystem.'
      });
      const packageDetails = installPackageDetails(overlay);
      write(`${renderChip(paint, 'PAQUETE', packageDetails.tone)} ${paint.dim(packageDetails.summary)}\n\n`);

      renderStageHeader(write, paint, {
        step: 4,
        total: 6,
        title: 'Adaptadores de runtime',
        subtitle: 'Elige qué editores o agentes se conectan al workflow.'
      });

      const runtimeChoices = await prompter.chooseOptions({
        title: 'Elige uno o más runtimes',
        defaultValues: (await storedRuntimeDefaults(mode, targetPath)).values,
        options: RUNTIME_OPTIONS
      });

      const customRuntimes = runtimeChoices.includes('custom')
        ? await prompter.promptText('Runtimes propios [neutral]: ', (await storedRuntimeDefaults(mode, targetPath)).custom)
        : '';
      runtime = selectedRuntimeList(runtimeChoices, customRuntimes).join(',');

      if (mode !== 'export') explainExistingRepoBehavior(write, paint);
    } else {
      renderStageHeader(write, paint, {
        step: 2,
        total: 6,
        title: 'Elegir el proyecto',
        subtitle: mode === 'update'
          ? 'Elige el proyecto cuyos archivos del workflow quieres llevar a esta versión de workflow-kit.'
          : mode === 'export'
            ? 'Elige dónde exportar el paquete del workflow.'
            : 'Elige dónde instalar el paquete del workflow.'
      });

      targetPath = await prompter.promptText(mode === 'export' ? 'Carpeta de salida' : 'Ruta del proyecto', '.');
      if (await stopInstallOverExistingInstall({ mode, targetPath, write, paint })) return { code: 1, applied: false, mode };

      renderStageHeader(write, paint, {
        step: 3,
        total: 6,
        title: mode === 'update' ? 'Paquete a actualizar' : mode === 'export' ? 'Paquete a exportar' : 'Paquete a instalar',
        subtitle: mode === 'update'
          ? 'Los archivos gestionados se actualizan uno por uno, con backups y sin tocar tus ediciones.'
          : mode === 'export'
            ? 'workflow-kit escribe los archivos del workflow en la carpeta de salida; no toca ningún proyecto.'
          : 'workflow-kit instala por defecto el workflow completo de FHH IA Ecosystem.'
      });
      const packageDetails = installPackageDetails(overlay);
      write(`${renderChip(paint, 'PAQUETE', packageDetails.tone)} ${paint.dim(packageDetails.summary)}\n\n`);

      renderStageHeader(write, paint, {
        step: 4,
        total: 6,
        title: 'Adaptadores de runtime',
        subtitle: 'Elige qué editores o agentes se conectan al workflow.'
      });

      const runtimeChoices = await prompter.chooseOptions({
        title: 'Elige uno o más runtimes',
        options: RUNTIME_OPTIONS,
        defaultValues: (await storedRuntimeDefaults(mode, targetPath)).values
      });

      const customRuntimes = runtimeChoices.includes('custom')
        ? await prompter.promptText('Runtimes propios (separados por comas)', (await storedRuntimeDefaults(mode, targetPath)).custom)
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
            write(`\n${paint.copperInk('Este repositorio no tiene install-state.')}\n`);
            adoptExistingAnswer = scriptedMode
              ? await prompter.confirm('¿Crear una línea base segura con adopt-existing? Escribe sí para continuar [no]: ')
              : await prompter.confirm('¿Crear una línea base segura con adopt-existing?', true);
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
      label: 'Armando el plan',
      enabled: animate
    }, () => buildPlan({ edited, backupMode }));

    if (mode === 'update') {
      edited = await askEditedFileDecisions({ plan, prompter, write, paint });
      if (edited) {
        plan = await withSpinner({
          write,
          paint,
          label: 'Rearmando el plan con tus decisiones sobre los archivos editados',
          enabled: animate
        }, () => buildPlan({ edited, backupMode }));
      }
    }

    if (advancedApplyPrompts) {
      const selectedBackupMode = await prompter.chooseOption({
        title: 'Backups al escribir',
        defaultValue: backupMode,
        defaultIndex: 0,
        options: [
          {
            label: 'Seguro (con backup), recomendado',
            value: 'required',
            description: 'Crea un archivo de backup antes de sobrescribir o fusionar.'
          },
          {
            label: 'Rápido (sin backup)',
            value: 'none',
            description: 'Escribe directo, sin archivos de backup.'
          }
        ]
      });

      if (selectedBackupMode !== backupMode) {
        backupMode = selectedBackupMode;
        plan = await withSpinner({
          write,
          paint,
          label: `Rearmando el plan con el modo de backup: ${backupMode}`,
          enabled: animate
        }, () => buildPlan({ edited, backupMode }));
      }

      // The layout migration and a mode switch are applied whole
      // (selectPlanOperations keeps them): their files are not offered;
      // retired deletes are.
      const migrationWrites = plan.operations.filter((item) => item.migration && isWriteOperation(item)).length;
      const wholeBlock = plan.modeSwitch ? 'El cambio de modo' : 'La migración de layout';
      if (migrationWrites > 0) write(`${paint.dim(`${wholeBlock} (${migrationWrites} archivos) se aplica como un solo bloque y no se lista aquí.`)}\n`);
      const writableOperations = plan.operations.filter((item) => isWriteOperation(item) && !item.migration);
      if (writableOperations.length > 0) {
        const selectedWritablePaths = await prompter.chooseOptions({
          title: 'Elige los archivos a modificar',
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
      showFullPreview = await prompter.confirm('¿Mostrar la lista completa de operaciones? [no]: ');
    } else {
      showFullPreview = await prompter.confirm('¿Mostrar la lista completa de operaciones?', false);
    }

    if (showFullPreview) {
      const fullPreview = colorizeFullPlanPreview(paint, formatPlan(plan));
      write(`\n${paint.indigo(paint.bold('Vista previa completa'))}\n${fullPreview}\n\n`);
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
      title: 'Confirmar',
      subtitle: 'No se escribe nada hasta que confirmes este último paso.'
    });

    if (scriptedMode) {
      shouldApply = await prompter.confirm(paint.bold('¿Aplicar estos cambios? Escribe sí para escribir los archivos [no]: '));
    } else {
      shouldApply = await prompter.confirm('¿Aplicar estos cambios ahora?', false);
    }

    if (!shouldApply) {
      write(`${paint.copperInk(mode === 'export' ? 'Cancelado. No se exportó ningún archivo.' : 'Cancelado. No se escribió ningún archivo.')}\n`);
      return { code: 0, applied: false, plan };
    }

    const applied = await applyInstallPlan(plan);
    const { writeCount, backupCount, modifiedSkips, unmanagedSkips, projectOwned, changedSincePlan, adopted, retiredDeleted, projectFilesMoved } = countAppliedOperations(applied);
    write(`\n${paint.copper(mode === 'export' ? 'Exportación completada.' : 'Cambios aplicados.')} ${renderChip(paint, 'SISTEMA LISTO', 'copper')}\n`);
    write(`${mode === 'export' ? 'Archivos exportados' : 'Escrituras aplicadas'}: ${paint.copper(String(writeCount))}\n`);
    write(`Backups creados: ${paint.copperInk(String(backupCount))}\n`);
    if (mode === 'update') {
      write(`Ediciones locales protegidas (omitidas): ${paint.copperInk(String(modifiedSkips))}\n`);
      write(`Archivos no gestionados (omitidos): ${paint.copperInk(String(unmanagedSkips))}\n`);
      write(`Archivos del proyecto que se dejan como están: ${paint.copperInk(String(projectOwned))}\n`);
      write(`Archivos adoptados como línea base: ${paint.indigo(String(adopted))}\n`);
      write(`Archivos retirados borrados (con backup): ${paint.copperInk(String(retiredDeleted))}\n`);
      write(`Archivos del proyecto movidos a .agents/project/: ${paint.copperInk(String(projectFilesMoved))}\n`);
      if (changedSincePlan > 0) write(`No se borraron (cambiaron desde el plan, quedan como están): ${paint.copperInk(String(changedSincePlan))}\n`);
    }

    // Verify the result right away so a broken install or update is visible
    // here and not in the next AI session.
    if (mode !== 'export') {
      // options.commandExecutor stands in for the command doctor runs (tests).
      const doctorResult = await runDoctor({ targetPath, runtime, overlay, commandExecutor: options.commandExecutor });
      const errors = doctorResult.diagnostics.filter((item) => item.severity === 'error');
      const warnings = doctorResult.diagnostics.filter((item) => item.severity !== 'error');
      const healthy = doctorResult.ok;
      write(`Doctor: ${healthy ? paint.copper('ok') : paint.copperInk('con fallas')} (${errors.length} errores, ${warnings.length} avisos, ${doctorResult.missing.length} archivos faltantes)\n`);
      for (const item of [...errors, ...warnings].slice(0, 8)) {
        write(`  - [${item.code}] ${item.path}\n`);
      }
      if (!healthy || warnings.length > 0) write(`${paint.dim(`Ejecuta workflow-kit doctor --target ${shellWord(doctorResult.targetPath)} para ver los mensajes completos.`)}\n`);
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

      write(`\n${paint.bold('Resumen de la instalación automática de herramientas opcionales')}\n`);
      write(`Comandos intentados: ${capabilityInstallResult.attempted}\n`);
      write(`Comandos exitosos: ${paint.copper(String(capabilityInstallResult.succeeded))}\n`);
      write(`Comandos fallidos: ${capabilityInstallResult.failed > 0 ? paint.red(String(capabilityInstallResult.failed)) : paint.copper('0')}\n`);
      if (capabilityInstallResult.skipped.length > 0) {
        write(`${paint.copperInk('Herramientas omitidas:')}\n`);
        capabilityInstallResult.skipped.forEach((item) => {
          write(`- ${item.capability}: ${item.reason}\n`);
        });
      }
      if (capabilityInstallResult.notes.length > 0) {
        write(`${paint.copperInk('Configuración manual necesaria:')}\n`);
        for (const note of capabilityInstallResult.notes) {
          write(`- ${note}\n`);
        }
      }
    }

    // F9: in plugin mode the kit is not in the repository; the repository only
    // declares the plugin, whose install command is printed above.
    let closingLine = 'El repositorio ya tiene instalado el paquete completo del workflow FHH IA Ecosystem.';
    if (mode === 'update') closingLine = 'Los archivos del workflow del proyecto ya están en esta versión de workflow-kit.';
    else if (mode === 'export') closingLine = 'La carpeta de salida ya tiene el paquete completo del workflow FHH IA Ecosystem.';
    else if (plan.nextInstallState?.mode === 'plugin') closingLine = `El repositorio quedó preparado para el plugin ${pluginName}; instálalo con el comando de arriba.`;
    write(`${paint.dim(closingLine)}\n`);
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
      write(`\n${paint.yellow('Cancelado por ti. No se escribió ningún archivo.')}\n`);
      return { code: 0, applied: false };
    }
    throw error;
  }
}
