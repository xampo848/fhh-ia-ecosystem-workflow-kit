import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesRoot = path.join(packageRoot, 'templates');
export const installStateRelativePath = '.agents/workflow-kit/install-state.json';
const installStateSchemaVersion = '1.0.0';
const runtimeTemplatePaths = {
  codex: ['runtime-adapters/agents-md', 'runtime-adapters/codex'],
  copilot: ['runtime-adapters/agents-md', 'runtime-adapters/copilot'],
  claude: ['runtime-adapters/claude'],
  antigravity: ['runtime-adapters/antigravity']
};

export function parseRuntimeList(value = 'neutral') {
  const runtimes = new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean));
  if (runtimes.size === 0) runtimes.add('neutral');

  for (const runtime of runtimes) {
    if (runtime !== 'neutral' && !runtimeTemplatePaths[runtime]) {
      throw new Error(`Unsupported runtime: ${runtime}`);
    }
  }

  return [...runtimes];
}

export function normalizeOverlay(value = 'fhh-ia-ecosystem-full') {
  if (!['fhh-ia-ecosystem-full'].includes(value)) {
    throw new Error(`Unsupported overlay: ${value}`);
  }
  return value;
}

async function collectTemplateFiles(templateRelativePath) {
  const root = path.join(templatesRoot, templateRelativePath);
  const files = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(root, absolutePath);
        if (relativePath === 'README.md') continue;
        if (relativePath.startsWith(`${path.join('.agents', 'workflow-kit')}${path.sep}`)) continue;
        files.push({
          sourcePath: absolutePath,
          relativePath
        });
      }
    }
  }

  await walk(root);
  return files;
}

export async function selectedTemplateFiles({ runtimes = ['neutral'], overlay = 'fhh-ia-ecosystem-full' } = {}) {
  const selected = await collectTemplateFiles('repo-overlay-fhh-ia-ecosystem-full');

  for (const runtime of runtimes) {
    if (runtime === 'neutral') continue;
    for (const templatePath of runtimeTemplatePaths[runtime]) {
      selected.push(...await collectTemplateFiles(templatePath));
    }
  }

  const deduped = new Map();
  for (const file of selected) {
    deduped.set(file.relativePath, file);
  }

  return [...deduped.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function buildInstallPlan(options = {}) {
  const targetPath = path.resolve(options.targetPath ?? process.cwd());
  const runtimes = parseRuntimeList(options.runtime ?? 'neutral');
  const overlay = normalizeOverlay(options.overlay ?? 'fhh-ia-ecosystem-full');
  const files = await selectedTemplateFiles({ runtimes, overlay });
  const operations = [];

  for (const file of files) {
    const targetFile = path.resolve(targetPath, file.relativePath);
    const relativeTarget = path.relative(targetPath, targetFile);

    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
      throw new Error(`Refusing to plan write outside target: ${file.relativePath}`);
    }

    const content = await fs.readFile(file.sourcePath, 'utf8');
    const sourceChecksum = computeChecksum(content);
    let operation = 'create';
    let existingContent = null;

    try {
      existingContent = await fs.readFile(targetFile, 'utf8');
      operation = existingContent === content ? 'unchanged' : 'overwrite_with_backup';
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    operations.push({
      operation,
      relativePath: file.relativePath,
      targetFile,
      sourcePath: file.sourcePath,
      content,
      sourceChecksum
    });
  }

  operations.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const nextInstallState = buildNextInstallState({
    previousState: null,
    operations,
    runtimes,
    overlay,
    toolkitVersion: options.toolkitVersion
  });

  return {
    mode: 'init',
    targetPath,
    stateFilePath: path.join(targetPath, installStateRelativePath),
    nextInstallState,
    toolkitVersion: options.toolkitVersion ?? null,
    previousToolkitVersion: null,
    runtimes,
    overlay,
    operations,
    summary: summarizeOperations(operations)
  };
}

export async function buildUpdatePlan(options = {}) {
  const targetPath = path.resolve(options.targetPath ?? process.cwd());
  const stateFilePath = path.join(targetPath, installStateRelativePath);
  const existingState = await readInstallState(stateFilePath);
  const runtimes = parseRuntimeList(options.runtime ?? existingState?.runtimes?.join(',') ?? 'neutral');
  const overlay = normalizeOverlay(options.overlay ?? existingState?.overlay ?? 'fhh-ia-ecosystem-full');
  const files = await selectedTemplateFiles({ runtimes, overlay });
  const previousHashes = new Map(Object.entries(existingState?.files ?? {}));
  const operations = [];

  if (!existingState && !options.adoptExisting) {
    throw new Error('No install state found. Run `workflow-kit update --adopt-existing --runtime <list>` first to bootstrap a safe baseline.');
  }

  for (const file of files) {
    const targetFile = path.resolve(targetPath, file.relativePath);
    const relativeTarget = path.relative(targetPath, targetFile);

    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
      throw new Error(`Refusing to plan write outside target: ${file.relativePath}`);
    }

    const content = await fs.readFile(file.sourcePath, 'utf8');
    const sourceChecksum = computeChecksum(content);
    const recordedChecksum = previousHashes.get(file.relativePath);

    let existingContent = null;
    try {
      existingContent = await fs.readFile(targetFile, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    if (existingContent === null) {
      operations.push({
        operation: 'create',
        relativePath: file.relativePath,
        targetFile,
        sourcePath: file.sourcePath,
        content,
        sourceChecksum
      });
      continue;
    }

    if (!existingState && options.adoptExisting) {
      operations.push({
        operation: 'adopt_existing',
        relativePath: file.relativePath,
        targetFile,
        sourcePath: file.sourcePath,
        content,
        sourceChecksum,
        existingChecksum: computeChecksum(existingContent)
      });
      continue;
    }

    if (recordedChecksum) {
      const existingChecksum = computeChecksum(existingContent);
      if (existingChecksum !== recordedChecksum) {
        operations.push({
          operation: 'skip_modified',
          relativePath: file.relativePath,
          targetFile,
          sourcePath: file.sourcePath,
          content,
          sourceChecksum,
          existingChecksum,
          recordedChecksum
        });
      } else if (existingContent === content) {
        operations.push({
          operation: 'unchanged',
          relativePath: file.relativePath,
          targetFile,
          sourcePath: file.sourcePath,
          content,
          sourceChecksum
        });
      } else {
        operations.push({
          operation: 'overwrite_with_backup',
          relativePath: file.relativePath,
          targetFile,
          sourcePath: file.sourcePath,
          content,
          sourceChecksum,
          recordedChecksum
        });
      }
      continue;
    }

    if (existingContent === content) {
      operations.push({
        operation: 'unchanged',
        relativePath: file.relativePath,
        targetFile,
        sourcePath: file.sourcePath,
        content,
        sourceChecksum
      });
    } else {
      operations.push({
        operation: 'skip_unmanaged',
        relativePath: file.relativePath,
        targetFile,
        sourcePath: file.sourcePath,
        content,
        sourceChecksum
      });
    }
  }

  operations.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const nextInstallState = buildNextInstallState({
    previousState: existingState,
    operations,
    runtimes,
    overlay,
    toolkitVersion: options.toolkitVersion
  });

  return {
    mode: 'update',
    targetPath,
    stateFilePath,
    hadExistingState: Boolean(existingState),
    nextInstallState,
    toolkitVersion: options.toolkitVersion ?? null,
    previousToolkitVersion: existingState?.toolkitVersion ?? null,
    runtimes,
    overlay,
    operations,
    summary: summarizeOperations(operations)
  };
}

export async function readManagedInstallState(targetPath = process.cwd()) {
  return readInstallState(path.join(path.resolve(targetPath), installStateRelativePath));
}

export function summarizeOperations(operations) {
  const summary = {
    create: 0,
    unchanged: 0,
    overwrite_with_backup: 0,
    skip_modified: 0,
    skip_unmanaged: 0,
    adopt_existing: 0
  };

  for (const item of operations) {
    summary[item.operation] = (summary[item.operation] ?? 0) + 1;
  }

  return summary;
}

export function formatPlan(plan) {
  const lines = [
    `Target: ${plan.targetPath}`,
    `Mode: ${plan.mode ?? 'init'}`,
    `Toolkit version: ${plan.toolkitVersion ?? 'unknown'}`,
    `Target managed version: ${plan.previousToolkitVersion ?? 'none recorded'}`,
    `Runtimes: ${plan.runtimes.join(',')}`,
    `Overlay: ${plan.overlay}`,
    'Operations:'
  ];

  for (const item of plan.operations) {
    lines.push(`- ${item.operation}: ${item.relativePath}`);
  }

  lines.push(`Summary: create=${plan.summary.create}, unchanged=${plan.summary.unchanged}, overwrite_with_backup=${plan.summary.overwrite_with_backup}, skip_modified=${plan.summary.skip_modified}, skip_unmanaged=${plan.summary.skip_unmanaged}, adopt_existing=${plan.summary.adopt_existing}`);
  return lines.join('\n');
}

function computeChecksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function readInstallState(stateFilePath) {
  try {
    const raw = await fs.readFile(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== installStateSchemaVersion || typeof parsed.files !== 'object' || parsed.files === null) {
      return null;
    }

    return {
      schemaVersion: parsed.schemaVersion,
      managedBy: parsed.managedBy,
      toolkitVersion: parsed.toolkitVersion,
      generatedAt: parsed.generatedAt,
      runtimes: Array.isArray(parsed.runtimes) ? parseRuntimeList(parsed.runtimes.join(',')) : ['neutral'],
      overlay: normalizeOverlay(parsed.overlay ?? 'fhh-ia-ecosystem-full'),
      files: parsed.files
    };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function buildNextInstallState({ previousState, operations, runtimes, overlay, toolkitVersion }) {
  const files = { ...(previousState?.files ?? {}) };

  for (const item of operations) {
    if (item.operation === 'skip_unmanaged') {
      continue;
    }

    if (item.operation === 'skip_modified') {
      if (item.recordedChecksum) files[item.relativePath] = item.recordedChecksum;
      continue;
    }

    if (item.operation === 'adopt_existing') {
      files[item.relativePath] = item.existingChecksum;
      continue;
    }

    if (item.sourceChecksum) {
      files[item.relativePath] = item.sourceChecksum;
    }
  }

  return {
    schemaVersion: installStateSchemaVersion,
    managedBy: 'fhh-ia-ecosystem-workflow-kit',
    toolkitVersion: toolkitVersion ?? null,
    generatedAt: new Date().toISOString(),
    runtimes,
    overlay,
    files
  };
}
