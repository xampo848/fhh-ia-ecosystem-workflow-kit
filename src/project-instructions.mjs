// Project instructions (quality gate, backend, frontend) live in a neutral,
// project-owned location: .agents/project/<name>.md (roadmap D-29). Runtimes
// that load instructions from their own folder get a generated wrapper; today
// that is GitHub Copilot's .github/instructions/<name>.instructions.md, which
// keeps its applyTo so automatic loading by glob is not lost.
import fs from 'node:fs/promises';
import path from 'node:path';

export const projectInstructionNames = ['quality-gate', 'backend', 'frontend'];
export const projectInstructionTemplateMarker = '<!-- workflow-kit:project-instructions:template -->';
// Frontmatter used when a project has no Copilot file yet. Layers without a
// default get no generated copy until the project declares its own glob.
const defaultFrontmatter = { 'quality-gate': 'applyTo: "**"' };

export const neutralInstructionPath = (name) => `.agents/project/${name}.md`;
export const copilotWrapperPath = (name) => `.github/instructions/${name}.instructions.md`;

const generatedNote = (name) => `<!-- Generated from ${neutralInstructionPath(name)} by workflow-kit. Edit that file, not this one. -->`;
const frontmatterPattern = /^---\n([\s\S]*?)\n---\n/;

// The frontmatter is kept verbatim: projects write applyTo as a string or as a
// YAML list, and rewriting it could change which files load the instructions.
export function splitWrapper(content) {
  const match = content.match(frontmatterPattern);
  const frontmatter = match ? match[1] : null;
  const rest = match ? content.slice(match[0].length) : content;
  const generated = /<!-- Generated from \.agents\/project\/[a-z-]+\.md by workflow-kit\./.test(rest);
  const body = rest.replace(/^\s*<!-- Generated from \.agents\/project\/[a-z-]+\.md by workflow-kit\.[^\n]*-->\n/, '').replace(/^\n+/, '');
  return { frontmatter, body, generated };
}

export function renderCopilotWrapper(name, neutralContent, frontmatter = defaultFrontmatter[name]) {
  return `---\n${frontmatter}\n---\n\n${generatedNote(name)}\n\n${neutralContent.replace(/^\n+/, '')}`;
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
// - frontmatter: the Copilot frontmatter (applyTo) to keep on the generated copy.
export async function inspectProjectInstructions({ targetPath }) {
  const result = {};
  for (const name of projectInstructionNames) {
    const neutral = await readOptional(path.join(targetPath, neutralInstructionPath(name)));
    const wrapper = await readOptional(path.join(targetPath, copilotWrapperPath(name)));
    const parsed = wrapper === null ? null : splitWrapper(wrapper);
    result[name] = {
      neutral,
      wrapper,
      frontmatter: parsed?.frontmatter ?? defaultFrontmatter[name] ?? null,
      migratedContent: neutral === null && parsed && !parsed.generated && parsed.body.trim().length > 0 ? parsed.body : null
    };
  }
  return result;
}

// Wrapper operations for runtimes that need one. `neutralContents` holds the
// content each neutral file will have after the plan is applied.
export function planCopilotWrappers({ targetPath, inspection, neutralContents, backupMode }) {
  const operations = [];
  for (const name of projectInstructionNames) {
    const neutral = neutralContents[name];
    const state = inspection[name];
    // A template placeholder or a layer without a glob is not worth a wrapper.
    if (!neutral || neutral.includes(projectInstructionTemplateMarker) || !state.frontmatter) continue;
    const content = renderCopilotWrapper(name, neutral, state.frontmatter);
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
    if (state.neutral !== null && state.wrapper !== null && runtimes.includes('copilot')) {
      const parsed = splitWrapper(state.wrapper);
      if (parsed.generated && parsed.body.trim() !== state.neutral.trim()) {
        diagnostics.push(warning('project-instructions/wrapper-stale', copilotWrapperPath(name), `Differs from ${neutralInstructionPath(name)}. Run workflow-kit update to regenerate it; edit the neutral file, never the wrapper.`));
      }
    }
  }
  if (inspection['quality-gate'].neutral === null && inspection['quality-gate'].migratedContent === null) {
    diagnostics.push(warning('project-instructions/quality-gate-missing', neutralInstructionPath('quality-gate'), 'No quality gate is configured. Code-writing work reports "quality gate: no configurado" and N3 work stops until it exists. Run workflow-kit update to restore the default gate.'));
  }
  return diagnostics;
}
