import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeTempRepo } from './helpers.mjs';
import { runbookSections, validateKitBoundary } from '../scripts/validate-kit-boundary.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const copied = ['.agents', 'templates', 'package.json', 'AGENTS.md', 'CLAUDE.md', 'ANTIGRAVITY.md', '.github'];

// A disposable copy of the parts of the kit source that the boundary covers.
async function fixture() {
  const dir = await makeTempRepo('kit-boundary-');
  for (const item of copied) await fs.cp(path.join(root, item), path.join(dir, item), { recursive: true });
  return dir;
}

async function write(dir, relativePath, content) {
  await fs.mkdir(path.dirname(path.join(dir, relativePath)), { recursive: true });
  await fs.writeFile(path.join(dir, relativePath), content);
}

async function edit(dir, relativePath, change) {
  const file = path.join(dir, relativePath);
  await fs.writeFile(file, change(await fs.readFile(file, 'utf8')));
}

const skillsTable = (rows) => ['## Skills', '', '| Skill name | Class | Trigger | Physical path | Cost hint |', '| --- | --- | --- | --- | --- |', ...rows, ''];
const patternRow = '| `api-pagination` | Pattern | Paginated list endpoints | `.agents/project/skills/api-pagination/SKILL.md` | lean |';

async function failuresFor(dir) {
  const result = await validateKitBoundary({ root: dir });
  return result.failures.join('\n');
}

test('the kit source holds its boundary and an old-layout overlay is an empty overlay', async () => {
  const result = await validateKitBoundary({ root });
  assert.deepEqual(result.failures, []);
  await assert.rejects(fs.access(path.join(root, '.agents/project/index.md')), 'the kit ships no project catalog');
  const [contract, manifest] = await Promise.all([
    fs.readFile(path.join(root, '.agents/kit-boundary.md'), 'utf8'),
    fs.readFile(path.join(root, '.agents/workflow-kit/manifest.json'), 'utf8').then(JSON.parse)
  ]);
  for (const entry of manifest.project_layout) assert.ok(contract.includes(entry.replace(/\/$/, '')), `the contract names ${entry}`);
  for (const heading of runbookSections) assert.ok(contract.includes(`\`${heading}\``), `the contract names the runbook heading ${heading}`);
});

test('every installable file needs a manifest class and the template never ships the project overlay', async () => {
  const dir = await fixture();
  await write(dir, 'templates/repo-overlay-fhh-ia-ecosystem-full/tools/extra.md', '# Extra\n');
  await write(dir, 'templates/repo-overlay-fhh-ia-ecosystem-full/.agents/project/index.md', '# Project catalog\n');
  await edit(dir, '.agents/workflow-kit/manifest.json', (content) => {
    const manifest = JSON.parse(content);
    manifest.kit_version = '0.0.0';
    manifest.paths.push({ path: 'AGENTS.md', class: 'kit' }, { path: 'docs/gone.md', class: 'kit' }, { path: '.agents/project/routing.md', class: 'kit' });
    return JSON.stringify(manifest);
  });
  const failures = await failuresFor(dir);
  assert.match(failures, /kit_version 0\.0\.0 differs from package\.json version/);
  assert.match(failures, /duplicate entry AGENTS\.md/);
  assert.match(failures, /docs\/gone\.md matches no template file/);
  assert.match(failures, /\.agents\/project\/routing\.md is under \.agents\/project\/; the kit may only seed project files/);
  assert.match(failures, /installs tools\/extra\.md, which no manifest entry covers/);
  assert.match(failures, /ships \.agents\/project\/index\.md under \.agents\/project\/ without class seed/);
});

test('adapters keep one kit-owned block that matches the template', async () => {
  const dir = await fixture();
  await edit(dir, 'CLAUDE.md', (content) => content.replace('<!-- workflow-kit:managed:end -->', ''));
  await edit(dir, 'AGENTS.md', (content) => content.replace('keep it thin.', 'keep it short.'));
  await edit(dir, 'ANTIGRAVITY.md', (content) => `${content}\nProject note outside the block.\n`);
  await edit(dir, '.github/instructions/ai-workflow.instructions.md', (content) => `${content}<!-- workflow-kit:managed:start -->\n<!-- workflow-kit:managed:end -->\n`);
  const start = '<!-- workflow-kit:managed:start -->\n';
  await edit(dir, 'templates/runtime-adapters/claude/CLAUDE.md', (content) => content.replace(start, '').replace('<!-- workflow-kit:level-prefilter:end -->', `<!-- workflow-kit:level-prefilter:end -->\n${start}`));
  const failures = await failuresFor(dir);
  assert.match(failures, /ai-workflow\.instructions\.md: the workflow-kit:managed block has more than one block/);
  assert.match(failures, /templates\/runtime-adapters\/claude\/CLAUDE\.md: the level pre-filter block must sit inside the workflow-kit:managed block/);
  assert.match(failures, /CLAUDE\.md: the workflow-kit:managed block is missing its markers/);
  assert.match(failures, /AGENTS\.md: the workflow-kit:managed block differs/);
  assert.doesNotMatch(failures, /ANTIGRAVITY\.md/, 'project text outside the markers is allowed');
});

test('path references follow INV-PATH-01', async () => {
  const dir = await fixture();
  await edit(dir, '.agents/kit-boundary.md', (content) => `${content}\nSee \`.agents/skills/missing/SKILL.md\`, \`.agents/project/notes.md\`, and \`.agents/project/<file>.md\`; \`.agents/project/**\` is fine.\n`);
  await edit(dir, '.agents/project/backend.md', (content) => `${content}\nFollow \`.agents/skills/02-implement/implement-change/SKILL.md\`.\n`);
  await edit(dir, '.agents/instructions.md', (content) => `${content}\nRead \`.agents/project-context.md\`.\n`);
  const failures = await failuresFor(dir);
  assert.match(failures, /\.agents\/skills\/missing\/SKILL\.md does not resolve inside the kit tree/);
  assert.match(failures, /\.agents\/project\/notes\.md is not in the overlay layout/);
  assert.match(failures, /\.agents\/project\/<file>\.md is not in the overlay layout/);
  assert.doesNotMatch(failures, /\.agents\/project\/\*\* is not in the overlay layout/);
  assert.match(failures, /project files name kit skills by name, never by path/);
  assert.match(failures, /legacy path \.agents\/project-context\.md must be named next to its current path/);
});

test('a project catalog registers add, extend, and shadow only through the overlay', async () => {
  const dir = await fixture();
  const kitPath = '.agents/skills/02-implement/validation-runner/SKILL.md';
  await write(dir, '.agents/project/skills/api-pagination/SKILL.md', '---\nname: api-pagination\n---\n');
  await write(dir, '.agents/project/shadows/validation-runner/SKILL.md', '---\nname: validation-runner\n---\n');
  await write(dir, '.agents/project/shadows/validation-runner/shadow.json', JSON.stringify({ skill: 'validation-runner', kit_path: kitPath, base_sha256: 'a'.repeat(64), kit_version: '0.20.0' }));
  const catalog = ({ skills = [], extensions = [], shadows = [] }) => [
    ...skillsTable([patternRow, ...skills]),
    '## Extensions', '', '| Kit skill | Extension file |', '| --- | --- |', '| `quality-gate` | `.agents/project/quality-gate.md` |', ...extensions, '',
    '## Shadows', '', '| Kit skill | Shadow directory |', '| --- | --- |', '| `validation-runner` | `.agents/project/shadows/validation-runner/` |', ...shadows, ''
  ].join('\n');
  await write(dir, '.agents/project/index.md', catalog({}));
  assert.equal(await failuresFor(dir), '');

  await write(dir, '.agents/project/index.md', catalog({
    skills: ['| `create-prd` | Pattern | x | `.agents/project/skills/create-prd/SKILL.md` | lean |', '| billing-export | Pattern | x | .agents/skills/billing-export/SKILL.md | lean |'],
    extensions: ['| `create-prd` | `.agents/project/extensions/create-prd.md` |', '| `workflow-router` | `.agents/project/routing.md` |'],
    shadows: ['| `workflow-router` | `.agents/project/shadows/workflow-router/` |', '| `implement-change` | `.agents/project/shadows/implement-change/` |']
  }));
  const failures = await failuresFor(dir);
  assert.match(failures, /project skill create-prd reuses a kit skill name/);
  assert.match(failures, /shadow of workflow-router is not allowed/);
  assert.match(failures, /shadow of implement-change has no SKILL\.md/);
  assert.match(failures, /create-prd declares no extension point/);
  assert.match(failures, /project skill billing-export must live under \.agents\/project\/skills\//, 'rows without backticks still count');
  assert.match(failures, /extension of workflow-router points to missing \.agents\/project\/routing\.md/);

  await write(dir, '.agents/project/shadows/validation-runner/shadow.json', JSON.stringify({ skill: 'validation-runner', kit_path: '.agents/skills/gone/SKILL.md', base_sha256: 'a'.repeat(64) }));
  await write(dir, '.agents/project/index.md', catalog({}));
  assert.match(await failuresFor(dir), /kit_path \.agents\/skills\/gone\/SKILL\.md does not exist in the kit/);
});

test('a project catalog lists only Pattern and Runbook skills, and a runbook keeps its path, name, and sections', async () => {
  const dir = await fixture();
  const runbookFile = '.agents/project/skills/runbooks/promote-build/SKILL.md';
  // The valid runbook is the kit template's copied body, so the template itself meets the contract.
  const template = await fs.readFile(path.join(root, '.agents/skills/06-patterns/authoring/runbook-template.md'), 'utf8');
  const body = /```markdown\n([\s\S]*?)```/.exec(template)[1].replaceAll('<runbook-name>', 'promote-build');
  const runbookRow = (path = runbookFile, name = 'promote-build') => `| \`${name}\` | Runbook | promote the build | \`${path}\` | lean |`;
  await write(dir, '.agents/project/skills/api-pagination/SKILL.md', '---\nname: api-pagination\n---\n');
  await write(dir, runbookFile, body);
  await write(dir, '.agents/project/index.md', skillsTable([patternRow, runbookRow()]).join('\n'));
  assert.equal(await failuresFor(dir), '', 'one Pattern and one Runbook pass');

  for (const { rule, rows = [patternRow, runbookRow()], file = body, expected, absent } of [
    { rule: 'class is Pattern or Runbook', rows: [patternRow.replace('Pattern', 'Guide'), runbookRow()], expected: /project skill api-pagination has class Guide; use Pattern or Runbook/ },
    { rule: 'runbook outside runbooks/', rows: [patternRow, runbookRow('.agents/project/skills/promote-build/SKILL.md')], expected: /runbook promote-build must live at \.agents\/project\/skills\/runbooks\/promote-build\/SKILL\.md/ },
    { rule: 'runbook folder equals its name', rows: [patternRow, runbookRow(runbookFile, 'release-build')], expected: /runbook release-build must live at \.agents\/project\/skills\/runbooks\/release-build\/SKILL\.md/ },
    { rule: 'pattern never under runbooks/', rows: [patternRow.replace('`.agents/project/skills/api-pagination/SKILL.md`', `\`${runbookFile}\``)], expected: /pattern api-pagination must not live under \.agents\/project\/skills\/runbooks\// },
    { rule: 'required section', file: body.replace('\n## Rollback\n', '\n'), expected: /promote-build\/SKILL\.md: runbook has no ## Rollback section/ },
    { rule: 'frontmatter name equals folder', file: body.replace('name: promote-build', 'name: release-build'), expected: /promote-build\/SKILL\.md: runbook frontmatter name release-build differs from its folder promote-build/ },
    { rule: 'missing runbook file is reported, not parsed', file: null, expected: /project skill promote-build points to missing/, absent: /runbook has no/ }
  ]) {
    await write(dir, '.agents/project/index.md', skillsTable(rows).join('\n'));
    if (file === null) await fs.rm(path.join(dir, runbookFile));
    else await write(dir, runbookFile, file);
    const failures = await failuresFor(dir);
    assert.match(failures, expected, rule);
    if (absent) assert.doesNotMatch(failures, absent, rule);
  }
});
