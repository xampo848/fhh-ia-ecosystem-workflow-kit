import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { parseArgs } from '../src/cli/args.mjs';
import { extractManagedBlock } from '../src/kit-manifest.mjs';
import { loadDelegateCatalog, renderClaudeAgent, renderCopilotAgent } from '../src/model-profiles.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan, installStateRelativePath, selectPlanOperations } from '../src/planner.mjs';
// Namespace import: before the slice exists each test fails on its own
// missing export instead of the whole file failing to load.
import * as pluginMode from '../src/plugin-mode.mjs';
import { runtimeEntrypoints } from '../src/runtime-matrix.mjs';
import { validateAdapterContracts } from '../src/workflow-contract/adapters.mjs';
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
const pluginPlan = (target, extra = {}) => buildInstallPlan({ targetPath: target, mode: 'plugin', ...extra });
const pluginInstall = async (target, extra = {}) => applyInstallPlan(await pluginPlan(target, { runtime: 'claude', ...extra }));
const stateOf = async (target) => JSON.parse(await read(target, installStateRelativePath));
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
    {
      name: 'plugin disabled',
      existing: `${JSON.stringify({ enabledPlugins: { [pluginId]: false } })}\n`,
      operation: 'merge_with_backup',
      expected: { enabledPlugins: { [pluginId]: true }, extraKnownMarketplaces: declared.extraKnownMarketplaces }
    },
    { name: 'already declared', existing: `${JSON.stringify({ theme: 'dark', ...declared }, null, 2)}\n`, operation: 'unchanged' },
    { name: 'invalid JSON', existing: '{ "enabledPlugins": ', operation: 'skip_unmanaged' },
    { name: 'JSON array', existing: '[]\n', operation: 'skip_unmanaged' },
    { name: 'enabledPlugins is not an object', existing: '{ "enabledPlugins": ["x"] }\n', operation: 'skip_unmanaged' }
  ];
  for (const { name, existing, backupMode, operation, expected } of cases) {
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
      assert.equal(planned.reason, 'invalid_settings_json', name);
      const output = formatPlan(plan);
      const line = `- skip_unmanaged: ${settingsPaths.claude} (invalid_settings_json)`;
      assert.ok(output.includes(line), output);
      const fragment = output.slice(output.indexOf(line) + line.length).split('\nSummary:')[0];
      assert.deepEqual(JSON.parse(fragment.slice(fragment.indexOf('{'), fragment.lastIndexOf('}') + 1)), declared, `${name}: the fragment to add by hand`);
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

// AC-19 guard: without --mode (or with --mode repo) init plans exactly what it
// planned before plugin mode existed.
test('AC-19 guard: init without --mode and with --mode repo produce the same repo-mode plan', async () => {
  const target = await makeTempRepo();
  const shape = (plan) => plan.operations.map(({ relativePath, operation, class: fileClass, content }) => ({ relativePath, operation, fileClass, content }));
  const without = await buildInstallPlan({ targetPath: target, runtime: 'claude,copilot', profile: 'claude=costo' });
  const repo = await buildInstallPlan({ targetPath: target, runtime: 'claude,copilot', profile: 'claude=costo', mode: 'repo' });
  assert.deepEqual(shape(repo), shape(without));
  assert.equal(without.nextInstallState.mode, 'repo');
  assert.equal(formatPlan(without).includes('Install mode'), false);
  assert.ok(operationFor(without, '.agents/instructions.md'));
  assert.equal(operationFor(without, settingsPaths.claude), undefined);
  assert.equal(blockOf(operationFor(without, 'CLAUDE.md').content).includes('kit-location'), false);
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

// T14 and the mode switches this build does not implement yet (P2-S3 and
// P2-S4 replace that stop): each stops, writes nothing and names --mode.
test('update stops: a runtime without plugin on a plugin install (T14), and a mode switch, write nothing', async () => {
  const repoInstall = async (target) => applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  const exportInstall = async (target) => applyInstallPlan(await buildInstallPlan({ targetPath: target, export: true, ensureWorkspaceIgnore: false, recordJournal: false }));
  const legacyInstall = (target) => write(target, installStateRelativePath, `${JSON.stringify({ schemaVersion: '1.0.0', files: {} })}\n`);
  const switchStop = /--mode .*not available in this build/;
  const cases = [
    { name: 'T14: --runtime codex on plugin', install: pluginInstall, flags: ['--runtime', 'codex'], names: ['workflow-kit update --mode repo --runtime codex', '--runtime claude,copilot'], next: ['update', '--mode', 'repo', '--runtime', 'codex'] },
    { name: 'plugin -> repo', install: pluginInstall, flags: ['--mode', 'repo'], names: [switchStop, '(plugin mode)'] },
    { name: 'repo -> plugin', install: repoInstall, flags: ['--mode', 'plugin', '--runtime', 'claude'], names: [switchStop, '(repo mode)'] },
    { name: 'export -> plugin', install: exportInstall, flags: ['--mode', 'plugin', '--runtime', 'claude'], names: [switchStop, '(an export)'] },
    { name: '1.0.0 -> plugin', install: legacyInstall, flags: ['--mode', 'plugin', '--runtime', 'claude'], names: [switchStop, '(install-state 1.0.0)'] },
    { name: 'no state -> plugin', install: async () => {}, flags: ['--adopt-existing', '--mode', 'plugin', '--runtime', 'claude'], names: [switchStop, '(no install state)'] }
  ];
  for (const { name, install, flags, names, next } of cases) {
    const target = await makeTempRepo();
    await install(target);
    const before = await hashTree(target);
    const stop = await cli(['update', '--target', target, ...flags, '--apply', '--yes']);
    assert.notEqual(stop.code, 0, name);
    for (const expected of names) {
      if (typeof expected === 'string') assert.ok(stop.stderr.includes(expected), `${name}: names ${expected}\n${stop.stderr}`);
      else assert.match(stop.stderr, expected, name);
    }
    assert.match(stop.stderr, /Nothing was written/, name);
    assert.deepEqual(await hashTree(target), before, name);
    // The named command is a mode switch: until P2-S4 it reaches that stop.
    if (next) {
      const rerun = await cli([...next, '--target', target]);
      assert.notEqual(rerun.code, 0, `${name}: ${next.join(' ')}`);
      assert.match(rerun.stderr, switchStop, name);
      assert.deepEqual(await hashTree(target), before, name);
    }
  }
});

// T6 guard: a repo-mode install updates as before plugin mode existed,
// whether it was installed with or without --mode repo, updated with or
// without it, or its state has no mode; an export still updates to repo.
test('T6 guard: update on a repo-mode install plans the same with or without --mode repo and for a state without mode', async () => {
  const shape = (plan) => plan.operations.map(({ relativePath, operation, class: fileClass, content }) => ({ relativePath, operation, fileClass, content }));
  const install = async (mode) => {
    const target = await makeTempRepo();
    await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude,copilot', profile: 'claude=costo', mode }));
    return target;
  };
  const target = await install(undefined);
  const baseline = await buildUpdatePlan({ targetPath: target });
  assert.equal(baseline.nextInstallState.mode, 'repo');
  assert.equal(formatPlan(baseline).includes('Install mode'), false);
  assert.ok(operationFor(baseline, '.agents/instructions.md'));
  assert.equal(operationFor(baseline, settingsPaths.claude), undefined);
  assert.equal(blockOf(await read(target, 'CLAUDE.md')).includes('kit-location'), false);

  const withRepoMode = await buildUpdatePlan({ targetPath: await install('repo'), mode: 'repo' });
  assert.deepEqual(shape(withRepoMode), shape(baseline));
  const { mode, ...withoutMode } = await stateOf(target);
  assert.equal(mode, 'repo');
  await write(target, installStateRelativePath, `${JSON.stringify(withoutMode, null, 2)}\n`);
  const stateWithoutMode = await buildUpdatePlan({ targetPath: target });
  assert.deepEqual(shape(stateWithoutMode), shape(baseline));
  assert.equal(stateWithoutMode.nextInstallState.mode, 'repo');

  const exported = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: exported, export: true, ensureWorkspaceIgnore: false, recordJournal: false }));
  assert.equal((await buildUpdatePlan({ targetPath: exported })).nextInstallState.mode, 'repo');
});
