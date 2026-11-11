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

Reviewing an update (since `0.16.0`): the plan lists its one-time migrations
under "Migrations", and `workflow-kit update --target <repo> --diff` prints the
line diff of every file that would change, including managed files you edited
(`skip_modified`), so you can merge them by hand. Updates never delete or move
files; a second update right after is a no-op. The full version history is in
`CHANGELOG.md`.

Neutral structure (since `0.15.0`):

- **Project instructions moved to a neutral place.** The quality gate and the
  backend and frontend instructions now live in `.agents/project/`
  (`quality-gate.md`, `backend.md`, `frontend.md`), so every runtime applies
  them, not only Copilot. If your repository has hand-written
  `.github/instructions/backend.instructions.md` or `frontend.instructions.md`,
  `update` copies their content to the neutral file and regenerates the Copilot
  file from it, keeping your `applyTo` glob and leaving a backup. From then on
  edit the neutral file; `doctor` reports `project-instructions/wrapper-stale`
  when the generated copy is out of date.
- **Stack rules left the skills.** Rails and React rules (Minitest, Bullet,
  MSW, TanStack Query, `make` and `bun run` commands) are now a stack pack.
  A repository installed before this version gets
  `.agents/project/stack.md` from the `rails-react` pack on its next `update`,
  so it keeps the same rules. Use `--stack none` to opt out; new installs get
  no pack unless you pass `--stack rails-react`. The file is yours afterwards.
- **Skills are split.** No own skill file passes 200 lines; long sections moved
  to `reference/` files that state when to read them. Nothing is deleted from
  your repository: old files are rewritten and new ones added.
- **Claude Code** gets `.claude/skills/` wrappers so workflow skills work as
  slash commands; they never start on their own.
- **OpenCode** is accepted as a runtime (`--runtime opencode`) through the
  shared `AGENTS.md`.

PRD and PR quality (since `0.14.0`): new PRDs carry two more sections,
`2.8 Supuestos e integraciones` and `2.9 Que queda obsoleto`; existing PRDs
stay valid without them. `create-prd` asks edge cases by confirmation, limits
question rounds, and measures size signals before declaring a PRD ready.
`solution-sketch` offers optional UI paths (including "use the team's design")
with HTML mockups under `docs/design/<slug>-mockups/`. `pr-comments-resolution`
now evaluates every comment before offering options and asks for approval of
each reply text.

Validation reuse and incremental QA (since `0.13.0`): expensive deterministic
checks (package typecheck, unit suites, build) can reuse a previous result
when `validation-fingerprint.mjs` proves the content is identical. Reuse starts
in **shadow mode**: checks still run and only report what would have been
reused. Switch a project to active reuse with `validation_reuse: active` in
`.agents/project-context.md` after 2 or 3 clean implementations. QA re-entries
are focused on the repair and its impact radius; the first QA and the closure
suite stay complete.

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
