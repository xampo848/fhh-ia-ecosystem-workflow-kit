# Documentation Hub

This directory hosts project documentation and AI workflow artifacts.

## Install modes

The kit installs in repo mode (all runtimes; the kit files are committed) or in
plugin mode (pilot; Claude Code and GitHub Copilot, the kit runs as the plugin
`fhh`). See [Quickstart, plugin mode](quickstart.md#11-plugin-mode-pilot),
[GitHub install](github-install.md) and the
[capability matrix](workflow/cross-runtime-capability-matrix.md#plugin-mode).
A plugin-mode install writes no `docs/` files. A repository that switched from
repo mode to plugin mode keeps the kit's docs-workflow block in its own
`docs/README.md`, and the links in that block resolve under the kit root (the
plugin folder).

<!-- workflow-kit:docs-workflow:start -->
## Workflow Documentation (workflow-kit)

Use this section to keep workflow artifacts discoverable without mixing them with product docs.

- `docs/workflow/README.md`: operating map, naming, and contribution rules for workflow docs.
- `docs/workflow/decisions/`: architecture and workflow decisions captured over time.
- `docs/workflow/runbooks/`: practical runbooks used during implementation and maintenance.
- `docs/workflow/handoffs/`: handoff notes between product, engineering, and QA.
- `docs/workflow/standards/`: setup guides for the project's backend and frontend rules (the rules themselves live in `.agents/project/`).
- `docs/workflow/migration/legacy-docs-map.md`: one-time map generated during init when legacy docs are detected.

Suggested naming convention:

- Decisions: `YYYY-MM-DD-short-topic.md`
- Runbooks: `verb-object.md` (example: `update-skill-registry.md`)
- Handoffs: `ticket-or-prd-id.md`
<!-- workflow-kit:docs-workflow:end -->
