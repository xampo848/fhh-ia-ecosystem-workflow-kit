// Makes an install or update plan reviewable before anything is written
// (roadmap D-33): which structural migrations it carries and, on request, the
// line diff of every file it would change.
import fs from 'node:fs/promises';
import { neutralInstructionPath, projectInstructionNames } from './project-instructions.mjs';

// Migrations are derived from the plan itself, so they are idempotent: once a
// repository is migrated the plan no longer contains the operation.
export function describeMigrations({ operations, existingState, modelProfiles = {}, requestedProfiles = {}, stackPack, stackRequested, migratedInstructions = {} }) {
  const migrations = [];
  const has = (relativePath, kinds) => operations.some((item) => item.relativePath === relativePath && kinds.includes(item.operation));
  const writes = ['create', 'merge_with_backup', 'merge_no_backup', 'overwrite_with_backup', 'overwrite_no_backup'];

  if (has('.gitignore', writes)) {
    migrations.push({ id: '0.11.0-ai-workspace', summary: 'Add .ai-work/ (temporary AI state) to .gitignore.' });
  }
  const defaultedRuntimes = existingState
    ? Object.keys(modelProfiles).filter((runtime) => !existingState.modelProfiles?.[runtime] && !requestedProfiles[runtime])
    : [];
  if (defaultedRuntimes.length > 0) {
    migrations.push({
      id: '0.9.0-model-profiles',
      summary: `Delegate agents get models from a profile: ${defaultedRuntimes.map((runtime) => `${runtime}=${modelProfiles[runtime]}`).join(', ')}. For per-token API billing rerun with --profile <runtime>=costo.`
    });
  }
  const migratedNames = projectInstructionNames.filter((name) => neutralInstructionPath(name) in migratedInstructions);
  if (migratedNames.length > 0) {
    migrations.push({
      id: '0.15.0-neutral-project-instructions',
      summary: `Copy hand-written Copilot instructions (${migratedNames.join(', ')}) to .agents/project/ and regenerate the Copilot files from them; backups are kept.`
    });
  }
  if (stackPack && stackPack !== 'none' && !stackRequested && existingState && existingState.stackPack === undefined && has('.agents/project/stack.md', ['create'])) {
    migrations.push({
      id: '0.15.0-stack-pack',
      summary: `Install the ${stackPack} stack pack as .agents/project/stack.md so the stack rules that left the skills are kept. Use --stack none to skip.`
    });
  }
  return migrations;
}

// Longest-common-subsequence line diff, printed as changed hunks with context.
export function lineDiff(before, after, { context = 2, maxLines = 60 } = {}) {
  const a = before.split('\n');
  const b = after.split('\n');
  const rows = a.length + 1;
  const columns = b.length + 1;
  const table = new Uint32Array(rows * columns);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * columns + j] = a[i] === b[j]
        ? table[(i + 1) * columns + j + 1] + 1
        : Math.max(table[(i + 1) * columns + j], table[i * columns + j + 1]);
    }
  }
  const entries = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { entries.push({ mark: ' ', text: a[i] }); i += 1; j += 1; }
    else if (table[(i + 1) * columns + j] >= table[i * columns + j + 1]) { entries.push({ mark: '-', text: a[i] }); i += 1; }
    else { entries.push({ mark: '+', text: b[j] }); j += 1; }
  }
  while (i < a.length) { entries.push({ mark: '-', text: a[i] }); i += 1; }
  while (j < b.length) { entries.push({ mark: '+', text: b[j] }); j += 1; }

  const keep = new Set();
  entries.forEach((entry, index) => {
    if (entry.mark === ' ') return;
    for (let k = Math.max(0, index - context); k <= Math.min(entries.length - 1, index + context); k += 1) keep.add(k);
  });
  const lines = [];
  let previous = -2;
  for (const index of [...keep].sort((x, y) => x - y)) {
    if (index !== previous + 1 && lines.length > 0) lines.push('  ...');
    lines.push(`${entries[index].mark} ${entries[index].text}`);
    previous = index;
  }
  const added = entries.filter((entry) => entry.mark === '+').length;
  const removed = entries.filter((entry) => entry.mark === '-').length;
  const truncated = lines.length > maxLines;
  return { added, removed, lines: truncated ? [...lines.slice(0, maxLines), `  ... (${lines.length - maxLines} more diff lines)`] : lines };
}

const diffOperations = new Set(['merge_with_backup', 'merge_no_backup', 'overwrite_with_backup', 'overwrite_no_backup', 'skip_modified']);

// Diff of every file the plan would change. skip_modified shows what the
// update would bring, so a protected local edit can be merged by hand.
export async function renderPlanDiffs(plan, { maxLines = 60 } = {}) {
  const sections = [];
  for (const item of plan.operations) {
    if (!diffOperations.has(item.operation)) continue;
    let current;
    try {
      current = await fs.readFile(item.targetFile, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    const diff = lineDiff(current, item.content, { maxLines });
    if (diff.added === 0 && diff.removed === 0) continue;
    sections.push(`--- ${item.operation}: ${item.relativePath} (+${diff.added} -${diff.removed})\n${diff.lines.join('\n')}`);
  }
  return sections.length > 0 ? sections.join('\n\n') : 'No content differences to show.';
}
