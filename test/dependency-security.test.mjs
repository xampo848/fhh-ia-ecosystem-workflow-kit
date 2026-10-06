import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { evaluateDependencyAudit, verifyDependencyPatches } from '../scripts/validate-dependency-security.mjs';

const require = createRequire(import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fixture = async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'verified-security-'));
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
  await assert.rejects(verifyDependencyPatches({ ...input, manifest: { packages: [] } }), /Missing patch inventory/);
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

test('real installed corrections reject deep recursion and preserve numeric and glob compatibility', async () => {
  const braces = require('braces');
  const { sprintf, vsprintf } = require('sprintf-js');
  const deep = '{'.repeat(4000) + 'a,b' + '}'.repeat(4000);
  for (const pattern of [deep, '('.repeat(4000) + 'a' + ')'.repeat(4000)]) {
    assert.equal(braces.compile(pattern), pattern);
    assert.deepEqual(braces.expand(pattern), [pattern]);
    assert.equal(braces.stringify(braces.parse(pattern)), pattern);
  }
  assert.deepEqual(braces.expand('src/{a,b}.js'), ['src/a.js', 'src/b.js']);
  assert.deepEqual(braces.expand('item-{1..3}'), ['item-1', 'item-2', 'item-3']);
  assert.equal(sprintf('%s:%04d', 'x', 7), 'x:0007');
  assert.equal(vsprintf('%.2f %s', [1.234, 'ok']), '1.23 ok');
  assert.equal(sprintf('%.0f', 1.234), '1');
  assert.equal(sprintf('%.0g', 1), '1');
  for (const suffix of ['f', 'e', 'g']) {
    assert.equal(typeof sprintf('%.1000000000' + suffix, 1), 'string');
    assert.equal(typeof sprintf('%.' + '9'.repeat(400) + suffix, 1), 'string');
  }
  const probe = spawnSync(process.execPath, ['-e', 'const b=require("braces");b.compile("{".repeat(4000)+"a,b"+"}".repeat(4000));require("sprintf-js").sprintf("%.1000000000f",1)'], { timeout: 2000, maxBuffer: 4096 });
  assert.equal(probe.error, undefined);
  assert.equal(probe.status, 0, probe.stderr?.toString());
  const verification = await verifyDependencyPatches();
  assert.ok(verification.instanceCounts.braces >= 1);
  assert.ok(verification.instanceCounts['sprintf-js'] >= 1);
});