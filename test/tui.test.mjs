import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { buildInstallPlan, installStateRelativePath } from '../src/planner.mjs';
import { runTui } from '../src/tui.mjs';
import { installLegacy0181 } from './fixtures/legacy-0.18.1/install.mjs';
import { makeTempRepo } from './helpers.mjs';

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
const editedFilesQuestion = 'Some workflow files in this project have your own edits. What should the update do with them?';

// The numbered options of the last question with this title, as printed.
function optionsOf(output, title) {
  const lines = output.split('\n');
  const start = lines.lastIndexOf(title);
  assert.ok(start > -1, `question not shown: ${title}`);
  const options = [];
  for (const line of lines.slice(start + 1)) {
    const match = line.match(/^  (\d+)\) (.+?)( \(default\))?$/);
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
  assert.match(output, /Full FHH IA Ecosystem flow selected \(recommended\)\./);
  assert.match(output, /Mission control/);
  assert.match(output, /Legacy docs are not moved automatically/);
  assert.match(output, /Aborted\. No files were written\./);
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
  assert.match(output, /Apply completed successfully\./);
  assert.match(output, /Applied writes:/);
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
  assert.match(output, /Applied writes: 1/);
  assert.match(output, /Backups created: 0/);
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
  assert.match(output, /Manual configuration required:/);
  assert.match(output, /Context7 still requires manual MCP configuration with your API key\./);
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
  assert.match(output, /Protected local edits \(skipped\):/);
  assert.match(output, /workflow-kit version +: /);
  assert.match(output, /Project workflow version: none recorded/);
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
  assert.match(output, /Migrations \(applied once\)/);
  assert.match(output, /No stack pack: the repository does not look like Rails \+ React/);
  await assert.rejects(fs.access(path.join(target, '.agents/project/stack.md')), { code: 'ENOENT' });
});

test('tui update keeps every edited file pending when the user keeps the default', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'codex' }));
  await fs.writeFile(path.join(target, 'docs/workflow/README.md'), 'local override\n', 'utf8');

  let output = '';
  const result = await runTui({
    ask: scriptedAsk(['2', target, '2', '', '', '', 'no']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.applied, false);
  assert.match(output, /Detected 1 managed file\(s\) with local edits\./);
  assert.deepEqual(optionsOf(output, editedFilesQuestion).map((option) => option.label), [
    'Keep my edits (recommended)',
    'Replace all edited files with the kit version',
    'Decide file by file'
  ]);
  assert.equal(operationFor(result.plan, 'docs/workflow/README.md').operation, 'skip_modified');
});

test('tui update replaces every edited file with the kit version when the user picks Replace all', async () => {
  const target = await makeTempRepo();
  const installPlan = await buildInstallPlan({ targetPath: target, runtime: 'codex' });
  await applyInstallPlan(installPlan);
  await fs.writeFile(path.join(target, 'docs/workflow/README.md'), 'local override\n', 'utf8');

  let output = '';
  const result = await runTui({
    ask: scriptedAsk(['2', target, '2', '2', '', '', 'yes']),
    color: false,
    write: (message) => { output += message; }
  });

  assert.equal(result.mode, 'update');
  assert.equal(result.applied, true);
  assert.match(output, /Protected local edits \(skipped\): 0/);
  assert.match(output, /Backups created: [1-9]/);

  const docsContent = await fs.readFile(path.join(target, 'docs/workflow/README.md'), 'utf8');
  assert.notEqual(docsContent, 'local override\n');
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
  assert.deepEqual(optionsOf(output, `${instructionsPath}: what should the update do with your edits?`).map((option) => option.label), [
    'Keep my edits in this file',
    'Take the kit version'
  ]);
  assert.deepEqual(optionsOf(output, `${leafSkillPath}: what should the update do with your edits?`).map((option) => option.label), [
    'Keep my edits in this file',
    'Take the kit version',
    'Move my version to a project shadow'
  ]);
  assert.match(output, /Copy your version to \.agents\/project\/shadows\/validation-runner\/ and take the kit version/);
  // The short diff of what taking the kit version would change.
  assert.match(output, /^- Local edit\.$/m);
  assert.match(output, new RegExp(`${ownCopy.replaceAll('.', '\\.')} \\(kit_skill_name\\)`));
  assert.doesNotMatch(output, new RegExp(`${ownCopy.replaceAll('.', '\\.')}: what should the update`));

  assert.doesNotMatch(await fs.readFile(path.join(target, instructionsPath), 'utf8'), /Local edit\./);
  assert.match(await fs.readFile(path.join(target, '.agents/project/shadows/validation-runner/SKILL.md'), 'utf8'), /\nLocal edit\.\n$/);
  assert.match(output, /Retired files deleted \(backup kept\): 1/);
  assert.match(output, /Project files moved to \.agents\/project\/: 4/);
});

test('tui partial selection keeps the layout migration whole and lets a retired delete be deselected', async () => {
  const target = await makeTempRepo();
  const legacy = await installLegacy0181(target);
  let output = '';
  let offered = [];
  const keepAllButRetired = (written) => {
    offered = optionsOf(written, 'Select files to modify');
    return offered.filter((option) => !option.label.startsWith(`${legacy.retiredPath} `)).map((option) => option.number).join(',');
  };

  const result = await runTui({
    ask: scriptedAsk(['2', target, '', '', keepAllButRetired, '', '', 'no'], () => output),
    color: false,
    write: (message) => { output += message; },
    enableScriptedAdvancedPrompts: true
  });

  assert.equal(result.applied, false);
  assert.match(output, /The layout migration \(\d+ files\) is applied as one block and is not listed here\./);
  assert.ok(offered.some((option) => option.label.startsWith(`${legacy.retiredPath} `)), 'the retired delete is offered');
  const movedSource = `${legacy.localSkill.oldDir}/SKILL.md`;
  assert.ok(!offered.some((option) => option.label.startsWith(`${movedSource} `)), 'a migration operation is not offered');
  assert.equal(operationFor(result.plan, legacy.retiredPath), undefined);
  assert.equal(operationFor(result.plan, movedSource).operation, 'delete_with_backup');
  assert.equal(operationFor(result.plan, legacy.ownContext.newPath).operation, 'create');
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
  assert.match(output, /This updates workflow-kit itself on this machine\. Projects stay as they are/);
  assert.match(output, /Aborted\. workflow-kit was not changed\./);
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
  assert.match(output, /Export completed successfully\./);
  assert.match(output, /Exported files:/);
  await fs.access(path.join(target, '.agents/instructions.md'));
  await fs.access(path.join(target, 'AGENTS.md'));
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
