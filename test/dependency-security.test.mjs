import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { evaluateDependencyAudit, verifyDependencyPatches } from '../scripts/validate-dependency-security.mjs';
import { makeTempRepo } from './helpers.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fixture = async (context) => {
  const root = await makeTempRepo('verified-security-');
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const entry = { name: 'braces', version: '3.0.3', patch: 'patches/fix.patch', patchSha256: sha256('fix'), files: { 'index.js': sha256('safe') }, advisory: 'GHSA-vfj7-8cjw-p6xm', severity: 'high', source: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' };
  await fs.mkdir(path.join(root, 'patches'), { recursive: true });
  await fs.writeFile(path.join(root, entry.patch), 'fix');
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ patchedDependencies: { 'braces@3.0.3': entry.patch } }));
  await fs.mkdir(path.join(root, 'node_modules/braces'), { recursive: true });
  await fs.writeFile(path.join(root, 'node_modules/braces/package.json'), JSON.stringify({ name: entry.name, version: entry.version }));
  await fs.writeFile(path.join(root, 'node_modules/braces/index.js'), 'safe');
  return { root, manifest: { packages: [entry] } };
};

test('verified patches require matching registration, patch bytes, installed code and every nested copy', async (context) => {
  const input = await fixture(context);
  const verified = await verifyDependencyPatches(input);
  assert.deepEqual(verified.instanceCounts, { braces: 1 });
  const nested = path.join(input.root, 'node_modules/parent/node_modules/braces');
  await fs.mkdir(nested, { recursive: true });
  await fs.writeFile(path.join(input.root, 'node_modules/parent/package.json'), JSON.stringify({ name: 'parent', version: '1' }));
  await fs.cp(path.join(input.root, 'node_modules/braces'), nested, { recursive: true });
  assert.equal((await verifyDependencyPatches(input)).instanceCounts.braces, 2);
  await fs.writeFile(path.join(nested, 'index.js'), 'vulnerable');
  await assert.rejects(verifyDependencyPatches(input), /Installed patch mismatch/);
  await fs.writeFile(path.join(nested, 'index.js'), 'safe');
  await fs.writeFile(path.join(nested, 'package.json'), JSON.stringify({ name: 'braces', version: '3.0.2' }));
  await assert.rejects(verifyDependencyPatches(input), /Unexpected installed version/);
  await fs.rm(path.join(nested, 'package.json'));
  await assert.rejects(verifyDependencyPatches(input), /ENOENT/);
});

test('parents without metadata cannot hide nested vulnerable packages', async (context) => {
  const input = await fixture(context);
  const nested = path.join(input.root, 'node_modules/parent-without-metadata/node_modules/braces');
  await fs.cp(path.join(input.root, 'node_modules/braces'), nested, { recursive: true });
  assert.equal((await verifyDependencyPatches(input)).instanceCounts.braces, 2);
  await fs.writeFile(path.join(nested, 'index.js'), 'vulnerable');
  await assert.rejects(verifyDependencyPatches(input), /Installed patch mismatch/);
});

test('missing, unregistered, altered or duplicate patches fail closed', async (context) => {
  const input = await fixture(context);
  await assert.rejects(verifyDependencyPatches({ ...input, manifest: {} }), /Missing patch inventory/);
  // A patch registered in package.json but absent from the inventory is not accepted.
  await assert.rejects(verifyDependencyPatches({ ...input, manifest: { packages: [] } }), /Unregistered local patch: braces@3\.0\.3/);
  await assert.rejects(verifyDependencyPatches({ ...input, manifest: { packages: [...input.manifest.packages, ...input.manifest.packages] } }), /duplicate/);
  await fs.writeFile(path.join(input.root, 'package.json'), '{}');
  await assert.rejects(verifyDependencyPatches(input), /Missing registered patch/);
  await fs.writeFile(path.join(input.root, 'package.json'), JSON.stringify({ patchedDependencies: { 'braces@3.0.3': 'patches/fix.patch' } }));
  await fs.writeFile(path.join(input.root, 'patches/fix.patch'), 'different');
  await assert.rejects(verifyDependencyPatches(input), /Patch hash mismatch/);
  await fs.rm(path.join(input.root, 'patches/fix.patch'));
  await assert.rejects(verifyDependencyPatches(input), /ENOENT/);
});

test('audit accepts only exact corrected advisories and rejects malformed reports or failed processes', async (context) => {
  const verification = await verifyDependencyPatches(await fixture(context));
  const advisory = { id: 1240992, url: verification.packages[0].source, severity: 'high' };
  const report = { braces: [advisory] };
  const evaluate = (overrides = {}) => evaluateDependencyAudit({ status: 1, report, verification, ...overrides });
  assert.equal(evaluate().corrected.length, 1);
  assert.deepEqual(evaluate({ status: 0, report: {} }), { status: 'PASS', corrected: [] });
  for (const invalid of [null, [], { braces: [] }, { braces: {} }, { unrelated: [advisory] }, { braces: [{ ...advisory, url: 'https://github.com/advisories/GHSA-new' }] }, { braces: [{ ...advisory, severity: 'critical' }] }, { braces: [{ ...advisory, id: '1240992' }] }]) {
    assert.throws(() => evaluate({ report: invalid }));
  }
  for (const status of [null, 2, -1, 0]) assert.throws(() => evaluate({ status }));
  assert.throws(() => evaluate({ report: {} }), /disagree/);
  assert.throws(() => evaluate({ verification: { ...verification, instanceCounts: {} } }));
});

test('without local corrections the gate accepts a clean audit and rejects any advisory', async (context) => {
  const root = await makeTempRepo('verified-security-empty-');
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ devDependencies: { yaml: '^2.9.1' } }));
  await fs.mkdir(path.join(root, 'node_modules/yaml'), { recursive: true });
  await fs.writeFile(path.join(root, 'node_modules/yaml/package.json'), JSON.stringify({ name: 'yaml', version: '2.9.1' }));
  const verification = await verifyDependencyPatches({ root, manifest: { packages: [] } });
  assert.deepEqual(verification, { packages: [], instanceCounts: {} });
  assert.deepEqual(evaluateDependencyAudit({ status: 0, report: {}, verification }), { status: 'PASS', corrected: [] });
  const advisory = { id: 1, url: 'https://github.com/advisories/GHSA-new', severity: 'low' };
  assert.throws(() => evaluateDependencyAudit({ status: 1, report: { yaml: [advisory] }, verification }), /Uncorrected or unexpected advisory: yaml/);
});

test('this repository registers no local patch, override or patched dependency', async () => {
  const verification = await verifyDependencyPatches();
  assert.deepEqual(verification, { packages: [], instanceCounts: {} });
  const metadata = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(metadata.patchedDependencies, undefined);
  assert.equal(metadata.overrides, undefined);
  assert.deepEqual(Object.keys(metadata.dependencies), ['@inquirer/prompts']);
  assert.deepEqual(Object.keys(metadata.devDependencies), ['yaml']);
});
