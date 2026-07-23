import { spawn } from 'node:child_process';
import packageJson from '../package.json' with { type: 'json' };

const workflowKitConfig = packageJson.workflowKit ?? {};

export function currentToolkitMetadata() {
  return {
    version: packageJson.version,
    repository: workflowKitConfig.repository ?? 'xampo848/fhh-ia-ecosystem-workflow-kit',
    defaultUpgradeRef: workflowKitConfig.defaultUpgradeRef ?? 'main',
    preferredPackageManager: workflowKitConfig.preferredPackageManager ?? 'bun'
  };
}

export function normalizePackageManager(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'bun' || normalized === 'npm') return normalized;
  throw new Error(`Unsupported package manager: ${value}`);
}

export function normalizeUpgradeRef(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : currentToolkitMetadata().defaultUpgradeRef;
}

export function buildToolkitPackageSpec({ repository, ref }) {
  return `github:${repository}#${normalizeUpgradeRef(ref)}`;
}

export function buildUpgradePlan(options = {}) {
  const metadata = currentToolkitMetadata();
  const packageManager = normalizePackageManager(options.packageManager ?? metadata.preferredPackageManager);
  const ref = normalizeUpgradeRef(options.ref ?? metadata.defaultUpgradeRef);
  const repository = metadata.repository;
  const spec = buildToolkitPackageSpec({ repository, ref });

  return {
    packageManager,
    ref,
    repository,
    spec,
    currentVersion: metadata.version,
    command: packageManager,
    args: packageManager === 'bun'
      ? ['add', '-g', spec]
      : ['install', '-g', spec]
  };
}

export function formatUpgradePlan(plan) {
  return [
    `Current toolkit version: ${plan.currentVersion}`,
    `Repository: ${plan.repository}`,
    `Upgrade ref: ${plan.ref}`,
    `Package manager: ${plan.packageManager}`,
    `Package spec: ${plan.spec}`,
    `Command: ${plan.command} ${plan.args.join(' ')}`,
    'Next step after successful upgrade: run workflow-kit update --target <repo> --apply --yes with the refreshed toolkit.'
  ].join('\n');
}

export function commandExists(command) {
  return new Promise((resolve) => {
    const child = spawn(command, ['--version'], { stdio: 'ignore' });
    child.on('error', (error) => {
      if (error && error.code === 'ENOENT') {
        resolve(false);
        return;
      }
      resolve(false);
    });
    child.on('exit', () => resolve(true));
  });
}

export async function resolveUpgradePackageManager(preferred, exists = commandExists) {
  if (preferred) return normalizePackageManager(preferred);

  const metadata = currentToolkitMetadata();
  const fallbackOrder = [metadata.preferredPackageManager, 'npm'];
  for (const candidate of fallbackOrder) {
    if (await exists(candidate)) return candidate;
  }

  throw new Error('Neither bun nor npm is available in PATH for toolkit upgrade.');
}

export function runUpgradePlan(plan, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  return new Promise((resolve) => {
    const child = spawn(plan.command, plan.args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.on('data', (chunk) => stdout.write(String(chunk)));
    child.stderr.on('data', (chunk) => stderr.write(String(chunk)));

    child.on('error', (error) => {
      resolve({ ok: false, code: null, reason: String(error?.message ?? error) });
    });

    child.on('exit', (code) => {
      resolve({ ok: code === 0, code, reason: code === 0 ? null : `exit-${code}` });
    });
  });
}