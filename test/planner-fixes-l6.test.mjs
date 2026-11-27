import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { runCli } from '../src/cli.mjs';
import { createMemoryIo, hashTree, makeTempRepo } from './helpers.mjs';

const execFileAsync = promisify(execFile);
const root = path.resolve('.');
const standards = 'docs/workflow/standards';

async function cli(args) {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, out: io.output.stdout, err: io.output.stderr };
}

async function install(runtime = 'claude') {
  const target = await makeTempRepo('workflow-kit-l6-');
  const done = await cli(['init', '--runtime', runtime, '--target', target, '--apply', '--yes']);
  assert.equal(done.code, 0, done.err);
  return target;
}

const stateOf = async (target) => JSON.parse(await fs.readFile(path.join(target, '.agents/workflow-kit/install-state.json'), 'utf8'));

// A copy of the package (the CLI reads its templates from where it lives), so
// OS junk can be planted in its template tree without touching this checkout.
async function packageCopy() {
  const copy = await makeTempRepo('workflow-kit-l6-package-');
  for (const entry of ['bin', 'src', 'templates', 'package.json']) await fs.cp(path.join(root, entry), path.join(copy, entry), { recursive: true });
  await fs.symlink(path.join(root, 'node_modules'), path.join(copy, 'node_modules'));
  return copy;
}

async function copyCli(copy, args) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [path.join(copy, 'bin/workflow-kit.mjs'), ...args], { maxBuffer: 64 * 1024 * 1024 });
    return { code: 0, out: stdout, err: '' };
  } catch (error) {
    return { code: error.code, out: error.stdout ?? '', err: error.stderr ?? '' };
  }
}

const withoutTarget = (text) => text.split('\n').filter((line) => !line.startsWith('Target:')).join('\n');

test('OS junk files anywhere in the template tree change neither the init plan nor an export', async () => {
  const copy = await packageCopy();
  const plan = async () => {
    const target = await makeTempRepo('workflow-kit-l6-');
    const result = await copyCli(copy, ['init', '--runtime', 'claude,copilot', '--target', target]);
    assert.equal(result.code, 0, result.err);
    return withoutTarget(result.out);
  };
  const clean = await plan();

  const templates = path.join(copy, 'templates');
  const planted = [];
  for (const dir of ['.', 'repo-overlay-fhh-ia-ecosystem-full', 'repo-overlay-fhh-ia-ecosystem-full/docs/workflow/standards', 'repo-overlay-fhh-ia-ecosystem-full/.agents/skills/00-router']) {
    for (const name of ['.DS_Store', 'Thumbs.db', 'desktop.ini']) {
      await fs.writeFile(path.join(templates, dir, name), 'junk');
      planted.push(path.join(dir, name));
    }
  }
  assert.equal(await plan(), clean, 'the plan is identical with the junk files');
  assert.doesNotMatch(clean, /DS_Store|Thumbs\.db|desktop\.ini/);

  const output = await makeTempRepo('workflow-kit-l6-export-');
  const exported = await copyCli(copy, ['export', '--output', output, '--runtime', 'claude', '--apply', '--yes']);
  assert.equal(exported.code, 0, exported.err);
  const files = Object.keys(await hashTree(output));
  assert.deepEqual(files.filter((file) => /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/.test(file)), []);
});

test('only the three OS junk names are skipped, other dotfiles in a template folder are still planned', async () => {
  const copy = await packageCopy();
  const folder = path.join(copy, 'templates/repo-overlay-fhh-ia-ecosystem-full/docs/workflow/standards');
  await fs.writeFile(path.join(folder, '.keep-me'), 'x');
  const target = await makeTempRepo('workflow-kit-l6-');
  const result = await copyCli(copy, ['init', '--runtime', 'claude', '--target', target, '--all']);
  assert.equal(result.code, 0, result.err);
  assert.match(result.out, /docs\/workflow\/standards\/\.keep-me/);
});

async function symlinkedStandard() {
  const target = await install();
  const outside = await makeTempRepo('workflow-kit-l6-outside-');
  const destination = path.join(outside, 'frontend-elsewhere.md');
  await fs.writeFile(destination, 'a different file\n');
  await fs.rm(path.join(target, standards, 'frontend.md'));
  await fs.symlink(destination, path.join(target, standards, 'frontend.md'));
  await fs.appendFile(path.join(target, standards, 'backend.md'), '\nmy edit\n');
  return { target, outside, destination };
}

const frontendOperation = (plan) => plan.split('\n').find((line) => line.includes(`${standards}/frontend.md`));

test('a pending kit file that is a symbolic link offers only keep, in the plan and in doctor', async () => {
  const { target } = await symlinkedStandard();
  const dry = await cli(['update', '--target', target]);
  assert.equal(dry.code, 0, dry.err);
  const line = frontendOperation(dry.out);
  assert.match(line, /^- skip_modified:/);
  assert.match(line, /symbolic link/);
  assert.match(line, /only keep applies/);
  assert.match(line, /replace the link with a regular file/i);
  assert.doesNotMatch(line, /keep \| discard/);
  assert.match(dry.out.split('\n').find((item) => item.includes(`${standards}/backend.md`)), /keep \| discard/);

  const doctor = await cli(['doctor', '--target', target]);
  const message = `${doctor.out}${doctor.err}`.split('\n').find((item) => item.includes(`${standards}/frontend.md`) && item.includes('symbolic link'));
  assert.ok(message, 'doctor says why');
  assert.match(message, /only keep applies/);
  assert.doesNotMatch(message, /--edited [^ ]*frontend\.md=discard/);
  assert.match(message, /--edited [^ ]*frontend\.md=keep/);
});

test('--edited on a symbolic link stops with a clear message and writes nothing', async () => {
  const { target, outside } = await symlinkedStandard();
  const before = await hashTree(target);
  const outsideBefore = await hashTree(outside);
  for (const extra of [[], ['--apply', '--yes']]) {
    const result = await cli(['update', '--target', target, '--edited', `${standards}/frontend.md=discard`, ...extra]);
    assert.equal(result.code, 2);
    assert.match(result.err, /symbolic link/);
    assert.match(result.err, /does not write through links/);
    assert.match(result.err, /Valid decisions: keep\. Nothing was written\./);
    assert.doesNotMatch(result.err, /Refusing to write or delete through symbolic links/);
  }
  assert.deepEqual(await hashTree(target), before);
  assert.deepEqual(await hashTree(outside), outsideBefore);
});

test('--edited all=discard discards the other pending files and leaves the symbolic link as keep, dry run and apply agreeing', async () => {
  const { target, outside, destination } = await symlinkedStandard();
  const backendKit = await fs.readFile(path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full', standards, 'backend.md'), 'utf8');
  const dry = await cli(['update', '--target', target, '--edited', 'all=discard']);
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out.split('\n').find((item) => item.includes(`${standards}/backend.md`)), /^- overwrite_with_backup:/);
  assert.match(frontendOperation(dry.out), /^- skip_modified:.*symbolic link.*also under --edited all=discard/);

  const linkBefore = await fs.readlink(path.join(target, standards, 'frontend.md'));
  const destinationBefore = await fs.readFile(destination, 'utf8');
  const outsideBefore = await hashTree(outside);
  const applied = await cli(['update', '--target', target, '--edited', 'all=discard', '--apply', '--yes']);
  assert.equal(applied.code, 0, applied.err);
  assert.match(frontendOperation(applied.out), /^- skip_modified:/);
  assert.equal(await fs.readFile(path.join(target, standards, 'backend.md'), 'utf8'), backendKit);
  const backups = (await fs.readdir(path.join(target, standards))).filter((name) => name.startsWith('backend.md') && name.includes('workflow-kit-backup'));
  assert.equal(backups.length, 1, 'the discarded edit keeps a backup');
  assert.match(await fs.readFile(path.join(target, standards, backups[0]), 'utf8'), /my edit/);
  assert.equal((await fs.lstat(path.join(target, standards, 'frontend.md'))).isSymbolicLink(), true);
  assert.equal(await fs.readlink(path.join(target, standards, 'frontend.md')), linkBefore);
  assert.equal(await fs.readFile(destination, 'utf8'), destinationBefore);
  assert.deepEqual(await hashTree(outside), outsideBefore);
});

test('an updated export stays an export and keeps its export stops', async () => {
  const target = await makeTempRepo('workflow-kit-l6-');
  const output = path.join(target, 'exported');
  const exported = await cli(['export', '--output', output, '--runtime', 'claude', '--apply', '--yes']);
  assert.equal(exported.code, 0, exported.err);
  assert.equal((await stateOf(output)).mode, 'export');

  await fs.rm(path.join(output, standards, 'backend.md'));
  const updated = await cli(['update', '--target', output, '--apply', '--yes']);
  assert.equal(updated.code, 0, updated.err);
  assert.match(updated.out, /create: docs\/workflow\/standards\/backend\.md/);
  assert.equal((await stateOf(output)).mode, 'export');

  const toPlugin = await cli(['update', '--target', output, '--mode', 'plugin', '--runtime', 'claude']);
  assert.equal(toPlugin.code, 2);
  assert.match(toPlugin.err, /records an export/);

  const again = await cli(['init', '--target', output, '--runtime', 'claude', '--apply', '--yes']);
  assert.notEqual(again.code, 0);
  assert.match(again.err, /export/i);

  const doctor = await cli(['doctor', '--target', output]);
  assert.doesNotMatch(`${doctor.out}${doctor.err}`, /records repo mode/);
});
