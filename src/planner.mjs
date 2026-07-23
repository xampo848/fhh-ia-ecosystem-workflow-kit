import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesRoot = path.join(packageRoot, 'templates');
export const installStateRelativePath = '.agents/workflow-kit/install-state.json';
const installStateSchemaVersion = '1.0.0';
const skillRegistryJsonPath = '.agents/skills/registry.json';
const skillCatalogPreservePaths = new Set([
  '.agents/skills/index.md',
  '.agents/skills/registry.md',
  '.agents/skills/registry.cache.json'
]);
const docsReadmePath = 'docs/README.md';
const docsWorkflowMarkerStart = '<!-- workflow-kit:docs-workflow:start -->';
const docsWorkflowMarkerEnd = '<!-- workflow-kit:docs-workflow:end -->';
const oneTimeLegacyDocsMapPath = 'docs/workflow/migration/legacy-docs-map.md';
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
  const discoveredSkillEntries = await collectDiscoveredLocalSkillEntries(targetPath);
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
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    const resolution = resolvePlannedContent({
      relativePath: file.relativePath,
      templateContent: content,
      existingContent,
      discoveredSkillEntries
    });

    if (existingContent !== null) {
      if (resolution.strategy === 'preserve_existing') {
        operation = 'skip_unmanaged';
      } else if (existingContent === resolution.content) {
        operation = 'unchanged';
      } else {
        operation = resolution.strategy === 'merged' ? 'merge_with_backup' : 'overwrite_with_backup';
      }
    }

    operations.push({
      operation,
      relativePath: file.relativePath,
      targetFile,
      sourcePath: file.sourcePath,
      content: resolution.content,
      sourceChecksum,
      plannedChecksum: computeChecksum(resolution.content)
    });
  }

  operations.push(...await buildOneTimeDocsMigrationOperations({ targetPath }));
  if (options.migrateLegacyDocs) {
    operations.push(...await buildLegacyDocsMoveOperations({ targetPath }));
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
    discoveredSkillEntries,
    migrateLegacyDocs: Boolean(options.migrateLegacyDocs),
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
  const discoveredSkillEntries = await collectDiscoveredLocalSkillEntries(targetPath);
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

    const resolution = resolvePlannedContent({
      relativePath: file.relativePath,
      templateContent: content,
      existingContent,
      discoveredSkillEntries
    });

    if (existingContent === null) {
      operations.push({
        operation: 'create',
        relativePath: file.relativePath,
        targetFile,
        sourcePath: file.sourcePath,
        content: resolution.content,
        sourceChecksum,
        plannedChecksum: computeChecksum(resolution.content)
      });
      continue;
    }

    if (resolution.strategy === 'preserve_existing') {
      operations.push({
        operation: 'skip_unmanaged',
        relativePath: file.relativePath,
        targetFile,
        sourcePath: file.sourcePath,
        content: resolution.content,
        sourceChecksum,
        plannedChecksum: computeChecksum(resolution.content),
        dropFromState: true
      });
      continue;
    }

    if (!existingState && options.adoptExisting) {
      operations.push({
        operation: 'adopt_existing',
        relativePath: file.relativePath,
        targetFile,
        sourcePath: file.sourcePath,
        content: resolution.content,
        sourceChecksum,
        existingChecksum: computeChecksum(existingContent),
        plannedChecksum: computeChecksum(resolution.content)
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
          recordedChecksum,
          plannedChecksum: computeChecksum(resolution.content)
        });
      } else if (existingContent === resolution.content) {
        operations.push({
          operation: 'unchanged',
          relativePath: file.relativePath,
          targetFile,
          sourcePath: file.sourcePath,
          content: resolution.content,
          sourceChecksum,
          plannedChecksum: computeChecksum(resolution.content)
        });
      } else {
        operations.push({
          operation: resolution.strategy === 'merged' ? 'merge_with_backup' : 'overwrite_with_backup',
          relativePath: file.relativePath,
          targetFile,
          sourcePath: file.sourcePath,
          content: resolution.content,
          sourceChecksum,
          recordedChecksum,
          plannedChecksum: computeChecksum(resolution.content)
        });
      }
      continue;
    }

    if (existingContent === resolution.content) {
      operations.push({
        operation: 'unchanged',
        relativePath: file.relativePath,
        targetFile,
        sourcePath: file.sourcePath,
        content: resolution.content,
        sourceChecksum,
        plannedChecksum: computeChecksum(resolution.content)
      });
    } else {
      operations.push({
        operation: 'skip_unmanaged',
        relativePath: file.relativePath,
        targetFile,
        sourcePath: file.sourcePath,
        content: resolution.content,
        sourceChecksum,
        plannedChecksum: computeChecksum(resolution.content)
      });
    }
  }

  if (options.migrateLegacyDocs) {
    operations.push(...await buildLegacyDocsMoveOperations({ targetPath }));
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
    discoveredSkillEntries,
    migrateLegacyDocs: Boolean(options.migrateLegacyDocs),
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
    move_with_backup: 0,
    merge_with_backup: 0,
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
    if (item.operation === 'move_with_backup' && item.fromRelativePath) {
      lines.push(`- ${item.operation}: ${item.fromRelativePath} -> ${item.relativePath}`);
      continue;
    }

    lines.push(`- ${item.operation}: ${item.relativePath}`);
  }

  lines.push(`Summary: create=${plan.summary.create}, unchanged=${plan.summary.unchanged}, move_with_backup=${plan.summary.move_with_backup}, merge_with_backup=${plan.summary.merge_with_backup}, overwrite_with_backup=${plan.summary.overwrite_with_backup}, skip_modified=${plan.summary.skip_modified}, skip_unmanaged=${plan.summary.skip_unmanaged}, adopt_existing=${plan.summary.adopt_existing}`);
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
      if (item.dropFromState) delete files[item.relativePath];
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

    if (item.plannedChecksum) {
      files[item.relativePath] = item.plannedChecksum;
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

function resolvePlannedContent({ relativePath, templateContent, existingContent, discoveredSkillEntries = [] }) {
  if (relativePath === skillRegistryJsonPath) {
    return {
      strategy: 'merged',
      content: mergeSkillRegistryJson({ existingContent, templateContent, discoveredSkillEntries })
    };
  }

  if (existingContent === null) {
    return { strategy: 'template', content: templateContent };
  }

  if (relativePath === docsReadmePath) {
    return {
      strategy: 'merged',
      content: mergeDocsReadme({ existingContent, templateContent })
    };
  }

  if (skillCatalogPreservePaths.has(relativePath)) {
    return { strategy: 'preserve_existing', content: existingContent };
  }

  return { strategy: 'template', content: templateContent };
}

function mergeSkillRegistryJson({ existingContent, templateContent, discoveredSkillEntries = [] }) {
  let existing = {};
  let incoming;

  try {
    incoming = JSON.parse(templateContent);
  } catch {
    return templateContent;
  }

  if (existingContent !== null) {
    try {
      existing = JSON.parse(existingContent);
    } catch {
      existing = {};
    }
  }

  const merged = {
    ...incoming,
    ...existing,
    schema_version: existing.schema_version ?? incoming.schema_version ?? '1.0.0',
    canonical_source: existing.canonical_source ?? incoming.canonical_source ?? '.agents/skills/registry.md',
    skills: mergeRegistryEntries(existing.skills, [...normalizeRegistryEntries(incoming.skills), ...discoveredSkillEntries.filter((entry) => entry.class !== 'Standards/pattern')]),
    pattern_skills: mergeRegistryEntries(existing.pattern_skills, [...normalizeRegistryEntries(incoming.pattern_skills), ...discoveredSkillEntries.filter((entry) => entry.class === 'Standards/pattern')])
  };

  return `${JSON.stringify(merged, null, 2)}\n`;
}

function mergeRegistryEntries(existingEntries, incomingEntries) {
  const merged = [];
  const seen = new Set();

  for (const entry of normalizeRegistryEntries(existingEntries)) {
    const key = registryEntryIdentity(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  for (const entry of normalizeRegistryEntries(incomingEntries)) {
    const key = registryEntryIdentity(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  return merged;
}

function normalizeRegistryEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry) => entry && typeof entry === 'object');
}

function registryEntryIdentity(entry) {
  if (entry.key && typeof entry.key === 'string') return `key:${entry.key}`;
  if (entry.name && typeof entry.name === 'string') return `name:${entry.name}`;
  if (entry.path && typeof entry.path === 'string') return `path:${entry.path}`;
  return `raw:${JSON.stringify(entry)}`;
}

async function collectDiscoveredLocalSkillEntries(targetPath) {
  const root = path.join(targetPath, '.agents', 'skills');
  const discovered = [];

  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile() || entry.name !== 'SKILL.md') continue;
      const relativePath = path.relative(targetPath, absolutePath).split(path.sep).join('/');
      const content = await fs.readFile(absolutePath, 'utf8');
      discovered.push(buildDiscoveredSkillEntry({ relativePath, content }));
    }
  }

  await walk(root);
  return discovered;
}

function buildDiscoveredSkillEntry({ relativePath, content }) {
  const frontmatter = parseSkillFrontmatter(content);
  const rawName = frontmatter.name || skillNameFromPath(relativePath);
  const name = String(rawName).trim();
  const skillClass = classifyDiscoveredSkill(relativePath);
  const description = String(frontmatter.description || '').trim();

  return {
    name,
    class: skillClass,
    path: relativePath,
    trigger: description || `Discovered local project skill at ${relativePath}; load when explicitly requested.`,
    loading_posture: defaultLoadingPostureForClass(skillClass),
    key: slugifySkillKey(name),
    runtime_notes: 'Auto-discovered from the target repository during workflow-kit install/update.'
  };
}

function parseSkillFrontmatter(content) {
  const match = String(content).match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    if (!line || /^\s/.test(line)) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!key) continue;
    frontmatter[key] = value;
  }

  return frontmatter;
}

function skillNameFromPath(relativePath) {
  const withoutSuffix = relativePath.replace(/\/SKILL\.md$/, '');
  const segments = withoutSuffix.split('/');
  return segments[segments.length - 1] || 'local-skill';
}

function classifyDiscoveredSkill(relativePath) {
  if (relativePath.includes('/06-patterns/')) return 'Standards/pattern';
  if (relativePath.includes('/03-quality/')) return 'Quality/validation';
  if (relativePath.includes('/04-crosscutting/')) return 'Cross-cutting overlay';
  if (relativePath.includes('/05-caveman/')) return 'Mode/helper';
  if (relativePath.includes('/02-implement/')) return 'Delegate-only implementation';
  return 'Workflow';
}

function defaultLoadingPostureForClass(skillClass) {
  if (skillClass === 'Delegate-only implementation') return 'Delegated-only';
  if (skillClass === 'Quality/validation' || skillClass === 'Standards/pattern') return 'Just-in-time';
  if (skillClass === 'Cross-cutting overlay') return 'Overlay';
  if (skillClass === 'Mode/helper') return 'Helper/mode';
  return 'Explicit-only';
}

function slugifySkillKey(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'local-skill';
}

function mergeDocsReadme({ existingContent, templateContent }) {
  if (!existingContent.trim()) return templateContent;

  const block = extractDocsWorkflowBlock(templateContent);
  if (!block) return `${existingContent.trimEnd()}\n\n${templateContent.trim()}\n`;

  const start = existingContent.indexOf(docsWorkflowMarkerStart);
  const end = existingContent.indexOf(docsWorkflowMarkerEnd);

  if (start >= 0 && end >= start) {
    const afterEnd = end + docsWorkflowMarkerEnd.length;
    const before = existingContent.slice(0, start).trimEnd();
    const after = existingContent.slice(afterEnd).trimStart();
    const pieces = [before, block.trim()];
    if (after) pieces.push(after);
    return `${pieces.filter(Boolean).join('\n\n').trimEnd()}\n`;
  }

  return `${existingContent.trimEnd()}\n\n${block.trim()}\n`;
}

function extractDocsWorkflowBlock(content) {
  const start = content.indexOf(docsWorkflowMarkerStart);
  const end = content.indexOf(docsWorkflowMarkerEnd);
  if (start < 0 || end < start) return null;
  return content.slice(start, end + docsWorkflowMarkerEnd.length);
}

async function buildOneTimeDocsMigrationOperations({ targetPath }) {
  const docsRoot = path.join(targetPath, 'docs');
  const migrationMapTarget = path.join(targetPath, oneTimeLegacyDocsMapPath);
  const operations = [];

  try {
    await fs.access(migrationMapTarget);
    return operations;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const legacyDocs = await collectLegacyDocsForMigration({ docsRoot });
  if (legacyDocs.length === 0) return operations;

  const content = renderLegacyDocsMigrationMap(legacyDocs);
  operations.push({
    operation: 'create',
    relativePath: oneTimeLegacyDocsMapPath,
    targetFile: migrationMapTarget,
    sourcePath: null,
    content,
    sourceChecksum: computeChecksum(content),
    plannedChecksum: computeChecksum(content)
  });

  return operations;
}

async function buildLegacyDocsMoveOperations({ targetPath }) {
  const docsRoot = path.join(targetPath, 'docs');
  const legacyDocs = await collectLegacyDocsForMigration({ docsRoot });
  const operations = [];

  for (const item of legacyDocs) {
    const sourceFile = path.join(docsRoot, item.relative);
    const targetFile = path.join(targetPath, item.suggested);
    const relativePath = item.suggested;
    const fromRelativePath = `docs/${item.relative}`;

    let targetExists = false;
    try {
      await fs.access(targetFile);
      targetExists = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    if (targetExists) {
      operations.push({
        operation: 'skip_unmanaged',
        relativePath,
        fromRelativePath,
        targetFile,
        sourceFile,
        content: null,
        sourceChecksum: null,
        plannedChecksum: null
      });
      continue;
    }

    const content = await fs.readFile(sourceFile, 'utf8');
    operations.push({
      operation: 'move_with_backup',
      relativePath,
      fromRelativePath,
      targetFile,
      sourceFile,
      sourcePath: null,
      content,
      sourceChecksum: computeChecksum(content),
      plannedChecksum: computeChecksum(content)
    });
  }

  return operations;
}

async function collectLegacyDocsForMigration({ docsRoot }) {
  const files = [];

  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }

      if (!entry.isFile()) continue;
      const relative = path.relative(docsRoot, absolute).split(path.sep).join('/');
      if (relative.startsWith('workflow/')) continue;
      if (!isDocFile(relative)) continue;

      files.push({
        relative,
        suggested: suggestWorkflowDocsTarget(relative)
      });
    }
  }

  await walk(docsRoot);
  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

function isDocFile(relativePath) {
  return /\.(md|mdx|txt|rst)$/i.test(relativePath);
}

function suggestWorkflowDocsTarget(relativePath) {
  const lower = relativePath.toLowerCase();
  const slug = relativePath.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9/-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  if (/(adr|decision|architecture|arquitectura|tradeoff)/.test(lower)) {
    return `docs/workflow/decisions/imported-${slug}.md`;
  }

  if (/(runbook|playbook|operat|release|deploy|incident|troubleshoot|soporte)/.test(lower)) {
    return `docs/workflow/runbooks/imported-${slug}.md`;
  }

  if (/(handoff|handover|entrega|qa|transfer|ownership)/.test(lower)) {
    return `docs/workflow/handoffs/imported-${slug}.md`;
  }

  if (/(backend|api|contract|frontend|ui|ux|style|guideline|standard|estandar)/.test(lower)) {
    return `docs/workflow/standards/imported-${slug}.md`;
  }

  return `docs/workflow/migration/review-${slug}.md`;
}

function renderLegacyDocsMigrationMap(legacyDocs) {
  const lines = [
    '# Legacy Docs Migration Map',
    '',
    'This file is generated once by workflow-kit during init when legacy docs already exist.',
    'It preserves originals and proposes coherent target locations under docs/workflow/.',
    '',
    '## How to use this map',
    '',
    '1. Review each suggestion and adjust target paths if needed.',
    '2. Move files with `git mv` to preserve history.',
    '3. Keep this file as migration evidence or archive it once complete.',
    '',
    '| Existing file | Suggested destination |',
    '| --- | --- |'
  ];

  for (const item of legacyDocs) {
    lines.push(`| docs/${item.relative} | ${item.suggested} |`);
  }

  lines.push('', '## Suggested move commands', '');
  for (const item of legacyDocs) {
    lines.push(`- git mv "docs/${item.relative}" "${item.suggested}"`);
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}
