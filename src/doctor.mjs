import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import packageJson from '../package.json' with { type: 'json' };
import { selectedTemplateFiles, parseRuntimeList, normalizeOverlay, readManagedInstallState } from './planner.mjs';
import { validateWorkflowContract } from './workflow-contract/index.mjs';
import { loadDelegateCatalog, modelSettingLine, renderDelegateAdapterForPath, resolveModelProfiles } from './model-profiles.mjs';
import { projectContextDiagnostics, workspaceDiagnostics } from './workspace-diagnostics.mjs';

function checksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function managedDriftDiagnostics(targetPath) {
  const state = await readManagedInstallState(targetPath);
  if (!state) {
    return [];
  }

  const diagnostics = [];
  for (const [relativePath, expected] of Object.entries(state.files ?? {})) {
    try {
      const content = await fs.readFile(path.join(targetPath, relativePath), 'utf8');
      if (checksum(content) !== expected) {
        diagnostics.push({
          code: 'managed/content-drift',
          path: relativePath,
          message: 'Managed file has local modifications; doctor will not overwrite it.',
          severity: 'warning'
        });
      }
    } catch {
      // Missing files are reported by the presence scan.
    }
  }
  return diagnostics;
}

async function managedVersionDiagnostics(targetPath) {
  const state = await readManagedInstallState(targetPath);
  if (!state?.toolkitVersion || !packageJson.version || state.toolkitVersion === packageJson.version) {
    return [];
  }

  return [{
    code: 'managed/toolkit-version-mismatch',
    path: '.agents/workflow-kit/install-state.json',
    message: `Managed files were last applied with toolkit version ${state.toolkitVersion}; current CLI version is ${packageJson.version}. Run workflow-kit update if you want this repository on the current toolkit surface.`,
    severity: 'warning'
  }];
}

export async function runDoctor(options = {}) {
  const targetPath = path.resolve(options.targetPath ?? process.cwd());
  const storedState = await readManagedInstallState(targetPath);
  const runtimes = parseRuntimeList(options.runtime ?? storedState?.runtimes?.join(',') ?? 'neutral');
  const overlay = normalizeOverlay(options.overlay ?? 'fhh-ia-ecosystem-full');
  const files = await selectedTemplateFiles({ runtimes, overlay });
  const missing = [];
  const present = [];

  for (const file of files) {
    const targetFile = path.join(targetPath, file.relativePath);
    try {
      await fs.access(targetFile);
      present.push(file.relativePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      missing.push(file.relativePath);
    }
  }

  const contract = await validateWorkflowContract({ root: targetPath, runtimes });
  const catalog = await loadDelegateCatalog();
  const modelProfiles = resolveModelProfiles({ catalog, runtimes, stored: storedState?.modelProfiles });
  const diagnostics = [
    ...contract.diagnostics,
    ...await modelProfileDiagnostics({ targetPath, present, catalog, modelProfiles }),
    ...await workspaceDiagnostics({ targetPath }),
    ...await projectContextDiagnostics({ targetPath }),
    ...await managedDriftDiagnostics(targetPath),
    ...await managedVersionDiagnostics(targetPath)
  ].sort((a, b) => a.severity.localeCompare(b.severity)
    || a.code.localeCompare(b.code)
    || a.path.localeCompare(b.path));

  return {
    ok: missing.length === 0 && !diagnostics.some((item) => item.severity === 'error'),
    targetPath,
    runtimes,
    overlay,
    modelProfiles,
    present,
    missing,
    diagnostics
  };
}

// Fails when a delegate agent's model setting does not match the project's
// profile (for example a calidad project with costo agents after a manual copy).
async function modelProfileDiagnostics({ targetPath, present, catalog, modelProfiles }) {
  const diagnostics = [];
  for (const relativePath of present) {
    const expected = renderDelegateAdapterForPath(relativePath, catalog, modelProfiles);
    if (!expected) continue;
    const content = await fs.readFile(path.join(targetPath, relativePath), 'utf8');
    const actualLine = modelSettingLine(expected.runtime, content);
    const expectedLine = modelSettingLine(expected.runtime, expected.content);
    if (actualLine !== expectedLine) {
      diagnostics.push({
        code: 'model-profile/agent-mismatch',
        path: relativePath,
        message: `Expected \`${expectedLine}\` for the ${modelProfiles[expected.runtime]} profile but found \`${actualLine ?? 'no model setting'}\`. Run workflow-kit update --profile ${expected.runtime}=${modelProfiles[expected.runtime]} --apply --yes to regenerate it.`,
        severity: 'error'
      });
    }
  }
  return diagnostics;
}

export function formatDoctorResult(result) {
  const lines = [
    `Target: ${result.targetPath}`,
    `Toolkit version: ${packageJson.version}`,
    `Runtimes: ${result.runtimes.join(',')}`,
    `Overlay: ${result.overlay}`,
    `Model profiles: ${Object.entries(result.modelProfiles ?? {}).map(([runtime, profile]) => `${runtime}=${profile}`).join(',') || 'none'}`,
    result.ok ? 'Doctor: ok' : 'Doctor: failed'
  ];

  if (result.missing.length > 0) {
    lines.push('Missing files:');
    for (const item of result.missing) lines.push(`- ${item}`);
  }

  if (result.diagnostics.length > 0) {
    lines.push('Diagnostics:');
    for (const item of result.diagnostics) {
      lines.push(`- [${item.code}] ${item.path}: ${item.message} (${item.severity})`);
    }
  }

  return lines.join('\n');
}
