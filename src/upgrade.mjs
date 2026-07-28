import { spawn } from 'node:child_process';
import os from 'node:os';
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
  if (normalized === 'bun') return normalized;
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
    args: ['add', '-g', spec]
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

export function globalUpgradeWorkingDirectory({ fallback = process.cwd() } = {}) {
  const home = String(os.homedir() ?? '').trim();
  return home.length > 0 ? home : fallback;
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
  const fallbackOrder = [metadata.preferredPackageManager, 'bun'];
  for (const candidate of fallbackOrder) {
    if (await exists(candidate)) return candidate;
  }

  throw new Error('bun is required in PATH for toolkit upgrade.');
}

export function isNonBlockingBunRemoveFailure({ stdout = '', stderr = '' } = {}) {
  const output = `${stdout}\n${stderr}`.toLowerCase();
  return output.includes('not found') || output.includes('no package') || output.includes('no such package');
}

export function runUpgradePlan(plan, { cwd = globalUpgradeWorkingDirectory(), stdout = process.stdout, stderr = process.stderr } = {}) {
  return new Promise((resolve) => {
    const runCommand = (command, args) => new Promise((resolveCommand) => {
      const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });

      let stdoutBuffer = '';
      let stderrBuffer = '';

      child.stdout.on('data', (chunk) => {
        const text = String(chunk);
        stdoutBuffer += text;
        stdout.write(text);
      });
      child.stderr.on('data', (chunk) => {
        const text = String(chunk);
        stderrBuffer += text;
        stderr.write(text);
      });

      child.on('error', (error) => {
        resolveCommand({ ok: false, code: null, reason: String(error?.message ?? error), stdout: stdoutBuffer, stderr: stderrBuffer });
      });

      child.on('exit', (code) => {
        resolveCommand({ ok: code === 0, code, reason: code === 0 ? null : `exit-${code}`, stdout: stdoutBuffer, stderr: stderrBuffer });
      });
    });

    const run = async () => {
      if (plan.packageManager === 'bun') {
        stdout.write(`Pre-cleaning previous global package: ${packageJson.name}\n`);
        const preclean = await runCommand('bun', ['remove', '-g', packageJson.name]);
        if (!preclean.ok && !isNonBlockingBunRemoveFailure(preclean)) {
          return {
            ok: false,
            code: preclean.code,
            reason: `preclean-failed:${preclean.reason}`
          };
        }
      }

      return runCommand(plan.command, plan.args);
    };

    run().then(resolve);
  });
}