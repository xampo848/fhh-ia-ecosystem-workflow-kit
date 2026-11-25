import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { parseArgs } from '../src/cli/args.mjs';
import { runDoctor } from '../src/doctor.mjs';
import { extractManagedBlock } from '../src/kit-manifest.mjs';
import { loadDelegateCatalog, renderClaudeAgent, renderCopilotAgent } from '../src/model-profiles.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan, installStateRelativePath, selectPlanOperations } from '../src/planner.mjs';
// Namespace import: before the slice exists each test fails on its own
// missing export instead of the whole file failing to load.
import * as pluginMode from '../src/plugin-mode.mjs';
import { runtimeEntrypoints } from '../src/runtime-matrix.mjs';
import { validateAdapterContracts } from '../src/workflow-contract/adapters.mjs';
import packageJson from '../package.json' with { type: 'json' };
import { installLegacy0181 } from './fixtures/legacy-0.18.1/install.mjs';
import { collectRepoModePlans, planShape, fixturePath as repoModePlansFixture } from './fixtures/plugin-mode/repo-mode-plans.mjs';
import { createMemoryIo, hashTree, makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const runtimeTemplates = path.join(root, 'templates', 'runtime-adapters');
const managedBlockName = 'workflow-kit:managed';
const pluginId = 'fhh@fhh-ia-ecosystem';
const claudeInstall = 'claude plugin install fhh@fhh-ia-ecosystem --scope project';
const copilotInstall = 'copilot plugin install fhh@fhh-ia-ecosystem';
const settingsPaths = { claude: '.claude/settings.json', copilot: '.github/copilot/settings.json' };
const seedPaths = ['.agents/project/backend.md', '.agents/project/context.md', '.agents/project/frontend.md', '.agents/project/paths.json', '.agents/project/quality-gate.md'];
const adapterTemplates = {
  'AGENTS.md': 'agents-md/AGENTS.md',
  'CLAUDE.md': 'claude/CLAUDE.md',
  '.github/copilot-instructions.md': 'copilot/.github/copilot-instructions.md',
  '.github/instructions/ai-workflow.instructions.md': 'copilot/.github/instructions/ai-workflow.instructions.md'
};

const read = (target, relativePath) => fs.readFile(path.join(target, relativePath), 'utf8');
const exists = (target, relativePath) => fs.access(path.join(target, relativePath)).then(() => true, () => false);
const operationFor = (plan, relativePath) => plan.operations.find((item) => item.relativePath === relativePath);
const blockOf = (content) => extractManagedBlock(content, managedBlockName).block;
async function write(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}
// Doctor in plugin mode lists the installed Claude plugins; tests never run
// the real binary: this double answers that this CLI's version is installed.
const listsCurrentPlugin = async () => ({ code: 0, stdout: JSON.stringify([{ id: pluginId, version: packageJson.version, enabled: true }]) });
// D16: each path is reported as an untracked adapter naming the command that
// keeps it, and the deletion that drops it; nothing else is untracked.
function assertUntracked(result, relativePaths, keepCommand) {
  const untracked = result.diagnostics.filter((item) => item.code === 'mode/adapter-not-tracked');
  assert.deepEqual(untracked.map((item) => item.path).sort(), [...relativePaths].sort(), JSON.stringify(result.diagnostics, null, 2));
  for (const item of untracked) {
    assert.equal(item.severity, 'warning', item.path);
    assert.ok(item.message.includes(`\`${keepCommand}\``) && /delete/i.test(item.message), `${item.path}: ${item.message}`);
  }
}
const pluginPlan = (target, extra = {}) => buildInstallPlan({ targetPath: target, mode: 'plugin', ...extra });
const pluginInstall = async (target, extra = {}) => applyInstallPlan(await pluginPlan(target, { runtime: 'claude', ...extra }));
const stateOf = async (target) => JSON.parse(await read(target, installStateRelativePath));
const repoInstall = async (target, runtime = 'claude') => applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime }));
const backupSuffix = /\.workflow-kit-backup-\d{8}T\d{6}Z$/;
const writingOperations = (plan) => plan.operations.filter((item) => !['unchanged', 'skip_unmanaged', 'skip_modified', 'adopt_existing'].includes(item.operation));
async function cli(args) {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, ...io.output };
}
// The tree without the kit's own bookkeeping (install-state and the apply
// journal), which every apply rewrites.
async function projectTree(target) {
  return Object.fromEntries(Object.entries(await hashTree(target)).filter(([relativePath]) => !relativePath.startsWith('.agents/workflow-kit')));
}

// AC-5 (PRD 2.3): the files the kit owns are the adapters and derived files it
// plans, the settings declaration and install-state; the seeds and .gitignore
// belong to the project.
test('AC-5: init --mode plugin plans only the plugin-mode files, counted per runtime, and records mode plugin', async () => {
  const cases = [
    { runtime: 'claude', kitOwned: 3, seeds: seedPaths },
    { runtime: 'copilot', kitOwned: 6, seeds: seedPaths },
    { runtime: 'claude,copilot', kitOwned: 8, seeds: seedPaths },
    // neutral next to a plugin runtime adds nothing (and has no agents to skip).
    { runtime: 'neutral,claude', profile: 'claude=calidad', kitOwned: 3, seeds: seedPaths },
    { runtime: 'claude', stack: 'rails-react', kitOwned: 3, seeds: [...seedPaths, '.agents/project/stack.md'].sort() }
  ];
  for (const { runtime, profile, stack, kitOwned, seeds } of cases) {
    const target = await makeTempRepo();
    const plan = await pluginPlan(target, { runtime, profile, stack });
    const runtimes = runtime.split(',').filter((name) => name !== 'neutral');
    const settings = runtimes.map((name) => settingsPaths[name]).sort();
    const label = `${runtime}${stack ? ` + ${stack}` : ''}`;

    const owned = plan.operations.filter((item) => ['adapter', 'derived'].includes(item.class) || settings.includes(item.relativePath));
    assert.equal(owned.length + 1, kitOwned, `${label}: ${owned.map((item) => item.relativePath).join(', ')} + install-state`);
    assert.deepEqual(plan.operations.filter((item) => item.class === 'seed').map((item) => item.relativePath), seeds, label);
    assert.ok(operationFor(plan, '.gitignore'), label);
    assert.equal(plan.operations.length, owned.length + seeds.length + 1, `${label}: nothing else is planned`);
    // Adapters are exactly the chosen runtimes' entrypoints; the only derived
    // files are the Copilot instruction wrappers; no kit file, no docs/workflow.
    assert.deepEqual(plan.operations.filter((item) => item.class === 'adapter').map((item) => item.relativePath).sort(),
      [...new Set(runtimes.flatMap((name) => runtimeEntrypoints[name]))].sort(), label);
    assert.ok(plan.operations.filter((item) => item.class === 'derived').every((item) => item.relativePath.startsWith('.github/instructions/')), label);
    assert.equal(plan.operations.some((item) => item.class === 'kit' || item.relativePath.startsWith('docs/')), false, label);
    assert.deepEqual(plan.operations.filter((item) => !item.class).map((item) => item.relativePath).sort(), ['.gitignore', ...settings].sort(), label);
    assert.equal(plan.nextInstallState.mode, 'plugin', label);

    await applyInstallPlan(plan);
    const state = JSON.parse(await read(target, installStateRelativePath));
    assert.equal(state.mode, 'plugin', label);
    assert.equal(state.schemaVersion, '2.0.0', label);
    assert.deepEqual(Object.keys(state.files).sort(), plan.operations.filter((item) => item.class).map((item) => item.relativePath).sort(), `${label}: settings and .gitignore stay out of files`);
    assert.equal(await exists(target, '.agents/instructions.md'), false, label);
  }
});

test('AC-5 wiring: the CLI dry run writes nothing and says plugin mode; the apply prints the install command per runtime', async () => {
  const target = await makeTempRepo();
  const dryRun = createMemoryIo();
  assert.equal(await runCli(['init', '--target', target, '--mode', 'plugin', '--runtime', 'claude,copilot'], dryRun), 0, dryRun.output.stderr);
  assert.match(dryRun.output.stdout, /^Install mode: plugin$/m);
  assert.deepEqual(await fs.readdir(target), []);

  const apply = createMemoryIo();
  assert.equal(await runCli(['init', '--target', target, '--mode', 'plugin', '--runtime', 'claude,copilot', '--apply', '--yes'], apply), 0, apply.output.stderr);
  assert.ok(apply.output.stdout.includes(claudeInstall), apply.output.stdout);
  assert.ok(apply.output.stdout.includes(copilotInstall), apply.output.stdout);
  assert.match(apply.output.stdout, /once per clone/);
  assert.equal(JSON.parse(await read(target, installStateRelativePath)).mode, 'plugin');
});

// AC-6 (PRD 2.2): the managed block is the repo-mode template block plus the
// kit-location block right after its start marker; own text stays outside.
test('AC-6: the adapters carry the template block plus kit-location, keep own text, and pass the adapter contract', async () => {
  const ownText = '# Our team rules\n\nUse tabs in this repository.\n';
  const cases = [
    { name: 'empty repository', runtime: 'claude,copilot', own: null },
    { name: 'own CLAUDE.md without markers', runtime: 'claude', own: ownText }
  ];
  for (const { name, runtime, own } of cases) {
    const target = await makeTempRepo();
    if (own !== null) await write(target, 'CLAUDE.md', own);
    const plan = await pluginPlan(target, { runtime });
    await applyInstallPlan(plan);

    const entrypoints = [...new Set(runtime.split(',').flatMap((item) => runtimeEntrypoints[item]))];
    for (const relativePath of entrypoints) {
      const template = await fs.readFile(path.join(runtimeTemplates, adapterTemplates[relativePath]), 'utf8');
      const expected = pluginMode.pluginAdapterContent(template, managedBlockName);
      const written = await read(target, relativePath);
      const block = blockOf(written);
      assert.equal(block, blockOf(expected), `${name}: ${relativePath}`);

      // The kit-location block sits right after the start marker, and removing
      // it gives back the repo-mode template byte for byte.
      const location = extractManagedBlock(block, 'workflow-kit:kit-location').block;
      assert.ok(block.startsWith(`<!-- ${managedBlockName}:start -->\n${location}`), `${name}: ${relativePath}`);
      assert.equal(expected.replace(`${location}\n`, '').replace(`<!-- ${managedBlockName}:start -->\n\n`, `<!-- ${managedBlockName}:start -->\n`), template, `${name}: ${relativePath}`);
      for (const required of ['`fhh`', 'fhh:kit-root', pluginMode.pluginPathRule, claudeInstall, copilotInstall, 'N0']) {
        assert.ok(location.includes(required), `${name}: ${relativePath} kit-location names ${required}`);
      }
      if (own === null) assert.equal(written, expected, `${name}: ${relativePath}`);
    }
    if (own !== null) {
      const written = await read(target, 'CLAUDE.md');
      assert.ok(written.endsWith(own), name);
      assert.equal(blockOf(written).includes('Our team rules'), false, name);
    }
    assert.deepEqual(await validateAdapterContracts({ root: target, runtimes: runtime.split(',') }), [], name);
  }
});

// AC-7 (PRD 2.3, "Declaración"): every settings case at the plan layer, and
// what the apply leaves on disk.
test('AC-7: the settings declaration is created, merged keeping other keys and order, left alone when declared, and never touched when invalid', async () => {
  const declared = {
    extraKnownMarketplaces: { 'fhh-ia-ecosystem': { source: { source: 'github', repo: pluginMode.marketplaceRepository } } },
    enabledPlugins: { [pluginId]: true }
  };
  const others = { permissions: { allow: ['Bash(npm test)'] }, enabledPlugins: { 'other@market': true }, extraKnownMarketplaces: { market: { source: { source: 'github', repo: 'someone/market' } } }, model: 'opus' };
  const cases = [
    { name: 'missing', existing: null, operation: 'create', expected: declared },
    {
      name: 'other keys (with --backup-mode none)',
      existing: `${JSON.stringify(others, null, 4)}\n`,
      backupMode: 'none',
      operation: 'merge_with_backup',
      expected: {
        permissions: others.permissions,
        enabledPlugins: { 'other@market': true, [pluginId]: true },
        extraKnownMarketplaces: { ...others.extraKnownMarketplaces, ...declared.extraKnownMarketplaces },
        model: 'opus'
      }
    },
    // D15: what the project decided stays, and the plan says why.
    { name: 'plugin disabled by the project', existing: `${JSON.stringify({ enabledPlugins: { [pluginId]: false } })}\n`, operation: 'skip_unmanaged', reason: 'plugin_disabled_by_project', note: `enabledPlugins["${pluginId}"]` },
    { name: 'own marketplace entry', existing: `${JSON.stringify({ extraKnownMarketplaces: { 'fhh-ia-ecosystem': { source: { source: 'github', repo: 'fork/kit' } } } }, null, 2)}\n`, operation: 'skip_unmanaged', reason: 'marketplace_customized', note: 'extraKnownMarketplaces["fhh-ia-ecosystem"]' },
    { name: 'already declared', existing: `${JSON.stringify({ theme: 'dark', ...declared }, null, 2)}\n`, operation: 'unchanged' },
    { name: 'invalid JSON', existing: '{ "enabledPlugins": ', operation: 'skip_unmanaged', reason: 'invalid_settings_json' },
    { name: 'JSON array', existing: '[]\n', operation: 'skip_unmanaged', reason: 'invalid_settings_json' },
    { name: 'enabledPlugins is not an object', existing: '{ "enabledPlugins": ["x"] }\n', operation: 'skip_unmanaged', reason: 'invalid_settings_json' }
  ];
  for (const { name, existing, backupMode, operation, reason, note, expected } of cases) {
    const target = await makeTempRepo();
    if (existing !== null) await write(target, settingsPaths.claude, existing);
    const plan = await pluginPlan(target, { runtime: 'claude', backupMode });
    const planned = operationFor(plan, settingsPaths.claude);
    assert.equal(planned.operation, operation, name);
    assert.equal(planned.class, undefined, `${name}: user-owned, no class`);

    await applyInstallPlan(plan);
    const after = await read(target, settingsPaths.claude);
    if (expected) {
      const parsed = JSON.parse(after);
      assert.deepEqual(parsed, expected, name);
      // deepEqual ignores key order: the merge keeps the file's order.
      assert.deepEqual(Object.keys(parsed), Object.keys(expected), name);
      assert.deepEqual(Object.keys(parsed.enabledPlugins), Object.keys(expected.enabledPlugins), name);
    } else {
      assert.equal(after, existing, `${name}: byte-identical`);
    }
    if (operation === 'merge_with_backup') {
      const backups = (await fs.readdir(path.join(target, '.claude'))).filter((file) => file.startsWith('settings.json.workflow-kit-backup-'));
      assert.equal(backups.length, 1, `${name}: always keeps a backup`);
    }
    if (operation === 'skip_unmanaged') {
      assert.equal(planned.reason, reason, name);
      const output = formatPlan(plan);
      const line = `- skip_unmanaged: ${settingsPaths.claude} (${reason})`;
      assert.ok(output.includes(line), output);
      const rest = output.slice(output.indexOf(line) + line.length).split('\nSummary:')[0];
      if (note) assert.ok(rest.split('\n')[0].includes(note), `${name}: the plan line names ${note}\n${output}`);
      else assert.deepEqual(JSON.parse(rest.slice(rest.indexOf('{'), rest.lastIndexOf('}') + 1)), declared, `${name}: the fragment to add by hand`);
    }
    assert.equal(JSON.parse(await read(target, installStateRelativePath)).files[settingsPaths.claude], undefined, name);
  }
});

// AC-8 (PRD 2.4, T3, T12, T15): each stop writes nothing and names a command
// that works; for T3 the test runs that command.
test('AC-8: --mode stops name the next command, write nothing, and the named command works', async () => {
  const cases = [
    { name: 'unknown mode value', args: (target) => ['init', '--target', target, '--mode', 'cloud'], names: [/repo/, /plugin/], next: (target) => `workflow-kit init --target ${target} --mode repo` },
    { name: 'runtime without plugin (T3)', args: (target) => ['init', '--target', target, '--mode', 'plugin', '--runtime', 'codex'], names: [/--runtime claude,copilot/], next: () => 'workflow-kit init --mode repo --runtime codex' },
    { name: 'no runtime (T3)', args: (target) => ['init', '--target', target, '--mode', 'plugin'], names: [/--runtime claude,copilot/], next: () => 'workflow-kit init --mode repo' },
    { name: 'export (T12)', args: (target) => ['export', '--output', target, '--mode', 'plugin'], names: [/export has no install mode/], next: () => 'workflow-kit export --output <path>' },
    { name: 'doctor (T15)', args: (target) => ['doctor', '--target', target, '--mode', 'plugin'], names: [/init and update/], next: (target) => `workflow-kit doctor --target ${target}` }
  ];
  for (const { name, args, names, next } of cases) {
    const target = await makeTempRepo();
    const before = await hashTree(target);
    const io = createMemoryIo();
    assert.notEqual(await runCli(args(target), io), 0, name);
    for (const pattern of names) assert.match(io.output.stderr, pattern, name);
    const command = next(target);
    assert.ok(io.output.stderr.includes(command), `${name}: names ${command}\n${io.output.stderr}`);
    assert.match(io.output.stderr, /Nothing was written/, name);
    assert.deepEqual(await hashTree(target), before, name);
    if (name.includes('T3')) {
      const rerun = createMemoryIo();
      const [, ...flags] = command.split(' ');
      assert.equal(await runCli([...flags, '--target', target], rerun), 0, `${name}: ${command}\n${rerun.output.stderr}`);
      const plugin = createMemoryIo();
      assert.equal(await runCli(['init', '--target', target, '--mode', 'plugin', '--runtime', 'claude'], plugin), 0, `${name}: --runtime claude\n${plugin.output.stderr}`);
    }
  }
  assert.equal(parseArgs(['init', '--mode', 'plugin']).mode, 'plugin');
  assert.equal(parseArgs(['update', '--mode', 'repo']).mode, 'repo');
});

// D2: the plugin ships the default profile; a project with another profile
// gets its own agents, rendered with the plugin variant and that profile.
test('a non-default profile at init writes the 13 plugin-variant agents of that runtime with its models', async () => {
  const catalog = await loadDelegateCatalog();
  const cases = [
    { runtime: 'claude', profile: 'costo', pathOf: (slug) => `.claude/agents/${slug}.md`, render: renderClaudeAgent },
    { runtime: 'copilot', profile: 'calidad', pathOf: (slug) => `.github/agents/${slug}.agent.md`, render: renderCopilotAgent }
  ];
  for (const { runtime, profile, pathOf, render } of cases) {
    const target = await makeTempRepo();
    const plan = await pluginPlan(target, { runtime, profile: `${runtime}=${profile}` });
    const agents = plan.operations.filter((item) => item.relativePath.startsWith(path.dirname(pathOf('x'))));
    assert.equal(agents.length, 13, runtime);
    for (const agent of catalog.agents) {
      const planned = operationFor(plan, pathOf(agent.slug));
      assert.equal(planned.class, 'derived', `${runtime}: ${agent.slug}`);
      assert.equal(planned.content, render(agent, catalog, profile, pluginMode.pluginName), `${runtime}: ${agent.slug}`);
    }
    assert.equal(plan.nextInstallState.modelProfiles[runtime], profile, runtime);
    await applyInstallPlan(plan);
    assert.ok(JSON.parse(await read(target, installStateRelativePath)).files[pathOf(catalog.agents[0].slug)], runtime);
  }
});

// AC-19 and T6 guards: the repo-mode plans of init and of the update that
// follows it, without --mode and with --mode repo, are those of commit 558e9fb
// (the last one before plugin mode): operation, path and class of every file,
// for claude, copilot and claude,codex. The fixture comes from running that
// commit's own modules, exported with `git archive 558e9fb`; its header says
// how to regenerate it.
const repoModeFixture = async () => JSON.parse(await fs.readFile(repoModePlansFixture, 'utf8'));
const sourceRoot = path.join(root, 'src');

test('AC-19 guard: init and update without --mode and with --mode repo plan what 558e9fb planned', async () => {
  const fixture = await repoModeFixture();
  for (const planOptions of [{}, { mode: 'repo' }]) {
    assert.deepEqual(await collectRepoModePlans(sourceRoot, makeTempRepo, planOptions), fixture, JSON.stringify(planOptions));
  }
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'claude,copilot', profile: 'claude=costo' });
  assert.equal(plan.nextInstallState.mode, 'repo');
  assert.equal(formatPlan(plan).includes('Install mode'), false);
  assert.equal(operationFor(plan, settingsPaths.claude), undefined);
  assert.equal(blockOf(operationFor(plan, 'CLAUDE.md').content).includes('kit-location'), false);
});

// AC-9 (PRD 2.4, T8): update keeps the recorded plugin mode, a second run has
// nothing to write, and nothing the project owns changes.
test('AC-9: update keeps plugin mode, the second run writes nothing, project content stays, and a filtered plan keeps the mode', async () => {
  const target = await makeTempRepo();
  await pluginInstall(target);
  await write(target, '.agents/project/context.md', '# Our context\n\nEdited by the team.\n');
  await fs.appendFile(path.join(target, 'CLAUDE.md'), '\n## Our own rules\n\nKeep this.\n');
  await write(target, settingsPaths.claude, `${JSON.stringify({ model: 'opus', ...JSON.parse(await read(target, settingsPaths.claude)) }, null, 2)}\n`);
  const before = await projectTree(target);

  const first = await cli(['update', '--target', target, '--apply', '--yes']);
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /^Install mode: plugin$/m);
  assert.ok(first.stdout.includes(claudeInstall), first.stdout);
  assert.equal((await stateOf(target)).mode, 'plugin');
  assert.deepEqual(await projectTree(target), before, 'the first update changes nothing the project owns');

  const second = await buildUpdatePlan({ targetPath: target });
  assert.deepEqual(writingOperations(second), []);
  assert.equal(operationFor(second, settingsPaths.claude).operation, 'unchanged');
  assert.equal(operationFor(second, '.agents/instructions.md'), undefined, 'no kit file is planned');
  assert.equal(second.nextInstallState.mode, 'plugin');
  await applyInstallPlan(second);
  assert.equal((await stateOf(target)).mode, 'plugin');
  assert.deepEqual(await projectTree(target), before, 'the second update changes nothing');

  const filtered = selectPlanOperations(await buildUpdatePlan({ targetPath: target }), []);
  assert.equal(filtered.nextInstallState.mode, 'plugin');
  await applyInstallPlan(filtered);
  assert.equal((await stateOf(target)).mode, 'plugin');
});

// T16 for a normal update: the journal restores the files and the previous
// state, which was in plugin mode.
test('T16: rollback of a plugin-mode update that wrote restores the files and the state stays in plugin mode', async () => {
  const target = await makeTempRepo();
  await pluginInstall(target);
  // An older kit text in the block: the repo-mode block, without kit-location.
  const current = await read(target, 'CLAUDE.md');
  const template = await fs.readFile(path.join(runtimeTemplates, adapterTemplates['CLAUDE.md']), 'utf8');
  const older = current.replace(blockOf(current), blockOf(template));
  await write(target, 'CLAUDE.md', older);
  const stateBefore = await read(target, installStateRelativePath);

  const update = await cli(['update', '--target', target, '--profile', 'claude=costo', '--apply', '--yes']);
  assert.equal(update.code, 0, update.stderr);
  assert.equal(await read(target, 'CLAUDE.md'), current);
  assert.equal((await fs.readdir(path.join(target, '.claude', 'agents'))).length, 13);
  assert.equal((await stateOf(target)).mode, 'plugin');

  const rollback = await cli(['rollback', '--target', target, '--apply', '--yes']);
  assert.equal(rollback.code, 0, rollback.stderr);
  assert.equal(await read(target, 'CLAUDE.md'), older);
  assert.equal(await exists(target, '.claude/agents'), false);
  assert.equal(await read(target, installStateRelativePath), stateBefore);
  assert.equal(JSON.parse(stateBefore).mode, 'plugin');
});

// AC-10 (PRD 2.3, D2): a non-default profile adds the 13 plugin-variant
// agents; back to the default, the plan's live list no longer has them, so
// they retire with a backup.
test('AC-10: update --profile claude=costo writes the 13 plugin-variant agents; back to calidad deletes them with backups', async () => {
  const catalog = await loadDelegateCatalog();
  const target = await makeTempRepo();
  await pluginInstall(target);
  const agentOperations = (plan) => plan.operations.filter((item) => item.relativePath.startsWith('.claude/agents/'));

  const costo = await buildUpdatePlan({ targetPath: target, profile: 'claude=costo' });
  assert.equal(agentOperations(costo).length, 13);
  for (const agent of catalog.agents) {
    const planned = operationFor(costo, `.claude/agents/${agent.slug}.md`);
    assert.equal(planned.operation, 'create', agent.slug);
    assert.equal(planned.content, renderClaudeAgent(agent, catalog, 'costo', pluginMode.pluginName), agent.slug);
  }
  await applyInstallPlan(costo);
  let state = await stateOf(target);
  assert.equal(state.modelProfiles.claude, 'costo');
  assert.equal(state.mode, 'plugin');

  const calidad = await buildUpdatePlan({ targetPath: target, profile: 'claude=calidad' });
  assert.deepEqual(agentOperations(calidad).map((item) => item.operation), Array(13).fill('delete_with_backup'));
  await applyInstallPlan(calidad);
  const left = await fs.readdir(path.join(target, '.claude', 'agents'));
  assert.equal(left.length, 13);
  assert.ok(left.every((file) => file.includes('.workflow-kit-backup-')), left.join(', '));
  state = await stateOf(target);
  assert.equal(state.modelProfiles.claude, 'calidad');
  assert.equal(state.mode, 'plugin');
  assert.deepEqual(Object.keys(state.files).filter((relativePath) => relativePath.startsWith('.claude/agents/')), []);
});

// T14: a runtime without plugin stops update in plugin mode, also on a
// switch to plugin mode, writes nothing and names the repo-mode command,
// which works (from a plugin install it is the switch to repo mode, T9).
test('update stops: a runtime without plugin (T14, also on a switch to plugin) writes nothing and the named command works', async () => {
  const cases = [
    { name: 'T14: --runtime codex on plugin', install: pluginInstall, flags: ['--runtime', 'codex'], names: ['workflow-kit update --mode repo --runtime codex', '--runtime claude,copilot'], next: ['update', '--mode', 'repo', '--runtime', 'codex'] },
    { name: 'T14: repo (codex) -> plugin', install: (target) => repoInstall(target, 'codex'), flags: ['--mode', 'plugin'], names: ['workflow-kit update --mode repo --runtime codex', '--runtime claude,copilot'] }
  ];
  for (const { name, install, flags, names, next } of cases) {
    const target = await makeTempRepo();
    await install(target);
    const before = await hashTree(target);
    const stop = await cli(['update', '--target', target, ...flags, '--apply', '--yes']);
    assert.notEqual(stop.code, 0, name);
    for (const expected of names) assert.ok(stop.stderr.includes(expected), `${name}: names ${expected}\n${stop.stderr}`);
    assert.match(stop.stderr, /Nothing was written/, name);
    assert.deepEqual(await hashTree(target), before, name);
    if (next) {
      const rerun = await cli([...next, '--target', target]);
      assert.equal(rerun.code, 0, `${name}: ${next.join(' ')}\n${rerun.stderr}`);
      assert.deepEqual(await hashTree(target), before, `${name}: the dry run writes nothing`);
    }
  }
});

// T6 guard: a repo-mode install whose state has no mode updates as 558e9fb
// did, and an export still updates to repo mode.
test('T6 guard: update on a repo-mode state without mode plans what 558e9fb planned; an export updates to repo', async () => {
  const fixture = await repoModeFixture();
  for (const runtime of Object.keys(fixture.update)) {
    const target = await makeTempRepo();
    await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime }));
    assert.equal(blockOf(await read(target, runtimeEntrypoints[runtime.split(',')[0]][0])).includes('kit-location'), false, runtime);
    const { mode, ...withoutMode } = await stateOf(target);
    assert.equal(mode, 'repo', runtime);
    await write(target, installStateRelativePath, `${JSON.stringify(withoutMode, null, 2)}\n`);
    const plan = await buildUpdatePlan({ targetPath: target });
    assert.deepEqual(planShape(plan), fixture.update[runtime], runtime);
    assert.equal(plan.nextInstallState.mode, 'repo', runtime);
    assert.equal(formatPlan(plan).includes('Install mode'), false, runtime);
  }

  const exported = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: exported, export: true, ensureWorkspaceIgnore: false, recordJournal: false }));
  assert.equal((await buildUpdatePlan({ targetPath: exported })).nextInstallState.mode, 'repo');
});

// The tree a rollback has to give back: everything but the apply journal and
// the backup files.
async function treeWithoutBackups(target) {
  return Object.fromEntries(Object.entries(await hashTree(target))
    .filter(([relativePath]) => !relativePath.includes('.workflow-kit-backup-') && relativePath !== '.agents/workflow-kit/last-apply.json'));
}
const backupsOf = (tree, relativePath) => Object.keys(tree).filter((key) => key.startsWith(`${relativePath}.workflow-kit-backup-`) && backupSuffix.test(key));
const switchToPlugin = (target, ...flags) => cli(['update', '--target', target, '--mode', 'plugin', ...flags]);
const claudeTemplate = () => fs.readFile(path.join(runtimeTemplates, adapterTemplates['CLAUDE.md']), 'utf8');

// AC-11 (PRD 2.4, T7 and T16): with nothing edited the switch deletes the
// recorded kit tree with backups, whatever the backup mode, and the journal
// takes it back byte for byte.
test('AC-11: update --mode plugin on an unedited repo install retires every recorded kit and derived file with a backup, and rollback restores the tree and the repo-mode state', async () => {
  const fresh = await makeTempRepo();
  const pluginState = (await pluginPlan(fresh, { runtime: 'claude' })).nextInstallState;
  for (const backupMode of ['required', 'none']) {
    const target = await makeTempRepo();
    const init = await cli(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes']);
    assert.equal(init.code, 0, init.stderr);
    // A file in a kit folder that the state does not record is never deleted.
    await write(target, '.agents/skills/team-own/SKILL.md', '# Our own skill\n');
    const repoState = await read(target, installStateRelativePath);
    const retiredPaths = Object.entries(JSON.parse(repoState).files).filter(([, entry]) => ['kit', 'derived'].includes(entry.class)).map(([relativePath]) => relativePath);
    assert.ok(retiredPaths.includes('.agents/instructions.md') && retiredPaths.includes('.claude/agents/turbo-backend.md'), backupMode);
    const before = await treeWithoutBackups(target);

    const switched = await switchToPlugin(target, '--backup-mode', backupMode, '--apply', '--yes');
    assert.equal(switched.code, 0, `${backupMode}: ${switched.stderr}`);
    assert.match(switched.stdout, /^Install mode: plugin$/m);
    const after = await hashTree(target);
    for (const relativePath of retiredPaths) {
      assert.equal(after[relativePath], undefined, `${backupMode}: ${relativePath} is gone`);
      const backups = backupsOf(after, relativePath);
      assert.equal(backups.length, 1, `${backupMode}: ${relativePath} has one backup`);
      assert.equal(after[backups[0]], before[relativePath], `${backupMode}: the backup of ${relativePath} is the file`);
    }
    assert.equal(await read(target, 'CLAUDE.md'), pluginMode.pluginAdapterContent(await claudeTemplate(), managedBlockName), backupMode);
    assert.equal(backupsOf(after, 'CLAUDE.md').length, 1, `${backupMode}: the adapter keeps a backup even with --backup-mode none`);
    assert.equal(Object.keys(after).filter((key) => backupSuffix.test(key)).length, retiredPaths.length + 1, `${backupMode}: one backup per retired file plus CLAUDE.md`);
    assert.equal(JSON.parse(await read(target, settingsPaths.claude)).enabledPlugins[pluginId], true, backupMode);
    assert.equal(await read(target, '.agents/skills/team-own/SKILL.md'), '# Our own skill\n', backupMode);
    const state = await stateOf(target);
    assert.equal(state.mode, 'plugin', backupMode);
    assert.deepEqual(Object.keys(state.files).sort(), Object.keys(pluginState.files).sort(), `${backupMode}: only the plugin-mode files`);
    assert.deepEqual(state.files['CLAUDE.md'], pluginState.files['CLAUDE.md'], backupMode);

    const rollback = await cli(['rollback', '--target', target, '--apply', '--yes']);
    assert.equal(rollback.code, 0, `${backupMode}: ${rollback.stderr}`);
    assert.deepEqual(await treeWithoutBackups(target), before, `${backupMode}: every file back, byte for byte`);
    assert.deepEqual(Object.keys(await hashTree(target)).filter((key) => key.includes('.workflow-kit-backup-')), [], backupMode);
    assert.equal(await read(target, installStateRelativePath), repoState, `${backupMode}: the repo-mode state is back`);
  }
});

// AC-12 (PRD 2.4, D5) and F8: edited kit files stop the whole switch; only
// discard settles them, and each backup keeps its edit. The stop prints one
// command that settles every file, and that command, run as printed, works.
test('AC-12: edited kit files stop the switch without writing; the printed command (one --edited per file) deletes them keeping each edit in its backup; keep, shadow and split are rejected naming discard', async () => {
  const target = await makeTempRepo();
  await repoInstall(target);
  const edited = ['.agents/instructions.md', '.agents/skills/00-router/workflow-router/SKILL.md'];
  const editedContents = {};
  for (const relativePath of edited) {
    editedContents[relativePath] = `${await read(target, relativePath)}\nOur team rule.\n`;
    await write(target, relativePath, editedContents[relativePath]);
  }
  const before = await hashTree(target);
  const printedCommand = `workflow-kit update --mode plugin ${edited.map((relativePath) => `--edited ${relativePath}=discard`).join(' ')}`;

  let stopMessage = '';
  for (const flags of [[], ['--apply', '--yes']]) {
    const stop = await switchToPlugin(target, ...flags);
    const label = flags.length > 0 ? 'apply' : 'dry run';
    assert.notEqual(stop.code, 0, label);
    for (const expected of [...edited.map((relativePath) => `- ${relativePath} `), `\`${printedCommand}\``, 'one `--edited <path>=<decision>` per file, all in the same command', 'workflow-kit update --mode plugin --edited all=discard', 'project shadow (.agents/kit-boundary.md)', 'Nothing was written']) {
      assert.ok(stop.stderr.includes(expected), `${label}: names ${expected}\n${stop.stderr}`);
    }
    assert.deepEqual(await hashTree(target), before, label);
    stopMessage = stop.stderr;
  }
  for (const decision of ['keep', 'shadow', 'split']) {
    const rejected = await switchToPlugin(target, '--edited', `${edited[1]}=${decision}`, '--edited', `${edited[0]}=discard`, '--apply', '--yes');
    assert.notEqual(rejected.code, 0, decision);
    assert.ok(rejected.stderr.includes(`Invalid --edited ${edited[1]}=${decision}`) && rejected.stderr.includes('Valid decisions: discard.'), `${decision}\n${rejected.stderr}`);
    assert.deepEqual(await hashTree(target), before, decision);
  }

  // The command exactly as the stop printed it.
  const [, command] = stopMessage.match(/`(workflow-kit update --mode plugin(?: --edited \S+=discard)+)`/);
  const discard = await runNamed(command, target, { apply: true });
  assert.equal(discard.code, 0, discard.stderr);
  const state = await stateOf(target);
  assert.equal(state.mode, 'plugin');
  for (const relativePath of edited) {
    assert.equal(await exists(target, relativePath), false, relativePath);
    const backups = (await fs.readdir(path.dirname(path.join(target, relativePath)))).filter((file) => file.startsWith(`${path.basename(relativePath)}.workflow-kit-backup-`));
    assert.equal(backups.length, 1, relativePath);
    assert.equal(await read(target, path.join(path.dirname(relativePath), backups[0])), editedContents[relativePath], relativePath);
    assert.equal(state.files[relativePath], undefined, relativePath);
  }
});

// All or nothing (D5) beyond the retired files: a file the plugin plan would
// write that stays pending stops the switch and names what settles it.
test('all or nothing: a pending adapter stops the switch, naming its decisions or the fix by hand, and writes nothing', async () => {
  const ownText = '# Our CLAUDE.md\n\nNo markers here.\n';
  const cases = [
    { name: 'recorded CLAUDE.md without markers', setup: (target) => write(target, 'CLAUDE.md', ownText), flags: [], names: ['- CLAUDE.md (unmarked_adapter): discard\n', '--edited all=discard'], settle: ['--edited', 'all=discard'] },
    { name: 'unrecorded AGENTS.md with its markers out of order', setup: (target) => write(target, 'AGENTS.md', `<!-- ${managedBlockName}:end -->\nOur agents.\n<!-- ${managedBlockName}:start -->\n`), flags: ['--runtime', 'claude,copilot'], names: ['- AGENTS.md (invalid_managed_block): no --edited decision applies; fix its workflow-kit markers by hand'] }
  ];
  for (const { name, setup, flags, names, settle } of cases) {
    const target = await makeTempRepo();
    await repoInstall(target);
    await setup(target);
    const before = await hashTree(target);
    const stop = await switchToPlugin(target, ...flags, '--apply', '--yes');
    assert.notEqual(stop.code, 0, name);
    for (const expected of [...names, 'applied whole', 'Nothing was written']) assert.ok(stop.stderr.includes(expected), `${name}: names ${expected}\n${stop.stderr}`);
    assert.deepEqual(await hashTree(target), before, name);
    if (settle) {
      const settled = await switchToPlugin(target, ...flags, ...settle, '--apply', '--yes');
      assert.equal(settled.code, 0, `${name}: ${settled.stderr}`);
      assert.equal(await read(target, 'CLAUDE.md'), pluginMode.pluginAdapterContent(await claudeTemplate(), managedBlockName), name);
      const backup = (await fs.readdir(target)).find((file) => file.startsWith('CLAUDE.md.workflow-kit-backup-'));
      assert.equal(await read(target, backup), ownText, `${name}: the backup keeps the own text`);
      assert.equal((await stateOf(target)).mode, 'plugin', name);
    }
  }
});

// A partial selection (the TUI) can never leave both modes: every operation of
// a switch is kept, as the layout migration keeps its own.
test('a mode switch is applied whole: an empty selection keeps every operation and applies like the full plan', async () => {
  const shape = (plan) => plan.operations.map(({ relativePath, operation }) => ({ relativePath, operation }));
  const [full, selected] = [await makeTempRepo(), await makeTempRepo()];
  await repoInstall(full);
  await repoInstall(selected);
  const fullPlan = await buildUpdatePlan({ targetPath: full, mode: 'plugin' });
  const selectedPlan = selectPlanOperations(await buildUpdatePlan({ targetPath: selected, mode: 'plugin' }), []);
  assert.ok(fullPlan.operations.length > 0);
  assert.deepEqual(shape(selectedPlan), shape(fullPlan));
  assert.deepEqual(selectedPlan.nextInstallState.files, fullPlan.nextInstallState.files);
  assert.equal(selectedPlan.nextInstallState.mode, 'plugin');

  await applyInstallPlan(fullPlan);
  await applyInstallPlan(selectedPlan);
  const normalized = async (target) => Object.fromEntries(Object.entries(await projectTree(target)).map(([key, value]) => [key.replace(backupSuffix, '.workflow-kit-backup'), value]));
  assert.deepEqual(await normalized(selected), await normalized(full));
  assert.deepEqual((await stateOf(selected)).files, (await stateOf(full)).files);
});

// T7 with a runtime left out: the generated Copilot wrappers retire with the
// rest of the kit tree; the adapters the plugin plan does not write stay as
// they are and leave the state.
test('a switch that leaves copilot out retires its generated wrappers and stops recording its adapters', async () => {
  const target = await makeTempRepo();
  await repoInstall(target, 'claude,copilot');
  const recorded = (await stateOf(target)).files;
  const wrappers = Object.keys(recorded).filter((relativePath) => relativePath.startsWith('.github/instructions/') && recorded[relativePath].class === 'derived');
  assert.ok(wrappers.length > 0);
  const plan = await buildUpdatePlan({ targetPath: target, mode: 'plugin', runtime: 'claude' });
  for (const relativePath of wrappers) assert.equal(operationFor(plan, relativePath)?.operation, 'delete_with_backup', relativePath);
  const leftBehind = ['.github/copilot-instructions.md', '.github/instructions/ai-workflow.instructions.md', 'AGENTS.md', 'docs/README.md'];
  for (const relativePath of leftBehind) {
    assert.equal(recorded[relativePath].class, 'adapter', relativePath);
    assert.equal(operationFor(plan, relativePath), undefined, `${relativePath} is not touched`);
    assert.equal(plan.nextInstallState.files[relativePath], undefined, `${relativePath} leaves the state`);
  }

  // On disk: the switch applies, the adapters left behind are untouched, and
  // doctor passes, listing each entrypoint of copilot as untracked.
  const adaptersBefore = Object.fromEntries(await Promise.all(leftBehind.map(async (relativePath) => [relativePath, await read(target, relativePath)])));
  await applyInstallPlan(plan);
  for (const relativePath of leftBehind) assert.equal(await read(target, relativePath), adaptersBefore[relativePath], relativePath);
  const result = await runDoctor({ targetPath: target, commandExecutor: listsCurrentPlugin });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics, null, 2));
  assertUntracked(result, runtimeEntrypoints.copilot, 'workflow-kit update --runtime claude,copilot');
});

// The tree a rollback of a switch has to give back: everything but the apply
// journal (the backups an earlier apply left stay as they were).
async function treeWithoutJournal(target) {
  return Object.fromEntries(Object.entries(await hashTree(target)).filter(([relativePath]) => relativePath !== '.agents/workflow-kit/last-apply.json'));
}
const switchToRepo = (target, ...flags) => cli(['update', '--target', target, '--mode', 'repo', ...flags]);

// AC-13 (PRD 2.4, T9 and T16): the switch writes the repo-mode tree of the
// recorded runtimes, takes kit-location out of the block, takes only the
// declaration out of the settings file, and rollback gives the plugin install
// back byte for byte.
test('AC-13: update --mode repo on a plugin install writes the repo-mode tree, drops kit-location and only the declaration, records repo, passes doctor, and rollback restores the plugin install', async () => {
  const target = await makeTempRepo();
  const ownSettings = `${JSON.stringify({ permissions: { allow: ['Bash(npm test)'] } }, null, 2)}\n`;
  await write(target, settingsPaths.claude, ownSettings);
  const init = await cli(['init', '--target', target, '--mode', 'plugin', '--runtime', 'claude', '--apply', '--yes']);
  assert.equal(init.code, 0, init.stderr);
  assert.equal(JSON.parse(await read(target, settingsPaths.claude)).enabledPlugins[pluginId], true);
  const pluginState = await read(target, installStateRelativePath);
  const before = await treeWithoutJournal(target);

  const switched = await switchToRepo(target, '--apply', '--yes');
  assert.equal(switched.code, 0, switched.stderr);
  assert.equal(switched.stdout.includes('Install mode: plugin'), false);
  assert.equal(switched.stdout.includes(claudeInstall), false, 'no plugin install steps after leaving plugin mode');

  // The kit tree, the adapter and the recorded files are those of a repo-mode init.
  const repoInit = await makeTempRepo();
  const reference = await cli(['init', '--target', repoInit, '--runtime', 'claude', '--apply', '--yes']);
  assert.equal(reference.code, 0, reference.stderr);
  const [state, referenceState, tree, referenceTree] = [await stateOf(target), await stateOf(repoInit), await hashTree(target), await hashTree(repoInit)];
  assert.equal(state.mode, 'repo');
  assert.deepEqual(Object.keys(state.files).sort(), Object.keys(referenceState.files).sort());
  for (const [relativePath, entry] of Object.entries(referenceState.files)) {
    assert.deepEqual(state.files[relativePath], entry, relativePath);
    if (entry.class !== 'seed') assert.equal(tree[relativePath], referenceTree[relativePath], `${relativePath} is the repo-mode file`);
  }
  assert.equal(await read(target, 'CLAUDE.md'), await read(repoInit, 'CLAUDE.md'));
  assert.equal((await read(target, 'CLAUDE.md')).includes(pluginMode.kitLocationBlockName), false);
  // Only the declaration leaves; the file stays, with the own key byte for byte.
  assert.equal(await read(target, settingsPaths.claude), ownSettings);
  assert.equal(backupsOf(tree, settingsPaths.claude).length, 2, 'the init merge and the switch each keep a backup');
  const doctor = await runDoctor({ targetPath: target });
  assert.equal(doctor.ok, true, JSON.stringify(doctor.findings ?? doctor, null, 2).slice(0, 2000));

  const rollback = await cli(['rollback', '--target', target, '--apply', '--yes']);
  assert.equal(rollback.code, 0, rollback.stderr);
  assert.deepEqual(await treeWithoutJournal(target), before, 'every plugin-mode file back, byte for byte, and no file of the switch left');
  assert.equal(await read(target, installStateRelativePath), pluginState, 'the plugin-mode state is back');
});

// T9 with a non-default profile (D2): the recorded plugin-variant agents are
// replaced by the repo variant of the same profile, with a backup whatever
// the backup mode, since a switch is applied whole.
test('a plugin install with a non-default profile switched to repo ends with the repo-variant agents of that profile', async () => {
  const catalog = await loadDelegateCatalog();
  const target = await makeTempRepo();
  await pluginInstall(target, { profile: 'claude=costo' });
  const repoPlan = await buildInstallPlan({ targetPath: await makeTempRepo(), runtime: 'claude', profile: 'claude=costo' });

  const plan = await buildUpdatePlan({ targetPath: target, mode: 'repo', backupMode: 'none' });
  assert.equal(plan.modelProfiles.claude, 'costo');
  for (const agent of catalog.agents) {
    const relativePath = `.claude/agents/${agent.slug}.md`;
    const planned = operationFor(plan, relativePath);
    assert.equal(planned.operation, 'overwrite_with_backup', relativePath);
    assert.equal(planned.content, operationFor(repoPlan, relativePath).content, `${relativePath} is the repo variant`);
    assert.notEqual(planned.content, renderClaudeAgent(agent, catalog, 'costo', pluginMode.pluginName), relativePath);
  }
  await applyInstallPlan(plan);
  const state = await stateOf(target);
  assert.equal(state.mode, 'repo');
  assert.equal(state.modelProfiles.claude, 'costo');
  for (const agent of catalog.agents) {
    const relativePath = `.claude/agents/${agent.slug}.md`;
    assert.equal(await read(target, relativePath), operationFor(repoPlan, relativePath).content, relativePath);
    assert.deepEqual(state.files[relativePath], repoPlan.nextInstallState.files[relativePath], relativePath);
  }
});

// T9 is not all or nothing (PRD 2.4): a file at a kit path the plugin state
// does not record stays pending under the F2 rules, and the rest switches.
test('T9: an unrecorded file at a kit path stays pending with its F2 decisions while the rest switches to repo', async () => {
  const target = await makeTempRepo();
  await pluginInstall(target);
  const own = '# Our own instructions\n';
  await write(target, '.agents/instructions.md', own);

  const plan = await buildUpdatePlan({ targetPath: target, mode: 'repo' });
  const pending = operationFor(plan, '.agents/instructions.md');
  assert.equal(pending.operation, 'skip_modified');
  assert.equal(pending.reason, 'unrecorded_kit_file');
  assert.deepEqual(pending.decisions, ['keep', 'discard']);
  assert.ok(formatPlan(plan).includes('- skip_modified: .agents/instructions.md (unrecorded_kit_file): keep | discard'), formatPlan(plan));

  await applyInstallPlan(plan);
  assert.equal(await read(target, '.agents/instructions.md'), own);
  const state = await stateOf(target);
  assert.equal(state.mode, 'repo');
  assert.equal(state.files['.agents/instructions.md'], undefined);
  assert.ok(state.files['.agents/skills/00-router/workflow-router/SKILL.md']);
});

// PRD 2.4 (T9, "Declaración"): every settings case at the planner that owns
// it, and the plan line of an invalid file.
test('T9 settings: only the kit declaration leaves the settings file, other keys and their order stay, the file is never deleted, and an invalid file is left with a note', async () => {
  const declaration = { source: { source: 'github', repo: pluginMode.marketplaceRepository } };
  const json = (value, indent = 2) => `${JSON.stringify(value, null, indent)}\n`;
  const cases = [
    {
      name: 'declaration among other keys (4-space indent)',
      existing: json({ permissions: { allow: ['Bash(npm test)'] }, enabledPlugins: { 'other@market': true, [pluginId]: true }, extraKnownMarketplaces: { market: { source: { source: 'github', repo: 'someone/market' } }, 'fhh-ia-ecosystem': declaration }, model: 'opus' }, 4),
      operation: 'merge_with_backup',
      content: json({ permissions: { allow: ['Bash(npm test)'] }, enabledPlugins: { 'other@market': true }, extraKnownMarketplaces: { market: { source: { source: 'github', repo: 'someone/market' } } }, model: 'opus' }, 4)
    },
    { name: 'only the declaration', existing: json({ extraKnownMarketplaces: { 'fhh-ia-ecosystem': declaration }, enabledPlugins: { [pluginId]: true } }), operation: 'merge_with_backup', content: '{}\n' },
    // D15: only an entry equal to the kit's leaves.
    {
      name: 'a marketplace changed by hand and a plugin the project turned off both stay',
      existing: json({ extraKnownMarketplaces: { 'fhh-ia-ecosystem': { source: { source: 'github', repo: 'fork/kit' } } }, enabledPlugins: { [pluginId]: false } }),
      operation: 'unchanged'
    },
    {
      name: 'the enabled plugin leaves; a marketplace changed by hand stays',
      existing: json({ extraKnownMarketplaces: { 'fhh-ia-ecosystem': { source: { source: 'github', repo: 'fork/kit' } } }, enabledPlugins: { [pluginId]: true } }),
      operation: 'merge_with_backup',
      content: json({ extraKnownMarketplaces: { 'fhh-ia-ecosystem': { source: { source: 'github', repo: 'fork/kit' } } } })
    },
    { name: 'no declaration', existing: json({ model: 'opus' }), operation: 'unchanged' },
    { name: 'missing', existing: null, operation: null },
    { name: 'invalid JSON', existing: '{ "model": "opus", }\n', operation: 'skip_unmanaged' },
    { name: 'not an object', existing: '[]\n', operation: 'skip_unmanaged' }
  ];
  for (const { name, existing, operation, content } of cases) {
    const target = await makeTempRepo();
    if (existing !== null) await write(target, settingsPaths.claude, existing);
    const operations = await pluginMode.planPluginSettingsRemoval({ targetPath: target, runtimes: ['neutral', 'claude', 'codex'] });
    if (operation === null) {
      assert.deepEqual(operations, [], name);
      continue;
    }
    assert.equal(operations.length, 1, name);
    const [planned] = operations;
    assert.equal(planned.relativePath, settingsPaths.claude, name);
    assert.equal(planned.operation, operation, name);
    if (operation === 'merge_with_backup') assert.equal(planned.content, content, name);
    else assert.equal(planned.content, existing, name);
    if (operation === 'skip_unmanaged') {
      assert.equal(planned.reason, 'invalid_settings_json', name);
      assert.ok(planned.manualFragment.includes(pluginId), name);
    }
  }

  // Wiring: the switch plans the removal and its dry run prints the note.
  const target = await makeTempRepo();
  await pluginInstall(target);
  await write(target, settingsPaths.claude, '{ broken\n');
  const plan = await buildUpdatePlan({ targetPath: target, mode: 'repo' });
  assert.equal(operationFor(plan, settingsPaths.claude).operation, 'skip_unmanaged');
  assert.ok(formatPlan(plan).includes(`- skip_unmanaged: ${settingsPaths.claude} (invalid_settings_json); remove this from it by hand:`), formatPlan(plan));
});

// A switch is applied whole in both directions, and its plan says so (the
// TUI names it instead of the layout migration); a normal update and the
// layout migration do not.
test('a mode switch plan is flagged and applied whole in both directions; a normal update and the layout migration are not mode switches', async () => {
  const [repoTarget, pluginTarget, legacyTarget] = [await makeTempRepo(), await makeTempRepo(), await makeTempRepo()];
  await repoInstall(repoTarget);
  await pluginInstall(pluginTarget);
  await installLegacy0181(legacyTarget);
  for (const [label, plan] of [['repo -> plugin', await buildUpdatePlan({ targetPath: repoTarget, mode: 'plugin' })], ['plugin -> repo', await buildUpdatePlan({ targetPath: pluginTarget, mode: 'repo' })]]) {
    assert.equal(plan.modeSwitch, true, label);
    assert.ok(plan.operations.every((item) => item.migration), label);
    const selected = selectPlanOperations(plan, []);
    assert.equal(selected.modeSwitch, true, label);
    assert.deepEqual(selected.operations.map((item) => item.relativePath), plan.operations.map((item) => item.relativePath), label);
  }
  for (const [label, plan] of [['plugin update', await buildUpdatePlan({ targetPath: pluginTarget })], ['repo update', await buildUpdatePlan({ targetPath: repoTarget })], ['layout migration', await buildUpdatePlan({ targetPath: legacyTarget })]]) {
    assert.equal(plan.modeSwitch, false, label);
  }
});

// AC-14 (PRD 2.4: T4, T5, T10, T11, T13, T17, and an incomplete apply): each
// stop writes nothing, names the command that works, and the test runs it.
// Every named command but the last of a case is applied; the last is a dry run.
const exportInstall = async (target) => applyInstallPlan(await buildInstallPlan({ targetPath: target, export: true, ensureWorkspaceIgnore: false, recordJournal: false }));
async function runNamed(text, target, { apply }) {
  const argv = text.replace(/^workflow-kit /, '').split(' ');
  const repoIndex = argv.indexOf('<repo>');
  if (repoIndex >= 0) argv[repoIndex] = await makeTempRepo();
  if (!argv.includes('--target') && !argv.includes('--output')) argv.push('--target', target);
  if (apply && !argv.includes('--apply')) argv.push('--apply', '--yes');
  return cli(argv);
}
test('AC-14: T4, T5, T10, T11, T13, T17 and an incomplete apply stop without writing and name a command that works', async () => {
  const markLastApplyIncomplete = async (target) => {
    const journal = JSON.parse(await read(target, '.agents/workflow-kit/last-apply.json'));
    await write(target, '.agents/workflow-kit/last-apply.json', `${JSON.stringify({ ...journal, completed: false })}\n`);
  };
  const cases = [
    { name: 'T4 (repo state)', install: repoInstall, args: ['init', '--mode', 'plugin', '--runtime', 'claude'], names: ['already records an install'], commands: ['workflow-kit update --mode plugin --runtime claude'] },
    { name: 'T4 (plugin state)', install: pluginInstall, args: ['init', '--mode', 'plugin', '--runtime', 'claude'], names: ['already records an install'], commands: ['workflow-kit update --mode plugin --runtime claude'] },
    { name: 'T4 (export state)', install: exportInstall, args: ['init', '--mode', 'plugin', '--runtime', 'claude'], names: ['copy of the kit'], commands: ['workflow-kit init --mode plugin --runtime claude --target <repo>'] },
    { name: 'T5', install: installLegacy0181, args: ['init', '--mode', 'plugin', '--runtime', 'claude'], names: ['install-state 1.0.0', 'then `workflow-kit update --mode plugin --runtime claude`'], commands: ['workflow-kit update', 'workflow-kit update --mode plugin --runtime claude'] },
    { name: 'T10', install: installLegacy0181, args: ['update', '--mode', 'plugin', '--runtime', 'claude'], names: ['install-state 1.0.0', 'layout migration'], commands: ['workflow-kit update', 'workflow-kit update --mode plugin --runtime claude'] },
    { name: 'T11', install: exportInstall, args: ['update', '--mode', 'plugin', '--runtime', 'claude'], names: ['copy of the kit'], commands: ['workflow-kit init --mode plugin --runtime claude --target <repo>'] },
    { name: 'T13', install: async () => {}, args: ['update', '--adopt-existing', '--mode', 'plugin', '--runtime', 'claude'], names: ['no install state'], commands: ['workflow-kit update --adopt-existing --runtime claude', 'workflow-kit update --mode plugin --runtime claude'] },
    { name: 'T17', install: pluginInstall, args: ['export'], names: ['export to another folder', '`workflow-kit update` brings an install to this version'], commands: ['workflow-kit update'], also: ['workflow-kit export --output <repo>'] },
    {
      name: 'incomplete apply',
      install: async (target) => {
        await repoInstall(target);
        const update = await cli(['update', '--target', target, '--profile', 'claude=costo', '--apply', '--yes']);
        assert.equal(update.code, 0, update.stderr);
        await markLastApplyIncomplete(target);
      },
      args: ['update', '--mode', 'plugin'],
      names: ['did not finish', 'then run this command again'],
      commands: ['workflow-kit rollback --apply --yes'],
      again: true
    }
  ];
  for (const { name, install, args, names, commands, also = [], again } of cases) {
    const target = await makeTempRepo();
    await install(target);
    const before = await hashTree(target);
    const stopArgs = args[0] === 'export' ? [...args, '--output', target] : [...args, '--target', target];
    const stop = await cli([...stopArgs, '--apply', '--yes']);
    assert.notEqual(stop.code, 0, `${name}\n${stop.stdout}`);
    for (const expected of [...names, ...commands.map((command) => `\`${command}\``), 'Nothing was written']) {
      assert.ok(stop.stderr.includes(expected), `${name}: names ${expected}\n${stop.stderr}`);
    }
    assert.equal(/not available in this build/.test(stop.stderr), false, name);
    assert.deepEqual(await hashTree(target), before, `${name}: the tree is identical`);

    const run = [...commands, ...also];
    for (const [index, command] of run.entries()) {
      const result = await runNamed(command, target, { apply: index < commands.length - 1 });
      assert.equal(result.code, 0, `${name}: ${command}\n${result.stderr}`);
    }
    if (again) {
      const rerun = await cli([...args, '--target', target]);
      assert.equal(rerun.code, 0, `${name}: the command again\n${rerun.stderr}`);
    }
  }
});

// D16 (PRD 5): a runtime that leaves takes its declaration and its profile
// agents with it; its adapters stay as project files, out of the state.
const allEntrypoints = [...new Set(Object.values(runtimeEntrypoints).flat())];
const repoTemplateBlock = async (relativePath) => blockOf(await fs.readFile(path.join(runtimeTemplates, adapterTemplates[relativePath]), 'utf8'));
const declaresPlugin = async (target, relativePath) => Object.hasOwn(JSON.parse(await read(target, relativePath)).enabledPlugins ?? {}, pluginId);

test('F2 (D16): dropping copilot in plugin mode removes its declaration and agents and untracks its adapters; switching to repo afterwards passes doctor', async () => {
  const target = await makeTempRepo();
  const init = await cli(['init', '--target', target, '--mode', 'plugin', '--runtime', 'claude,copilot', '--profile', 'copilot=calidad', '--apply', '--yes']);
  assert.equal(init.code, 0, init.stderr);
  const copilotAdapters = runtimeEntrypoints.copilot;
  const adaptersBefore = Object.fromEntries(await Promise.all(copilotAdapters.map(async (relativePath) => [relativePath, await read(target, relativePath)])));

  const drop = await cli(['update', '--target', target, '--runtime', 'claude', '--apply', '--yes']);
  assert.equal(drop.code, 0, drop.stderr);
  assert.equal(await declaresPlugin(target, settingsPaths.copilot), false, 'the copilot declaration leaves; the file stays');
  assert.equal(await declaresPlugin(target, settingsPaths.claude), true);
  const agents = await fs.readdir(path.join(target, '.github', 'agents'));
  assert.ok(agents.length === 13 && agents.every((file) => file.includes('.workflow-kit-backup-')), agents.join(', '));
  let state = await stateOf(target);
  assert.deepEqual([state.mode, state.runtimes], ['plugin', ['claude']]);
  for (const relativePath of copilotAdapters) {
    assert.equal(await read(target, relativePath), adaptersBefore[relativePath], `${relativePath} stays as it is`);
    assert.equal(state.files[relativePath], undefined, `${relativePath} leaves the state`);
  }
  const pluginDoctor = await runDoctor({ targetPath: target, commandExecutor: listsCurrentPlugin });
  assert.equal(pluginDoctor.ok, true, JSON.stringify(pluginDoctor.diagnostics, null, 2));
  assertUntracked(pluginDoctor, copilotAdapters, 'workflow-kit update --runtime claude,copilot');

  const back = await cli(['update', '--target', target, '--mode', 'repo', '--apply', '--yes']);
  assert.equal(back.code, 0, back.stderr);
  state = await stateOf(target);
  assert.deepEqual([state.mode, state.runtimes], ['repo', ['claude']]);
  for (const relativePath of allEntrypoints) {
    if (await exists(target, relativePath)) assert.equal((await read(target, relativePath)).includes(pluginMode.kitLocationBlockName), false, relativePath);
  }
  const result = await runDoctor({ targetPath: target });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics, null, 2));
  assert.deepEqual(result.diagnostics.filter((item) => item.code === 'mode/repo-and-plugin'), []);
  assertUntracked(result, copilotAdapters, 'workflow-kit update --runtime claude,copilot');
});

test('F3 (D16): leaving plugin mode with another runtime list takes kit-location out of every adapter, untracks the ones left out, and doctor names the command that keeps them', async () => {
  const cases = [
    { init: 'claude,copilot', runtime: 'claude', untracked: runtimeEntrypoints.copilot, keep: 'claude,copilot' },
    { init: 'claude', runtime: 'codex', untracked: ['CLAUDE.md'], keep: 'codex,claude' }
  ];
  for (const { init, runtime, untracked, keep } of cases) {
    const label = `${init} -> repo ${runtime}`;
    const target = await makeTempRepo();
    const installed = await cli(['init', '--target', target, '--mode', 'plugin', '--runtime', init, '--apply', '--yes']);
    assert.equal(installed.code, 0, installed.stderr);

    const switched = await switchToRepo(target, '--runtime', runtime, '--apply', '--yes');
    assert.equal(switched.code, 0, `${label}: ${switched.stderr}`);
    for (const relativePath of allEntrypoints) {
      if (await exists(target, relativePath)) assert.equal((await read(target, relativePath)).includes(pluginMode.kitLocationBlockName), false, `${label}: ${relativePath}`);
    }
    const state = await stateOf(target);
    for (const relativePath of untracked) {
      assert.equal(blockOf(await read(target, relativePath)), await repoTemplateBlock(relativePath), `${label}: ${relativePath} has the repo-mode block`);
      assert.equal(state.files[relativePath], undefined, `${label}: ${relativePath} leaves the state`);
    }
    for (const name of init.split(',')) assert.equal(await declaresPlugin(target, settingsPaths[name]), false, `${label}: ${settingsPaths[name]}`);
    const result = await runDoctor({ targetPath: target });
    assert.equal(result.ok, true, `${label}: ${JSON.stringify(result.diagnostics, null, 2)}`);
    assertUntracked(result, untracked, `workflow-kit update --runtime ${keep}`);

    const kept = await cli(['update', '--target', target, '--runtime', keep, '--apply', '--yes']);
    assert.equal(kept.code, 0, `${label}: ${kept.stderr}`);
    assertUntracked(await runDoctor({ targetPath: target }), [], 'none');
  }
});

// F6: the stops that send an install with a runtime without plugin to plugin
// mode say what happens to that runtime; the test runs the named commands and
// doctor then lists the adapter left behind.
test('F6: T4, T5 and T10 for an install with codex say the named command leaves codex out, and after it doctor lists its adapter as untracked', async () => {
  const legacy = (target) => installLegacy0181(target, { runtimes: ['claude', 'codex'] });
  const switchCommand = 'workflow-kit update --mode plugin --runtime claude';
  const cases = [
    { name: 'T4', install: (target) => repoInstall(target, 'claude,codex'), args: ['init', '--mode', 'plugin', '--runtime', 'claude'], commands: [switchCommand] },
    { name: 'T5', install: legacy, args: ['init', '--mode', 'plugin', '--runtime', 'claude'], commands: ['workflow-kit update', switchCommand] },
    { name: 'T10', install: legacy, args: ['update', '--mode', 'plugin', '--runtime', 'claude'], commands: ['workflow-kit update', switchCommand] }
  ];
  for (const { name, install, args, commands } of cases) {
    const target = await makeTempRepo();
    await install(target);
    const before = await hashTree(target);
    const stop = await cli([...args, '--target', target, '--apply', '--yes']);
    assert.notEqual(stop.code, 0, name);
    for (const expected of [`\`${switchCommand}\``, 'leaves codex out of the install', 'with a backup', 'project files', 'Nothing was written']) {
      assert.ok(stop.stderr.includes(expected), `${name}: names ${expected}\n${stop.stderr}`);
    }
    assert.deepEqual(await hashTree(target), before, name);

    for (const command of commands) {
      const result = await runNamed(command, target, { apply: true });
      assert.equal(result.code, 0, `${name}: ${command}\n${result.stderr}`);
    }
    const state = await stateOf(target);
    assert.deepEqual([state.mode, state.runtimes], ['plugin', ['claude']], name);
    const doctor = await runDoctor({ targetPath: target, commandExecutor: listsCurrentPlugin });
    assert.equal(doctor.ok, true, `${name}: ${JSON.stringify(doctor.diagnostics, null, 2)}`);
    assertUntracked(doctor, ['AGENTS.md'], 'workflow-kit update --mode repo --runtime claude,codex');
  }
});

// F4: as in 558e9fb, a path the plan cannot write is reported before a
// --profile value is parsed; plugin mode checks the agent paths of a profile
// once it knows them.
test('F4: a path problem is reported before an invalid --profile, in init and update, and plugin mode checks its profile agent paths', async () => {
  const cases = [
    { name: 'init (repo)', setup: (target) => write(target, 'docs', 'a file\n'), args: ['init', '--runtime', 'claude', '--profile', 'claude=bogus'], problem: 'docs is a file, not a folder' },
    {
      name: 'update (repo)',
      setup: async (target) => {
        await repoInstall(target);
        await fs.rm(path.join(target, 'docs'), { recursive: true });
        await write(target, 'docs', 'a file\n');
      },
      args: ['update', '--profile', 'claude=bogus'],
      problem: 'docs is a file, not a folder'
    },
    { name: 'init --mode plugin', setup: (target) => write(target, '.claude', 'a file\n'), args: ['init', '--mode', 'plugin', '--runtime', 'claude', '--profile', 'claude=bogus'], problem: '.claude is a file, not a folder' },
    { name: 'init --mode plugin, profile agents', setup: (target) => write(target, '.claude/agents', 'a file\n'), args: ['init', '--mode', 'plugin', '--runtime', 'claude', '--profile', 'claude=costo'], problem: '.claude/agents is a file, not a folder' }
  ];
  for (const { name, setup, args, problem } of cases) {
    const target = await makeTempRepo();
    await setup(target);
    const before = await hashTree(target);
    const result = await cli([...args, '--target', target]);
    assert.notEqual(result.code, 0, name);
    assert.ok(result.stderr.includes(problem), `${name}\n${result.stderr}`);
    assert.equal(result.stderr.includes('--profile'), false, `${name}: the path comes first\n${result.stderr}`);
    assert.deepEqual(await hashTree(target), before, name);
  }
});

// An install-state whose mode this CLI does not know is never read as repo.
test('an install-state with an unknown mode is unusable: init and update stop naming it, doctor reports it, and the state is not rewritten', async () => {
  for (const mode of ['hybrid', 42]) {
    const target = await makeTempRepo();
    await repoInstall(target);
    await write(target, installStateRelativePath, `${JSON.stringify({ ...(await stateOf(target)), mode }, null, 2)}\n`);
    const before = await hashTree(target);
    for (const args of [['update'], ['update', '--mode', 'plugin', '--runtime', 'claude'], ['update', '--mode', 'repo'], ['init', '--runtime', 'claude']]) {
      const stop = await cli([...args, '--target', target, '--apply', '--yes']);
      assert.notEqual(stop.code, 0, `${mode}: ${args.join(' ')}`);
      assert.ok(stop.stderr.includes(`mode ${JSON.stringify(mode)}`), `${mode}: ${args.join(' ')}\n${stop.stderr}`);
      assert.deepEqual(await hashTree(target), before, `${mode}: ${args.join(' ')}`);
    }
    const doctor = await runDoctor({ targetPath: target });
    const finding = doctor.diagnostics.find((item) => item.code === 'managed/install-state-unusable');
    assert.ok(finding?.message.includes(`mode ${JSON.stringify(mode)}`), `${mode}: ${JSON.stringify(doctor.diagnostics, null, 2)}`);
    assert.equal(doctor.ok, false, String(mode));
  }
});
