// The kit repository root is the root of the plugin `fhh`: the build only adds
// small generated files (manifests and skill wrappers) and never copies the
// kit tree, so every generated path stays outside `.agents/` and `templates/`.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { expectedPluginFiles, validatePluginBuild, writePluginBuild } from '../scripts/build-plugin.mjs';
import { claudeSkillKeys } from '../scripts/sync-claude-skills.mjs';
import { hashTree, makeTempRepo } from './helpers.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await fs.readFile(path.join(sourceRoot, 'package.json'), 'utf8'));
const registry = JSON.parse(await fs.readFile(path.join(sourceRoot, '.agents/skills/registry.json'), 'utf8'));
const registryPaths = new Set([...registry.skills, ...(registry.pattern_skills ?? [])].map((entry) => entry.path));
const expected = await expectedPluginFiles({ root: sourceRoot });
const manifests = ['plugin.json', '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json'];
const wrapperPaths = claudeSkillKeys.map((key) => `skills/${key}/SKILL.md`);

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

test('the build generates exactly the 3 manifests and the 12 plugin skills, outside the kit tree', () => {
  assert.deepEqual([...expected.keys()].sort(), [...manifests, ...wrapperPaths, 'skills/kit-root/SKILL.md'].sort());
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

test('the plugin build check passes on the repository', async () => {
  const result = await validatePluginBuild({ root: sourceRoot });
  assert.deepEqual(result.failures, []);
});

test('the plugin build check reports drift, a missing file and an orphaned generated file; writing twice changes nothing', async () => {
  const root = await fixtureWith(['package.json', '.agents/skills/registry.json']);
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

  const { ok, failures } = await validatePluginBuild({ root });
  assert.equal(ok, false);
  assert.deepEqual(failures.sort(), [
    'Generated plugin file drift: .claude-plugin/marketplace.json',
    'Generated plugin file drift: .claude-plugin/plugin.json',
    'Generated plugin file drift: plugin.json',
    'Generated plugin file missing: skills/create-prd/SKILL.md',
    'Orphaned generated plugin file: skills/retired-skill/SKILL.md'
  ].sort());
});
