// Turns an empty directory into a repository that workflow-kit 0.18.1 installed
// and later updated, with the content a team adds on top: a local pattern
// skill (with an executable script), catalog rows written by hand (one of them
// for a document, not a skill), a written project context, project backend
// rules, and a kit file a release before 0.18.1 retired. The structural files come from Git through
// build.mjs (files/ and files.json); every other kit file is today's content,
// recorded with the hash of what is on disk, so it reads as unedited.
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyInstallPlan } from '../../../src/apply.mjs';
import { buildInstallPlan, installStateRelativePath } from '../../../src/planner.mjs';

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

export const legacyToolkitVersion = '0.18.1-orchestrator-reads';
// 0.18.1 never recorded these after an update: it preserved them as project
// files (catalogs, context) or only added rows to them. Every path under
// .agents/project/ is dropped as well.
export const legacyDroppedPaths = Object.freeze([
  '.agents/project-context.md',
  '.agents/skills/index.md',
  '.agents/skills/06-patterns/index.md',
  '.agents/skills/registry.md',
  '.agents/skills/registry.cache.json'
]);
const registryJsonPath = '.agents/skills/registry.json';
const journalPath = '.agents/workflow-kit/last-apply.json';
const legacyGeneratedAt = '2026-10-15T12:00:00.000Z';
const autoDiscoveredNote = 'Auto-discovered from the target repository during workflow-kit install/update.';

const localSkillName = 'retry-policy';
const localSkillOldDir = `.agents/skills/06-patterns/local/${localSkillName}`;
const localSkillTrigger = 'Project pattern for retrying calls to external services with bounded attempts, backoff, and idempotency checks. Use when a slice adds or changes a call to a service outside this repository.';
const localSkillFiles = {
  'SKILL.md': `---
name: ${localSkillName}
description: ${localSkillTrigger}
---

# Retry Policy

## Trigger

Load when a slice adds or changes a call to a service outside this repository.

## Must Read

- \`references/notes.md\`
- \`scripts/check-retries.sh\` lists calls that retry without a limit.

## Procedure

1. Retry only operations that are safe to repeat, or make them idempotent first.
2. Use at most three attempts with exponential backoff and jitter.
3. Stop retrying on client errors; retry on timeouts and server errors.
4. Log the final failure once, with the attempt count.

## Validation Hooks

- A focused test for the retried path and one for the give-up path.

## Stop Conditions

- The operation is not idempotent and cannot be made so in the slice.
`,
  'references/notes.md': `# Retry Policy Notes

- Backoff starts at 200 ms and doubles per attempt, with up to 20% jitter.
- A call that already has its own retry layer is not wrapped again.
`,
  'scripts/check-retries.sh': `#!/bin/sh
# Lists calls that retry without a limit.
grep -rn "retry(" app lib || true
`
};
// Permission bits of the skill files that are not 644.
const localSkillModes = { 'scripts/check-retries.sh': 0o755 };

// Rows a team wrote by hand in the 0.18.1 catalogs: the skill's row has its
// own trigger and cost, and the handbook row names a document, not a skill.
const localSkillTriggerRow = 'Slice adds or changes a call to a service outside this repository';
const localSkillCost = 'balanced';
const handbook = {
  path: 'docs/release-handbook.md',
  content: '# Release Handbook\n\n1. Tag the release.\n2. Promote to production after the smoke check.\n',
  row: '| `release-handbook` | Runbook | Before tagging a release or promoting to production | `docs/release-handbook.md` | Explicit-only | heavy |'
};
// The same rows in .agents/project/index.md after the layout migration: the
// skill's path follows the skill and its class becomes Pattern (the project
// catalog allows Pattern and Runbook); everything else is the team's text.
const projectIndexRows = [
  `| \`${localSkillName}\` | Pattern | ${localSkillTriggerRow} | \`.agents/project/skills/${localSkillName}/SKILL.md\` | ${localSkillCost} |`,
  '| `release-handbook` | Runbook | Before tagging a release or promoting to production | `docs/release-handbook.md` | heavy |'
];

const ownContext = `# Project Context

Fixed knowledge base of this project for AI work. The team reviews every
change to it; keep it under 200 lines and point to documents instead of
copying them.

## Structure map

| Path | Responsibility |
| --- | --- |
| \`app/\` | Application code, one folder per module |
| \`lib/\` | Shared helpers without business rules |
| \`test/\` | Automated tests, mirroring \`app/\` |

## Validation commands

| Layer | Command | Cost | When to run |
| --- | --- | --- | --- |
| Unit | \`make test\` | about 1 minute | per slice |
| Full suite | \`make test-all\` | about 10 minutes | closure or CI only |

## Test conventions

- Tests live under \`test/\`, next to the module they cover; shared builders live in \`test/support/\`.
- Network calls are stubbed; no test reaches an external service.

## Environment quirks

- The local database is reset before each full suite run.
`;

const ownBackend = `# Backend Instructions

## Stack and architecture

- Services return a result object; controllers only translate it into a response.

## Tests

- Every service change adds a focused test for the success path and one failure path.
`;

// 0.18.1 wrote these two .gitignore blocks, joined by a blank line.
const legacyGitignore = '# AI workflow workspace (temporary coordination state)\n.ai-work/\n\n# workflow-kit rollback journal (local to the machine that ran the last apply)\n/.agents/workflow-kit/last-apply.json\n';
// 0.18.1 rendered the Copilot wrapper of the quality gate from the project file alone.
const legacyQualityGateWrapper = (qualityGate) => `---\napplyTo: "**"\n---\n\n<!-- Generated from .agents/project/quality-gate.md by workflow-kit. Edit that file, not this one. -->\n\n${qualityGate.replace(/^\n+/, '')}`;

const sha256 = (content) => createHash('sha256').update(content).digest('hex');

async function writeFile(target, relativePath, content) {
  const file = path.join(target, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

// Removes a file and the directories it leaves empty, up to the target.
async function removeFile(target, relativePath) {
  await fs.rm(path.join(target, relativePath), { force: true });
  let directory = path.dirname(path.join(target, relativePath));
  while (directory !== target && directory.startsWith(target)) {
    try {
      await fs.rmdir(directory);
    } catch (error) {
      if (['ENOTEMPTY', 'EEXIST', 'ENOENT'].includes(error.code)) break;
      throw error;
    }
    directory = path.dirname(directory);
  }
}

async function loadFixture() {
  const index = JSON.parse(await fs.readFile(path.join(fixtureDir, 'files.json'), 'utf8'));
  const read = (entry) => fs.readFile(path.join(fixtureDir, entry.fixture));
  return { index, read };
}

// The same entry 0.18.1 (buildDiscoveredSkillEntry) added for a SKILL.md that
// no registry entry named.
function parseFrontmatter(content) {
  const match = String(content).replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/);
  const frontmatter = {};
  for (const line of match ? match[1].split('\n') : []) {
    if (!line || /^\s/.test(line)) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    if (key) frontmatter[key] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return frontmatter;
}

function discoveredEntry(relativePath, content) {
  const frontmatter = parseFrontmatter(content);
  const name = String(frontmatter.name || relativePath.replace(/\/SKILL\.md$/, '').split('/').at(-1)).trim();
  const skillClass = relativePath.includes('/06-patterns/') ? 'Standards/pattern'
    : relativePath.includes('/03-quality/') ? 'Quality/validation'
      : relativePath.includes('/04-crosscutting/') ? 'Cross-cutting overlay'
        : relativePath.includes('/05-caveman/') ? 'Mode/helper'
          : relativePath.includes('/02-implement/') ? 'Delegate-only implementation'
            : 'Workflow';
  const posture = {
    'Delegate-only implementation': 'Delegated-only',
    'Quality/validation': 'Just-in-time',
    'Standards/pattern': 'Just-in-time',
    'Cross-cutting overlay': 'Overlay',
    'Mode/helper': 'Helper/mode'
  }[skillClass] ?? 'Explicit-only';
  const description = String(frontmatter.description || '').trim();
  return {
    name,
    class: skillClass,
    path: relativePath,
    trigger: description || `Discovered local project skill at ${relativePath}; load when explicitly requested.`,
    loading_posture: posture,
    key: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'local-skill',
    runtime_notes: autoDiscoveredNote
  };
}

async function skillFilesOnDisk(target) {
  const found = [];
  async function walk(relativeDirectory) {
    for (const entry of await fs.readdir(path.join(target, relativeDirectory), { withFileTypes: true })) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) await walk(relativePath);
      else if (entry.isFile() && entry.name === 'SKILL.md') found.push(relativePath);
    }
  }
  await walk('.agents/skills');
  // Sorted so the appended entries do not depend on the file system order.
  return found.sort();
}

// registry.json as 0.18.1 left it after more than one update: one
// auto-discovered entry per SKILL.md on disk that no shipped entry names by
// path or key. The first update appended them; every later one keeps the
// entries the template does not ship first and the shipped ones after them.
// 0.18.1 plans this content as unchanged.
async function mergedLegacyRegistry(target, templateContent) {
  const registry = JSON.parse(templateContent);
  const discovered = [];
  const found = { skills: [], pattern_skills: [] };
  for (const relativePath of await skillFilesOnDisk(target)) {
    const entry = discoveredEntry(relativePath, await fs.readFile(path.join(target, relativePath), 'utf8'));
    const listName = entry.class === 'Standards/pattern' ? 'pattern_skills' : 'skills';
    if (registry[listName].some((item) => item.path === entry.path || item.key === entry.key)) continue;
    found[listName].push(entry);
    discovered.push(entry);
  }
  for (const listName of Object.keys(found)) registry[listName] = [...found[listName], ...registry[listName]];
  return { content: `${JSON.stringify(registry, null, 2)}\n`, discovered };
}

// Adds rows after the last row of the table that lists pattern skills.
function appendPatternRows(content, rows) {
  const lines = content.split('\n');
  const last = lines.findLastIndex((line) => line.startsWith('| `') && line.includes('`.agents/skills/06-patterns/'));
  if (last === -1) throw new Error('The 0.18.1 catalog has no pattern table.');
  lines.splice(last + 1, 0, ...rows);
  return lines.join('\n');
}

export async function installLegacy0181(target, { runtimes = ['claude'], windowsKeys = false } = {}) {
  const { index, read } = await loadFixture();
  const selected = runtimes.length > 0 ? runtimes : ['neutral'];

  // a. Today's kit tree, without what 0.18.1 never installed.
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: selected.join(',') }));
  const currentState = JSON.parse(await fs.readFile(path.join(target, installStateRelativePath), 'utf8'));
  await removeFile(target, journalPath);
  await removeFile(target, installStateRelativePath);
  for (const relativePath of index.addedSince) await removeFile(target, relativePath);

  // b. The 0.18.1 structural files for the selected runtimes.
  const snapshotContent = {};
  for (const entry of index.snapshot) {
    if (entry.runtimes && !entry.runtimes.some((runtime) => selected.includes(runtime))) continue;
    snapshotContent[entry.target] = await read(entry);
    await writeFile(target, entry.target, snapshotContent[entry.target]);
  }
  await writeFile(target, '.gitignore', legacyGitignore);
  const qualityGatePath = '.agents/project/quality-gate.md';
  const qualityGateWrapperPath = '.github/instructions/quality-gate.instructions.md';
  if (selected.includes('copilot')) {
    await writeFile(target, qualityGateWrapperPath, legacyQualityGateWrapper(snapshotContent[qualityGatePath].toString('utf8')));
  }

  // c. Project content as a 0.18 team has it, and the retired kit file.
  for (const [file, content] of Object.entries(localSkillFiles)) await writeFile(target, `${localSkillOldDir}/${file}`, content);
  for (const [file, mode] of Object.entries(localSkillModes)) await fs.chmod(path.join(target, localSkillOldDir, file), mode);
  await writeFile(target, handbook.path, handbook.content);
  await writeFile(target, '.agents/project-context.md', ownContext);
  await writeFile(target, '.agents/project/backend.md', ownBackend);
  await writeFile(target, index.retired.target, await read(index.retired));

  const localSkillPath = `${localSkillOldDir}/SKILL.md`;
  const catalogRows = {
    '.agents/skills/registry.md': [`| \`${localSkillName}\` | Standards/pattern | \`${localSkillPath}\` | ${localSkillTriggerRow} | Just-in-time | ${localSkillCost} | \`${localSkillName}\` | Project-local pattern. |`],
    '.agents/skills/06-patterns/index.md': [`| \`${localSkillName}\` | Standards/pattern | ${localSkillTriggerRow} | \`${localSkillPath}\` | Just-in-time | ${localSkillCost} |`, handbook.row]
  };
  for (const [relativePath, rows] of Object.entries(catalogRows)) {
    await writeFile(target, relativePath, appendPatternRows(snapshotContent[relativePath].toString('utf8'), rows));
  }
  const registry = await mergedLegacyRegistry(target, snapshotContent[registryJsonPath].toString('utf8'));
  await writeFile(target, registryJsonPath, registry.content);

  // d. install-state 1.0.0 as 0.18.1 left it after an update.
  const added = new Set(index.addedSince);
  const dropped = new Set(legacyDroppedPaths);
  const managed = Object.keys(currentState.files).filter((relativePath) => !added.has(relativePath)
    && !dropped.has(relativePath)
    && !relativePath.startsWith('.agents/project/')
    && !relativePath.startsWith('.agents/workflow-kit/'));
  managed.push(index.retired.target);
  const files = {};
  for (const relativePath of [...new Set(managed)].sort((a, b) => a.localeCompare(b))) {
    const content = await fs.readFile(path.join(target, relativePath));
    files[windowsKeys ? relativePath.replaceAll('/', '\\') : relativePath] = sha256(content);
  }
  const state = {
    schemaVersion: '1.0.0',
    managedBy: 'fhh-ia-ecosystem-workflow-kit',
    toolkitVersion: legacyToolkitVersion,
    generatedAt: legacyGeneratedAt,
    runtimes: selected,
    overlay: 'fhh-ia-ecosystem-full',
    modelProfiles: currentState.modelProfiles ?? {},
    stackPack: 'none',
    files
  };
  await writeFile(target, installStateRelativePath, `${JSON.stringify(state, null, 2)}\n`);

  // e. What the tests assert on.
  return {
    runtimes: selected,
    toolkitVersion: legacyToolkitVersion,
    localSkill: {
      name: localSkillName,
      oldDir: localSkillOldDir,
      newDir: `.agents/project/skills/${localSkillName}`,
      files: Object.keys(localSkillFiles),
      contents: { ...localSkillFiles },
      modes: { ...localSkillModes },
      catalogRows
    },
    handbook: { path: handbook.path, content: handbook.content },
    projectIndexRows: [...projectIndexRows],
    ownContext: { path: '.agents/project-context.md', newPath: '.agents/project/context.md', content: ownContext },
    ownBackend: { path: '.agents/project/backend.md', content: ownBackend },
    qualityGate: { path: qualityGatePath, sha256: sha256(snapshotContent[qualityGatePath]) },
    retiredPath: index.retired.target,
    registryPath: registryJsonPath,
    registryEntryPath: localSkillPath,
    discoveredRegistryEntries: registry.discovered,
    stateKeys: Object.keys(files)
  };
}
