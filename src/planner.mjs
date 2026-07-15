import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesRoot = path.join(packageRoot, 'templates');
const runtimeTemplatePaths = {
  codex: 'runtime-adapters/codex',
  copilot: 'runtime-adapters/copilot',
  claude: 'runtime-adapters/claude'
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

export function normalizeOverlay(value = 'none') {
  if (!['none', 'starter', 'all-metrics-full'].includes(value)) {
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

export async function selectedTemplateFiles({ runtimes = ['neutral'], overlay = 'none' } = {}) {
  const selected = await collectTemplateFiles('portable-core');

  for (const runtime of runtimes) {
    if (runtime === 'neutral') continue;
    selected.push(...await collectTemplateFiles(runtimeTemplatePaths[runtime]));
  }

  if (overlay === 'starter') {
    selected.push(...await collectTemplateFiles('repo-overlay'));
  } else if (overlay === 'all-metrics-full') {
    selected.push(...await collectTemplateFiles('repo-overlay-all-metrics-full'));
  }

  return selected;
}

export async function buildInstallPlan(options = {}) {
  const targetPath = path.resolve(options.targetPath ?? process.cwd());
  const runtimes = parseRuntimeList(options.runtime ?? 'neutral');
  const overlay = normalizeOverlay(options.overlay ?? 'none');
  const files = await selectedTemplateFiles({ runtimes, overlay });
  const operations = [];

  for (const file of files) {
    const targetFile = path.resolve(targetPath, file.relativePath);
    const relativeTarget = path.relative(targetPath, targetFile);

    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
      throw new Error(`Refusing to plan write outside target: ${file.relativePath}`);
    }

    const content = await fs.readFile(file.sourcePath, 'utf8');
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
      content
    });
  }

  operations.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return {
    targetPath,
    runtimes,
    overlay,
    operations,
    summary: summarizeOperations(operations)
  };
}

export function summarizeOperations(operations) {
  return operations.reduce((summary, item) => {
    summary[item.operation] = (summary[item.operation] ?? 0) + 1;
    return summary;
  }, { create: 0, unchanged: 0, overwrite_with_backup: 0 });
}

export function formatPlan(plan) {
  const lines = [
    `Target: ${plan.targetPath}`,
    `Runtimes: ${plan.runtimes.join(',')}`,
    `Overlay: ${plan.overlay}`,
    'Operations:'
  ];

  for (const item of plan.operations) {
    lines.push(`- ${item.operation}: ${item.relativePath}`);
  }

  lines.push(`Summary: create=${plan.summary.create}, unchanged=${plan.summary.unchanged}, overwrite_with_backup=${plan.summary.overwrite_with_backup}`);
  return lines.join('\n');
}
