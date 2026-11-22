// Layout migration from install-state 1.0.0 (PRD manifest-updater 2.3). A 1.0.0
// state recorded merged catalogs and never recorded preserved files, so it
// reaches the class planner only through this module, which controls what the
// planner sees as recorded. A 2.0.0 state never runs this code.
//
// Every operation this module adds or takes over is flagged `migration: true`:
// the migration is applied whole (selectPlanOperations keeps it) and every
// write of a migration plan keeps a backup, whatever the backup mode.
import fs from 'node:fs/promises';
import path from 'node:path';
import { checksumOf } from './fs-safety.mjs';
import { classifyPath, supersededSeedHashes } from './kit-manifest.mjs';
import { selectedTemplateFiles } from './planner.mjs';
import { supportedRuntimes } from './runtime-matrix.mjs';

export const layoutMigrationId = '0.22.0-kit-overlay-layout';
export const projectIndexPath = '.agents/project/index.md';
const skillsRoot = '.agents/skills';
const projectSkillsRoot = '.agents/project/skills';
const skillFileName = 'SKILL.md';
const backupFileMarker = '.workflow-kit-backup-';
// Catalogs 0.18.1 preserved as project files after merging local rows into
// them. registry.md is a kit file by class, but it was preserved the same way.
const catalogPaths = new Set(['.agents/skills/index.md', '.agents/skills/registry.md', '.agents/skills/06-patterns/index.md', '.agents/skills/registry.json']);
const markdownCatalogPaths = [...catalogPaths].filter((relativePath) => relativePath.endsWith('.md'));
const registryJsonPath = '.agents/skills/registry.json';
// A folder name: no separators, never "." or "..".
const skillNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const skillsTableHeader = ['| Skill name | Class | Trigger | Physical path | Cost hint |', '| --- | --- | --- | --- | --- |'];
const pendingEditReasons = new Set(['edited_kit_file', 'unmarked_adapter']);
const noBackupUpgrade = { overwrite_no_backup: 'overwrite_with_backup', merge_no_backup: 'merge_with_backup' };

async function readBufferOptional(file) {
  try {
    return await fs.readFile(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function pathExists(file) {
  try {
    await fs.lstat(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

// Top-level `key: value` lines of a YAML frontmatter, enough for name and
// description (folded and literal blocks are joined into one line).
function readFrontmatter(content) {
  const match = String(content).replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  const fields = {};
  if (!match) return fields;
  const lines = match[1].split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const field = lines[index].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!field) continue;
    let value = field[2].trim();
    if (/^[>|][+-]?$/.test(value)) {
      const block = [];
      while (index + 1 < lines.length && /^\s+\S/.test(lines[index + 1])) block.push(lines[(index += 1)].trim());
      value = block.join(' ');
    }
    fields[field[1]] = value.replace(/^(['"])(.*)\1$/, '$2');
  }
  return fields;
}

const skillNameOf = (content, directory) => String(readFrontmatter(content).name || path.posix.basename(directory)).trim();

// Regular files under a folder of the target, as "/" paths; links are skipped.
async function listFiles(targetPath, relativeDirectory) {
  const found = [];
  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(path.join(targetPath, current), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const relativePath = `${current}/${entry.name}`;
      if (entry.isDirectory()) await walk(relativePath);
      else if (entry.isFile()) found.push(relativePath);
    }
  }
  await walk(relativeDirectory);
  return found.sort();
}

// Skill paths the catalogs list, with the trigger text they give.
async function catalogEntries(targetPath) {
  const entries = new Map();
  const add = (relativePath, trigger) => {
    if (!entries.has(relativePath) || (!entries.get(relativePath) && trigger)) entries.set(relativePath, trigger || null);
  };
  const registry = await readBufferOptional(path.join(targetPath, registryJsonPath));
  if (registry !== null) {
    let parsed = null;
    try {
      parsed = JSON.parse(registry.toString('utf8'));
    } catch {
      // A registry that is not JSON has no rows to keep; it is replaced whole.
    }
    for (const listName of ['skills', 'pattern_skills']) {
      for (const entry of Array.isArray(parsed?.[listName]) ? parsed[listName] : []) {
        if (typeof entry?.path === 'string') add(entry.path, typeof entry.trigger === 'string' ? entry.trigger : null);
      }
    }
  }
  for (const catalogPath of markdownCatalogPaths) {
    const content = await readBufferOptional(path.join(targetPath, catalogPath));
    for (const line of content === null ? [] : content.toString('utf8').split('\n')) {
      if (!line.trimStart().startsWith('|')) continue;
      for (const [, relativePath] of line.matchAll(/`(\.agents\/skills\/[^`]+\/SKILL\.md)`/g)) add(relativePath, null);
    }
  }
  return entries;
}

// Own skills: folders under .agents/skills/ with a SKILL.md that no runtime of
// this CLI ships and the 1.0.0 state does not record. A retired kit skill is
// recorded, so it stays with the retired-file planner.
async function findOwnSkills({ targetPath, previousFiles, shippedPaths }) {
  const isKitFile = (relativePath) => shippedPaths.has(relativePath) || Object.hasOwn(previousFiles, relativePath);
  const files = (await listFiles(targetPath, skillsRoot)).filter((relativePath) => !relativePath.includes(backupFileMarker));
  const directories = files
    .filter((relativePath) => path.posix.basename(relativePath) === skillFileName && !isKitFile(relativePath))
    .map((relativePath) => path.posix.dirname(relativePath));
  // A skill folder inside another own skill moves with it.
  const outermost = directories.filter((directory) => !directories.some((other) => other !== directory && directory.startsWith(`${other}/`)));
  return outermost.map((directory) => {
    const skillFiles = files.filter((relativePath) => relativePath.startsWith(`${directory}/`));
    return { directory, files: skillFiles, mixed: skillFiles.some(isKitFile) };
  });
}

async function kitSkillNames(shippedFiles) {
  const names = new Set();
  for (const file of shippedFiles) {
    if (path.posix.basename(file.relativePath) !== skillFileName) continue;
    names.add(skillNameOf(await fs.readFile(file.sourcePath, 'utf8'), path.posix.dirname(file.relativePath)));
  }
  return names;
}

// Reads every file of a skill, or explains why it cannot move unchanged.
async function planSkillMove({ targetPath, skill, kitNames, claimed }) {
  const contents = {};
  for (const relativePath of skill.files) contents[relativePath] = await fs.readFile(path.join(targetPath, relativePath));
  const name = skillNameOf(contents[`${skill.directory}/${skillFileName}`].toString('utf8'), skill.directory);
  const pending = (reason) => ({ ...skill, name, reason });
  if (!skillNamePattern.test(name)) return pending('invalid_skill_name');
  if (skill.mixed) return pending('mixed_with_kit_files');
  if (kitNames.has(name)) return pending('kit_skill_name');
  const newDirectory = `${projectSkillsRoot}/${name}`;
  if (claimed.has(name) || await pathExists(path.join(targetPath, newDirectory))) return pending('project_skill_exists');
  // The move writes text: a file that does not survive a UTF-8 round trip
  // would be rewritten, so the skill stays where it is.
  for (const buffer of Object.values(contents)) {
    if (!Buffer.from(buffer.toString('utf8'), 'utf8').equals(buffer)) return pending('binary_file');
  }
  claimed.add(name);
  return { ...skill, name, newDirectory, contents: Object.fromEntries(Object.entries(contents).map(([key, buffer]) => [key, buffer.toString('utf8')])) };
}

const cell = (text) => String(text).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();

function skillRow(skill, trigger) {
  return `| \`${skill.name}\` | Pattern | ${cell(trigger)} | \`${skill.newDirectory}/${skillFileName}\` | lean |`;
}

// Appends rows to the Skills table, adding the section or the table header
// when missing. Existing rows are never changed.
function appendSkillRows(content, rows) {
  const lines = content.split('\n');
  const heading = lines.findIndex((line) => /^##\s+Skills\s*$/.test(line));
  if (heading === -1) {
    const separator = content.length === 0 || content.endsWith('\n') ? '' : '\n';
    return `${content}${separator}\n## Skills\n\n${[...skillsTableHeader, ...rows].join('\n')}\n`;
  }
  let end = lines.findIndex((line, index) => index > heading && /^#{1,2}\s/.test(line));
  if (end === -1) end = lines.length;
  let lastRow = -1;
  for (let index = heading + 1; index < end; index += 1) if (lines[index].trimStart().startsWith('|')) lastRow = index;
  if (lastRow === -1) lines.splice(heading + 1, 0, '', ...skillsTableHeader, ...rows);
  else lines.splice(lastRow + 1, 0, ...rows);
  return lines.join('\n');
}

function newProjectIndex(rows) {
  return [
    '# Project Catalog',
    '',
    'Skills, extensions and shadows that belong to this project. Format:',
    '`.agents/kit-boundary.md`, "Project catalog format".',
    '',
    '## Skills',
    '',
    ...skillsTableHeader,
    ...rows,
    ''
  ].join('\n');
}

const migrationOperation = (targetPath, relativePath, fields) => ({
  relativePath,
  targetFile: path.join(targetPath, relativePath),
  sourcePath: null,
  // Project files and moved project files: never recorded in install-state.
  class: null,
  migration: true,
  ...fields
});

const deleteOperation = (targetPath, relativePath, content) => migrationOperation(targetPath, relativePath, {
  operation: 'delete_with_backup',
  content: null,
  recordedChecksum: checksumOf(content)
});

// Reads what the migration needs before the class planner runs. Returns the
// planner inputs (`plannerFiles`, `seedContents`), the state paths to drop,
// and the steps that complete the plan.
export async function prepareLayoutMigration({ targetPath, manifest, previousFiles, files }) {
  const shippedFiles = await selectedTemplateFiles({ runtimes: supportedRuntimes });
  const shippedPaths = new Set(shippedFiles.map((file) => file.relativePath));

  // 3. Catalogs are derived (A1): the 1.0.0 state dropped the ones it
  // preserved, so the planner gets their current content as recorded and plans
  // a replace. The project rows they held are moved first (2).
  const plannerFiles = { ...previousFiles };
  const takenOver = new Set();
  for (const file of files) {
    if (Object.hasOwn(previousFiles, file.relativePath)) continue;
    const entry = classifyPath(manifest, file.relativePath);
    if (entry?.class !== 'derived' && !catalogPaths.has(file.relativePath)) continue;
    const existing = await readBufferOptional(path.join(targetPath, file.relativePath));
    if (existing === null) continue;
    plannerFiles[file.relativePath] = { sha256: checksumOf(existing.toString('utf8')), class: entry?.class ?? null };
    takenOver.add(file.relativePath);
  }

  // 4. Legacy paths: the old file becomes the seed when the seed is missing.
  const seedContents = {};
  const legacyMoves = [];
  const contextMoves = [];
  for (const [legacyPath, currentPath] of Object.entries(manifest.legacy_paths)) {
    const legacy = await readBufferOptional(path.join(targetPath, legacyPath));
    if (legacy === null || await pathExists(path.join(targetPath, currentPath))) continue;
    seedContents[currentPath] = legacy.toString('utf8');
    legacyMoves.push({ legacyPath, currentPath });
  }

  // 1. Own skills.
  const kitNames = await kitSkillNames(shippedFiles);
  const claimed = new Set();
  const skills = [];
  for (const skill of await findOwnSkills({ targetPath, previousFiles, shippedPaths })) {
    skills.push(await planSkillMove({ targetPath, skill, kitNames, claimed }));
  }
  const moved = skills.filter((skill) => skill.newDirectory);

  // 2. Own catalog rows: every moved skill gets a row; its catalog trigger is
  // kept when a catalog listed it.
  const catalog = await catalogEntries(targetPath);
  const catalogRows = moved.filter((skill) => catalog.has(`${skill.directory}/${skillFileName}`));
  const existingIndex = await readBufferOptional(path.join(targetPath, projectIndexPath));
  const indexText = existingIndex?.toString('utf8') ?? '';
  const rows = moved
    .map((skill) => {
      const skillPath = `${skill.directory}/${skillFileName}`;
      const trigger = catalog.get(skillPath) || readFrontmatter(skill.contents[skillPath]).description || `Project skill moved from ${skill.directory}/.`;
      return { skill, row: skillRow(skill, trigger) };
    })
    .filter(({ skill }) => !indexText.includes(`\`${skill.newDirectory}/${skillFileName}\``));

  // Called right after the class planner, before anything reads the planned
  // content of other files (the Copilot wrappers read the quality gate).
  async function completeOperations(operations) {
    for (const item of operations) {
      // 5. A seed still equal to a default the kit shipped is reset; any other
      // existing seed stays the project's.
      if (item.class === 'seed' && item.operation === 'skip_unmanaged' && supersededSeedHashes(manifest, item.relativePath).has(checksumOf(item.content))) {
        delete item.reason;
        Object.assign(item, { operation: 'overwrite_with_backup', content: await fs.readFile(item.sourcePath, 'utf8'), superseded: true, migration: true });
      }
      if (takenOver.has(item.relativePath) || catalogPaths.has(item.relativePath)) item.migration = true;
    }
    // The legacy file goes only once its content is planned at the new path.
    for (const move of legacyMoves) {
      const created = operations.find((item) => item.relativePath === move.currentPath && item.operation === 'create' && item.content === seedContents[move.currentPath]);
      if (!created) continue;
      created.migration = true;
      operations.push(deleteOperation(targetPath, move.legacyPath, created.content));
      contextMoves.push(move);
    }
    for (const skill of moved) {
      for (const [relativePath, content] of Object.entries(skill.contents)) {
        operations.push(deleteOperation(targetPath, relativePath, content));
        const newPath = `${skill.newDirectory}/${relativePath.slice(skill.directory.length + 1)}`;
        operations.push(migrationOperation(targetPath, newPath, { operation: 'create', content }));
      }
    }
    if (rows.length > 0) {
      operations.push(migrationOperation(targetPath, projectIndexPath, existingIndex === null
        ? { operation: 'create', content: newProjectIndex(rows.map((item) => item.row)) }
        : { operation: 'merge_with_backup', content: appendSkillRows(indexText, rows.map((item) => item.row)) }));
    }
  }

  // Counts per group, from the final operations.
  function describe(operations) {
    const writing = (item) => !['unchanged', 'skip_modified', 'skip_unmanaged', 'adopt_existing', 'delete_with_backup'].includes(item.operation);
    const kitUpdated = operations.filter((item) => !item.retired && ['kit', 'derived', 'adapter'].includes(item.class) && writing(item));
    return {
      id: layoutMigrationId,
      kitUpdated: kitUpdated.length,
      catalogsReplaced: kitUpdated.filter((item) => takenOver.has(item.relativePath) || catalogPaths.has(item.relativePath)).length,
      pending: [
        ...operations.filter((item) => item.operation === 'skip_modified' && pendingEditReasons.has(item.reason)).map((item) => ({ relativePath: item.relativePath, reason: item.reason })),
        ...skills.filter((skill) => !skill.newDirectory).map((skill) => ({ relativePath: `${skill.directory}/`, reason: skill.reason }))
      ],
      retiredDeleted: operations.filter((item) => item.retired && item.operation === 'delete_with_backup').length,
      skillsMoved: moved.length,
      catalogRowsMoved: catalogRows.length,
      projectIndexRows: rows.length,
      contextMoved: contextMoves.map(({ legacyPath, currentPath }) => ({ from: legacyPath, to: currentPath })),
      seedsReset: operations.filter((item) => item.superseded).map((item) => item.relativePath)
    };
  }

  return {
    plannerFiles,
    seedContents,
    // A legacy path never enters the 2.0.0 state, moved or not.
    droppedPaths: Object.keys(manifest.legacy_paths).filter((legacyPath) => Object.hasOwn(previousFiles, legacyPath)),
    completeOperations,
    describe
  };
}

// "The migration always keeps a backup" (edge case Rollout): no write of a
// migration plan goes without one, whatever --backup-mode says.
export function requireMigrationBackups(operations) {
  for (const item of operations) {
    if (Object.hasOwn(noBackupUpgrade, item.operation)) item.operation = noBackupUpgrade[item.operation];
  }
}
