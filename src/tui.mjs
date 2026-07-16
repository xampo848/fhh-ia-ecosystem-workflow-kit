import { applyInstallPlan } from './apply.mjs';
import { buildInstallPlan, formatPlan } from './planner.mjs';
import { createCapabilityGuide, defaultIntentFor, installPackageDetails, runtimeSet } from './tui/model.mjs';
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
        subtitle: 'Choose what package you want to install. Full is the recommended default.'
      });

      overlay = await prompter.chooseOption({
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

      const runtimePreset = await prompter.chooseOption({
        title: 'Select runtimes',
        defaultIndex: 0,
        options: RUNTIME_OPTIONS
      });

      runtime = runtimePreset === 'custom'
        ? await prompter.promptText('Custom runtimes [neutral]: ', 'neutral')
        : runtimePreset;

      const packageDetails = installPackageDetails(overlay);
      write(`${renderChip(paint, 'INSTALL PACKAGE', packageDetails.tone)} ${paint.dim(packageDetails.summary)}\n\n`);
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
        subtitle: 'Choose what package you want to install. Full is the recommended default.'
      });

      overlay = await prompter.chooseOption({
        title: 'Select install package',
        options: INSTALL_PACKAGE_OPTIONS,
        defaultValue: FULL_OVERLAY
      });

      renderStageHeader(write, paint, {
        step: 3,
        total: 5,
        title: 'Runtime adapters',
        subtitle: 'Select which editor or agent surfaces should be wired into the workflow.'
      });

      const runtimePreset = await prompter.chooseOption({
        title: 'Select runtimes',
        options: RUNTIME_OPTIONS,
        defaultValue: 'neutral'
      });

      runtime = runtimePreset === 'custom'
        ? await prompter.promptText('Custom runtimes (comma-separated)', 'neutral')
        : runtimePreset;

      const packageDetails = installPackageDetails(overlay);
      write(`${renderChip(paint, 'INSTALL PACKAGE', packageDetails.tone)} ${paint.dim(packageDetails.summary)}\n\n`);
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

    if (wantCapabilityGuide) {
      const chosenCapability = scriptedMode
        ? await prompter.chooseOption({
          title: 'Select optional capability',
          defaultIndex: 0,
          options: CAPABILITY_OPTIONS
        })
        : await prompter.chooseOption({
          title: 'Select optional capability',
          options: CAPABILITY_OPTIONS,
          defaultValue: 'context7'
        });

      if (chosenCapability !== 'skip') {
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

        const intentDefault = defaultIntentFor(chosenCapability);
        const intentOptions = CAPABILITY_INTENT_OPTIONS.map((item) => ({
          ...item,
          label: item.value === intentDefault ? `${item.label} (recommended)` : item.label
        }));

        const chosenIntent = scriptedMode
          ? await prompter.chooseOption({
            title: 'Select install mode',
            defaultIndex: intentDefault === 'attach-only' ? 0 : 1,
            options: intentOptions
          })
          : await prompter.chooseOption({
            title: 'Select install mode',
            options: intentOptions,
            defaultValue: intentDefault
          });

        const guide = createCapabilityGuide({
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
    write(`${paint.dim('The target repository now has the complete FHH IA Ecosystem workflow package installed.')}\n`);
    return { code: 0, applied: true, plan, appliedOperations: applied };
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      write(`\n${paint.yellow('Canceled by user. No files were written.')}\n`);
      return { code: 0, applied: false };
    }
    throw error;
  } finally {
  }
}
