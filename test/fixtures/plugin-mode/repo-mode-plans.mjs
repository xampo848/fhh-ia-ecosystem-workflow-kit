// What repo mode does in the release the fixture was last regenerated at
// (0.23.1-script-guards; first generated from 0.22.0, commit 558e9fb, the last
// commit before plugin mode), as the AC-19 and T6 guards of
// test/plugin-mode.test.mjs compare it, per runtime list:
//
// - plans: for `init` on an empty repository and for `update` right after
//   that init, the operation, class, path and content hash of every planned
//   file;
// - applied: the CLI run for real (`init` dry run, `init --apply --yes`,
//   `doctor`, `update` dry run): exit code and output, and the hash of every
//   file of the tree `init` wrote; plus `init` over a folder at
//   `.claude/settings.json`, a path repo mode never writes.
//
// The same collectors run on this checkout (the tests) and on the files of a
// commit (to write the fixture), so both sides are shaped the same way.
// The package version, the target folder, timestamps and the checksums that
// carry the version are normalized, and the CLI runs without Node's own
// process warnings, so only a change of behaviour differs, on any Node.
//
// Regenerate the fixture only when a change is meant to change what repo mode
// installs: commit that change (with its version raise), then, from the
// repository root, run the collectors on the files of that commit, and update
// the release named in the first lines of this header:
//
//   dir=$(mktemp -d) && git archive HEAD | tar -x -C "$dir"
//   ln -s "$PWD/node_modules" "$dir/node_modules"
//   node test/fixtures/plugin-mode/repo-mode-plans.mjs "$dir"
//   rm -rf "$dir"
//
// Without an argument (as `node --test` runs every file under test/) it does
// nothing.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMainModule } from '../../../scripts/is-main-module.mjs';

export const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'repo-mode-plans.json');
export const guardedRuntimeLists = Object.freeze(['neutral', 'claude', 'copilot', 'claude,codex']);

const sha256 = (content) => createHash('sha256').update(content).digest('hex');
const versionMark = '<version>';

export async function packageVersionOf(rootDirectory) {
  return JSON.parse(await fs.readFile(path.join(rootDirectory, 'package.json'), 'utf8')).version;
}

// Text content with the package version replaced; binary content as it is.
const normalizedContent = (content, version) => (typeof content === 'string' ? content.replaceAll(version, versionMark) : content);

// One line per planned file: "<operation> <class> <path> <content hash>"
// (class "-" for a file without one, such as .gitignore; hash "-" for an
// operation without content).
export const planShape = (plan, version) => plan.operations.map(({ operation, relativePath, class: fileClass, content }) =>
  `${operation} ${fileClass ?? '-'} ${relativePath} ${content === undefined || content === null ? '-' : sha256(normalizedContent(content, version)).slice(0, 16)}`);

// `planOptions` reaches both plans (for example `{ mode: 'repo' }`, which the
// modules of 558e9fb ignore).
export async function collectRepoModePlans(rootDirectory, makeTarget, planOptions = {}) {
  const sourceDirectory = path.join(rootDirectory, 'src');
  const version = await packageVersionOf(rootDirectory);
  const { buildInstallPlan, buildUpdatePlan } = await import(pathToFileURL(path.join(sourceDirectory, 'planner.mjs')).href);
  const { applyInstallPlan } = await import(pathToFileURL(path.join(sourceDirectory, 'apply.mjs')).href);
  const plans = { init: {}, update: {} };
  for (const runtime of guardedRuntimeLists) {
    const target = await makeTarget();
    const init = await buildInstallPlan({ targetPath: target, runtime, ...planOptions });
    plans.init[runtime] = planShape(init, version);
    await applyInstallPlan(init);
    plans.update[runtime] = planShape(await buildUpdatePlan({ targetPath: target, ...planOptions }), version);
  }
  return plans;
}

const runFile = promisify(execFile);

function normalizeText(text, { target, version }) {
  return text.replaceAll(target, '<target>').replaceAll(version, versionMark)
    .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, '<time>')
    .replace(/\d{8}T\d{6}Z/g, '<stamp>');
}

// Node's own process warnings (Node 20 warns that importing JSON modules is
// experimental, later versions do not) depend on the Node version, not on the
// kit, so the runs turn them off.
const childEnv = { ...process.env, NODE_NO_WARNINGS: '1' };

// The output of a run (exit code, then stdout and stderr, normalized): its
// hash, and its lines without the one-path operation lines ("- create: <path>"),
// which the plans already hold, so a failing guard shows the lines that moved.
function outputShape(text) {
  return { sha256: sha256(text).slice(0, 16), lines: text.split('\n').filter((line) => !/^- [a-z_]+: \S+$/.test(line)) };
}

// `context.undo` (tests only): the intentional changes since 558e9fb, undone
// before shaping, so everything else still compares exactly. `output(step,
// text)` gets the normalized output of a run, `file(relativePath, content)`
// the content of a file of the tree. The fixture is written without it.
async function runCli(rootDirectory, args, context, step) {
  const bin = path.join(rootDirectory, 'bin', 'workflow-kit.mjs');
  let result;
  try {
    const { stdout, stderr } = await runFile(process.execPath, [bin, ...args], { cwd: context.target, env: childEnv, maxBuffer: 16 * 1024 * 1024 });
    result = { code: 0, stdout, stderr };
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    result = { code: error.code, stdout: error.stdout, stderr: error.stderr };
  }
  const text = `exit ${result.code}\n${normalizeText(result.stdout, context)}\n--- stderr ---\n${normalizeText(result.stderr, context)}`;
  return outputShape(context.undo?.output ? context.undo.output(step, text) : text);
}

// The hash of every file under the target. A checksum of a file's raw content
// (install-state, journal) is replaced by the checksum of its normalized
// content, so a file that carries the version compares by behaviour.
async function treeShape(context) {
  const raw = {};
  const checksums = new Map();
  for (const relativePath of (await fs.readdir(context.target, { recursive: true })).sort()) {
    const absolutePath = path.join(context.target, relativePath);
    if (!(await fs.lstat(absolutePath)).isFile()) continue;
    const posixPath = relativePath.split(path.sep).join('/');
    const read = await fs.readFile(absolutePath, 'utf8');
    const content = context.undo?.file ? context.undo.file(posixPath, read) : read;
    raw[posixPath] = content;
    checksums.set(sha256(content), sha256(normalizeText(content, context)));
  }
  return Object.fromEntries(Object.entries(raw).map(([relativePath, content]) => [
    relativePath,
    sha256(normalizeText(content, context).replace(/\b[0-9a-f]{64}\b/g, (checksum) => checksums.get(checksum) ?? checksum)).slice(0, 16)
  ]));
}

export async function collectRepoModeRuns(rootDirectory, makeTarget, undo = undefined) {
  const version = await packageVersionOf(rootDirectory);
  const runs = {};
  for (const runtime of guardedRuntimeLists) {
    const context = { target: await fs.realpath(await makeTarget()), version, undo };
    const init = ['init', '--target', context.target, '--runtime', runtime];
    runs[runtime] = {
      initDryRun: await runCli(rootDirectory, init, context, 'initDryRun'),
      initApply: await runCli(rootDirectory, [...init, '--apply', '--yes'], context, 'initApply'),
      tree: await treeShape(context),
      doctor: await runCli(rootDirectory, ['doctor', '--target', context.target], context, 'doctor'),
      updateDryRun: await runCli(rootDirectory, ['update', '--target', context.target], context, 'updateDryRun')
    };
  }
  const context = { target: await fs.realpath(await makeTarget()), version, undo };
  await fs.mkdir(path.join(context.target, '.claude', 'settings.json'), { recursive: true });
  runs.settingsFolder = await runCli(rootDirectory, ['init', '--target', context.target, '--runtime', 'claude'], context, 'settingsFolder');
  return runs;
}

if (isMainModule(import.meta.url) && process.argv[2]) {
  const created = [];
  const makeTarget = async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-fixture-'));
    created.push(directory);
    return directory;
  };
  try {
    const rootDirectory = path.resolve(process.argv[2]);
    const fixture = {
      plans: await collectRepoModePlans(rootDirectory, makeTarget),
      applied: await collectRepoModeRuns(rootDirectory, makeTarget)
    };
    await fs.writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  } finally {
    for (const directory of created) await fs.rm(directory, { recursive: true, force: true });
  }
}
