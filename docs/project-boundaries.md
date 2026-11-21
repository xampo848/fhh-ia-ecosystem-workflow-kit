# Project Boundaries

This repository is the standalone distribution of a portable AI workflow kit: a public, GitHub-installable CLI and TUI.

When the kit is installed in a repository, every file there belongs either to
the kit or to the project. The AI-facing contract is
[`.agents/kit-boundary.md`](../.agents/kit-boundary.md); the machine-readable
list is [`.agents/workflow-kit/manifest.json`](../.agents/workflow-kit/manifest.json).

## Kit paths

A path belongs to the kit only when an entry of the manifest covers it. Each
entry has a class:

| Class | Who owns the content | Examples |
| --- | --- | --- |
| `kit` | The kit, the whole file | `.agents/instructions.md`, `.agents/skills/**`, `docs/workflow/**` |
| `derived` | The kit, generated from its sources | skill catalogs, `.claude/skills/**`, rendered delegate agents |
| `adapter` | The kit owns only the block between `<!-- workflow-kit:managed:start -->` and `<!-- workflow-kit:managed:end -->`; the rest is the project's | `CLAUDE.md`, `AGENTS.md`, `ANTIGRAVITY.md`, Copilot instructions |
| `seed` | Created once by the kit, then the project's | `.agents/project/backend.md`, `.agents/project/quality-gate.md` |
| `state` | The `workflow-kit` CLI | `.agents/workflow-kit/install-state.json` |

The portable core is the set of `kit` and `derived` paths. It must not include
product-specific backend or frontend rules.

## Project overlay

Everything under `.agents/project/` belongs to the project:

- `index.md`: the project catalog (project skills, extensions, shadows);
- `routing.md`: project routing rules;
- `skills/<name>/SKILL.md`: project pattern skills;
- `extensions/` and `shadows/`: changes to kit skills (see
  [Extending the workflow](extending-the-workflow.md));
- `context.md`, `backend.md`, `frontend.md`, `stack.md`, `quality-gate.md`,
  `paths.json`: project knowledge, layer and stack rules, and quality-gate
  additions.

A missing overlay file means an empty overlay: a repository installed with an
earlier version keeps working without any of these files. Until the updater
migrates it, the project context may still live at `.agents/project-context.md`;
the kit reads that path when `.agents/project/context.md` does not exist.

The installer may generate starter placeholders (`seed`), but it must not
pretend FHH IA Ecosystem overlay rules are universal.

### Kit defaults and project additions

When the kit ships a default that a project may tighten, the default lives in a
kit file and the project file holds only additions. The quality gate works this
way: the kit default is `.agents/delegation/quality-gate.md` and receives kit
fixes; `.agents/project/quality-gate.md` holds the project's extra rules, which
may tighten the default but never relax it. The stack rules (`stack.md`) will
follow the same pattern once the updater supports it.

### This repository's own overlay

This repository is the kit's source, so its `.agents/` tree is the kit itself.
Only the paths the manifest lists are distributed. Under `.agents/project/`
the template may ship only `seed` files; any other file there is this
repository's own overlay and is never copied to a target repository.

## Runtime adapters

Runtime adapters are thin entrypoints for tools such as Codex, GitHub Copilot, Claude Code, or future runtimes. They should point back to neutral `.agents/**` files and avoid duplicating workflow logic. The kit owns only their `workflow-kit:managed` block; a project adds its own notes below the end marker.

## Checks

`npm run check:workflow` runs `scripts/validate-kit-boundary.mjs`, which fails
when an installable file has no manifest class, an adapter loses its managed
block or drifts from its template, a path reference breaks the rules in
`.agents/kit-boundary.md`, or the template ships project files.

## What the tool does today

The CLI and TUI install (`init`), update (`update`), export (`export`), check
(`doctor`), and undo the last applied run (`rollback`) in a target repository,
always dry-run first, with backups before every overwrite or merge and a
recorded install state. They never publish packages or create repositories;
releases stay approval-gated (see `RELEASE.md`). The updater does not read the
manifest yet: until it does, it keeps its current per-file rules, and an edited
kit file is skipped rather than overwritten.
