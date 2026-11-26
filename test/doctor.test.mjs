import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyInstallPlan } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { formatDoctorResult, runDoctor } from '../src/doctor.mjs';
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

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The words of a command doctor printed, as a POSIX shell splits them (plain
// words and single-quoted ones, the only quoting doctor uses).
export function shellWords(command) {
  const words = [];
  for (const match of command.matchAll(/'((?:[^']|'\\'')*)'|(\S+)/g)) words.push(match[1] !== undefined ? match[1].replaceAll("'\\''", "'") : match[2]);
  return words;
}

// Runs a printed `workflow-kit ...` command from another folder, as a person
// pasting it would.
export async function runPrinted(command) {
  const [bin, ...args] = shellWords(command);
  assert.equal(bin, 'workflow-kit', command);
  const previous = process.cwd();
  process.chdir(await makeTempRepo());
  try {
    const io = createMemoryIo();
    const code = await runCli(args, io);
    return { code, ...io.output };
  } finally {
    process.chdir(previous);
  }
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
    ['boundary/pending-edited_kit_file', '.agents/instructions.md', new RegExp(`Decide with \`workflow-kit update --target ${escape(target)} --edited \\.agents/instructions\\.md=keep\` \\(leaves it as it is; the next update lists it again\\) or \`workflow-kit update --target ${escape(target)} --edited \\.agents/instructions\\.md=discard\` \\(takes the kit version; a backup keeps yours\\), then add --apply --yes\\.$`)],
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
  // Round 5 (R3): an inline `<!--` in prose does not hide the table.
  await write(target, '.agents/project/index.md', `# Project Catalog\n\nAdapters use \`<!--\` markers.\n\n## Shadows\n\n| Kit skill | Shadow directory |\n| --- | --- |\n${rows.join('\n')}\n`);
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
    ['managed/legacy-layout', installStateRelativePath, new RegExp(`run \`workflow-kit update --target ${escape(target)}\` \\(dry run first\\) to migrate to the kit/project overlay layout`)],
    ['boundary/pending-edited_kit_file', '.agents/instructions.md', new RegExp(`\`workflow-kit update --target ${escape(target)} --edited \\.agents/instructions\\.md=keep\` \\(.*\\) or \`workflow-kit update --target ${escape(target)} --edited \\.agents/instructions\\.md=discard\` \\(`)],
    ['boundary/pending-unmarked_adapter', 'CLAUDE.md', new RegExp(`\`workflow-kit update --target ${escape(target)} --edited CLAUDE\\.md=keep\` \\(.*\\), \`workflow-kit update --target ${escape(target)} --edited CLAUDE\\.md=discard\` \\(.*\\) or \`workflow-kit update --target ${escape(target)} --edited CLAUDE\\.md=split\` \\(keeps your own lines next to a new block\\)`)],
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
    [JSON.stringify({ schemaVersion: '2.0.0', appliedAt: '2026-01-01T00:00:00.000Z', completed: false, files: [] }), 'managed/apply-incomplete', /did not finish \(2026-01-01T00:00:00\.000Z\)\. Run `workflow-kit rollback --target \S+ --apply --yes`/]
  ];
  for (const [content, code, message] of cases) {
    await write(target, journalPath, content);
    const result = await runDoctor({ targetPath: target });
    assertFindings(result, [[code, journalPath, message, 'error']]);
    assert.equal(result.ok, false);
  }
  // Final review 7: a journal that cannot even be opened is a finding too.
  await fs.rm(path.join(target, journalPath));
  await fs.mkdir(path.join(target, journalPath));
  assertFindings(await runDoctor({ targetPath: target }), [['managed/apply-journal-unusable', journalPath, /cannot be read \(EISDIR\)/, 'error']]);
});

// Final review 7 and round 4 (N3): a path doctor cannot read is reported,
// never a crash: a file where the kit expects a folder, a folder where it
// expects a file, a folder without permission.
test('doctor reports a path it cannot read as a finding instead of crashing', async () => {
  const cases = [
    { name: '.agents/project as a file', path: '.agents/project/context.md', message: /ENOTDIR.*a file stands where a folder of this path should be/, break: async (target) => {
      await fs.rm(path.join(target, '.agents/project'), { recursive: true });
      await write(target, '.agents/project', 'not a folder\n');
    } },
    { name: 'CLAUDE.md as a folder', path: 'CLAUDE.md', message: /EISDIR/, break: async (target) => {
      await fs.rm(path.join(target, 'CLAUDE.md'));
      await fs.mkdir(path.join(target, 'CLAUDE.md'));
    } },
    { name: 'the project context as a folder', path: '.agents/project/context.md', message: /EISDIR/, break: async (target) => {
      await fs.rm(path.join(target, '.agents/project/context.md'));
      await fs.mkdir(path.join(target, '.agents/project/context.md'));
    } },
    // Permission bits do not stop root.
    ...(process.getuid?.() === 0 ? [] : [{ name: '.claude/agents without permission', path: '.claude/agents', message: /EACCES/, break: async (target) => {
      await fs.chmod(path.join(target, '.claude/agents'), 0o000);
    } }])
  ];
  for (const item of cases) {
    const target = await makeTempRepo();
    await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
    await item.break(target);
    try {
      const result = await runDoctor({ targetPath: target });
      assert.equal(result.ok, false, item.name);
      assertFindings(result, [['managed/path-unreadable', item.path, item.message, 'error']]);
    } finally {
      await fs.chmod(path.join(target, '.claude/agents'), 0o755).catch(() => {});
    }
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
  // The agent is an edited kit file: the fix names --edited ... =discard, with
  // the absolute target, and runs as printed from another folder.
  const fix = io.output.stdout.match(/Run `(workflow-kit update [^`]+)` to regenerate it\./)?.[1];
  assert.equal(fix, `workflow-kit update --target ${target} --profile claude=equilibrado --edited .claude/agents/testinator-5000.md=discard --apply --yes`);
  assert.equal((await runPrinted(fix)).code, 0);
  const after = createMemoryIo();
  assert.equal(await runCli(['doctor', '--target', target], after), 0, after.output.stdout);
  assert.match(after.output.stdout, /^Doctor: ok$/m);
});

// The fix doctor printed before only re-ran update with the profile, which
// leaves an edited agent as it is: doctor failed again with the same error.
test('the model-profile fix doctor prints settles an agent whose model line was removed', async () => {
  const target = await makeTempRepo();
  assert.equal(await runCli(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes'], createMemoryIo()), 0);
  const agent = path.join(target, '.claude/agents/arquitecta-fases.md');
  await fs.writeFile(agent, (await fs.readFile(agent, 'utf8')).replace(/^model: .*\n/m, ''), 'utf8');

  const result = await runDoctor({ targetPath: target });
  const finding = result.diagnostics.find((item) => item.code === 'model-profile/agent-mismatch');
  const fix = finding.message.match(/Run `([^`]+)`/)[1];
  assert.equal(fix, `workflow-kit update --target ${target} --profile claude=calidad --edited .claude/agents/arquitecta-fases.md=discard --apply --yes`);
  assert.equal((await runPrinted(fix)).code, 0);
  assert.equal((await runDoctor({ targetPath: target })).ok, true);
  assert.match(await fs.readFile(agent, 'utf8'), /^model: opus$/m);
});

// Final review 10: every fixed code doctor emits has a row or a bullet in the
// troubleshooting guide (the per-reason boundary/pending-* codes are listed by
// reason there). The plugin-mode codes have their table in the quickstart, so
// mode/* and target/* may be listed in either of the two.
test('every fixed doctor code is documented in the user guides', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const read = (file) => fs.readFile(path.join(root, file), 'utf8');
  const guide = await read('docs/troubleshooting.md');
  const guides = `${guide}\n${await read('docs/quickstart.md')}`;
  const sources = await Promise.all(['src/doctor.mjs', 'src/workspace-diagnostics.mjs'].map(read));
  const codes = [...new Set(sources.flatMap((source) => [...source.matchAll(/'((?:managed|boundary|project-context|mode|target)\/[a-z-]+)'/g)].map((match) => match[1])))];
  assert.ok(codes.length > 20, codes.join(', '));
  assert.ok(codes.some((code) => code.startsWith('mode/')) && codes.includes('target/not-found'), codes.join(', '));
  assert.deepEqual(codes.filter((code) => !(/^(mode|target)\//.test(code) ? guides : guide).includes(`\`${code}\``)), []);
});

// Every workflow-kit command doctor prints carries the absolute target, quoted
// for a shell, so it runs as printed from another folder and acts on the
// target, never on the folder it is pasted in.
test('every command doctor prints names the absolute target and runs as printed from another folder', async () => {
  const target = path.join(await makeTempRepo(), "team's repo");
  await fs.mkdir(target);
  assert.equal(await runCli(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes'], createMemoryIo()), 0);
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nlocal rule\n');
  const statePath = path.join(target, installStateRelativePath);
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  state.toolkitVersion = '0.0.1-older';
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  const relative = path.relative(process.cwd(), target);
  const io = createMemoryIo();
  await runCli(['doctor', '--target', relative], io);
  const commands = [...io.output.stdout.matchAll(/`(workflow-kit [^`]+)`/g)].map((match) => match[1]);
  const quoted = `'${target.replaceAll("'", "'\\''")}'`;
  assert.ok(commands.length >= 3, io.output.stdout);
  assert.match(io.output.stdout, /\[managed\/toolkit-version-mismatch\].*Managed files were last applied with workflow-kit 0\.0\.1-older/);
  assert.doesNotMatch(io.output.stdout, /<repo>/);
  for (const command of commands) {
    assert.ok(command.startsWith(`workflow-kit update --target ${quoted}`), command);
    const before = await fs.readFile(statePath, 'utf8');
    const result = await runPrinted(command);
    assert.equal(result.code, 0, `${command}\n${result.stderr}`);
    assert.match(result.stdout, new RegExp(`^Target: ${escape(target)}$`, 'm'), command);
    assert.equal(await fs.readFile(statePath, 'utf8'), before, `${command} is a dry run`);
  }
});

test('doctor on a path that does not exist says so in one finding, without a list of missing files', async () => {
  const target = path.join(await makeTempRepo(), 'no-such-repo');
  const io = createMemoryIo();
  assert.equal(await runCli(['doctor', '--target', target], io), 1);
  assert.match(io.output.stdout, new RegExp(`^- \\[target/not-found\\] \\.: ${escape(target)} does not exist\\. Check --target`, 'm'));
  assert.doesNotMatch(io.output.stdout, /Missing files:/);
  const file = path.join(await makeTempRepo(), 'a-file');
  await fs.writeFile(file, 'x');
  assert.match(formatDoctorResult(await runDoctor({ targetPath: file })), /\[target\/not-found\] \.: .* is not a folder\./);
});

test('missing files come after what explains them: no install, or an install from another version', async () => {
  const empty = await makeTempRepo();
  const none = formatDoctorResult(await runDoctor({ targetPath: empty })).split('\n');
  const noneHint = none.findIndex((line) => line.startsWith('No workflow-kit install-state here'));
  assert.ok(noneHint >= 0 && noneHint === none.indexOf('Missing files:') - 1, none.slice(0, 12).join('\n'));
  assert.ok(none[noneHint].includes(`\`workflow-kit init --target ${empty}\``));

  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  const statePath = path.join(target, installStateRelativePath);
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  await fs.writeFile(statePath, JSON.stringify({ ...state, toolkitVersion: '0.21.0' }, null, 2));
  await fs.rm(path.join(target, '.agents/kit-boundary.md'));
  const lines = formatDoctorResult(await runDoctor({ targetPath: target })).split('\n');
  const hint = lines.findIndex((line) => line.startsWith('This install was last applied with workflow-kit 0.21.0'));
  assert.ok(hint >= 0 && hint === lines.indexOf('Missing files:') - 1, lines.slice(0, 12).join('\n'));
  assert.ok(lines[hint].includes(`run \`workflow-kit update --target ${target}\` (a dry run first)`));

  // A current install with a missing file gets no such line.
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  assert.equal((await runDoctor({ targetPath: target })).missingHint, null);
});

test('an emptied kit file is an error with the command that takes the kit version back, and that command works', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  await fs.writeFile(path.join(target, '.agents/instructions.md'), '\n');

  const result = await runDoctor({ targetPath: target });
  assert.equal(result.ok, false);
  assertFindings(result, [['managed/file-empty', '.agents/instructions.md', new RegExp(`^This workflow-kit file is empty, so the agent finds no rules in it\\. Run \`workflow-kit update --target ${escape(target)} --edited \\.agents/instructions\\.md=discard --apply --yes\``), 'error']]);
  const fix = result.diagnostics.find((item) => item.code === 'managed/file-empty').message.match(/`([^`]+)`/)[1];
  assert.equal((await runPrinted(fix)).code, 0);
  assert.equal((await runDoctor({ targetPath: target })).ok, true);
});

// A backtick in the target path would close a single-backtick span early:
// such a command goes between double backticks and still runs as printed.
test('a command doctor prints for a target with a backtick keeps an unambiguous delimiter and runs as printed', async () => {
  const target = path.join(await makeTempRepo(), 'repo `with` ticks');
  await fs.mkdir(target);
  assert.equal(await runCli(['init', '--target', target, '--runtime', 'claude', '--apply', '--yes'], createMemoryIo()), 0);
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nlocal rule\n');

  const finding = (await runDoctor({ targetPath: target })).diagnostics.find((item) => item.code === 'boundary/pending-edited_kit_file');
  const commands = [...finding.message.matchAll(/`` (workflow-kit .+?) ``/g)].map((match) => match[1]);
  assert.equal(commands.length, 2, finding.message);
  for (const command of commands) {
    assert.ok(command.startsWith(`workflow-kit update --target '${target}'`), command);
    const result = await runPrinted(command);
    assert.equal(result.code, 0, `${command}\n${result.stderr}`);
    assert.match(result.stdout, new RegExp(`^Target: ${escape(target)}$`, 'm'));
  }
});

// The updater's apply lock: a live one is an error (a run is changing the
// repository), a stale one a warning (the next apply takes it over).
test('doctor reports the apply lock: held by a running process is an error, one left behind is a warning', async () => {
  const lockPath = '.agents/workflow-kit/apply.lock';
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  assert.equal((await runDoctor({ targetPath: target })).diagnostics.some((item) => item.path === lockPath), false, 'no lock, no finding');

  await write(target, lockPath, `${JSON.stringify({ pid: process.pid, startedAt: '2026-01-01T00:00:00.000Z' })}\n`);
  const held = await runDoctor({ targetPath: target });
  assertFindings(held, [['managed/apply-lock-held', lockPath, new RegExp(`^${escape(lockPath)} is held by process ${process.pid}, taken \\d+ s ago: a workflow-kit run is changing this repository\\. If you are sure no workflow-kit command is running`), 'error']]);
  assert.equal(held.ok, false);

  await write(target, lockPath, '');
  const stale = await runDoctor({ targetPath: target });
  assertFindings(stale, [['managed/apply-lock-stale', lockPath, new RegExp(`^${escape(lockPath)} cannot be read or is not valid \\(no usable process id or start time\\); the next apply or rollback takes it over\\.$`), 'warning']]);
  assert.equal(stale.ok, true, 'a stale lock does not fail doctor');
});

// A rollback that started and did not finish has its own wording, and the
// command doctor names carries the target (the journal message does not).
test('an interrupted apply or rollback is managed/apply-incomplete with its own wording and a rollback command that names the target', async () => {
  for (const interrupted of ['apply', 'rollback']) {
    const target = await makeTempRepo();
    await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
    const journalPath = path.join(target, '.agents/workflow-kit/last-apply.json');
    const journal = JSON.parse(await fs.readFile(journalPath, 'utf8'));
    if (interrupted === 'apply') journal.completed = false;
    else journal.rollbackStartedAt = '2026-01-02T03:04:05.000Z';
    await fs.writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);

    const result = await runDoctor({ targetPath: target });
    const finding = result.diagnostics.find((item) => item.code === 'managed/apply-incomplete');
    assert.equal(result.ok, false, interrupted);
    assert.match(finding.message, interrupted === 'rollback'
      ? /^A workflow-kit rollback of the apply of .* started \(2026-01-02T03:04:05\.000Z\) and did not finish, so the repository is partly rolled back\. Run `workflow-kit rollback --target .* --apply --yes` again to finish it, then run init or update again\.$/
      : /^The last workflow-kit apply did not finish \(.*\)\. Run `workflow-kit rollback --target .* --apply --yes` first, then run init or update again\.$/, interrupted);
    assert.ok(finding.message.includes(`\`workflow-kit rollback --target ${target} --apply --yes\``), finding.message);
    assert.doesNotMatch(finding.message, /`workflow-kit rollback --apply --yes`/);
    // The printed command runs from another folder and clears the finding.
    assert.equal((await runPrinted(`workflow-kit rollback --target ${target} --apply --yes`)).code, 0, interrupted);
    assert.equal((await runDoctor({ targetPath: target })).diagnostics.some((item) => item.code === 'managed/apply-incomplete'), false, interrupted);
  }
});

test('doctor on a file as the target says it is not a folder, not a journal problem', async () => {
  const file = path.join(await makeTempRepo(), 'a-file');
  await fs.writeFile(file, 'x');
  const result = await runDoctor({ targetPath: file });
  assert.deepEqual(result.diagnostics.map((item) => item.code), ['target/not-found']);
  assert.doesNotMatch(JSON.stringify(result.diagnostics), /apply|journal/i);
  const io = createMemoryIo();
  assert.equal(await runCli(['doctor', '--target', file], io), 1);
  assert.match(io.output.stdout, /is not a folder\./);
});
