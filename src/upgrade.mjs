import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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

const supportedPackageManagers = ['bun'];

export function normalizePackageManager(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (supportedPackageManagers.includes(normalized)) return normalized;
  throw new Error(`Unsupported package manager: ${value}. workflow-kit upgrade supports: ${supportedPackageManagers.join(', ')}. Nothing was run.`);
}

export function normalizeUpgradeRef(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length === 0) return currentToolkitMetadata().defaultUpgradeRef;
  // A Git branch, tag or commit. Anything else would end up inside the package
  // spec handed to the package manager.
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(trimmed) || trimmed.includes('..')) {
    throw new Error(`Invalid --ref "${trimmed}". Use a branch, tag or commit of the workflow-kit repository.`);
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
    `Current workflow-kit version: ${plan.currentVersion}`,
    `Repository: ${plan.repository}`,
    `Upgrade ref: ${plan.ref}`,
    `Package manager: ${plan.packageManager}`,
    `Package spec: ${plan.spec}`,
    `Command: ${plan.command} ${plan.args.join(' ')}`,
    'Next step after a successful upgrade: run workflow-kit update --target <repo> (dry run first) in each project, with the new workflow-kit.'
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

  throw new Error('bun is required in PATH for workflow-kit upgrade.');
}

export function isNonBlockingBunRemoveFailure({ stdout = '', stderr = '' } = {}) {
  const output = `${stdout}\n${stderr}`.toLowerCase();
  return output.includes('not found') || output.includes('no package') || output.includes('no such package');
}

// git without a prompt for credentials (a private or mistyped repository
// would otherwise wait for a password) and bounded in time.
export const gitProbeTimeoutMs = 30_000;
const gitEnv = () => ({ ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' });

export function runGit(args, { cwd, timeoutMs = gitProbeTimeoutMs } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (outcome) => { if (!settled) { settled = true; resolve(outcome); } };
    const child = spawn('git', args, { cwd, env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'], timeout: timeoutMs, killSignal: 'SIGKILL' });
    const chunks = [];
    child.stdout.on('data', (chunk) => { chunks.push(chunk); });
    child.on('error', (error) => settle({ ok: false, code: null, missingCommand: error?.code === 'ENOENT', stdout: Buffer.concat(chunks).toString('utf8') }));
    // `close`, not `exit`: only then is the whole output read (a long
    // ls-remote list would be cut short). At the timeout the answer is known
    // at once: a child git left behind may hold the pipe open.
    child.on('exit', (code, signal) => {
      if (signal !== 'SIGKILL') return;
      child.stdout.destroy();
      settle({ ok: false, code, timedOut: true, stdout: Buffer.concat(chunks).toString('utf8') });
    });
    child.on('close', (code, signal) => settle({ ok: code === 0, code, timedOut: signal === 'SIGKILL', stdout: Buffer.concat(chunks).toString('utf8') }));
  });
}

const commitPattern = /^[0-9a-f]{7,40}$/i;

// Whether `ref` exists in the repository, before anything is removed: a
// branch or tag by name; a full commit by fetching it into a scratch
// repository; a short commit only when it is a branch or tag tip (a server
// does not resolve short commits). `run(args)` runs git (tests replace it).
export async function verifyUpgradeRef(plan, run = runGit) {
  const url = `https://github.com/${plan.repository}.git`;
  const byName = await run(['ls-remote', '--exit-code', url, plan.ref]);
  if (byName.missingCommand) return { status: 'skipped' };
  if (byName.ok) return { status: 'found' };
  if (byName.code !== 2) return { status: 'unreachable', timedOut: byName.timedOut };
  if (!commitPattern.test(plan.ref)) return { status: 'missing' };
  if (plan.ref.length === 40) {
    let scratch;
    try {
      scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-ref-'));
    } catch (scratchError) {
      return { status: 'scratch-failed', reason: `${scratchError.code ?? scratchError.message} in ${os.tmpdir()}` };
    }
    try {
      const init = await run(['init', '--quiet', '--bare', scratch]);
      if (!init.ok) return { status: 'unreachable' };
      const fetched = await run(['-C', scratch, 'fetch', '--quiet', '--depth=1', '--no-tags', url, plan.ref]);
      if (fetched.timedOut) return { status: 'unreachable', timedOut: true };
      return { status: fetched.ok ? 'found' : 'missing' };
    } finally {
      await fs.rm(scratch, { recursive: true, force: true });
    }
  }
  const tips = await run(['ls-remote', url]);
  if (!tips.ok) return { status: 'unreachable', timedOut: tips.timedOut };
  const prefix = plan.ref.toLowerCase();
  if (tips.stdout.split('\n').some((line) => line.toLowerCase().startsWith(prefix))) return { status: 'found' };
  return { status: 'short-commit' };
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

    const run = async () => {
      // The upgrade removes the installed workflow-kit before adding the new
      // one. Confirm the ref exists first, so a typo or a network failure
      // cannot leave the machine without a working workflow-kit.
      if (plan.packageManager === 'bun' && plan.repository && plan.ref) {
        const probe = await verifyUpgradeRef(plan, verifyRef ? (args) => verifyRef('git', args) : runGit);
        // Without git the ref cannot be checked, and the removal below would
        // run on a guess: stop (the safer choice) and name the way around.
        if (probe.status !== 'found') {
          const why = {
            skipped: `git is not in PATH, so workflow-kit cannot check that ref "${plan.ref}" exists in ${plan.repository} before it removes the installed workflow-kit. Install git and run workflow-kit upgrade again.`,
            'scratch-failed': `Could not create a temporary folder to check commit "${plan.ref}" (${probe.reason}). Set TMPDIR to a writable folder and run this again.`,
            missing: `Ref "${plan.ref}" was not found in ${plan.repository}.`,
            'short-commit': `Ref "${plan.ref}" is no branch, tag or branch tip of ${plan.repository}, and a short commit cannot be checked: give the full 40-character commit, or a branch or tag.`,
            unreachable: `Could not reach ${plan.repository} to verify ref "${plan.ref}"${probe.timedOut ? ` (git did not answer within ${gitProbeTimeoutMs / 1000} seconds)` : ''}.`
          }[probe.status];
          stderr.write(`${why} Nothing was changed.\n`);
          return { ok: false, code: probe.status === 'missing' || probe.status === 'short-commit' ? 2 : null, reason: 'ref-not-verified' };
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
        // The ref was verified, so a retry of the same command can work once
        // the cause (often the network) is gone; the default ref is the other
        // way back to a working workflow-kit.
        const defaultRef = currentToolkitMetadata().defaultUpgradeRef;
        const fallback = plan.ref === defaultRef ? '' : ` or, for the default ref, ${plan.command} add -g ${buildToolkitPackageSpec({ repository: plan.repository, ref: defaultRef })}`;
        stderr.write(`The previous workflow-kit was removed and the new one failed to install, so workflow-kit is not installed now. Reinstall with ${plan.command} ${plan.args.join(' ')} once the error above is solved${fallback}.\n`);
      }
      return result;
    };

    // Anything unexpected is a failure with a message, never a stack trace.
    run().then(resolve, (error) => {
      stderr.write(`workflow-kit upgrade stopped: ${error?.message ?? error}\n`);
      resolve({ ok: false, code: null, reason: 'unexpected-error' });
    });
  });
}