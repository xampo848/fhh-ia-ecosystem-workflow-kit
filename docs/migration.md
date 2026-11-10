# Migration Guide

Use this guide when moving from manual `.agents` copying to installer-managed templates.

## From manual copy to dry-run planning

1. Keep your current `.agents` files in place.
2. Run `workflow-kit init` without `--apply`.
3. Review `unchanged`, `create`, and `overwrite_with_backup` operations.
4. Merge local customizations before applying.

## Preserving local rules

Local domain rules belong in the full workflow package. Keep runtime-specific instructions inside thin runtime adapters.

Recommended structure:

```text
.agents/instructions.md                  # neutral workflow source of truth
.agents/skills/registry.md               # skill discovery
.agents/skills/06-patterns/README.md     # local pattern-skill entrypoint
.agents/capabilities/registry.md         # local capability state
```

Default migration behavior installs the complete FHH IA Ecosystem `.agents2`-derived workflow so the target repository receives a ready-to-use flow instead of placeholders.

## Runtime adapters

Adapters should remain thin. If you already have `AGENTS.md`,
`.github/copilot-instructions.md`, `CLAUDE.md`, or `ANTIGRAVITY.md`, merge them
so they point to `.agents/instructions.md` instead of duplicating workflow
logic.

Older adapters often routed only at session startup. The current contract
requires lightweight intake on every prompt through the generated level
pre-filter (N0–N3): explicit skills win, N0 requests are handled without
loading workflow files, N1 surgical changes ask for a short yes, and N2/N3
freeform work loads `workflow-router`. If you customized an adapter, keep the
`workflow-kit:level-prefilter` markers so updates can refresh the block. Run `doctor` after migration to find missing semantic rules,
not only missing files.

## Rollback

The installer does not delete files. For overwritten conflicts, use the `.workflow-kit-backup-<timestamp>` file created during apply.

## Upgrading safely after migration

`workflow-kit update` uses `.agents/workflow-kit/install-state.json` to decide which files are managed.

Behavior on update:

1. Managed and unchanged-from-last-apply files can be updated.
2. Managed but locally edited files are preserved as `skip_modified`.
3. Unmanaged files at colliding paths are preserved as `skip_unmanaged`.

Cheaper preparation (since `0.12.0`): the update creates
`.agents/project-context.md` as a template when it is missing and never
overwrites it afterwards; fill it in with an initial Discovery (`doctor`
reports `project-context/not-initialized` until then). Delegates now read
`.agents/delegation/delegate-contract.md` instead of `.agents/instructions.md`,
and the generated agent adapters embed its summary. At N3,
`prd-readiness-review` builds a PRD index that later stages use instead of
rereading the PRD.

AI workspace (since `0.11.0`): temporary coordination state moved from
`<prd-directory>/_meta/` to a single Git-ignored `.ai-work/<prd-slug>/` at the
repository root. `update` appends `.ai-work/` to `.gitignore` (with a backup)
and never takes ownership of that file. In-flight PRDs keep working: the
legacy `_meta/` directory is read as a fallback, and `doctor` lists it as
`workspace/legacy-meta` so you can delete it after closure. Execution now has
brakes at every level: at most 2 repair rounds per slice, one recovery attempt
for an environment failure, one rerun for a flaky test.

Implementation route (since `0.10.0`): `implement-change` is the general
route for PRDs, bugs, tickets, and iterations; `implement-prd` stays as a
permanent alias, so "implementa este PRD" and existing references keep working.
The update rewrites `implement-prd/SKILL.md` as a short alias and adds
`implement-change/`; the shared references stay under `implement-prd/reference/`.
Former operating modes map to levels: `small/local` → N1, `controlled-lite` and
`controlled-implementation` → N2, `standard` → N3; `autonomous-safe` and
`resume` are now modifiers. No files are moved or deleted.

Model profiles (since `0.9.0`): repositories installed before model profiles
have no stored profile, so the first `update` applies the runtime default.
For Claude Code that changes the delegate agents from `model: inherit` to
`sonnet`/`opus` (`calidad`). If that project runs Claude Code or Codex through a
per-token API key, pass `--profile claude=costo` (or `codex=costo`) on that
update. The profile is then stored and kept by later updates.

If your repo was installed before install-state support, run a one-time bootstrap:

```bash
workflow-kit update --target /path/to/repo --runtime codex,copilot --adopt-existing --apply --yes
```

This records the current baseline and avoids immediate overwrites.
