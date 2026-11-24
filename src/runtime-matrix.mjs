export const runtimeTemplatePaths = {
  codex: ['runtime-adapters/agents-md', 'runtime-adapters/codex'],
  copilot: ['runtime-adapters/agents-md', 'runtime-adapters/copilot'],
  claude: ['runtime-adapters/claude'],
  antigravity: ['runtime-adapters/antigravity'],
  // OpenCode reads the shared AGENTS.md bootstrap; it has no generated agents yet.
  opencode: ['runtime-adapters/agents-md']
};

export const runtimeEntrypoints = {
  codex: ['AGENTS.md', '.codex/README.md'],
  copilot: ['AGENTS.md', '.github/copilot-instructions.md', '.github/instructions/ai-workflow.instructions.md'],
  claude: ['CLAUDE.md'],
  antigravity: ['ANTIGRAVITY.md'],
  opencode: ['AGENTS.md']
};

export const supportedRuntimes = Object.freeze(Object.keys(runtimeTemplatePaths));

export function isSupportedRuntime(runtime) {
  return supportedRuntimes.includes(runtime);
}

// Plugin mode (PRD plugin-mode-pilot 2.3): the runtimes that can load the kit
// as a plugin, and the settings file where a repository declares it.
export const pluginRuntimes = Object.freeze(['claude', 'copilot']);

export const pluginSettingsPaths = Object.freeze({
  claude: '.claude/settings.json',
  copilot: '.github/copilot/settings.json'
});
