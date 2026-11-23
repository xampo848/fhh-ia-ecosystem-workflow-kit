// The plugin `fhh` is a generated folder, `dist/plugin/`: the plugin
// manifests, the plugin skills and agents, the legal files and a copy of the
// kit files of the overlay template. Only the marketplace is committed at the
// repository root; `--publish` turns the folder into a commit of the local
// branch `plugin`. Every test builds from a temporary copy of what the build
// reads, never from or into this checkout.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  expectedMarketplace,
  expectedPluginFiles,
  pluginLegalFiles,
  validatePluginFolder,
  writePluginBuild
} from '../scripts/build-plugin.mjs';
import { claudeSkillDescription, claudeSkillEntries, claudeSkillKeys, listFiles } from '../scripts/sync-claude-skills.mjs';
import { classifyPath, loadKitManifest } from '../src/kit-manifest.mjs';
import {
  agentTierFor,
  defaultProfileFor,
  generatedMarker as syncMarker,
  loadDelegateCatalog,
  modelSettingLine,
  renderClaudeAgent,
  renderCopilotAgent
} from '../src/model-profiles.mjs';
import { pluginPathRule } from '../src/plugin-mode.mjs';
import { hashTree, makeTempRepo } from './helpers.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildScript = path.join(sourceRoot, 'scripts/build-plugin.mjs');
const templateRoot = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const packageJson = JSON.parse(await fs.readFile(path.join(sourceRoot, 'package.json'), 'utf8'));
const catalog = await loadDelegateCatalog({ root: sourceRoot, relativePath: 'scripts/delegate-agent-catalog.json' });
const manifest = await loadKitManifest({ file: path.join(sourceRoot, templateRoot, '.agents/workflow-kit/manifest.json') });
const pluginManifests = ['plugin.json', '.claude-plugin/plugin.json'];
const wrapperPaths = claudeSkillKeys.map((key) => `skills/${key}/SKILL.md`);
const pluginAgents = catalog.agents.flatMap((agent) => [
  { runtime: 'claude', agent, path: `agents/${agent.slug}.md` },
  { runtime: 'copilot', agent, path: `com.github.copilot/agents/${agent.slug}.agent.md` }
]);
const fixtureEntries = [
  'package.json',
  '.agents/skills/registry.json',
  'scripts/delegate-agent-catalog.json',
  templateRoot,
  '.claude-plugin/marketplace.json',
  'docs/legal',
  ...pluginLegalFiles
];

async function makeFixture() {
  const root = await makeTempRepo('workflow-kit-plugin-');
  for (const entry of fixtureEntries) {
    await fs.mkdir(path.dirname(path.join(root, entry)), { recursive: true });
    await fs.cp(path.join(sourceRoot, entry), path.join(root, entry), { recursive: true });
  }
  return root;
}

function runCli(args, { cwd = sourceRoot, env = process.env } = {}) {
  return spawnSync(process.execPath, [buildScript, ...args], { cwd, env, encoding: 'utf8' });
}

function frontmatter(content) {
  return content.split('\n---\n')[0];
}

function withoutPrefix(tree, prefix) {
  return Object.fromEntries(Object.entries(tree).filter(([entry]) => entry !== prefix && !entry.startsWith(`${prefix}/`)));
}

const built = await makeFixture();
await writePluginBuild({ root: built });
const builtDir = path.join(built, 'dist/plugin');
const builtFiles = await listFiles(builtDir, '.').then((files) => files.map((file) => file.slice(2)).sort());
const generated = await expectedPluginFiles({ root: built });
const read = (relativePath) => fs.readFile(path.join(builtDir, relativePath), 'utf8');
const legalCopies = builtFiles.filter((file) => file.startsWith('docs/legal/'));
const componentPaths = new Set([...generated.keys(), ...pluginLegalFiles, ...legalCopies]);
const kitCopies = builtFiles.filter((file) => !componentPaths.has(file));

test('the path rule reads a kit path under the kit root only when the file is there, and keeps project files in the repository', () => {
  for (const phrase of [
    'read under the kit root when that file exists there',
    'when it does not exist there, it resolves in the repository',
    '`.agents/project/**`',
    'the install state',
    'the diagnostics',
    'the apply journal',
    'the seeds',
    '`.ai-work/**`',
    'the project\'s own files always resolve in the repository',
    'Never write under the kit root.'
  ]) {
    assert.ok(pluginPathRule.includes(phrase), `the path rule is missing: ${phrase}`);
  }
});

test('every docs/legal path the copied legal notices name ships in the built folder, byte for byte', async () => {
  const cited = new Set();
  for (const file of pluginLegalFiles) {
    for (const match of (await read(file)).matchAll(/docs\/legal\/[A-Za-z0-9._/-]*[A-Za-z0-9_-]\.(?:md|txt|json)/g)) cited.add(match[0]);
  }
  assert.ok(cited.has('docs/legal/third-party/licenses/Apache-2.0-impeccable.txt'), 'the notices cite the Apache-2.0 license text');
  for (const file of cited) assert.ok(builtFiles.includes(file), `${file} is cited by the legal notices but not shipped`);
  for (const file of legalCopies) {
    assert.equal(await read(file), await fs.readFile(path.join(sourceRoot, file), 'utf8'), file);
  }
});

test('the build writes the 2 plugin manifests, 11 wrappers plus kit-root, 13 + 13 agents, the legal files and the kit files, and the marketplace at the root', async () => {
  assert.equal(catalog.agents.length, 13);
  assert.equal(wrapperPaths.length, 11);
  assert.deepEqual([...generated.keys()].sort(), [
    ...pluginManifests,
    ...wrapperPaths,
    'skills/kit-root/SKILL.md',
    ...pluginAgents.map((entry) => entry.path)
  ].sort());
  for (const [relativePath, content] of generated) assert.equal(await read(relativePath), content, relativePath);
  for (const file of pluginLegalFiles) {
    assert.equal(await read(file), await fs.readFile(path.join(sourceRoot, file), 'utf8'), file);
  }
  for (const file of kitCopies) {
    assert.equal(await read(file), await fs.readFile(path.join(built, templateRoot, file), 'utf8'), file);
  }
  // Complete: every kit or derived file of the template is there.
  const templateFiles = (await listFiles(path.join(built, templateRoot), '.')).map((file) => file.slice(2));
  const shipped = templateFiles.filter((file) => {
    const entry = classifyPath(manifest, file);
    return ['kit', 'derived'].includes(entry?.class) && !entry.generated && !file.startsWith(manifest.project_root);
  });
  assert.deepEqual(kitCopies, shipped.sort());
  for (const sample of ['.agents/instructions.md', '.agents/skills/registry.json', '.agents/workflow-kit/manifest.json', 'docs/workflow/README.md']) {
    assert.ok(kitCopies.includes(sample), sample);
  }
  assert.equal(await fs.readFile(path.join(built, '.claude-plugin/marketplace.json'), 'utf8'), await expectedMarketplace({ root: built }));
});

test('every other file of the built folder is a kit or derived file of the manifest, with no project, state, seed, fixture, prd, package or adapter file', () => {
  for (const file of kitCopies) {
    const entry = classifyPath(manifest, file);
    assert.ok(['kit', 'derived'].includes(entry?.class), `${file}: ${entry?.class}`);
    assert.ok(!entry.generated, file);
    assert.ok(file.startsWith('.agents/') || file.startsWith('docs/workflow/'), file);
  }
  const forbidden = [
    /^\.agents\/project\//,
    /^\.agents\/workflow-kit\/(install-state\.json|last-apply\.json|diagnostics\/)/,
    /^docs\/workflow\/migration\/legacy-docs-map\.md$/,
    /(^|\/)fixtures?\//,
    /^docs\/prd\//,
    /^(bin|src|templates|test|scripts|node_modules)\//,
    /^(package\.json|package-lock\.json|bun\.lock|yarn\.lock|pnpm-lock\.yaml)$/,
    /^(CLAUDE|AGENTS|ANTIGRAVITY)\.md$/
  ];
  for (const file of builtFiles) {
    assert.equal(forbidden.some((pattern) => pattern.test(file)), false, file);
  }
});

test('a kit entry the manifest marks generated is not copied into the plugin', async () => {
  // No kit file of today's template is generated; the rule still holds when one is.
  const root = await makeFixture();
  const file = path.join(root, templateRoot, '.agents/workflow-kit/manifest.json');
  const edited = JSON.parse(await fs.readFile(file, 'utf8'));
  edited.paths = edited.paths.map((entry) => (entry.path === '.agents/memory/' ? { ...entry, generated: true } : entry));
  await fs.writeFile(file, JSON.stringify(edited), 'utf8');
  await writePluginBuild({ root });
  assert.ok(kitCopies.some((copy) => copy.startsWith('.agents/memory/')));
  assert.deepEqual(await listFiles(path.join(root, 'dist/plugin'), './.agents/memory'), []);
});

test('the manifests follow the Agent Plugins, Claude plugin and marketplace contracts and carry the package version', async () => {
  const agentPlugin = JSON.parse(await read('plugin.json'));
  const claudePlugin = JSON.parse(await read('.claude-plugin/plugin.json'));
  const marketplace = JSON.parse(await fs.readFile(path.join(built, '.claude-plugin/marketplace.json'), 'utf8'));
  const repository = `https://github.com/${packageJson.workflowKit.repository}`;

  assert.deepEqual(Object.keys(agentPlugin).sort(), ['$schema', 'author', 'description', 'keywords', 'license', 'name', 'repository', 'version']);
  assert.equal(agentPlugin.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.deepEqual(agentPlugin.keywords, packageJson.keywords);
  assert.deepEqual(Object.keys(claudePlugin).sort(), ['author', 'description', 'license', 'name', 'repository', 'version']);
  for (const plugin of [agentPlugin, claudePlugin]) {
    assert.equal(plugin.name, 'fhh');
    assert.deepEqual(plugin.author, { name: 'fhh-ia-ecosystem' });
    assert.equal(plugin.license, packageJson.license);
    assert.equal(plugin.repository, repository);
    assert.ok(plugin.description);
  }
  assert.deepEqual(Object.keys(marketplace).sort(), ['metadata', 'name', 'owner', 'plugins']);
  assert.equal(marketplace.name, 'fhh-ia-ecosystem');
  assert.deepEqual(marketplace.owner, { name: 'fhh-ia-ecosystem' });
  assert.ok(marketplace.metadata.description);
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, 'fhh');
  assert.deepEqual(marketplace.plugins[0].source, { source: 'github', repo: packageJson.workflowKit.repository, ref: 'plugin' });
  assert.ok(marketplace.plugins[0].description);
  assert.deepEqual([agentPlugin.version, claudePlugin.version, marketplace.metadata.version], Array(3).fill(packageJson.version));
});

test('each wrapper carries the registry trigger as its description and links a skill inside the built folder', async () => {
  const entries = await claudeSkillEntries({ root: built });
  for (const entry of entries) {
    const wrapperPath = `skills/${entry.name}/SKILL.md`;
    const content = await read(wrapperPath);
    const description = claudeSkillDescription(entry);
    assert.ok(description.length > 0, wrapperPath);
    assert.match(frontmatter(content), new RegExp(`^description: "${description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"$`, 'm'), wrapperPath);
    assert.match(frontmatter(content), /^disable-model-invocation: true$/m, wrapperPath);
    assert.ok(content.includes('the folder that contains `skills/` and `.agents/`'), wrapperPath);
    assert.ok(content.includes('`kit-root`'), wrapperPath);
    const link = content.match(/\]\(\.\.\/\.\.\/([^)]+)\)/)?.[1];
    assert.equal(link, entry.path, wrapperPath);
    assert.ok(content.includes(`<kit root>/${link}`), wrapperPath);
    assert.ok(existsSync(path.resolve(builtDir, path.dirname(wrapperPath), `../../${link}`)), `${wrapperPath} -> ${link}`);
  }
});

test('kit-root is model-loadable, names the plugin, and gives the kit root, the shared path rule and the delegate names per runtime', async () => {
  const content = await read('skills/kit-root/SKILL.md');
  assert.match(frontmatter(content), /^name: kit-root$/m);
  assert.doesNotMatch(frontmatter(content), /disable-model-invocation/);
  const description = frontmatter(content).match(/^description: "(.*)"$/m)?.[1] ?? '';
  assert.ok(description.includes('plugin fhh'), description);
  assert.ok(content.includes(pluginPathRule), 'kit-root carries the shared path rule');
  for (const phrase of [
    'Kit root: `${CLAUDE_PLUGIN_ROOT}`',
    'the folder that contains `skills/` and `.agents/`',
    'In Claude Code, a delegate is the plugin agent `fhh:<slug>`, unless the project defines an agent with that slug',
    'In Copilot, name a delegate by its alias',
    'Kit root: <absolute path>',
    '<kit root>/.agents/instructions.md'
  ]) {
    assert.ok(content.includes(phrase), `kit-root is missing: ${phrase}`);
  }
  assert.doesNotMatch(content, /two levels above/);
});

test('each plugin agent reads a shared skill inside the built folder and carries the kit location with the shared path rule', async () => {
  for (const entry of pluginAgents) {
    const content = await read(entry.path);
    const named = content.match(/read and follow `([^`]+)`/)?.[1];
    assert.equal(named, entry.agent.shared_skill_path, entry.path);
    assert.ok(existsSync(path.join(builtDir, named)), `${entry.path} -> ${named}`);
    // Kit location sits right after the first sentence and ends with the rule.
    assert.ok(content.includes(`read and follow \`${named}\` and \`.agents/delegation/delegate-contract.md\`.\n\nKit location: this kit runs as the plugin \`fhh\`. `), entry.path);
    assert.match(content, /Kit location: [^\n]*the `Kit root:` line of the brief that launched you[^\n]*$/m, entry.path);
    assert.ok(content.split('\n').some((line) => line.startsWith('Kit location: ') && line.endsWith(pluginPathRule)), entry.path);
    assert.ok(content.includes('<!-- Generated by scripts/build-plugin.mjs. Do not edit. -->'), entry.path);
    assert.ok(content.includes('The plugin ships the default profile;'), entry.path);
    assert.ok(!content.includes(syncMarker), entry.path);
    assert.ok(!content.includes('Change it with `workflow-kit update'), entry.path);
    // Copilot documents no plugin-root variable: only the brief gives the root.
    assert.equal(content.includes('${CLAUDE_PLUGIN_ROOT}'), entry.runtime === 'claude', entry.path);
  }
});

test('plugin agents carry the model of the runtime default profile and the repo-mode frontmatter', () => {
  for (const entry of pluginAgents) {
    const content = generated.get(entry.path);
    const profile = defaultProfileFor(catalog, entry.runtime);
    const tier = agentTierFor(catalog, profile, entry.agent.slug);
    const model = entry.runtime === 'claude'
      ? catalog.modelProfiles.runtimeTierSettings.claude[tier]
      : JSON.stringify(catalog.copilotModelRouting.tiers[tier]);
    assert.equal(modelSettingLine(entry.runtime, content), `model: ${model}`, entry.path);
    assert.ok(content.includes(`Model profile: ${profile} · tier: ${tier}.`), entry.path);
    const name = entry.runtime === 'claude' ? entry.agent.slug : entry.agent.alias;
    assert.match(frontmatter(content), new RegExp(`^name: ${name}$`, 'm'), entry.path);
  }
});

test('the repo-mode renderers without a kit location still produce the checked-in adapters byte for byte', async () => {
  for (const agent of catalog.agents) {
    const claude = await fs.readFile(path.join(sourceRoot, `.claude/agents/${agent.slug}.md`), 'utf8');
    const copilot = await fs.readFile(path.join(sourceRoot, `.github/agents/${agent.slug}.agent.md`), 'utf8');
    assert.equal(renderClaudeAgent(agent, catalog), claude, agent.slug);
    assert.equal(renderClaudeAgent(agent, catalog, defaultProfileFor(catalog, 'claude'), null), claude, agent.slug);
    assert.equal(renderCopilotAgent(agent, catalog), copilot, agent.slug);
    assert.equal(renderCopilotAgent(agent, catalog, defaultProfileFor(catalog, 'copilot'), null), copilot, agent.slug);
  }
});

test('no generated text carries an absolute path or an email address', async () => {
  const texts = new Map([...generated, ['.claude-plugin/marketplace.json', await expectedMarketplace({ root: built })]]);
  for (const [relativePath, content] of texts) {
    for (const absolute of [built, sourceRoot, os.homedir(), os.tmpdir()]) {
      assert.ok(!content.includes(absolute), `${relativePath} names ${absolute}`);
    }
    assert.doesNotMatch(content, /[\w.+-]+@[\w-]+\.[\w.-]+/, relativePath);
    assert.doesNotMatch(content, /(^|[\s`"'(])\/(Users|home|private|var|tmp)\//m, relativePath);
  }
});

test('the built folder passes the structural check', async () => {
  assert.deepEqual((await validatePluginFolder({ root: built, dir: builtDir })).failures, []);
});

test('the structural check reports each broken rule of a built folder with the way to fix it', async (t) => {
  const createPrd = generated.get('skills/create-prd/SKILL.md').match(/\]\(\.\.\/\.\.\/([^)]+)\)/)[1];
  const turboBackend = catalog.agents.find((agent) => agent.slug === 'turbo-backend').shared_skill_path;
  const plant = (file) => async (dir) => {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.writeFile(path.join(dir, file), 'planted\n', 'utf8');
  };
  const emptyDescription = (file) => async (dir) => {
    const content = await fs.readFile(path.join(dir, file), 'utf8');
    await fs.writeFile(path.join(dir, file), content.replace(/^description: .*$/m, 'description: ""'), 'utf8');
  };
  const version = (file) => async (dir) => {
    const content = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
    await fs.writeFile(path.join(dir, file), JSON.stringify({ ...content, version: '9.9.9' }), 'utf8');
  };
  const planted = [
    '.agents/project/context.md',
    '.agents/workflow-kit/install-state.json',
    'docs/workflow/migration/legacy-docs-map.md',
    'docs/prd/some-prd.md',
    'bin/workflow-kit.mjs',
    'package.json',
    'bun.lock',
    'CLAUDE.md'
  ];
  const cases = [
    ['an empty wrapper description', emptyDescription('skills/create-prd/SKILL.md'), ['Skill without a description: skills/create-prd/SKILL.md']],
    ['an empty kit-root description', emptyDescription('skills/kit-root/SKILL.md'), ['Skill without a description: skills/kit-root/SKILL.md']],
    ['a wrapper link outside the folder', (dir) => fs.rm(path.join(dir, createPrd)), [`Broken wrapper link: skills/create-prd/SKILL.md -> ${createPrd}`]],
    ['an agent skill outside the folder', (dir) => fs.rm(path.join(dir, turboBackend)), [
      `Agent skill not in the plugin: agents/turbo-backend.md -> ${turboBackend}`,
      `Agent skill not in the plugin: com.github.copilot/agents/turbo-backend.agent.md -> ${turboBackend}`
    ]],
    ['a manifest version that is not the package version', async (dir) => {
      await version('plugin.json')(dir);
      await version('.claude-plugin/plugin.json')(dir);
    }, pluginManifests.map((file) => `Plugin manifest version 9.9.9 is not the package.json version ${packageJson.version}: ${file}`)],
    ['a missing plugin manifest', (dir) => fs.rm(path.join(dir, '.claude-plugin/plugin.json')), ['Plugin manifest missing or not JSON: .claude-plugin/plugin.json']],
    ['files that are not kit or derived files', async (dir) => {
      for (const file of planted) await plant(file)(dir);
    }, planted.map((file) => `Not a kit or derived file of the kit manifest: ${file}`)]
  ];
  for (const [name, mutate, expectedFailures] of cases) {
    await t.test(name, async () => {
      const dir = path.join(await makeTempRepo('workflow-kit-plugin-copy-'), 'plugin');
      await fs.cp(builtDir, dir, { recursive: true });
      await mutate(dir);
      const { ok, failures } = await validatePluginFolder({ root: built, dir });
      assert.equal(ok, false);
      assert.deepEqual(failures.map((failure) => failure.message).sort(), [...expectedFailures].sort());
      for (const failure of failures) assert.ok(failure.fix, failure.message);
    });
  }
});

test('--write twice gives the same tree and removes what an earlier build left in dist/plugin', async () => {
  const root = await makeFixture();
  await writePluginBuild({ root });
  const first = await hashTree(root);
  await fs.writeFile(path.join(root, 'dist/plugin/stale.md'), 'left over\n', 'utf8');
  await fs.mkdir(path.join(root, 'dist/plugin/skills/retired-skill'), { recursive: true });
  await fs.writeFile(path.join(root, 'dist/plugin/skills/retired-skill/SKILL.md'), '# Retired\n', 'utf8');
  await fs.mkdir(path.join(root, 'dist/plugin/empty-folder'));
  await writePluginBuild({ root });
  assert.deepEqual(await hashTree(root), first);
});

test('--write never touches anything outside dist/plugin and never follows a link', async (t) => {
  const cases = [
    {
      name: 'other files under dist survive',
      arrange: async (root) => {
        await fs.mkdir(path.join(root, 'dist/other'), { recursive: true });
        await fs.writeFile(path.join(root, 'dist/other/keep.txt'), 'keep\n', 'utf8');
        await fs.writeFile(path.join(root, 'dist/readme.txt'), 'keep\n', 'utf8');
      }
    },
    {
      name: 'files at the root survive',
      arrange: async (root) => {
        await fs.writeFile(path.join(root, 'notes.md'), 'keep\n', 'utf8');
        await fs.mkdir(path.join(root, 'bin'));
        await fs.writeFile(path.join(root, 'bin/tool.mjs'), 'keep\n', 'utf8');
      }
    },
    {
      name: 'a symlinked dist pointing outside the root is refused',
      refused: /dist resolves outside/,
      arrange: async (root, outside) => fs.symlink(outside, path.join(root, 'dist'))
    },
    {
      name: 'a symlinked dist/plugin pointing outside the root is refused',
      refused: /dist\/plugin resolves outside/,
      arrange: async (root, outside) => {
        await fs.mkdir(path.join(root, 'dist'));
        await fs.symlink(outside, path.join(root, 'dist/plugin'));
      }
    },
    {
      name: 'a symlinked dist/plugin pointing inside the root is refused',
      refused: /dist\/plugin is a symbolic link/,
      arrange: async (root) => {
        await fs.mkdir(path.join(root, 'dist'));
        await fs.symlink(path.join(root, templateRoot), path.join(root, 'dist/plugin'));
      }
    },
    {
      name: 'a dist that is a file is refused',
      refused: /dist is not a directory/,
      arrange: async (root) => fs.writeFile(path.join(root, 'dist'), 'a file\n', 'utf8')
    },
    {
      name: 'a symlinked marketplace file pointing outside the root is refused',
      refused: /\.claude-plugin\/marketplace\.json resolves outside/,
      arrange: async (root, outside) => {
        await fs.rm(path.join(root, '.claude-plugin/marketplace.json'));
        await fs.symlink(path.join(outside, 'precious.txt'), path.join(root, '.claude-plugin/marketplace.json'));
      }
    },
    {
      name: 'a marketplace path that is a directory is refused',
      refused: /\.claude-plugin\/marketplace\.json is not a file/,
      arrange: async (root) => {
        await fs.rm(path.join(root, '.claude-plugin/marketplace.json'));
        await fs.mkdir(path.join(root, '.claude-plugin/marketplace.json'));
      }
    },
    {
      name: 'a symlinked .claude-plugin folder pointing outside the root is refused',
      refused: /\.claude-plugin resolves outside/,
      arrange: async (root, outside) => {
        await fs.rm(path.join(root, '.claude-plugin'), { recursive: true });
        await fs.symlink(outside, path.join(root, '.claude-plugin'));
      }
    }
  ];
  for (const { name, arrange, refused } of cases) {
    await t.test(name, async () => {
      const root = await makeFixture();
      const outside = await makeTempRepo('workflow-kit-plugin-outside-');
      await fs.writeFile(path.join(outside, 'precious.txt'), 'keep\n', 'utf8');
      await arrange(root, outside);
      const before = { root: await hashTree(root), outside: await hashTree(outside) };
      if (refused) {
        await assert.rejects(writePluginBuild({ root }), refused);
        assert.deepEqual(await hashTree(root), before.root);
      } else {
        await writePluginBuild({ root });
        // The build may create `dist` itself; every entry under it but
        // dist/plugin is compared.
        const outsidePluginFolder = (tree) => {
          const { dist, ...rest } = withoutPrefix(tree, 'dist/plugin');
          return rest;
        };
        assert.deepEqual(outsidePluginFolder(await hashTree(root)), outsidePluginFolder(before.root));
        assert.ok(existsSync(path.join(root, 'dist/plugin/plugin.json')));
      }
      assert.deepEqual(await hashTree(outside), before.outside);
    });
  }
});

test('the entry point refuses a --root that is not a kit repository, and unknown options, and writes nothing', async (t) => {
  const empty = await makeTempRepo('workflow-kit-plugin-empty-');
  const notKit = /--root .* is not a workflow kit repository/;
  const cases = [
    ['an empty --root', ['--write', '--root', ''], /--root needs a directory/],
    ['a --root without a value', ['--write', '--root'], /--root needs a directory/],
    ['--root . in a folder that is not a kit repository', ['--write', '--root', '.'], notKit],
    ['--root on an empty folder', ['--write', '--root', empty], notKit],
    ['--root on an empty folder in check mode', ['--root', empty], notKit],
    ['--write together with --publish', ['--write', '--publish', '--root', empty], /Use only one of --write and --publish/],
    ['--same-version without --publish', ['--write', '--same-version', '--root', empty], /--same-version only applies to --publish/],
    ['an unknown option', ['--force', '--root', empty], /Unknown option --force/]
  ];
  for (const [name, args, message] of cases) {
    await t.test(name, async () => {
      const before = await hashTree(empty);
      const result = runCli(args, { cwd: empty });
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, message);
      assert.deepEqual(await hashTree(empty), before);
    });
  }
});

test('check mode builds in a temporary folder, leaves the checkout untouched, and fails with the fixing command', async (t) => {
  const cases = [
    { name: 'a synchronized repository passes', status: 0, stdout: /Plugin build is valid/ },
    {
      name: 'a version bump without regenerating is marketplace drift',
      status: 1,
      arrange: async (root) => {
        const bumped = { ...packageJson, version: '9.9.9' };
        await fs.writeFile(path.join(root, 'package.json'), `${JSON.stringify(bumped, null, 2)}\n`, 'utf8');
      },
      stderr: /Marketplace drift: \.claude-plugin\/marketplace\.json \(fix: node scripts\/build-plugin\.mjs --write\)/
    },
    {
      name: 'a missing marketplace is reported with the same command',
      status: 1,
      arrange: (root) => fs.rm(path.join(root, '.claude-plugin/marketplace.json')),
      stderr: /Marketplace missing: \.claude-plugin\/marketplace\.json \(fix: node scripts\/build-plugin\.mjs --write\)/
    },
    {
      name: 'a build that cannot run fails',
      status: 1,
      arrange: async (root) => {
        const file = path.join(root, '.agents/skills/registry.json');
        const registry = JSON.parse(await fs.readFile(file, 'utf8'));
        registry.skills = registry.skills.filter((entry) => entry.key !== 'create-prd');
        await fs.writeFile(file, JSON.stringify(registry), 'utf8');
      },
      stderr: /Plugin build failed: Skill "create-prd" is not in \.agents\/skills\/registry\.json/
    }
  ];
  for (const { name, arrange, status, stdout, stderr } of cases) {
    await t.test(name, async () => {
      const root = await makeFixture();
      await arrange?.(root);
      const before = await hashTree(root);
      const tmp = await makeTempRepo('workflow-kit-plugin-tmpdir-');
      const result = runCli(['--root', root], { env: { ...process.env, TMPDIR: tmp } });
      assert.equal(result.status, status, result.stderr);
      if (stdout) assert.match(result.stdout, stdout);
      if (stderr) assert.match(result.stderr, stderr);
      assert.deepEqual(await hashTree(root), before);
      assert.equal(existsSync(path.join(root, 'dist')), false);
      // The temporary build folder is removed whatever the outcome.
      assert.deepEqual(await fs.readdir(tmp), []);
    });
  }
});

async function breakAgentSkill(root) {
  const file = path.join(root, 'scripts/delegate-agent-catalog.json');
  const edited = JSON.parse(await fs.readFile(file, 'utf8'));
  edited.agents = edited.agents.map((agent) => (agent.slug === 'turbo-backend' ? { ...agent, shared_skill_path: '.agents/skills/missing/SKILL.md' } : agent));
  await fs.writeFile(file, `${JSON.stringify(edited, null, 2)}\n`, 'utf8');
}
const agentSkillMissing = /Agent skill not in the plugin: agents\/turbo-backend\.md -> \.agents\/skills\/missing\/SKILL\.md/;

test('a --write that cannot build or does not validate fails and keeps the previous dist/plugin and marketplace, with no temporary folder left', async (t) => {
  const cases = [
    {
      name: 'an unreadable template file',
      arrange: (root) => fs.chmod(path.join(root, templateRoot, '.agents/instructions.md'), 0o000),
      stderr: /Plugin build failed: .*(EACCES|permission denied)/i
    },
    { name: 'a delegate skill the plugin does not ship', arrange: breakAgentSkill, stderr: agentSkillMissing }
  ];
  for (const { name, arrange, stderr } of cases) {
    await t.test(name, { skip: process.getuid?.() === 0 && 'root reads unreadable files' }, async () => {
      const root = await makeFixture();
      await writePluginBuild({ root });
      const snapshot = async () => ({
        plugin: await hashTree(path.join(root, 'dist/plugin')),
        marketplace: await fs.readFile(path.join(root, '.claude-plugin/marketplace.json'), 'utf8'),
        dist: await fs.readdir(path.join(root, 'dist'))
      });
      const before = await snapshot();
      await arrange(root);
      const result = runCli(['--write', '--root', root]);
      assert.equal(result.status, 1, result.stdout);
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual(before.dist, ['plugin']);
      assert.match(result.stderr, stderr);
    });
  }
});

// Publishing needs a real repository: these tests run git in temporary
// repositories. --publish drops every GIT_* variable it inherits, so the
// global configuration of the child is isolated through HOME (an empty
// folder); the identity is set only inside the temporary repository.
const gitless = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
const publisher = { name: 'Plugin Publisher', email: 'publisher@example.invalid' };
const publisherLine = `${publisher.name} <${publisher.email}>`;
const instructionsFile = `${templateRoot}/.agents/instructions.md`;

async function gitEnvironment() {
  const home = await makeTempRepo('workflow-kit-plugin-home-');
  const globalConfig = path.join(home, '.gitconfig');
  await fs.writeFile(globalConfig, '', 'utf8');
  return { ...gitless, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' };
}

function gitIn(cwd, env) {
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  };
  git.setIdentity = () => {
    git('config', 'user.name', publisher.name);
    git('config', 'user.email', publisher.email);
  };
  // Fixture commits carry their own identity: the repository may have none.
  git.commit = (message, ...paths) => {
    if (paths.length > 0) git('add', '--', ...paths);
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-q', '-m', message, ...(paths.length > 0 ? ['--', ...paths] : []));
  };
  git.refs = () => git('for-each-ref', '--format=%(refname) %(objectname)');
  return git;
}

async function gitFixture({ identity = true } = {}) {
  const root = await makeFixture();
  const env = await gitEnvironment();
  const git = gitIn(root, env);
  const remote = await makeTempRepo('workflow-kit-plugin-remote-');
  git('init', '-q', '--bare', '-b', 'main', remote);
  await fs.writeFile(path.join(root, '.gitignore'), 'dist/\n', 'utf8');
  await fs.writeFile(path.join(root, 'notes.md'), 'first\n', 'utf8');
  await fs.writeFile(path.join(root, 'staged.md'), 'first\n', 'utf8');
  git('init', '-q', '-b', 'main');
  if (identity) git.setIdentity();
  git('remote', 'add', 'origin', remote);
  git('add', '-A');
  git.commit('Fixture');
  // Uncommitted work outside the build inputs, which publishing leaves alone.
  await fs.writeFile(path.join(root, 'notes.md'), 'edited, not staged\n', 'utf8');
  await fs.writeFile(path.join(root, 'staged.md'), 'edited and staged\n', 'utf8');
  git('add', 'staged.md');
  await fs.writeFile(path.join(root, 'untracked.md'), 'untracked\n', 'utf8');
  const checkout = async () => ({
    branch: git('symbolic-ref', 'HEAD'),
    head: git('rev-parse', 'HEAD'),
    status: git('status', '--porcelain'),
    index: git('ls-files', '-s'),
    stash: git('stash', 'list'),
    config: git('config', '--local', '--list'),
    files: withoutPrefix(withoutPrefix(await hashTree(root), '.git'), 'dist')
  });
  const publish = (args = [], extraEnv = {}) => runCli(['--publish', '--root', root, ...args], { env: { ...env, ...extraEnv } });
  return { root, env, git, remote, checkout, publish };
}

async function raiseVersion(root, git, version) {
  const file = path.join(root, 'package.json');
  const edited = JSON.parse(await fs.readFile(file, 'utf8'));
  await fs.writeFile(file, `${JSON.stringify({ ...edited, version }, null, 2)}\n`, 'utf8');
  const write = runCli(['--write', '--root', root]);
  assert.equal(write.status, 0, write.stderr);
  git.commit(`Release ${version}`, 'package.json', '.claude-plugin/marketplace.json');
}

test('--publish commits dist/plugin to the local branch plugin as the configured identity, leaves the checkout alone and never pushes', async () => {
  const { root, git, remote, checkout, publish } = await gitFixture();
  const tmp = await makeTempRepo('workflow-kit-plugin-tmpdir-');
  const before = await checkout();

  const first = publish([], { TMPDIR: tmp });
  assert.equal(first.status, 0, first.stderr);
  // Printing the identity it commits with is part of the command's contract.
  assert.ok(first.stdout.includes(`Publishing as ${publisherLine}`), first.stdout);
  assert.match(first.stdout, /git push origin plugin/);
  assert.deepEqual(await checkout(), before);
  // The temporary index is removed.
  assert.deepEqual(await fs.readdir(tmp), []);
  const builtNow = (await listFiles(path.join(root, 'dist/plugin'), '.')).map((file) => file.slice(2)).sort();
  assert.deepEqual(git('ls-tree', '-r', '--name-only', 'plugin').split('\n').sort(), builtNow);
  assert.deepEqual(git('rev-list', '--parents', 'plugin').split(' '), [git('rev-parse', 'plugin')]);
  assert.equal(git('log', '-1', '--format=%s', 'plugin'), `Publish plugin fhh ${packageJson.version} from ${git('rev-parse', '--short', 'HEAD')}`);
  assert.equal(git('log', '-1', '--format=%an <%ae>|%cn <%ce>', 'plugin'), `${publisherLine}|${publisherLine}`);
  const firstTip = git('rev-parse', 'plugin');

  const again = publish();
  assert.equal(again.status, 0, again.stderr);
  assert.ok(again.stdout.includes(`Publishing as ${publisherLine}`), again.stdout);
  assert.match(again.stdout, /no commit created/);
  assert.equal(git('rev-parse', 'plugin'), firstTip);

  const remoteRefs = spawnSync('git', ['ls-remote', remote], { env: gitless, encoding: 'utf8' });
  assert.equal(remoteRefs.stdout, '');
});

test('--publish refuses while any worktree of the repository has the branch plugin checked out', async (t) => {
  const cases = [
    ['the current worktree', async (git) => git('checkout', '-q', '-b', 'plugin')],
    ['a linked worktree', async (git) => git('worktree', 'add', '-q', '-b', 'plugin', path.join(await makeTempRepo('workflow-kit-plugin-worktree-'), 'linked'))]
  ];
  for (const [name, arrange] of cases) {
    await t.test(name, async () => {
      const { git, checkout, publish } = await gitFixture();
      await arrange(git);
      const before = { checkout: await checkout(), refs: git.refs() };
      const result = publish();
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, /branch plugin is checked out/);
      assert.deepEqual({ checkout: await checkout(), refs: git.refs() }, before);
    });
  }
});

test('--publish refuses a kit root that is not the top level of its own git repository and commits nothing anywhere', async (t) => {
  const cases = [
    ['a kit copy outside any repository', async () => ({ kit: await makeFixture(), foreign: null })],
    ['a kit copy without its own .git inside a foreign repository', async (env) => {
      const foreign = await makeTempRepo('workflow-kit-plugin-foreign-');
      const git = gitIn(foreign, env);
      git('init', '-q', '-b', 'main');
      git.setIdentity();
      await fs.writeFile(path.join(foreign, 'readme.md'), 'foreign\n', 'utf8');
      git.commit('Foreign', 'readme.md');
      const kit = path.join(foreign, 'vendor/kit');
      await fs.cp(await makeFixture(), kit, { recursive: true });
      return { kit, foreign: git };
    }]
  ];
  for (const [name, arrange] of cases) {
    await t.test(name, async () => {
      const env = await gitEnvironment();
      const { kit, foreign } = await arrange(env);
      const before = foreign?.refs();
      const result = runCli(['--publish', '--root', kit], { env });
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, /is not the top level of its own git repository/);
      assert.equal(existsSync(path.join(kit, 'dist')), false);
      if (foreign) {
        assert.equal(foreign('branch', '--list', 'plugin'), '');
        assert.equal(foreign.refs(), before);
      }
    });
  }
});

test('--publish ignores the GIT_* variables it inherits: it commits to the kit repository as its configured identity', async () => {
  const { git, env, publish } = await gitFixture();
  const other = await makeTempRepo('workflow-kit-plugin-other-');
  const otherGit = gitIn(other, env);
  otherGit('init', '-q', '-b', 'main');
  await fs.writeFile(path.join(other, 'readme.md'), 'other\n', 'utf8');
  otherGit.commit('Other', 'readme.md');
  const otherBefore = otherGit.refs();
  const result = publish([], {
    GIT_DIR: path.join(other, '.git'),
    GIT_WORK_TREE: other,
    GIT_INDEX_FILE: path.join(other, '.git/index'),
    GIT_AUTHOR_NAME: 'Environment Author',
    GIT_AUTHOR_EMAIL: 'environment@example.invalid',
    GIT_COMMITTER_NAME: 'Environment Author',
    GIT_COMMITTER_EMAIL: 'environment@example.invalid'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(otherGit.refs(), otherBefore);
  assert.equal(otherGit('branch', '--list', 'plugin'), '');
  assert.equal(git('log', '-1', '--format=%an <%ae>|%cn <%ce>', 'plugin'), `${publisherLine}|${publisherLine}`);
});

test('--publish refuses without a git identity and commits nothing', async () => {
  const { git, checkout, publish } = await gitFixture({ identity: false });
  const before = { checkout: await checkout(), refs: git.refs() };
  const result = publish();
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /no git user\.name or user\.email/);
  assert.deepEqual({ checkout: await checkout(), refs: git.refs() }, before);
});

test('--publish refuses uncommitted changes in the files the build reads and names them', async () => {
  const { root, git, publish } = await gitFixture();
  await fs.appendFile(path.join(root, instructionsFile), '\nUnstaged.\n', 'utf8');
  await fs.appendFile(path.join(root, '.agents/skills/registry.json'), '\n', 'utf8');
  git('add', '.agents/skills/registry.json');
  await fs.writeFile(path.join(root, 'docs/legal/new-notice.md'), 'untracked\n', 'utf8');
  const before = git.refs();
  const result = publish();
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /uncommitted changes in files the build reads/);
  for (const file of [instructionsFile, '.agents/skills/registry.json', 'docs/legal/new-notice.md']) {
    assert.ok(result.stderr.includes(file), `${file} is not named: ${result.stderr}`);
  }
  // The fixture's own uncommitted files are not build inputs.
  assert.doesNotMatch(result.stderr, /notes\.md|staged\.md|untracked\.md/);
  assert.equal(git.refs(), before);
});

test('--publish refuses a build that does not validate or a marketplace out of sync, and commits nothing', async (t) => {
  const cases = [
    {
      name: 'a delegate skill the plugin does not ship',
      arrange: async (root, git) => {
        await breakAgentSkill(root);
        git.commit('Break the catalog', 'scripts/delegate-agent-catalog.json');
      },
      stderr: agentSkillMissing
    },
    {
      name: 'a version raised without regenerating the marketplace',
      arrange: async (root, git) => {
        await fs.writeFile(path.join(root, 'package.json'), `${JSON.stringify({ ...packageJson, version: '9.9.9' }, null, 2)}\n`, 'utf8');
        git.commit('Raise the version', 'package.json');
      },
      stderr: /Marketplace drift: \.claude-plugin\/marketplace\.json \(fix: node scripts\/build-plugin\.mjs --write\)/
    }
  ];
  for (const { name, arrange, stderr } of cases) {
    await t.test(name, async () => {
      const { root, git, publish } = await gitFixture();
      await arrange(root, git);
      const before = git.refs();
      const result = publish();
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, stderr);
      assert.equal(git.refs(), before);
      assert.equal(git('branch', '--list', 'plugin'), '');
    });
  }
});

test('--publish refuses new content under the published version unless --same-version, and a raised version publishes', async () => {
  const { root, git, publish } = await gitFixture();
  assert.equal(publish().status, 0);
  const firstTip = git('rev-parse', 'plugin');
  await fs.appendFile(path.join(root, instructionsFile), '\nA kit change.\n', 'utf8');
  git.commit('A kit change', instructionsFile);

  const before = git.refs();
  const refused = publish();
  assert.equal(refused.status, 1, refused.stdout);
  assert.ok(refused.stderr.includes(`keeps its version ${packageJson.version}`), refused.stderr);
  assert.match(refused.stderr, /Claude Code pins a plugin to its version/);
  assert.match(refused.stderr, /Raise the version/);
  assert.match(refused.stderr, /--same-version/);
  assert.equal(git.refs(), before);

  const accepted = publish(['--same-version']);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.deepEqual(git('rev-list', '--parents', '-n', '1', 'plugin').split(' ').slice(1), [firstTip]);
  assert.equal(git('log', '-1', '--format=%s', 'plugin'), `Publish plugin fhh ${packageJson.version} from ${git('rev-parse', '--short', 'HEAD')}`);
  assert.match(git('show', 'plugin:.agents/instructions.md'), /A kit change\./);

  await raiseVersion(root, git, '9.9.9');
  const raised = publish();
  assert.equal(raised.status, 0, raised.stderr);
  assert.equal(JSON.parse(git('show', 'plugin:.claude-plugin/plugin.json')).version, '9.9.9');
  assert.equal(git('log', '-1', '--format=%s', 'plugin'), `Publish plugin fhh 9.9.9 from ${git('rev-parse', '--short', 'HEAD')}`);
});

test('--publish builds on origin/plugin when there is no local branch, and refuses a local branch that does not contain origin/plugin', async (t) => {
  await t.test('a fresh clone publishes on top of the remote tip and pushes as a fast-forward', async () => {
    const { git, env, remote, publish } = await gitFixture();
    assert.equal(publish().status, 0);
    // Pushes go only to the throwaway bare repository of this test.
    git('push', '-q', 'origin', 'main', 'plugin');
    const clone = path.join(await makeTempRepo('workflow-kit-plugin-clone-'), 'kit');
    gitIn(path.dirname(clone), env)('clone', '-q', remote, clone);
    const cloneGit = gitIn(clone, env);
    cloneGit.setIdentity();
    assert.equal(cloneGit('branch', '--list', 'plugin'), '');
    const remoteTip = cloneGit('rev-parse', 'refs/remotes/origin/plugin');
    await raiseVersion(clone, cloneGit, '9.9.9');

    const result = runCli(['--publish', '--root', clone], { env });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(cloneGit('rev-list', '--parents', '-n', '1', 'plugin').split(' ').slice(1), [remoteTip]);
    // A push without --force fails unless it is a fast-forward.
    cloneGit('push', '-q', 'origin', 'plugin');
    assert.equal(cloneGit('ls-remote', 'origin', 'refs/heads/plugin').split('\t')[0], cloneGit('rev-parse', 'plugin'));
  });

  await t.test('a local branch behind or diverged from origin/plugin is refused', async () => {
    const { git, publish } = await gitFixture();
    assert.equal(publish().status, 0);
    git('update-ref', 'refs/remotes/origin/plugin', git('rev-parse', 'main'));
    const before = git.refs();
    const result = publish();
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /local branch plugin is behind or diverged from origin\/plugin/);
    assert.doesNotMatch(result.stderr, /--force|reset|rebase/);
    assert.equal(git.refs(), before);
  });
});
