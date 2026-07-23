import fs from 'node:fs/promises';
import path from 'node:path';
import { diagnostic } from './diagnostics.mjs';

const runtimeEntrypoints = {
  codex: ['AGENTS.md'],
  copilot: ['AGENTS.md', '.github/copilot-instructions.md', '.github/instructions/ai-workflow.instructions.md'],
  claude: ['CLAUDE.md'],
  antigravity: ['ANTIGRAVITY.md']
};

async function read(root, relativePath) {
  try {
    return await fs.readFile(path.join(root, relativePath), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function validateAdapterContracts({ root, runtimes = [] }) {
  const diagnostics = [];

  for (const runtime of runtimes.filter((item) => item !== 'neutral')) {
    for (const relativePath of runtimeEntrypoints[runtime] ?? []) {
      const content = await read(root, relativePath);
      if (content === null) continue;
      if (!content.includes('.agents/instructions.md')) {
        diagnostics.push(diagnostic({
          code: 'adapter/missing-neutral-reference',
          path: relativePath,
          message: 'Expected a reference to .agents/instructions.md.'
        }));
      }
      if (!/every new user prompt/i.test(content)) {
        diagnostics.push(diagnostic({
          code: 'adapter/missing-turn-intake',
          path: relativePath,
          message: 'Expected an explicit per-turn intake bootstrap.'
        }));
      }
    }
  }

  if (runtimes.includes('copilot')) {
    const relativePath = '.github/instructions/ai-workflow.instructions.md';
    const content = await read(root, relativePath);
    if (content !== null && !/^---\napplyTo: "\*\*"\n---\n/.test(content)) {
      diagnostics.push(diagnostic({
        code: 'copilot/missing-apply-to',
        path: relativePath,
        message: 'Expected applyTo: "**" front matter.'
      }));
    }
  }

  return diagnostics;
}
