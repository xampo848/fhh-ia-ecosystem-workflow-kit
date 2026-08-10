export const runtimeTemplatePaths = {
  codex: ['runtime-adapters/agents-md', 'runtime-adapters/codex'],
  copilot: ['runtime-adapters/agents-md', 'runtime-adapters/copilot'],
  claude: ['runtime-adapters/claude'],
  antigravity: ['runtime-adapters/antigravity']
};

export const runtimeEntrypoints = {
  codex: ['AGENTS.md', '.codex/README.md'],
  copilot: ['AGENTS.md', '.github/copilot-instructions.md', '.github/instructions/ai-workflow.instructions.md'],
  claude: ['CLAUDE.md'],
  antigravity: ['ANTIGRAVITY.md']
};

export const supportedRuntimes = Object.freeze(Object.keys(runtimeTemplatePaths));

export function isSupportedRuntime(runtime) {
  return supportedRuntimes.includes(runtime);
}
