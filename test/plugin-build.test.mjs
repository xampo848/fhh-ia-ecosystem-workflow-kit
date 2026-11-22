// The kit repository root is the root of the plugin `fhh`: the build only adds
// small generated files (manifests, skill wrappers and the plugin variant of
// the delegate agents) and never copies the kit tree, so every generated path
// stays outside `.agents/` and `templates/`.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { expectedPluginFiles, validatePluginBuild, writePluginBuild } from '../scripts/build-plugin.mjs';
import { claudeSkillKeys } from '../scripts/sync-claude-skills.mjs';
import {
  agentTierFor,
  defaultProfileFor,
  generatedMarker as syncMarker,
  loadDelegateCatalog,
  modelSettingLine,
  renderClaudeAgent,
  renderCopilotAgent
} from '../src/model-profiles.mjs';
import { hashTree, makeTempRepo } from './helpers.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await fs.readFile(path.join(sourceRoot, 'package.json'), 'utf8'));
const registry = JSON.parse(await fs.readFile(path.join(sourceRoot, '.agents/skills/registry.json'), 'utf8'));
const registryPaths = new Set([...registry.skills, ...(registry.pattern_skills ?? [])].map((entry) => entry.path));
const expected = await expectedPluginFiles({ root: sourceRoot });
const manifests = ['plugin.json', '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json'];
const wrapperPaths = claudeSkillKeys.map((key) => `skills/${key}/SKILL.md`);
const catalog = await loadDelegateCatalog({ root: sourceRoot, relativePath: 'scripts/delegate-agent-catalog.json' });
const pluginAgents = catalog.agents.flatMap((agent) => [
  { runtime: 'claude', agent, path: `agents/${agent.slug}.md` },
  { runtime: 'copilot', agent, path: `com.github.copilot/agents/${agent.slug}.agent.md` }
]);

async function fixtureWith(entries) {
  const root = await makeTempRepo('workflow-kit-plugin-');
  for (const entry of entries) {
    await fs.mkdir(path.dirname(path.join(root, entry)), { recursive: true });
    await fs.cp(path.join(sourceRoot, entry), path.join(root, entry), { recursive: true });
  }
  return root;
}

function frontmatter(content) {
  return content.split('\n---\n')[0];
}

test('the build generates exactly the 3 manifests, the 12 plugin skills and the 13 + 13 plugin agents, outside the kit tree', () => {
  assert.equal(catalog.agents.length, 13);
  assert.deepEqual([...expected.keys()].sort(), [
    ...manifests,
    ...wrapperPaths,
    'skills/kit-root/SKILL.md',
    ...pluginAgents.map((entry) => entry.path)
  ].sort());
  assert.equal([...expected.keys()].some((file) => file.startsWith('.agents/') || file.startsWith('templates/')), false);
});

test('the manifests follow the plugin and marketplace contracts and carry the package version', () => {
  const agentPlugin = JSON.parse(expected.get('plugin.json'));
  const claudePlugin = JSON.parse(expected.get('.claude-plugin/plugin.json'));
  const marketplace = JSON.parse(expected.get('.claude-plugin/marketplace.json'));
  const repository = `https://github.com/${packageJson.workflowKit.repository}`;

  assert.deepEqual(Object.keys(agentPlugin).sort(), ['$schema', 'description', 'keywords', 'license', 'name', 'repository', 'version']);
  assert.equal(agentPlugin.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.deepEqual(Object.keys(claudePlugin).sort(), ['description', 'license', 'name', 'repository', 'version']);
  for (const manifest of [agentPlugin, claudePlugin]) {
    assert.equal(manifest.name, 'fhh');
    assert.equal(manifest.license, packageJson.license);
    assert.equal(manifest.repository, repository);
  }
  assert.deepEqual(agentPlugin.keywords, packageJson.keywords);
  assert.equal(marketplace.name, 'fhh-ia-ecosystem');
  assert.equal(marketplace.owner.name, 'fhh-ia-ecosystem');
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, 'fhh');
  assert.equal(marketplace.plugins[0].source, './');
  assert.ok(marketplace.plugins[0].description);
  assert.deepEqual([agentPlugin.version, claudePlugin.version, marketplace.metadata?.version], Array(3).fill(packageJson.version));
});

test('each plugin wrapper targets a registered skill that exists, through a link that resolves', () => {
  for (const wrapperPath of wrapperPaths) {
    const content = expected.get(wrapperPath);
    assert.match(frontmatter(content), /^disable-model-invocation: true$/m, wrapperPath);
    assert.ok(content.includes('${CLAUDE_PLUGIN_ROOT}'), wrapperPath);
    assert.ok(content.includes('`kit-root`'), wrapperPath);
    const link = content.match(/\]\(\.\.\/\.\.\/([^)]+)\)/)?.[1];
    assert.ok(registryPaths.has(link), `${wrapperPath} -> ${link}`);
    assert.ok(content.includes(`<kit root>/${link}`), wrapperPath);
    assert.ok(existsSync(path.resolve(sourceRoot, path.dirname(wrapperPath), `../../${link}`)), `${wrapperPath} -> ${link}`);
  }
});

test('kit-root is model-loadable and states the kit root, the path rule, the overlay exclusion and delegate naming', () => {
  const content = expected.get('skills/kit-root/SKILL.md');
  assert.match(frontmatter(content), /^name: kit-root$/m);
  assert.doesNotMatch(frontmatter(content), /disable-model-invocation/);
  for (const phrase of [
    '${CLAUDE_PLUGIN_ROOT}',
    'two levels above',
    '`docs/workflow/**`',
    '`.ai-work/**`',
    '`docs/prd/**`',
    'Ignore `.agents/project/` under the kit root',
    'Never write under the kit root',
    '`fhh:<slug>`',
    'Kit root: <absolute path>',
    '<kit root>/.agents/instructions.md'
  ]) {
    assert.ok(content.includes(phrase), `kit-root is missing: ${phrase}`);
  }
});

test('each plugin agent names a shared skill path that exists in the kit tree', () => {
  for (const entry of pluginAgents) {
    const named = expected.get(entry.path).match(/read and follow `([^`]+)`/)?.[1];
    assert.equal(named, entry.agent.shared_skill_path, entry.path);
    assert.ok(existsSync(path.join(sourceRoot, named)), `${entry.path} -> ${named}`);
  }
});

test('plugin agents carry the kit location, the build marker and the plugin profile sentence, not the repo-mode ones', () => {
  for (const entry of pluginAgents) {
    const content = expected.get(entry.path);
    for (const phrase of [
      '<!-- Generated by scripts/build-plugin.mjs. Do not edit. -->',
      'Kit location: this kit runs as the plugin `fhh`.',
      'the `Kit root:` line of the brief that launched you',
      '`.agents/project/**`',
      'Never write under the kit root.',
      'The plugin ships the default profile;'
    ]) {
      assert.ok(content.includes(phrase), `${entry.path} is missing: ${phrase}`);
    }
    assert.ok(!content.includes(syncMarker), entry.path);
    assert.ok(!content.includes('Change it with `workflow-kit update'), entry.path);
    // Kit location sits right after the first sentence.
    assert.match(content, /read and follow `[^`]+` and `\.agents\/delegation\/delegate-contract\.md`\.\n\nKit location: /, entry.path);
    // Copilot documents no plugin-root variable: only the brief gives the root.
    assert.equal(content.includes('${CLAUDE_PLUGIN_ROOT}'), entry.runtime === 'claude', entry.path);
  }
});

test('plugin agents carry the model of the runtime default profile and the repo-mode frontmatter', () => {
  for (const entry of pluginAgents) {
    const content = expected.get(entry.path);
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

test('the plugin build check passes on the repository', async () => {
  const result = await validatePluginBuild({ root: sourceRoot });
  assert.deepEqual(result.failures, []);
});

test('the plugin build check reports drift, a missing file and an orphaned generated file; writing twice changes nothing', async () => {
  const root = await fixtureWith([
    'package.json',
    '.agents/skills/registry.json',
    'scripts/delegate-agent-catalog.json',
    'templates/repo-overlay-fhh-ia-ecosystem-full/.agents/delegation/delegate-contract.md'
  ]);
  await writePluginBuild({ root });
  const firstWrite = await hashTree(root);
  await writePluginBuild({ root });
  assert.deepEqual(await hashTree(root), firstWrite);
  assert.deepEqual((await validatePluginBuild({ root })).failures, []);

  // A version bump without regenerating leaves the manifests stale.
  const bumped = { ...packageJson, version: '9.9.9' };
  await fs.writeFile(path.join(root, 'package.json'), `${JSON.stringify(bumped, null, 2)}\n`, 'utf8');
  await fs.rm(path.join(root, 'skills/create-prd/SKILL.md'));
  await fs.mkdir(path.join(root, 'skills/retired-skill'), { recursive: true });
  await fs.writeFile(path.join(root, 'skills/retired-skill/SKILL.md'), '# Retired\n', 'utf8');
  await fs.appendFile(path.join(root, 'agents/turbo-backend.md'), 'Hand edit.\n', 'utf8');
  await fs.rm(path.join(root, 'com.github.copilot/agents/pixel-ninja.agent.md'));
  await fs.writeFile(path.join(root, 'agents/retired-agent.md'), '# Retired\n', 'utf8');
  await fs.writeFile(path.join(root, 'com.github.copilot/agents/retired-agent.agent.md'), '# Retired\n', 'utf8');

  const { ok, failures } = await validatePluginBuild({ root });
  assert.equal(ok, false);
  assert.deepEqual(failures.sort(), [
    'Generated plugin file drift: .claude-plugin/marketplace.json',
    'Generated plugin file drift: .claude-plugin/plugin.json',
    'Generated plugin file drift: plugin.json',
    'Generated plugin file drift: agents/turbo-backend.md',
    'Generated plugin file missing: skills/create-prd/SKILL.md',
    'Generated plugin file missing: com.github.copilot/agents/pixel-ninja.agent.md',
    'Orphaned generated plugin file: skills/retired-skill/SKILL.md',
    'Orphaned generated plugin file: agents/retired-agent.md',
    'Orphaned generated plugin file: com.github.copilot/agents/retired-agent.agent.md'
  ].sort());
});
