// Project instructions (quality gate, backend, frontend) live in a neutral,
// project-owned location: .agents/project/<name>.md (roadmap D-29). Runtimes
// that load instructions from their own folder get a generated wrapper; today
// that is GitHub Copilot's .github/instructions/<name>.instructions.md, which
// keeps its applyTo so automatic loading by glob is not lost. The quality gate
// wrapper carries the kit default first and the project additions after it.
import fs from 'node:fs/promises';
import path from 'node:path';

export const projectInstructionNames = ['quality-gate', 'backend', 'frontend'];
export const projectInstructionTemplateMarker = '<!-- workflow-kit:project-instructions:template -->';
// Frontmatter used when a project has no Copilot file yet. Layers without a
// default get no generated copy until the project declares its own glob.
const defaultFrontmatter = { 'quality-gate': 'applyTo: "**"' };

export const neutralInstructionPath = (name) => `.agents/project/${name}.md`;
export const copilotWrapperPath = (name) => `.github/instructions/${name}.instructions.md`;
// The kit default quality gate; the project file only adds to it.
export const kitQualityGatePath = '.agents/delegation/quality-gate.md';

const generatedNote = (name) => (name === 'quality-gate'
  ? `<!-- Generated from ${kitQualityGatePath} and ${neutralInstructionPath(name)} by workflow-kit. Edit the project file, not this one. -->`
  : `<!-- Generated from ${neutralInstructionPath(name)} by workflow-kit. Edit that file, not this one. -->`);
const generatedNotePattern = /<!-- Generated from \.agents\/[a-z/-]+\.md( and \.agents\/[a-z/-]+\.md)? by workflow-kit\./;
const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

// The frontmatter is kept verbatim: projects write applyTo as a string or as a
// YAML list, and rewriting it could change which files load the instructions.
export function splitWrapper(content) {
  const match = content.match(frontmatterPattern);
  const frontmatter = match ? match[1] : null;
  const rest = match ? content.slice(match[0].length) : content;
  const generated = generatedNotePattern.test(rest);
  const body = rest.replace(new RegExp(`^\\s*${generatedNotePattern.source}[^\\n]*-->\\n`), '').replace(/^\n+/, '');
  return { frontmatter, body, generated };
}

export function renderCopilotWrapper(name, neutralContent, frontmatter = defaultFrontmatter[name]) {
  return `---\n${frontmatter}\n---\n\n${generatedNote(name)}\n\n${neutralContent.replace(/^\n+/, '')}`;
}

// Body of the generated wrapper: the project file, or for the quality gate the
// kit default followed by the project additions. A template placeholder is no
// content of the project.
export function wrapperBody(name, neutral, kitDefault = null) {
  const own = neutral && !neutral.includes(projectInstructionTemplateMarker) ? neutral : null;
  if (name !== 'quality-gate' || !kitDefault) return own;
  return own ? `${kitDefault.trimEnd()}\n\n${own.replace(/^\n+/, '')}` : kitDefault;
}

async function readOptional(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// State of each project instruction in a target repository:
// - migratedContent: body of a hand-written Copilot wrapper that must become
//   the neutral file because no neutral file exists yet;
// - frontmatter: the Copilot frontmatter (applyTo) to keep on the generated copy;
// - kitDefault: the installed kit default (quality gate only).
export async function inspectProjectInstructions({ targetPath }) {
  const result = {};
  for (const name of projectInstructionNames) {
    const kitDefault = name === 'quality-gate' ? await readOptional(path.join(targetPath, kitQualityGatePath)) : null;
    const neutral = await readOptional(path.join(targetPath, neutralInstructionPath(name)));
    const wrapper = await readOptional(path.join(targetPath, copilotWrapperPath(name)));
    const parsed = wrapper === null ? null : splitWrapper(wrapper);
    result[name] = {
      neutral,
      wrapper,
      frontmatter: parsed?.frontmatter ?? defaultFrontmatter[name] ?? null,
      kitDefault,
      migratedContent: neutral === null && parsed && !parsed.generated && parsed.body.trim().length > 0 ? parsed.body : null
    };
  }
  return result;
}

// Wrapper operations for runtimes that need one. `neutralContents` holds the
// content each neutral file will have after the plan is applied, and
// `kitQualityGate` the kit default quality gate after it.
export function planCopilotWrappers({ targetPath, inspection, neutralContents, kitQualityGate = null, backupMode }) {
  const operations = [];
  for (const name of projectInstructionNames) {
    const body = wrapperBody(name, neutralContents[name], kitQualityGate);
    const state = inspection[name];
    // A template placeholder or a layer without a glob is not worth a wrapper.
    if (!body || !state.frontmatter) continue;
    const content = renderCopilotWrapper(name, body, state.frontmatter);
    const relativePath = copilotWrapperPath(name);
    const base = { relativePath, targetFile: path.join(targetPath, relativePath), sourcePath: null, content };
    if (state.wrapper === null) operations.push({ ...base, operation: 'create' });
    else if (state.wrapper === content) operations.push({ ...base, operation: 'unchanged' });
    else operations.push({ ...base, operation: backupMode === 'none' ? 'overwrite_no_backup' : 'overwrite_with_backup' });
  }
  return operations;
}

function warning(code, relativePath, message) {
  return { code, path: relativePath, message, severity: 'warning' };
}

export async function projectInstructionDiagnostics({ targetPath, runtimes = [] }) {
  const diagnostics = [];
  const inspection = await inspectProjectInstructions({ targetPath });
  for (const name of projectInstructionNames) {
    const state = inspection[name];
    if (state.migratedContent !== null) {
      diagnostics.push(warning('project-instructions/not-migrated', copilotWrapperPath(name), `Project rules still live only in the Copilot folder, so other runtimes skip them. Run workflow-kit update to copy them to ${neutralInstructionPath(name)} and regenerate this file from it.`));
      continue;
    }
    const expected = wrapperBody(name, state.neutral, state.kitDefault);
    if (expected !== null && state.wrapper !== null && runtimes.includes('copilot')) {
      const parsed = splitWrapper(state.wrapper);
      if (parsed.generated && parsed.body.trim() !== expected.trim()) {
        diagnostics.push(warning('project-instructions/wrapper-stale', copilotWrapperPath(name), `Differs from ${neutralInstructionPath(name)}. Run workflow-kit update to regenerate it; edit the neutral file, never the wrapper.`));
      }
    }
  }
  if (inspection['quality-gate'].neutral === null && inspection['quality-gate'].migratedContent === null) {
    diagnostics.push(warning('project-instructions/quality-gate-missing', neutralInstructionPath('quality-gate'), 'No quality gate is configured. Code-writing work reports "quality gate: no configurado" and N3 work stops until it exists. Run workflow-kit update to restore the default gate.'));
  }
  return diagnostics;
}
