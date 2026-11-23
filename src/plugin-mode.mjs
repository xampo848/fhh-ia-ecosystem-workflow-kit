// Plugin mode (PRD 4 of the kit-project-overlay epic): the workflow kit runs as
// the plugin `fhh` of the marketplace `fhh-ia-ecosystem`, published as the
// content of the branch `plugin` of the kit repository. This module is the
// single source of that identity and of the path rule every plugin text uses
// verbatim (the `kit-root` skill, the plugin agents and, later, the adapter
// block of a repository in plugin mode).

export const pluginName = 'fhh';
export const marketplaceName = 'fhh-ia-ecosystem';
export const pluginBranch = 'plugin';

// PRD 2.2. The plugin ships only the `kit` and `derived` files of the kit
// manifest, so anything else a kit file names is not under the kit root and
// resolves in the repository.
export const pluginPathRule = 'Path rule: a path that a kit file names is read under the kit root when that file exists there; when it does not exist there, it resolves in the repository. So `.agents/project/**`, the install state, the diagnostics, the apply journal, the seeds, `.ai-work/**` and the project\'s own files always resolve in the repository: the plugin ships none of them. Never write under the kit root.';
