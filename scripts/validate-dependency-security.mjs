import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (content) => createHash('sha256').update(content).digest('hex');

export async function verifyDependencyPatches({ root = repositoryRoot, manifest } = {}) {
  const inventory = manifest ?? JSON.parse(await fs.readFile(path.join(root, 'docs/security/dependency-patches.json'), 'utf8'));
  if (!Array.isArray(inventory.packages) || inventory.packages.length === 0) throw new Error('Missing patch inventory');
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const expected = new Map();
  const instances = new Map();
  for (const entry of inventory.packages) {
    if (typeof entry.name !== 'string' || typeof entry.version !== 'string' || expected.has(entry.name)
      || !entry.files || Object.keys(entry.files).length === 0) throw new Error('Invalid or duplicate patch entry');
    if (metadata.patchedDependencies?.[`${entry.name}@${entry.version}`] !== entry.patch) throw new Error(`Missing registered patch: ${entry.name}`);
    if (sha256(await fs.readFile(path.join(root, entry.patch))) !== entry.patchSha256) throw new Error(`Patch hash mismatch: ${entry.name}`);
    expected.set(entry.name, entry);
    instances.set(entry.name, []);
  }

  const visited = new Set();
  const inspectPackage = async (directory, requestedName) => {
    const real = await fs.realpath(directory);
    if (visited.has(real)) return;
    visited.add(real);
    let pkg;
    try {
      pkg = JSON.parse(await fs.readFile(path.join(real, 'package.json'), 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT' || expected.has(requestedName)) throw error;
      await inspectModules(path.join(real, 'node_modules'), true);
      return;
    }
    if (expected.has(requestedName) && pkg.name !== requestedName) throw new Error(`Installed package identity mismatch: ${requestedName}`);
    const entry = expected.get(pkg.name);
    if (entry) {
      if (pkg.version !== entry.version) throw new Error(`Unexpected installed version: ${pkg.name}@${pkg.version}`);
      for (const [file, hash] of Object.entries(entry.files)) {
        if (sha256(await fs.readFile(path.join(real, file))) !== hash) throw new Error(`Installed patch mismatch: ${pkg.name}/${file}`);
      }
      instances.get(pkg.name).push(real);
    }
    await inspectModules(path.join(real, 'node_modules'), true);
  };
  const inspectModules = async (directory, optional = false) => {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (optional && error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const location = path.join(directory, entry.name);
      if (entry.name === '.bun') {
        for (const container of await fs.readdir(location, { withFileTypes: true })) {
          if (container.isDirectory()) await inspectModules(path.join(location, container.name, 'node_modules'), true);
        }
      } else if (entry.name.startsWith('@')) {
        for (const scoped of await fs.readdir(location, { withFileTypes: true })) {
          if (scoped.isDirectory() || scoped.isSymbolicLink()) await inspectPackage(path.join(location, scoped.name), `${entry.name}/${scoped.name}`);
        }
      } else if (!entry.name.startsWith('.')) {
        await inspectPackage(location, entry.name);
      }
    }
  };
  await inspectModules(path.join(root, 'node_modules'));
  for (const [name, found] of instances) if (found.length === 0) throw new Error(`Patched package not installed: ${name}`);
  return { packages: inventory.packages, instanceCounts: Object.fromEntries([...instances].map(([name, found]) => [name, found.length])) };
}

export function evaluateDependencyAudit({ status, report, verification }) {
  if (status !== 0 && status !== 1) throw new Error('Audit process failed or returned an unsupported exit code');
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('Invalid audit report');
  const packageNames = Object.keys(report);
  if ((status === 0) !== (packageNames.length === 0)) throw new Error('Audit exit code and report disagree');
  const corrected = [];
  for (const name of packageNames) {
    const entries = report[name];
    if (!Array.isArray(entries) || entries.length === 0) throw new Error(`Invalid advisory list: ${name}`);
    const patch = verification.packages.find((entry) => entry.name === name && entry.advisory);
    for (const advisory of entries) {
      if (!patch || !advisory || advisory.url !== patch.source || advisory.severity !== patch.severity
        || !Number.isSafeInteger(advisory.id) || !Number.isSafeInteger(verification.instanceCounts[name]) || verification.instanceCounts[name] < 1) {
        throw new Error(`Uncorrected or unexpected advisory: ${name}`);
      }
      corrected.push({ name, advisory: patch.advisory, instances: verification.instanceCounts[name] });
    }
  }
  return { status: 'PASS', corrected };
}

export async function runDependencySecurity({ root = repositoryRoot } = {}) {
  const verification = await verifyDependencyPatches({ root });
  const result = spawnSync('bun', ['audit', '--json'], { cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
  if (result.error || result.signal) throw new Error('Audit execution failed or timed out');
  const report = JSON.parse(result.stdout);
  return evaluateDependencyAudit({ status: result.status, report, verification });
}

const invokedPath = process.argv[1] ? await fs.realpath(process.argv[1]).catch(() => null) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await runDependencySecurity();
    console.log(JSON.stringify(result, null, 2));
    console.log('[security] Known version-based advisories remain visible; only installed, hash-verified local corrections are accepted.');
  } catch (error) {
    console.error(`[security] FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}