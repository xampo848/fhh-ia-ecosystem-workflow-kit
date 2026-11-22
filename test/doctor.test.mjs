import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { runDoctor } from '../src/doctor.mjs';
import { buildInstallPlan, installStateRelativePath } from '../src/planner.mjs';
import { installLegacy0181 } from './fixtures/legacy-0.18.1/install.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

const sha = (content) => createHash('sha256').update(content, 'utf8').digest('hex');
const read = (target, relativePath) => fs.readFile(path.join(target, relativePath), 'utf8');
async function write(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

// Each expected finding: [code, path, message pattern, severity].
function assertFindings(result, expected) {
  for (const [code, relativePath, message, severity = 'warning'] of expected) {
    const finding = result.diagnostics.find((item) => item.code === code && item.path === relativePath && message.test(item.message));
    assert.ok(finding, `${code} ${relativePath} ${message} not in ${JSON.stringify(result.diagnostics, null, 2)}`);
    assert.equal(finding.severity, severity, code);
  }
}

test('doctor succeeds after selected install is applied', async () => {
  const target = await makeTempRepo();
  const installIo = createMemoryIo();
  const doctorIo = createMemoryIo();

  assert.equal(await runCli(['init', '--target', target, '--runtime', 'codex,copilot', '--overlay', 'fhh-ia-ecosystem-full', '--apply', '--yes'], installIo), 0);
  const code = await runCli(['doctor', '--target', target, '--runtime', 'codex,copilot', '--overlay', 'fhh-ia-ecosystem-full'], doctorIo);

  assert.equal(code, 0);
  assert.match(doctorIo.output.stdout, /Doctor: ok/);
});

test('doctor fails and names missing files for incomplete target', async () => {
  const target = await makeTempRepo();
  const io = createMemoryIo();

  const code = await runCli(['doctor', '--target', target, '--runtime', 'codex'], io);

  assert.equal(code, 1);
  assert.match(io.output.stdout, /Doctor: failed/);
  assert.match(io.output.stdout, /\.agents\/instructions\.md/);
  assert.match(io.output.stdout, /AGENTS\.md/);
});

test('doctor fails with actionable semantic diagnostics', async () => {
  const target = await makeTempRepo();
  const installIo = createMemoryIo();
  const doctorIo = createMemoryIo();
  await runCli(['init', '--target', target, '--runtime', 'copilot', '--apply', '--yes'], installIo);
  await fs.writeFile(
    path.join(target, '.github/instructions/ai-workflow.instructions.md'),
    '# invalid\n',
    'utf8'
  );

  const code = await runCli(['doctor', '--target', target, '--runtime', 'copilot'], doctorIo);

  assert.equal(code, 1);
  assert.match(doctorIo.output.stdout, /\[copilot\/missing-apply-to\]/);
  assert.match(doctorIo.output.stdout, /\.github\/instructions\/ai-workflow\.instructions\.md/);
});

// One source of truth for what update leaves pending: the update plan.
test('doctor lists what update leaves pending and what is neither kit nor project, each with its action (2.0.0 state)', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nlocal rule\n');
  const retired = '.agents/skills/04-crosscutting/retired-skill/SKILL.md';
  await write(target, retired, 'edited by the team\n');
  // An adapter's own text outside the block is the project's; an edit inside it is not.
  await fs.appendFile(path.join(target, 'docs/README.md'), '\nown text\n');
  await write(target, 'CLAUDE.md', (await read(target, 'CLAUDE.md')).replace('# CLAUDE.md', '# CLAUDE.md\n\nlocal rule inside the block'));
  // An own file in the kit skills tree; a backup the kit left is not reported.
  const own = '.agents/skills/06-patterns/local/own/SKILL.md';
  await write(target, own, '---\nname: own\n---\n');
  await write(target, '.agents/skills/06-patterns/README.md.workflow-kit-backup-20260101T000000Z', 'old\n');
  const state = JSON.parse(await read(target, installStateRelativePath));
  state.files[retired] = { sha256: sha('as the kit shipped it\n'), class: 'kit' };
  for (const key of ['/etc/hosts', 'docs/../outside.md', 'docs//double.md']) state.files[key] = { sha256: sha('x'), class: 'kit' };
  // A block that already equals this version's template is not an edit, even
  // when the state recorded an older block.
  state.files['docs/README.md'] = { sha256: sha('an older kit block'), class: 'adapter' };
  await write(target, installStateRelativePath, JSON.stringify(state, null, 2));

  const result = await runDoctor({ targetPath: target });

  assertFindings(result, [
    ['boundary/pending-edited_kit_file', '.agents/instructions.md', /workflow-kit update --edited \.agents\/instructions\.md=keep\|discard/],
    ['boundary/pending-retired_edited', retired, /the kit no longer ships it; delete it or keep it as project content outside the kit folders/],
    ['boundary/adapter-block-edited', 'CLAUDE.md', /next update restores the block.*move your text outside the markers/],
    ['boundary/unowned-path', own, /neither kit nor project; move it to \.agents\/project\/ \(skills go to \.agents\/project\/skills\/<name>\/ with a row in \.agents\/project\/index\.md\)/],
    ...['/etc/hosts', 'docs/../outside.md', 'docs//double.md'].map((key) => ['boundary/ignored-state-key', installStateRelativePath, new RegExp(`^Key "${key.replaceAll('.', '\\.')}" .*remove it from install-state\\.json`)]),
    // Final review 3: a SKILL.md the kit registry does not list is not kit
    // content; registering it in the kit catalog would make it a pending edit.
    ...[retired, own].map((skillPath) => ['skills/unregistered-file', skillPath, /not kit content.*boundary\/\* finding.*\.agents\/project\/skills\/<name>\/ with a row in \.agents\/project\/index\.md/])
  ]);
  const unexpected = result.diagnostics.filter((item) => item.code === 'managed/content-drift' || item.path === 'docs/README.md' || item.path.includes('workflow-kit-backup'));
  assert.deepEqual(unexpected, []);
  // Everything above is a warning: doctor passes.
  assert.deepEqual(result.diagnostics.filter((item) => item.severity === 'error'), []);
  assert.equal(result.ok, true);
});

test('doctor warns about outdated or invalid shadows and a project context kept at both paths', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const kitPath = '.agents/skills/02-implement/validation-runner/SKILL.md';
  const shadows = {
    current: { skill: 'validation-runner', kit_path: kitPath, base_sha256: sha(await read(target, kitPath)) },
    outdated: { skill: 'validation-runner', kit_path: kitPath, base_sha256: sha('older kit version\n') },
    gone: { skill: 'retired-skill', kit_path: '.agents/skills/04-crosscutting/retired-skill/SKILL.md', base_sha256: sha('x') },
    invalid: '{ not json',
    missing: null
  };
  const rows = Object.keys(shadows).map((name) => `| \`${name}\` | \`.agents/project/shadows/${name}/\` |`);
  await write(target, '.agents/project/index.md', `# Project Catalog\n\n## Shadows\n\n| Kit skill | Shadow directory |\n| --- | --- |\n${rows.join('\n')}\n`);
  for (const [name, manifest] of Object.entries(shadows)) {
    await write(target, `.agents/project/shadows/${name}/SKILL.md`, '---\nname: shadow\n---\n');
    if (manifest !== null) await write(target, `.agents/project/shadows/${name}/shadow.json`, typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
  }
  await write(target, '.agents/project-context.md', '# Old context\n');

  const result = await runDoctor({ targetPath: target });

  assertFindings(result, [
    ['boundary/shadow-outdated', '.agents/project/shadows/outdated/shadow.json', /changed since this shadow was made.*compare .* refresh the shadow, then update base_sha256/],
    ['boundary/shadow-outdated', '.agents/project/shadows/gone/shadow.json', /the kit no longer ships it/],
    ['boundary/shadow-invalid', '.agents/project/shadows/invalid/shadow.json', /not valid JSON/],
    ['boundary/shadow-invalid', '.agents/project/shadows/missing/shadow.json', /missing/],
    ['project-context/both-paths', '.agents/project-context.md', /merge them into \.agents\/project\/context\.md and delete \.agents\/project-context\.md/]
  ]);
  assert.equal(result.diagnostics.some((item) => item.path.startsWith('.agents/project/shadows/current/')), false);
});

test('with a 1.0.0 state doctor asks for the migration and lists what it would leave pending, with the action for each', async () => {
  const target = await makeTempRepo();
  await installLegacy0181(target);
  for (const relativePath of ['.agents/instructions.md', 'CLAUDE.md']) await fs.appendFile(path.join(target, relativePath), '\nLocal edit.\n');
  const kitNamed = '.agents/skills/06-patterns/local/router-copy';
  await write(target, `${kitNamed}/SKILL.md`, '---\nname: workflow-router\ndescription: Own copy.\n---\n');
  // A catalog row naming a path in the kit tree that is no own skill is not written.
  const ghostPath = '.agents/skills/06-patterns/local/ghost/SKILL.md';
  await fs.appendFile(path.join(target, '.agents/skills/registry.md'), `\n| Skill name | Trigger | Physical path |\n| --- | --- | --- |\n| \`ghost\` | Ghost row | \`${ghostPath}\` |\n`);

  const result = await runDoctor({ targetPath: target });

  assertFindings(result, [
    ['managed/legacy-layout', installStateRelativePath, /run workflow-kit update \(dry run first\) to migrate to the kit\/project overlay layout/],
    ['boundary/pending-edited_kit_file', '.agents/instructions.md', /workflow-kit update --edited \.agents\/instructions\.md=keep\|discard/],
    ['boundary/pending-unmarked_adapter', 'CLAUDE.md', /workflow-kit update --edited CLAUDE\.md=keep\|discard\|split/],
    ['boundary/pending-kit_skill_name', `${kitNamed}/`, /move the folder by hand to \.agents\/project\/skills\/<name>\/.*add its row to \.agents\/project\/index\.md/],
    ['boundary/pending-catalog_row_not_moved', ghostPath, /`ghost`.*add the row to \.agents\/project\/index\.md by hand/]
  ]);
  // The migration plan already lists the own files in the kit tree.
  assert.equal(result.diagnostics.some((item) => item.code === 'boundary/unowned-path'), false);
});

test('doctor reports an unusable or unfinished apply journal as an error with the way back', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const journalPath = '.agents/workflow-kit/last-apply.json';
  const cases = [
    ['{ not json', 'managed/apply-journal-unusable', /cannot be read \(not valid JSON\), so rollback cannot use it\. Fix it by hand \(Git does not track it\); only if you will not roll back the last apply, move it out of \.agents\/workflow-kit\/\. init and update stop until then\.$/],
    ['{"schemaVersion":"2.0.0"}', 'managed/apply-journal-unusable', /cannot be read \(unsupported format\)/],
    [JSON.stringify({ schemaVersion: '2.0.0', appliedAt: '2026-01-01T00:00:00.000Z', completed: false, files: [] }), 'managed/apply-incomplete', /did not finish \(2026-01-01T00:00:00\.000Z\)\. Run `workflow-kit rollback --apply --yes`/]
  ];
  for (const [content, code, message] of cases) {
    await write(target, journalPath, content);
    const result = await runDoctor({ targetPath: target });
    assertFindings(result, [[code, journalPath, message, 'error']]);
    assert.equal(result.ok, false);
  }
});

test('doctor warns when target was last applied with a different toolkit version', async () => {
  const target = await makeTempRepo();
  const installIo = createMemoryIo();
  const doctorIo = createMemoryIo();
  await runCli(['init', '--target', target, '--runtime', 'codex', '--apply', '--yes'], installIo);

  const statePath = path.join(target, '.agents/workflow-kit/install-state.json');
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  state.toolkitVersion = '0.0.1-older';
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  const code = await runCli(['doctor', '--target', target, '--runtime', 'codex'], doctorIo);

  assert.equal(code, 0);
  assert.match(doctorIo.output.stdout, /\[managed\/toolkit-version-mismatch\]/);
});

test('doctor fails with actionable Antigravity routing diagnostics', async () => {
  const target = await makeTempRepo();
  const installIo = createMemoryIo();
  const doctorIo = createMemoryIo();
  await runCli(['init', '--target', target, '--runtime', 'antigravity', '--apply', '--yes'], installIo);
  await fs.writeFile(
    path.join(target, 'ANTIGRAVITY.md'),
    '# ANTIGRAVITY.md\n\nThis is a thin Antigravity runtime adapter.\n',
    'utf8'
  );

  const code = await runCli(['doctor', '--target', target, '--runtime', 'antigravity'], doctorIo);

  assert.equal(code, 1);
  assert.match(doctorIo.output.stdout, /\[antigravity\/missing-routing-trace\]/);
  assert.match(doctorIo.output.stdout, /\[antigravity\/missing-execution-gate\]/);
  assert.match(doctorIo.output.stdout, /ANTIGRAVITY\.md/);
});

test('doctor warns when an always-loaded adapter lost the level pre-filter', async () => {
  const { runDoctor } = await import('../src/doctor.mjs');
  const { applyInstallPlan } = await import('../src/apply.mjs');
  const { buildInstallPlan } = await import('../src/planner.mjs');
  const { makeTempRepo } = await import('./helpers.mjs');
  const fsPromises = await import('node:fs/promises');
  const pathModule = await import('node:path');

  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  const claudePath = pathModule.join(target, 'CLAUDE.md');
  const original = await fsPromises.readFile(claudePath, 'utf8');
  const withoutBlock = original.replace(/<!-- workflow-kit:level-prefilter:start -->[\s\S]*<!-- workflow-kit:level-prefilter:end -->\n/, '');
  assert.notEqual(withoutBlock, original);
  await fsPromises.writeFile(claudePath, withoutBlock, 'utf8');

  const result = await runDoctor({ targetPath: target, runtime: 'claude' });
  assert.ok(result.diagnostics.some((item) => item.code === 'adapter/missing-level-prefilter' && item.path === 'CLAUDE.md' && item.severity === 'warning'));
});

test('doctor fails when a generated agent does not match the equilibrado profile', async () => {
  const target = await makeTempRepo();
  assert.equal(await runCli(['init', '--target', target, '--runtime', 'claude', '--profile', 'claude=equilibrado', '--apply', '--yes'], createMemoryIo()), 0);

  const healthyIo = createMemoryIo();
  assert.equal(await runCli(['doctor', '--target', target], healthyIo), 0);
  assert.match(healthyIo.output.stdout, /Model profiles: claude=equilibrado/);

  // A calidad agent left behind (for example a manual copy) no longer matches.
  const agentPath = path.join(target, '.claude/agents/testinator-5000.md');
  const content = await fs.readFile(agentPath, 'utf8');
  assert.match(content, /^model: sonnet$/m);
  await fs.writeFile(agentPath, content.replace(/^model: sonnet$/m, 'model: opus'), 'utf8');

  const io = createMemoryIo();
  assert.equal(await runCli(['doctor', '--target', target], io), 1);
  assert.match(io.output.stdout, /model-profile\/agent-mismatch/);
  assert.match(io.output.stdout, /Expected `model: sonnet` for the equilibrado profile but found `model: opus`/);
  assert.match(io.output.stdout, /update --profile claude=equilibrado --apply --yes/);
});
