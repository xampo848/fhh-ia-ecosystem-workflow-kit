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
export const skillsRoot = '.agents/skills';
const projectSkillsRoot = '.agents/project/skills';
const projectShadowsRoot = '.agents/project/shadows';
export const shadowManifestName = 'shadow.json';
const skillFileName = 'SKILL.md';
export const backupFileMarker = '.workflow-kit-backup-';
// The legacy 0.18 layout, not current ownership: the catalogs 0.18.x kept as
// project files (merging local rows into them, so the 1.0.0 state dropped or
// recorded them merged). Only these reach the planner as recorded and are
// replaced whole. Markdown catalogs are listed in the order their rows are
// read: the first catalog that has a column gives its text.
const legacyPreservedCatalogs = new Set([
  '.agents/skills/index.md',
  '.agents/skills/06-patterns/index.md',
  '.agents/skills/registry.md',
  '.agents/skills/registry.json',
  '.agents/skills/registry.cache.json'
]);
const markdownCatalogPaths = [...legacyPreservedCatalogs].filter((relativePath) => relativePath.endsWith('.md'));
const registryJsonPath = `${skillsRoot}/registry.json`;
// A folder name: no separators, never "." or "..".
const skillNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const skillsTable = { heading: 'Skills', columns: ['Skill name', 'Class', 'Trigger', 'Physical path', 'Cost hint'] };
const shadowsTable = { heading: 'Shadows', columns: ['Kit skill', 'Shadow directory'] };
// Classes the project catalog allows (.agents/kit-boundary.md, "Project catalog format").
const projectCatalogClasses = new Set(['Pattern', 'Runbook']);
const defaultProjectClass = 'Pattern';
const movedSkillClasses = new Set([defaultProjectClass]);
const defaultCostHint = 'lean';
// Pending files an --edited decision can settle (PRD 2.4).
export const pendingEditReasons = new Set(['edited_kit_file', 'unmarked_adapter', 'unrecorded_kit_file']);
// A shadow, or a skill move, that waits because the project index cannot take its row.
export const projectIndexUnexpected = 'project_index_unexpected';
const noBackupUpgrade = { overwrite_no_backup: 'overwrite_with_backup', merge_no_backup: 'merge_with_backup' };

async function readBufferOptional(file) {
  try {
    return await fs.readFile(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function lstatOptional(file) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

const pathExists = async (file) => (await lstatOptional(file)) !== null;

async function readdirOptional(directory) {
  try {
    return await fs.readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw error;
  }
}
const permissionBits = (stat) => stat.mode & 0o777;
// The move writes text: content that does not survive a UTF-8 round trip
// would be rewritten.
const isUtf8 = (buffer) => Buffer.from(buffer.toString('utf8'), 'utf8').equals(buffer);

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

// What a folder of the target holds, as "/" paths: regular files, symbolic
// links (never followed) and folders with nothing in them.
export async function walkTree(targetPath, relativeDirectory) {
  const tree = { files: [], links: [], emptyDirectories: [] };
  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(path.join(targetPath, current), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    if (entries.length === 0 && current !== relativeDirectory) tree.emptyDirectories.push(current);
    for (const entry of entries) {
      const relativePath = `${current}/${entry.name}`;
      if (entry.isSymbolicLink()) tree.links.push(relativePath);
      else if (entry.isDirectory()) await walk(relativePath);
      else if (entry.isFile()) tree.files.push(relativePath);
    }
  }
  await walk(relativeDirectory);
  for (const list of Object.values(tree)) list.sort();
  return tree;
}

// The cells of a Markdown table line ("\|" stays inside its cell), or null.
function tableCells(line) {
  const text = line.trim();
  if (!text.startsWith('|')) return null;
  const cells = [];
  let current = '';
  for (let index = 1; index < text.length; index += 1) {
    if (text[index] === '\\' && text[index + 1] === '|') {
      current += '\\|';
      index += 1;
    } else if (text[index] === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += text[index];
    }
  }
  if (current.trim()) cells.push(current.trim());
  return cells;
}

const isSeparatorRow = (cells) => cells !== null && cells.length > 0 && cells.every((text) => /^:?-{3,}:?$/.test(text));
const fenceOpening = /^\s*(`{3,}|~{3,})/;

// Which lines sit inside a fenced code block (the fence lines included).
function fencedLines(lines) {
  let fence = null;
  return lines.map((line) => {
    const marker = line.match(fenceOpening)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return true;
    }
    if (marker) fence = marker;
    return Boolean(marker);
  });
}

// Every table of a Markdown text outside code fences: its header cells and
// its rows' cells.
function markdownTables(text) {
  const lines = text.split(/\r?\n/);
  const fenced = fencedLines(lines);
  const tables = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = fenced[index] ? null : tableCells(lines[index]);
    if (!header || !isSeparatorRow(tableCells(lines[index + 1]))) continue;
    const rows = [];
    let row = index + 2;
    for (; row < lines.length && !fenced[row] && tableCells(lines[row]); row += 1) rows.push(tableCells(lines[row]));
    tables.push({ header, rows });
    index = row - 1;
  }
  return tables;
}

export const unquote = (text) => String(text ?? '').trim().replace(/^`([^`]*)`$/, '$1').trim();
const catalogColumns = { name: 'Skill name', class: 'Class', trigger: 'Trigger', path: 'Physical path', cost: 'Cost hint' };

// Rows of the tables that have a "Skill name" column, mapped by header name.
// A cell the table does not have is null.
function catalogRows(text) {
  const rows = [];
  for (const table of markdownTables(text)) {
    const position = Object.fromEntries(Object.entries(catalogColumns).map(([field, header]) => [field, table.header.indexOf(header)]));
    if (position.name === -1) continue;
    for (const cells of table.rows) {
      rows.push(Object.fromEntries(Object.entries(position).map(([field, index]) => [field, index === -1 || cells[index] === undefined || cells[index] === '' ? null : cells[index]])));
    }
  }
  return rows;
}

function registryEntries(text) {
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // A registry that is not JSON has no rows to keep; it is replaced whole.
  }
  return ['skills', 'pattern_skills'].flatMap((listName) => (Array.isArray(parsed?.[listName]) ? parsed[listName] : []))
    .filter((entry) => entry !== null && typeof entry === 'object');
}

// Project rows of the 0.18 catalogs, keyed by the path they name (or their
// name when they name none). A row is the project's when its skill name is
// not a row of the shipped template of that catalog; a registry.json entry
// when neither its path nor its key is shipped. A row naming a kit path
// (shipped, or recorded by the 1.0.0 state) is a kit row whatever its name.
// The first catalog that has a column gives its text; registry.json fills
// what no Markdown catalog gave.
async function projectCatalogRows({ targetPath, shippedFiles, isKitPath }) {
  const templateOf = async (relativePath) => {
    const file = shippedFiles.find((item) => item.relativePath === relativePath);
    return file ? fs.readFile(file.sourcePath, 'utf8') : '';
  };
  const rows = new Map();
  const add = (row) => {
    const rowPath = unquote(row.path);
    if (rowPath && isKitPath(rowPath)) return;
    const key = rowPath || `name:${unquote(row.name)}`;
    const existing = rows.get(key);
    if (!existing) rows.set(key, { ...row, rowPath });
    else for (const field of Object.keys(catalogColumns)) existing[field] ??= row[field];
  };
  for (const catalogPath of markdownCatalogPaths) {
    const content = await readBufferOptional(path.join(targetPath, catalogPath));
    if (content === null) continue;
    const shippedNames = new Set(catalogRows(await templateOf(catalogPath)).map((row) => unquote(row.name)));
    for (const row of catalogRows(content.toString('utf8'))) if (!shippedNames.has(unquote(row.name))) add(row);
  }
  const registry = await readBufferOptional(path.join(targetPath, registryJsonPath));
  if (registry !== null) {
    const shipped = registryEntries(await templateOf(registryJsonPath));
    const shippedKeys = new Set(shipped.flatMap((entry) => [entry.path, entry.key].filter((value) => typeof value === 'string')));
    for (const entry of registryEntries(registry.toString('utf8'))) {
      if ([entry.path, entry.key].some((value) => typeof value === 'string' && shippedKeys.has(value))) continue;
      const text = (value) => (typeof value === 'string' && value.trim() ? value : null);
      add({
        name: text(entry.name) && `\`${entry.name}\``,
        class: text(entry.class) && cell(entry.class),
        trigger: text(entry.trigger) && cell(entry.trigger),
        path: text(entry.path) && `\`${entry.path}\``,
        cost: text(entry.cost_hint) && cell(entry.cost_hint)
      });
    }
  }
  return [...rows.values()];
}

// Own skills: folders under .agents/skills/ with a SKILL.md that no runtime of
// this CLI ships and the 1.0.0 state does not record. A retired kit skill is
// recorded, so it stays with the retired-file planner.
async function findOwnSkills({ targetPath, isKitPath }) {
  const tree = await walkTree(targetPath, skillsRoot);
  const files = tree.files.filter((relativePath) => !relativePath.includes(backupFileMarker));
  const directories = files
    .filter((relativePath) => path.posix.basename(relativePath) === skillFileName && !isKitPath(relativePath))
    .map((relativePath) => path.posix.dirname(relativePath));
  // A skill folder inside another own skill moves with it.
  const outermost = directories.filter((directory) => !directories.some((other) => other !== directory && directory.startsWith(`${other}/`)));
  const inside = (directory) => (relativePath) => relativePath.startsWith(`${directory}/`);
  return outermost.map((directory) => {
    const skillFiles = files.filter(inside(directory));
    return {
      directory,
      files: skillFiles,
      mixed: skillFiles.some(isKitPath),
      links: tree.links.filter(inside(directory)),
      emptyDirectories: tree.emptyDirectories.filter(inside(directory))
    };
  });
}

// Names are compared without letter case: on most file systems Tool/ and
// tool/ are one folder.
const nameKey = (name) => name.toLowerCase();

async function kitSkillNames(shippedFiles) {
  const names = new Set();
  for (const file of shippedFiles) {
    if (path.posix.basename(file.relativePath) !== skillFileName) continue;
    names.add(nameKey(skillNameOf(await fs.readFile(file.sourcePath, 'utf8'), path.posix.dirname(file.relativePath))));
  }
  return names;
}

// Reads every file of a skill, or explains why it cannot move unchanged.
// `taken` holds the names already in .agents/project/skills/ and the ones
// claimed by earlier moves.
async function planSkillMove({ targetPath, skill, kitNames, taken }) {
  const contents = {};
  const modes = {};
  for (const relativePath of skill.files) {
    const file = path.join(targetPath, relativePath);
    contents[relativePath] = await fs.readFile(file);
    modes[relativePath] = permissionBits(await fs.lstat(file));
  }
  const name = skillNameOf(contents[`${skill.directory}/${skillFileName}`].toString('utf8'), skill.directory);
  const pending = (reason) => ({ ...skill, name, reason });
  if (!skillNamePattern.test(name)) return pending('invalid_skill_name');
  if (skill.mixed) return pending('mixed_with_kit_files');
  // A link would move as the file it points to, or not at all.
  if (skill.links.length > 0) return pending('symlink');
  if (kitNames.has(nameKey(name))) return pending('kit_skill_name');
  if (taken.has(nameKey(name))) return pending('project_skill_exists');
  if (!Object.values(contents).every(isUtf8)) return pending('binary_file');
  taken.add(nameKey(name));
  return {
    ...skill,
    name,
    newDirectory: `${projectSkillsRoot}/${name}`,
    modes,
    contents: Object.fromEntries(Object.entries(contents).map(([key, buffer]) => [key, buffer.toString('utf8')]))
  };
}

const cell = (text) => String(text).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();

// A row of the project index from a catalog row (or none): the team's text,
// with the path of a moved skill and a class the project catalog allows.
// Returns the row and, when the class changed, a note for the plan.
// A moved skill lands in .agents/project/skills/<name>/, where only Pattern
// fits: a Runbook lives under skills/runbooks/ with its own sections.
function projectIndexRow({ source, name, rowPath, fallbackTrigger, allowedClasses = projectCatalogClasses }) {
  const sourceClass = source?.class ?? null;
  const rowClass = allowedClasses.has(sourceClass) ? sourceClass : defaultProjectClass;
  const row = `| ${name} | ${rowClass} | ${source?.trigger ?? cell(fallbackTrigger)} | ${rowPath} | ${source?.cost ?? defaultCostHint} |`;
  const note = sourceClass !== null && sourceClass !== rowClass
    ? `${name} row: class ${sourceClass} written as ${rowClass} (${allowedClasses === projectCatalogClasses ? `${projectIndexPath} allows ${[...projectCatalogClasses].join(' and ')}` : `a moved skill goes to ${projectSkillsRoot}/<name>/, where only ${defaultProjectClass} fits`})`
    : null;
  return { row, note };
}

const shadowRow = (shadow) => `| \`${shadow.skill}\` | \`${shadow.directory}/\` |`;
const headingOf = (table) => new RegExp(`^##\\s+${table.heading}\\s*$`);
const tableHeader = (table) => [`| ${table.columns.join(' | ')} |`, `| ${table.columns.map(() => '---').join(' | ')} |`];

// The section of a table in the project index: its heading line, the end of
// the section and the lines of its table, all outside code fences. null when
// the section is missing; `unexpected` when the migration cannot extend it.
function indexSection(lines, table) {
  const fenced = fencedLines(lines);
  const headings = lines.map((line, index) => (headingOf(table).test(line) ? index : -1)).filter((index) => index !== -1);
  if (headings.length === 0) return null;
  if (headings.length > 1 || fenced[headings[0]]) return { unexpected: true };
  const heading = headings[0];
  let end = lines.findIndex((line, index) => index > heading && !fenced[index] && /^#{1,2}\s/.test(line));
  if (end === -1) end = lines.length;
  const tableLines = [];
  for (let index = heading + 1; index < end; index += 1) if (lines[index].trimStart().startsWith('|')) tableLines.push(index);
  if (tableLines.length === 0) return { heading, lastRow: -1 };
  const [first] = tableLines;
  const header = tableCells(lines[first]);
  const expected = header.length === table.columns.length && header.every((text, index) => text === table.columns[index]) && isSeparatorRow(tableCells(lines[first + 1] ?? ''));
  if (!expected || tableLines.some((index) => fenced[index])) return { unexpected: true };
  let lastRow = first + 1;
  while (lastRow + 1 < end && tableCells(lines[lastRow + 1])) lastRow += 1;
  return { heading, first, lastRow };
}

// The rows (cells) of the Skills or Shadows table of the project index: []
// when the section or its table is missing, null when the table is not the
// one the project catalog format describes.
export function projectIndexTableRows(text, heading) {
  const table = [skillsTable, shadowsTable].find((item) => item.heading === heading);
  const lines = text.split(/\r?\n/);
  const section = indexSection(lines, table);
  if (section?.unexpected) return null;
  if (section === null || section.lastRow === -1) return [];
  return lines.slice(section.first + 2, section.lastRow + 1).map(tableCells);
}

// The line ending of an existing index, or null when one of its tables is
// not the one the project catalog format describes (wrong header, inside a
// code fence, or named twice): then the migration does not write it.
function projectIndexLineEnding(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(eol);
  return [skillsTable, shadowsTable].some((table) => indexSection(lines, table)?.unexpected) ? null : eol;
}

// Appends rows to a table of the project index, adding the section or the
// table header when missing. Existing rows are never changed.
function appendTableRows(content, eol, table, rows) {
  if (rows.length === 0) return content;
  const lines = content.split(eol);
  const section = indexSection(lines, table);
  if (section === null) {
    const separator = content.length === 0 || content.endsWith(eol) ? '' : eol;
    return `${content}${separator}${eol}## ${table.heading}${eol}${eol}${[...tableHeader(table), ...rows].join(eol)}${eol}`;
  }
  if (section.lastRow === -1) lines.splice(section.heading + 1, 0, '', ...tableHeader(table), ...rows);
  else lines.splice(section.lastRow + 1, 0, ...rows);
  return lines.join(eol);
}

const newProjectIndexIntro = [
  '# Project Catalog',
  '',
  'Skills, extensions and shadows that belong to this project. Format:',
  '`.agents/kit-boundary.md`, "Project catalog format".',
  ''
].join('\n');

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
// planner inputs (`plannerFiles`, `seedContents`, `excludedPaths`), the state
// paths to drop, and the steps that complete the plan.
export async function prepareLayoutMigration({ targetPath, manifest, previousFiles, previousToolkitVersion, files }) {
  const shippedFiles = await selectedTemplateFiles({ runtimes: supportedRuntimes });
  const shippedPaths = new Set(shippedFiles.map((file) => file.relativePath));
  const isKitPath = (relativePath) => shippedPaths.has(relativePath) || Object.hasOwn(previousFiles, relativePath);

  // 3. Catalogs are derived (A1): the 1.0.0 state dropped the ones 0.18
  // preserved, so the planner gets their current content as recorded and
  // plans a replace. The project rows they held are moved first (2). Any
  // other unrecorded kit file is someone's own text (markUnrecordedKitFiles).
  const plannerFiles = { ...previousFiles };
  for (const file of files) {
    if (Object.hasOwn(previousFiles, file.relativePath) || !legacyPreservedCatalogs.has(file.relativePath)) continue;
    const existing = await readBufferOptional(path.join(targetPath, file.relativePath));
    if (existing === null) continue;
    plannerFiles[file.relativePath] = { sha256: checksumOf(existing.toString('utf8')), class: classifyPath(manifest, file.relativePath)?.class ?? null };
  }

  // 4. Legacy paths: the old file becomes the seed when the seed is missing.
  // It moves as text and as a file: anything else stays where it is, and the
  // new path is not planned until it is sorted out.
  const seedContents = {};
  const legacyMoves = [];
  const contextMoves = [];
  const legacyPending = [];
  const excludedPaths = new Set();
  for (const [legacyPath, currentPath] of Object.entries(manifest.legacy_paths)) {
    const legacy = await lstatOptional(path.join(targetPath, legacyPath));
    if (legacy === null) continue;
    const current = await lstatOptional(path.join(targetPath, currentPath));
    const content = legacy.isFile() ? await fs.readFile(path.join(targetPath, legacyPath)) : null;
    if (content === null || !isUtf8(content) || (current !== null && !current.isFile())) {
      legacyPending.push({ relativePath: legacyPath, reason: 'legacy_path_unsupported' });
      excludedPaths.add(currentPath);
      continue;
    }
    if (current !== null) continue;
    seedContents[currentPath] = content.toString('utf8');
    legacyMoves.push({ legacyPath, currentPath, mode: permissionBits(legacy) });
  }

  // The project index takes the moved rows only when its tables are the ones
  // the project catalog format describes.
  const existingIndex = await readBufferOptional(path.join(targetPath, projectIndexPath));
  const indexText = existingIndex?.toString('utf8') ?? '';
  const indexLineEnding = existingIndex === null ? '\n' : projectIndexLineEnding(indexText);
  const indexWritable = indexLineEnding !== null;

  // 1. Own skills. Without a writable index none moves: a skill moved
  // without its row would be hidden from the router.
  const kitNames = await kitSkillNames(shippedFiles);
  const taken = new Set((await readdirOptional(path.join(targetPath, projectSkillsRoot))).map(nameKey));
  const skills = [];
  for (const skill of await findOwnSkills({ targetPath, isKitPath })) {
    const planned = await planSkillMove({ targetPath, skill, kitNames, taken });
    skills.push(planned.newDirectory && !indexWritable ? { ...skill, name: planned.name, reason: projectIndexUnexpected } : planned);
  }
  const moved = skills.filter((skill) => skill.newDirectory);
  const notes = moved.filter((skill) => skill.emptyDirectories.length > 0)
    .map((skill) => `${skill.name}: empty folders left in place: ${skill.emptyDirectories.map((directory) => `${directory}/`).join(', ')}`);

  // 2. Own catalog rows: every moved skill gets a row, from its catalog row
  // when one lists it; a row of a skill left pending, or naming any other
  // path under .agents/skills/, is not written (it would point into the kit
  // tree); a row naming anything else moves as is.
  const sourceRows = await projectCatalogRows({ targetPath, shippedFiles, isKitPath });
  const skillOf = (rowPath) => skills.find((skill) => rowPath.startsWith(`${skill.directory}/`));
  const indexRows = [];
  const unwrittenRows = [];
  for (const skill of moved) {
    const skillPath = `${skill.directory}/${skillFileName}`;
    const source = sourceRows.find((row) => row.rowPath === skillPath) ?? null;
    indexRows.push({
      listedPath: `${skill.newDirectory}/${skillFileName}`,
      fromCatalog: source !== null,
      ...projectIndexRow({
        source,
        allowedClasses: movedSkillClasses,
        name: `\`${skill.name}\``,
        rowPath: `\`${skill.newDirectory}/${skillFileName}\``,
        fallbackTrigger: readFrontmatter(skill.contents[skillPath]).description || `Project skill moved from ${skill.directory}/.`
      })
    });
  }
  for (const source of sourceRows) {
    const owner = source.rowPath ? skillOf(source.rowPath) : null;
    if (owner?.newDirectory && source.rowPath === `${owner.directory}/${skillFileName}`) continue;
    if (owner && !owner.newDirectory) continue;
    if (!owner && source.rowPath.startsWith(`${skillsRoot}/`)) {
      notes.push(`${source.name} row not moved: ${source.rowPath} is under ${skillsRoot}/ and is not an own skill`);
      unwrittenRows.push({ name: source.name, rowPath: source.rowPath });
      continue;
    }
    // A skill folder inside a moved skill moved with it.
    const rowPath = owner ? source.path.replace(owner.directory, owner.newDirectory) : source.path ?? '';
    indexRows.push({
      listedPath: unquote(rowPath),
      fromCatalog: true,
      ...projectIndexRow({ source, name: source.name ?? '', rowPath, fallbackTrigger: '' })
    });
  }
  if (indexWritable) notes.push(...indexRows.map((item) => item.note).filter(Boolean));
  // A row whose path the index already lists is not added again.
  const newRows = (rows) => rows.filter(({ listedPath }) => !listedPath || !indexText.includes(`\`${listedPath}\``)).map(({ row }) => row);
  const skillRows = indexWritable ? newRows(indexRows) : [];
  let indexRowsAdded = 0;

  // shadow (PRD 2.4): only the SKILL.md of a kit leaf skill that the manifest
  // lets be shadowed and that has no shadow yet. Returns what the shadow
  // needs, or null when the decision does not apply to the pending file.
  async function shadowFor(item) {
    const directory = path.posix.dirname(item.relativePath);
    if (item.reason !== 'edited_kit_file') return null;
    if (!item.relativePath.startsWith(`${skillsRoot}/`) || path.posix.basename(item.relativePath) !== skillFileName) return null;
    const isInnerSkill = (relativePath) => relativePath.startsWith(`${directory}/`) && relativePath !== item.relativePath && path.posix.basename(relativePath) === skillFileName;
    if ([...shippedPaths].some(isInnerSkill)) return null;
    const skill = skillNameOf(await fs.readFile(item.sourcePath, 'utf8'), directory);
    if (!skillNamePattern.test(skill) || manifest.not_shadowable.includes(skill)) return null;
    const shadowDirectory = `${projectShadowsRoot}/${skill}`;
    if (await pathExists(path.join(targetPath, shadowDirectory))) return null;
    // The shadow is the edited file byte for byte, written as text.
    const edited = await fs.readFile(item.targetFile);
    if (!isUtf8(edited)) return null;
    return { skill, directory: shadowDirectory, kitPath: item.relativePath, content: edited.toString('utf8'), baseSha256: item.recordedChecksum };
  }

  // The shadow files; the replaced kit file is the caller's operation.
  function shadowOperations(shadow) {
    const shadowManifest = { skill: shadow.skill, kit_path: shadow.kitPath, base_sha256: shadow.baseSha256, kit_version: previousToolkitVersion ?? null };
    return [
      migrationOperation(targetPath, `${shadow.directory}/${skillFileName}`, { operation: 'create', content: shadow.content }),
      migrationOperation(targetPath, `${shadow.directory}/${shadowManifestName}`, { operation: 'create', content: `${JSON.stringify(shadowManifest, null, 2)}\n` })
    ];
  }

  // Called right after the class planner, before the --edited decisions: a
  // kit or derived file the 1.0.0 state does not record and that differs
  // from this version is pending like an edited one (keep | discard).
  async function markUnrecordedKitFiles(operations) {
    for (const item of operations) {
      if (item.operation !== 'skip_unmanaged' || !['kit', 'derived'].includes(item.class) || Object.hasOwn(plannerFiles, item.relativePath)) continue;
      const existingChecksum = checksumOf(await fs.readFile(item.targetFile, 'utf8'));
      Object.assign(item, { operation: 'skip_modified', reason: 'unrecorded_kit_file', existingChecksum, recordedChecksum: null });
    }
  }

  // Called right after the --edited decisions, before anything reads the
  // planned content of other files (the Copilot wrappers read the quality gate).
  async function completeOperations(operations, shadows = []) {
    for (const item of operations) {
      // 5. A seed still equal to a default the kit shipped is reset; any other
      // existing seed stays the project's.
      if (item.class === 'seed' && item.operation === 'skip_unmanaged' && supersededSeedHashes(manifest, item.relativePath).has(checksumOf(item.content))) {
        delete item.reason;
        Object.assign(item, { operation: 'overwrite_with_backup', content: await fs.readFile(item.sourcePath, 'utf8'), superseded: true, migration: true });
      }
      if (legacyPreservedCatalogs.has(item.relativePath)) item.migration = true;
    }
    // The legacy file goes only once its content is planned at the new path.
    for (const move of legacyMoves) {
      const created = operations.find((item) => item.relativePath === move.currentPath && item.operation === 'create' && item.content === seedContents[move.currentPath]);
      if (!created) continue;
      Object.assign(created, { migration: true, mode: move.mode });
      operations.push(deleteOperation(targetPath, move.legacyPath, created.content));
      contextMoves.push(move);
    }
    for (const skill of moved) {
      for (const [relativePath, content] of Object.entries(skill.contents)) {
        operations.push(deleteOperation(targetPath, relativePath, content));
        const newPath = `${skill.newDirectory}/${relativePath.slice(skill.directory.length + 1)}`;
        operations.push(migrationOperation(targetPath, newPath, { operation: 'create', content, mode: skill.modes[relativePath] }));
      }
    }
    // One index operation for the moved skills and the new shadows.
    const shadowRows = newRows(shadows.map((shadow) => ({ listedPath: `${shadow.directory}/`, row: shadowRow(shadow) })));
    indexRowsAdded = skillRows.length + shadowRows.length;
    if (indexRowsAdded > 0) {
      const content = appendTableRows(appendTableRows(existingIndex === null ? newProjectIndexIntro : indexText, indexLineEnding, skillsTable, skillRows), indexLineEnding, shadowsTable, shadowRows);
      operations.push(migrationOperation(targetPath, projectIndexPath, existingIndex === null ? { operation: 'create', content } : { operation: 'merge_with_backup', content }));
    }
  }

  // Counts per group, from the final operations.
  function describe(operations) {
    const writing = (item) => !['unchanged', 'skip_modified', 'skip_unmanaged', 'adopt_existing', 'delete_with_backup'].includes(item.operation);
    const kitUpdated = operations.filter((item) => !item.retired && ['kit', 'derived', 'adapter'].includes(item.class) && writing(item));
    const pendingFiles = operations.filter((item) => item.operation === 'skip_modified' && (pendingEditReasons.has(item.reason) || item.reason === projectIndexUnexpected));
    const waitingForIndex = !indexWritable && (indexRows.length > 0 || skills.some((skill) => skill.reason === projectIndexUnexpected) || pendingFiles.some((item) => item.reason === projectIndexUnexpected));
    return {
      id: layoutMigrationId,
      kitUpdated: kitUpdated.length,
      catalogsReplaced: kitUpdated.filter((item) => legacyPreservedCatalogs.has(item.relativePath)).length,
      pending: [
        ...pendingFiles.map((item) => ({ relativePath: item.relativePath, reason: item.reason, decisions: item.decisions })),
        ...legacyPending,
        ...(waitingForIndex ? [{ relativePath: projectIndexPath, reason: projectIndexUnexpected }] : []),
        ...skills.filter((skill) => !skill.newDirectory).map((skill) => ({ relativePath: `${skill.directory}/`, reason: skill.reason }))
      ],
      notes,
      unwrittenRows,
      retiredDeleted: operations.filter((item) => item.retired && item.operation === 'delete_with_backup').length,
      skillsMoved: moved.length,
      catalogRowsMoved: indexWritable ? indexRows.filter((item) => item.fromCatalog).length : 0,
      projectIndexRows: indexRowsAdded,
      contextMoved: contextMoves.map(({ legacyPath, currentPath }) => ({ from: legacyPath, to: currentPath })),
      seedsReset: operations.filter((item) => item.superseded).map((item) => item.relativePath)
    };
  }

  return {
    plannerFiles,
    seedContents,
    excludedPaths,
    indexWritable,
    // A legacy path never enters the 2.0.0 state, moved or not.
    droppedPaths: Object.keys(manifest.legacy_paths).filter((legacyPath) => Object.hasOwn(previousFiles, legacyPath)),
    shadowFor,
    shadowOperations,
    markUnrecordedKitFiles,
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
