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
  if (trimmed.length === 0) return currentToolkitMetadata().defaultUpgradeRef;
  // A Git branch, tag or commit. Anything else would end up inside the package
  // spec handed to the package manager.
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(trimmed) || trimmed.includes('..')) {
    throw new Error(`Invalid --ref "${trimmed}". Use a branch, tag or commit of the toolkit repository.`);
  }
  return trimmed;
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

export function runUpgradePlan(plan, { cwd = globalUpgradeWorkingDirectory(), stdout = process.stdout, stderr = process.stderr, verifyRef } = {}) {
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

    const runQuiet = (command, args) => new Promise((resolveCommand) => {
      const child = spawn(command, args, { cwd, stdio: 'ignore' });
      child.on('error', (error) => resolveCommand({ ok: false, code: null, missingCommand: error?.code === 'ENOENT' }));
      child.on('exit', (code) => resolveCommand({ ok: code === 0, code }));
    });

    const run = async () => {
      // The upgrade removes the installed toolkit before adding the new one.
      // Confirm the ref is reachable first, so a typo or a network failure
      // cannot leave the machine without a working workflow-kit.
      if (plan.packageManager === 'bun' && plan.repository && plan.ref) {
        const isCommit = /^[0-9a-f]{7,40}$/i.test(plan.ref);
        const probe = await (verifyRef ?? runQuiet)('git', ['ls-remote', '--exit-code', `https://github.com/${plan.repository}.git`, isCommit ? 'HEAD' : plan.ref]);
        if (probe.missingCommand) {
          stdout.write('git is not in PATH: skipping the check that the upgrade ref exists.\n');
        } else if (!probe.ok) {
          stderr.write(probe.code === 2
            ? `Ref "${plan.ref}" was not found in ${plan.repository}. Nothing was changed.\n`
            : `Could not reach ${plan.repository} to verify ref "${plan.ref}". Nothing was changed.\n`);
          return { ok: false, code: probe.code, reason: 'ref-not-verified' };
        }
      }

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

      const result = await runCommand(plan.command, plan.args);
      if (!result.ok && plan.packageManager === 'bun') {
        stderr.write(`The previous toolkit was removed and the new one failed to install. Reinstall with: ${plan.command} ${plan.args.join(' ')}\n`);
      }
      return result;
    };

    run().then(resolve);
  });
}