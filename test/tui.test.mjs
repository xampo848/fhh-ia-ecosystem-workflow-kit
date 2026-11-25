import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { buildInstallPlan, installStateRelativePath } from '../src/planner.mjs';
import { runCli } from '../src/cli.mjs';
import { runTui } from '../src/tui.mjs';
import { installLegacy0181 } from './fixtures/legacy-0.18.1/install.mjs';
import { createMemoryIo, hashTree, makeTempRepo } from './helpers.mjs';

// An answer is a string, or a function of the output written so far.
function scriptedAsk(answers, readOutput = () => '') {
  const queue = [...answers];
  return async () => {
    const answer = queue.shift() ?? '';
    return typeof answer === 'function' ? answer(readOutput()) : answer;
  };
}

const operationFor = (plan, relativePath) => plan.operations.find((item) => item.relativePath === relativePath);
const instructionsPath = '.agents/instructions.md';
// A kit leaf skill the manifest lets be shadowed.
const leafSkillPath = '.agents/skills/02-implement/validation-runner/SKILL.md';
const editedFilesQuestion = 'Algunos archivos del workflow de este proyecto tienen ediciones tuyas. ¿Qué hace la actualización con ellos?';

// The numbered options of the last question with this title, as printed.
function optionsOf(output, title) {
  const lines = output.split('\n');
  const start = lines.lastIndexOf(title);
  assert.ok(start > -1, `question not shown: ${title}`);
  const options = [];
  for (const line of lines.slice(start + 1)) {
    const match = line.match(/^  (\d+)\) (.+?)( \(por defecto\))?$/);
    if (match) options.push({ number: match[1], label: match[2] });
    else if (!line.startsWith('     ')) break;
  }
  return options;
}

// A 0.18.1 install (fixture) with a kit file and a kit leaf skill edited.
async function legacyRepoWithEdits() {
  const target = await makeTempRepo();
  const legacy = await installLegacy0181(target);
  for (const relativePath of [instructionsPath, leafSkillPath]) await fs.appendFile(path.join(target, relativePath), '\nLocal edit.\n');
  return { target, legacy };
}

test('tui previews plan and default decline writes nothing', async () => {
  const target = await makeTempRepo();
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['', target, '', '', '', '']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.code, 0);
  assert.equal(result.applied, false);
  assert.match(output, /FHH IA Ecosystem/);
  assert.match(output, /Flujo completo de FHH IA Ecosystem elegido \(recomendado\)\./);
  assert.match(output, /Panel de control/);
  assert.match(output, /Los docs antiguos no se mueven solos/);
  // Round 4 (N9): own skills are not registered from the kit tree.
  assert.doesNotMatch(output, /auto-registered/);
  assert.match(output, /Las skills propias van a \.agents\/project\/skills\/<name>\/ con una fila en \.agents\/project\/index\.md/);
  assert.match(output, /Cancelado\. No se escribió ningún archivo\./);
  await assert.rejects(fs.access(path.join(target, '.agents/instructions.md')), { code: 'ENOENT' });
});

test('tui confirmed apply writes selected files through planner apply', async () => {
  const target = await makeTempRepo();
  let output = '';

  const result = await runTui({
    // Runtime 6 = all adapters, so Codex and Claude Code each ask for their billing profile.
    ask: scriptedAsk(['', target, '6', '', '', '', '', 'yes']),
    color: false,
    env: {},
    write: (message) => { output += message; }
  });

  assert.equal(result.code, 0);
  assert.equal(result.applied, true);
  assert.match(output, /¿Cómo se cobra Codex en este proyecto\?/);
  assert.match(output, /¿Cómo se cobra Claude Code en este proyecto\?/);
  assert.match(output, /Cambios aplicados\./);
  assert.match(output, /Escrituras aplicadas:/);
  await fs.access(path.join(target, '.agents/instructions.md'));
  await fs.access(path.join(target, 'AGENTS.md'));
  await fs.access(path.join(target, '.github/copilot-instructions.md'));
  await fs.access(path.join(target, '.agents/skills/06-patterns/README.md'));
});

test('tui advanced apply prompts can disable backups and apply only selected files', async () => {
  const target = await makeTempRepo();
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['', target, '1', '2', '1', '', '', 'yes']),
    color: false,
    write: (message) => { output += message; },
    enableScriptedAdvancedPrompts: true
  });

  assert.equal(result.code, 0);
  assert.equal(result.applied, true);
  assert.equal(result.plan.summary.overwrite_no_backup > 0 || result.plan.summary.merge_no_backup > 0 || result.plan.summary.create > 0, true);
  assert.match(output, /Escrituras aplicadas: 1/);
  assert.match(output, /Backups creados: 0/);
  assert.equal(result.plan.operations.length, 1);
  await fs.access(path.join(target, result.plan.operations[0].relativePath));
});

test('tui combines GitHub Copilot and Antigravity adapters', async () => {
  const target = await makeTempRepo();

  const result = await runTui({
    ask: scriptedAsk(['', target, '3,5', '', '']),
    color: false,
    write: () => {}
  });

  assert.equal(result.applied, false);
  assert.deepEqual(result.plan.runtimes, ['copilot', 'antigravity']);
  assert.ok(result.plan.operations.some((item) => item.relativePath === '.github/copilot-instructions.md'));
});

test('tui can auto-install install+attach optional capabilities in one confirmation using bun', async () => {
  const target = await makeTempRepo();
  const executed = [];

  const result = await runTui({
    ask: scriptedAsk(['', target, '1', '', 'yes', '3', '1', '2', 'yes', 'yes']),
    color: false,
    write: () => {},
    commandExists: async (command) => command === 'bun',
    runCommand: async ({ command, args }) => {
      executed.push(`${command} ${args.join(' ')}`);
      return { ok: true, code: 0 };
    }
  });

  assert.equal(result.applied, true);
  assert.deepEqual(executed, [
    'bash -lc curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --ui',
    'codebase-memory-mcp install',
    `codebase-memory-mcp cli index_repository ${JSON.stringify({ repo_path: target })}`
  ]);
  assert.equal(result.capabilityInstallResult.attempted, 3);
  assert.equal(result.capabilityInstallResult.succeeded, 3);
  assert.equal(result.capabilityInstallResult.failed, 0);
});

test('tui auto-installs context7 package and reports manual configuration steps', async () => {
  const target = await makeTempRepo();
  const executed = [];
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['', target, '1', '', 'yes', '1', '1', '2', 'yes', 'yes']),
    color: false,
    write: (message) => { output += message; },
    commandExists: async (command) => command === 'bun',
    runCommand: async ({ command, args }) => {
      executed.push(`${command} ${args.join(' ')}`);
      return { ok: true, code: 0 };
    }
  });

  assert.equal(result.applied, true);
  assert.deepEqual(executed, ['bun add -g @upstash/context7-mcp']);
  assert.equal(result.capabilityInstallResult.attempted, 1);
  assert.equal(result.capabilityInstallResult.succeeded, 1);
  assert.equal(result.capabilityInstallResult.failed, 0);
  assert.match(output, /Configuración manual necesaria:/);
  assert.match(output, /Context7 todavía requiere configurar el MCP a mano con tu API key\./);
});

test('tui capabilities-only mode runs optional capabilities without applying workflow files', async () => {
  const target = await makeTempRepo();
  const executed = [];

  const result = await runTui({
    ask: scriptedAsk(['6', target, '1', '3', '1', '2', 'yes']),
    color: false,
    write: () => {},
    commandExists: async (command) => command === 'bun',
    runCommand: async ({ command, args }) => {
      executed.push(`${command} ${args.join(' ')}`);
      return { ok: true, code: 0 };
    }
  });

  assert.equal(result.mode, 'capabilities-only');
  assert.equal(result.applied, false);
  assert.deepEqual(executed, [
    'bash -lc curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --ui',
    'codebase-memory-mcp install',
    `codebase-memory-mcp cli index_repository ${JSON.stringify({ repo_path: target })}`
  ]);
  await assert.rejects(fs.access(path.join(target, '.agents/instructions.md')), { code: 'ENOENT' });
});

test('tui update mode applies managed workflow updates without reinstall flow semantics', async () => {
  const target = await makeTempRepo();
  const installPlan = await buildInstallPlan({ targetPath: target, runtime: 'codex' });
  await applyInstallPlan(installPlan);
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['2', target, '1', '', '', 'yes']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.mode, 'update');
  assert.equal(result.applied, true);
  assert.equal(result.plan.previousToolkitVersion, null);
  assert.match(output, /Ediciones locales protegidas \(omitidas\):/);
  assert.match(output, /Versión de workflow-kit +: /);
  assert.match(output, /Versión del workflow del proyecto: sin registro/);
});

test('tui update shows the stack pack and the one-time migrations before applying', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'codex' }));
  // An install from before stack packs, in a repository that is not Rails + React.
  const statePath = path.join(target, installStateRelativePath);
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  delete state.stackPack;
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['2', target, '1', '', '', 'yes']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.mode, 'update');
  assert.equal(result.plan.stackPack, 'none');
  assert.match(output, /Stack pack +: none/);
  assert.match(output, /Migraciones \(se aplican una vez\)/);
  assert.match(output, /No stack pack: the repository does not look like Rails \+ React/);
  await assert.rejects(fs.access(path.join(target, '.agents/project/stack.md')), { code: 'ENOENT' });
});

// Round 4 (N8): install over an existing install stops right after the
// target is chosen, before any question it would ignore.
test('tui install over an installed repository stops before asking anything else and points to update', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'codex' }));
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['1', target, '', '', '', '', 'yes']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.deepEqual({ code: result.code, applied: result.applied }, { code: 1, applied: false });
  assert.match(output, /ya registra una instalación \(runtimes: codex\)\. Elige «Actualizar el workflow de un proyecto»/);
  assert.doesNotMatch(output, /Select one or more runtimes/);
});

test('tui update keeps every edited file pending when the user keeps the default', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'codex' }));
  await fs.writeFile(path.join(target, 'docs/workflow/README.md'), 'local override\n', 'utf8');

  let output = '';
  const result = await runTui({
    ask: scriptedAsk(['2', target, '2', '', '', '', 'yes']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.applied, true);
  assert.equal(await fs.readFile(path.join(target, 'docs/workflow/README.md'), 'utf8'), 'local override\n');
  assert.match(output, /Se detectaron 1 archivo\(s\) gestionados con ediciones locales\./);
  assert.deepEqual(optionsOf(output, editedFilesQuestion).map((option) => option.label), [
    'Conservar mis ediciones (recomendado)',
    'Reemplazar todos los archivos editados por la versión del kit',
    'Decidir archivo por archivo'
  ]);
  assert.equal(operationFor(result.plan, 'docs/workflow/README.md').operation, 'skip_modified');
});

// Final review 6 and 10: Replace all takes the kit version of every edited
// file, but an unmarked adapter whose kit text is intact keeps its own text
// (split); every replaced version is kept as a backup and project files stay.
test('tui Replace all takes the kit version with a backup and keeps the own text of an adapter split applies to', async () => {
  const { target, legacy } = await legacyRepoWithEdits();
  const ownNote = '\nOwn note for Claude.\n';
  await fs.appendFile(path.join(target, 'CLAUDE.md'), ownNote);
  const edited = Object.fromEntries(await Promise.all([instructionsPath, leafSkillPath, 'CLAUDE.md'].map(async (relativePath) => [relativePath, await fs.readFile(path.join(target, relativePath), 'utf8')])));

  let output = '';
  const result = await runTui({
    ask: scriptedAsk(['2', target, '', '2', '', '', 'yes']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.applied, true);
  const journal = JSON.parse(await fs.readFile(path.join(target, '.agents/workflow-kit/last-apply.json'), 'utf8'));
  for (const [relativePath, content] of Object.entries(edited)) {
    const entry = journal.files.find((file) => file.relativePath === relativePath);
    assert.equal(await fs.readFile(path.join(target, entry.backup), 'utf8'), content, `${relativePath}: backup of the edited version`);
  }
  assert.doesNotMatch(await fs.readFile(path.join(target, instructionsPath), 'utf8'), /Local edit\./);
  const claude = await fs.readFile(path.join(target, 'CLAUDE.md'), 'utf8');
  assert.match(claude, /<!-- workflow-kit:managed:start -->/);
  assert.ok(claude.includes(ownNote.trim()), 'CLAUDE.md keeps its own text');
  assert.equal(await fs.readFile(path.join(target, legacy.ownContext.newPath), 'utf8'), legacy.ownContext.content);
  assert.match(output, /Ediciones locales protegidas \(omitidas\): 0/);
});

// Round 4 (N7): where split does not apply (an adapter with Windows line
// endings), Replace all leaves the adapter pending instead of dropping its text.
test('tui Replace all leaves pending an unmarked adapter split cannot keep', async () => {
  const { target } = await legacyRepoWithEdits();
  const claudePath = path.join(target, 'CLAUDE.md');
  const crlf = `${await fs.readFile(claudePath, 'utf8')}\nOwn note for Claude.\n`.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n');
  await fs.writeFile(claudePath, crlf);

  let output = '';
  const result = await runTui({
    ask: scriptedAsk(['2', target, '', '2', '', '', 'yes']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.applied, true);
  assert.equal(await fs.readFile(claudePath, 'utf8'), crlf);
  assert.equal(operationFor(result.plan, 'CLAUDE.md').operation, 'skip_modified');
  assert.doesNotMatch(await fs.readFile(path.join(target, instructionsPath), 'utf8'), /Local edit\./);
  assert.match(output, /CLAUDE\.md queda pendiente: «Reemplazar todos» no puede conservar su texto propio/);
});

test('tui update decides file by file with only the valid decisions, a short diff, and lists the files it cannot ask about (AC-15)', async () => {
  const { target } = await legacyRepoWithEdits();
  // An own skill named like a kit skill stays pending with no decision.
  const ownCopy = '.agents/skills/06-patterns/local/router-copy/';
  await fs.mkdir(path.join(target, ownCopy), { recursive: true });
  await fs.writeFile(path.join(target, ownCopy, 'SKILL.md'), '---\nname: workflow-router\ndescription: Own copy.\n---\n');

  let output = '';
  const result = await runTui({
    // Runtimes: the recorded ones; then Decide file by file, discard the
    // instructions and shadow the leaf skill.
    ask: scriptedAsk(['2', target, '', '3', '2', '3', '', '', 'yes']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.applied, true);
  assert.deepEqual(optionsOf(output, `${instructionsPath}: ¿qué hace la actualización con tus ediciones?`).map((option) => option.label), [
    'Conservar mis ediciones en este archivo',
    'Tomar la versión del kit'
  ]);
  assert.deepEqual(optionsOf(output, `${leafSkillPath}: ¿qué hace la actualización con tus ediciones?`).map((option) => option.label), [
    'Conservar mis ediciones en este archivo',
    'Tomar la versión del kit',
    'Mover mi versión a un shadow del proyecto'
  ]);
  assert.match(output, /Copia tu versión a \.agents\/project\/shadows\/validation-runner\/ y toma la versión del kit/);
  // The short diff of what taking the kit version would change.
  assert.match(output, /^- Local edit\.$/m);
  assert.match(output, new RegExp(`${ownCopy.replaceAll('.', '\\.')} \\(kit_skill_name\\)`));
  assert.doesNotMatch(output, new RegExp(`${ownCopy.replaceAll('.', '\\.')}: ¿qué hace la actualización`));

  assert.doesNotMatch(await fs.readFile(path.join(target, instructionsPath), 'utf8'), /Local edit\./);
  assert.match(await fs.readFile(path.join(target, '.agents/project/shadows/validation-runner/SKILL.md'), 'utf8'), /\nLocal edit\.\n$/);
  assert.match(output, /Archivos retirados borrados \(con backup\): 1/);
  assert.match(output, /Archivos del proyecto movidos a \.agents\/project\/: 4/);
});

test('tui partial selection keeps the layout migration whole and lets a retired delete be deselected', async () => {
  const target = await makeTempRepo();
  const legacy = await installLegacy0181(target);
  let output = '';
  let offered = [];
  const keepAllButRetired = (written) => {
    offered = optionsOf(written, 'Elige los archivos a modificar');
    return offered.filter((option) => !option.label.startsWith(`${legacy.retiredPath} `)).map((option) => option.number).join(',');
  };

  const result = await runTui({
    ask: scriptedAsk(['2', target, '', '', keepAllButRetired, '', '', 'yes'], () => output),
    color: false,
    write: (message) => { output += message; },
    enableScriptedAdvancedPrompts: true
  });

  assert.equal(result.applied, true);
  assert.match(output, /La migración de layout \(\d+ archivos\) se aplica como un solo bloque y no se lista aquí\./);
  assert.ok(offered.some((option) => option.label.startsWith(`${legacy.retiredPath} `)), 'the retired delete is offered');
  const movedSource = `${legacy.localSkill.oldDir}/SKILL.md`;
  assert.ok(!offered.some((option) => option.label.startsWith(`${movedSource} `)), 'a migration operation is not offered');
  assert.equal(operationFor(result.plan, legacy.retiredPath), undefined);
  assert.equal(operationFor(result.plan, movedSource).operation, 'delete_with_backup');
  assert.equal(operationFor(result.plan, legacy.ownContext.newPath).operation, 'create');
  // Final review 10: what was applied, not only what was planned.
  const exists = (relativePath) => fs.access(path.join(target, relativePath)).then(() => true, () => false);
  assert.equal(await exists(legacy.retiredPath), true, 'the deselected retired file stays');
  assert.equal(await exists(movedSource), false);
  assert.equal(await exists(`.agents/project/skills/${legacy.localSkill.name}/SKILL.md`), true);
  assert.equal(await fs.readFile(path.join(target, legacy.ownContext.newPath), 'utf8'), legacy.ownContext.content);
  assert.equal(JSON.parse(await fs.readFile(path.join(target, installStateRelativePath), 'utf8')).schemaVersion, '2.0.0');
});

test('tui upgrade-toolkit mode runs the global upgrade command and exits without repo writes', async () => {
  const target = await makeTempRepo();
  const executed = [];

  const result = await runTui({
    ask: scriptedAsk(['5', '', 'yes']),
    color: false,
    write: () => {},
    commandExists: async (command) => command === 'bun',
    runUpgradeExecutor: async (plan, { cwd }) => {
      executed.push({ plan, cwd });
      return { ok: true, code: 0 };
    }
  });

  assert.equal(result.mode, 'upgrade-toolkit');
  assert.equal(result.applied, false);
  assert.equal(executed.length, 1);
  assert.equal(executed[0].cwd, os.homedir());
  assert.equal(executed[0].plan.command, 'bun');
  assert.deepEqual(executed[0].plan.args, ['add', '-g', 'github:xampo848/fhh-ia-ecosystem-workflow-kit#main']);
  assert.equal(executed[0].plan.spec, 'github:xampo848/fhh-ia-ecosystem-workflow-kit#main');
  await assert.rejects(fs.access(path.join(target, '.agents/instructions.md')), { code: 'ENOENT' });
});

test('tui main menu tells updating workflow-kit apart from updating a project workflow', async () => {
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['5', '', 'no']),
    color: false,
    write: (message) => { output += message; },
    commandExists: async (command) => command === 'bun',
    runUpgradeExecutor: async () => { throw new Error('upgrade must not run when the user declines'); }
  });

  assert.equal(result.mode, 'upgrade-toolkit');
  assert.match(output, /¿Qué quieres hacer\?/);
  assert.match(output, /Actualizar el workflow de un proyecto/);
  assert.match(output, /Actualizar workflow-kit \(esta herramienta\)/);
  assert.match(output, /No cambia ningún proyecto/);
  assert.match(output, /No actualiza workflow-kit\./);
  assert.match(output, /Esto actualiza workflow-kit en esta máquina\. Los proyectos quedan como están/);
  assert.match(output, /Cancelado\. workflow-kit no cambió\./);
  assert.doesNotMatch(output, /toolkit (binary|surface)/i);
});

test('tui export mode writes workflow files into the selected output directory', async () => {
  const target = await makeTempRepo('workflow-kit-tui-export-');
  let output = '';

  const result = await runTui({
    // Runtime 2 = Codex, which asks for its billing profile once.
    ask: scriptedAsk(['3', target, '2', '', '', '', 'yes']),
    env: {},
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.mode, 'export');
  assert.equal(result.applied, true);
  assert.match(output, /Exportación completada\./);
  assert.match(output, /Archivos exportados:/);
  await fs.access(path.join(target, '.agents/instructions.md'));
  await fs.access(path.join(target, 'AGENTS.md'));
});

// Round 6 (S1): the backup-mode and file-selection prompts rebuild the plan's
// state; an export keeps mode "export", so it can be exported over again.
test('tui export with the selection prompts records an export that can be refreshed', async () => {
  const target = await makeTempRepo('workflow-kit-tui-export-');
  // The second export has no file to write, so it asks no file selection.
  const exportAnswers = (selection = ['']) => scriptedAsk(['3', target, '1', '', '', ...selection, '', 'yes']);
  const exportOnce = (selection) => runTui({ ask: exportAnswers(selection), env: {}, color: false, write: () => {}, enableScriptedAdvancedPrompts: true });

  assert.equal((await exportOnce()).applied, true);
  assert.equal(JSON.parse(await fs.readFile(path.join(target, installStateRelativePath), 'utf8')).mode, 'export');
  const before = await hashTree(target);
  assert.equal((await exportOnce([])).applied, true, 'TUI export again');
  assert.deepEqual(await hashTree(target), before, 'the second export writes nothing');
  const io = createMemoryIo();
  assert.equal(await runCli(['export', '--output', target, '--apply', '--yes'], io), 0, io.output.stderr);
});

// Round 5 (R1): the TUI export stops over an installed repository root too.
test('tui export stops over an installed repository root and leaves it untouched', async () => {
  const legacy = await makeTempRepo();
  await installLegacy0181(legacy);
  const installed = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: installed, runtime: 'codex' }));
  for (const [name, target, message] of [
    ['1.0.0 install', legacy, /uses install-state 1\.0\.0/],
    ['2.0.0 install', installed, /records an install, not an export/]
  ]) {
    const before = await hashTree(target);
    await assert.rejects(runTui({
      ask: scriptedAsk(['3', target, '1', '', '', '', 'yes']),
      env: {},
      color: false,
      write: () => {}
    }), message, name);
    assert.deepEqual(await hashTree(target), before, name);
  }
});

test('tui doctor mode reports repository diagnostics without writing files', async () => {
  const target = await makeTempRepo('workflow-kit-tui-doctor-');
  let output = '';

  const result = await runTui({
    ask: scriptedAsk(['4', target, '1']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.mode, 'doctor');
  assert.equal(result.applied, false);
  assert.equal(result.code, 1);
  assert.match(output, /Doctor: failed/);
  assert.match(output, /Missing files:/);
  await assert.rejects(fs.access(path.join(target, '.agents/instructions.md')), { code: 'ENOENT' });
});

test('tui preselects the costo profile when an API key is present and installs matching agents', async () => {
  const target = await makeTempRepo();
  let output = '';

  // Runtime 4 = Claude Code; the empty answer accepts the preselected costo profile.
  const result = await runTui({
    ask: scriptedAsk(['', target, '4', '', '', '', 'yes']),
    color: false,
    env: { ANTHROPIC_API_KEY: 'test-only-not-a-real-key' },
    write: (message) => { output += message; }
  });

  assert.equal(result.applied, true);
  assert.match(output, /ANTHROPIC_API_KEY está definida/);
  const sherlock = await fs.readFile(path.join(target, '.claude/agents/sherlock-estructura.md'), 'utf8');
  assert.match(sherlock, /^model: haiku$/m);
  const state = JSON.parse(await fs.readFile(path.join(target, '.agents/workflow-kit/install-state.json'), 'utf8'));
  assert.deepEqual(state.modelProfiles, { claude: 'costo' });
});

// Without a terminal every prompt ends at once; that is not a cancel by the
// user, and exit 0 would read as success in a script.
test('tui with stdin at end of file or a pipe exits 2 and says it needs a terminal', async () => {
  const { spawnSync } = await import('node:child_process');
  const bin = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'bin', 'workflow-kit.mjs');
  const cwd = await makeTempRepo();
  for (const input of [{ stdio: ['ignore', 'pipe', 'pipe'] }, { input: '1\n' }]) {
    const result = spawnSync(process.execPath, [bin, 'tui'], { cwd, encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' }, timeout: 20000, ...input });
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stderr, /^workflow-kit tui needs an interactive terminal \(stdin is not one\)\. In scripts, use the commands instead/m);
    assert.doesNotMatch(result.stdout + result.stderr, /Canceled by user|Cancelado por ti/);
  }
  assert.deepEqual(await fs.readdir(cwd), []);

  const errors = [];
  const result = await runTui({ write: () => {}, writeError: (text) => errors.push(text), stdin: { isTTY: false } });
  assert.deepEqual(result, { code: 2, applied: false });
  assert.equal(errors.length, 1);
});

// The two lines the CLI update summary gained with the apply lock work: seeds
// the project owns are counted apart from unmanaged files, and a delete the
// apply did not do because the file changed since the plan is listed.
test('tui update summary counts project-owned seeds apart and lists a delete kept because the file changed since the plan', async () => {
  const owned = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: owned, runtime: 'neutral' }));
  let ownedOutput = '';
  const ownedResult = await runTui({ ask: scriptedAsk(['2', owned, '', '', '', 'yes']), color: false, write: (message) => { ownedOutput += message; } });
  assert.equal(ownedResult.applied, true);
  assert.match(ownedOutput, /^Archivos no gestionados \(omitidos\): 0$/m, 'a seed the project owns is not an unmanaged file');
  assert.match(ownedOutput, /^Archivos del proyecto que se dejan como están: [1-9]\d*$/m);
  assert.doesNotMatch(ownedOutput, /No se borraron/, 'the line appears only when a delete was kept');

  const target = await makeTempRepo();
  const legacy = await installLegacy0181(target);
  let output = '';
  const editRetiredThenConfirm = async () => {
    await fs.appendFile(path.join(target, legacy.retiredPath), '\nEdited after the plan.\n');
    return 'yes';
  };
  const result = await runTui({ ask: scriptedAsk(['2', target, '', '', '', '', '', editRetiredThenConfirm], () => output), color: false, write: (message) => { output += message; }, enableScriptedAdvancedPrompts: true });
  assert.equal(result.applied, true, output.slice(-1500));
  assert.match(output, /^No se borraron \(cambiaron desde el plan, quedan como están\): 1$/m);
  assert.match(await fs.readFile(path.join(target, legacy.retiredPath), 'utf8'), /Edited after the plan\./, 'the changed file was kept');
});
