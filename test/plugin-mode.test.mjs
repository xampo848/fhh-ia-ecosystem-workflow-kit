import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { parseArgs } from '../src/cli/args.mjs';
import { extractManagedBlock } from '../src/kit-manifest.mjs';
import { loadDelegateCatalog, renderClaudeAgent, renderCopilotAgent } from '../src/model-profiles.mjs';
import { buildInstallPlan, formatPlan, installStateRelativePath } from '../src/planner.mjs';
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
