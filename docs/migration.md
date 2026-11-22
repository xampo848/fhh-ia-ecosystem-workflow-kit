# Migration Guide

Use this guide when moving from manual `.agents` copying to installer-managed templates.

## From manual copy to dry-run planning

1. Keep your current `.agents` files in place.
2. Run `workflow-kit init` without `--apply`.
3. Review `unchanged`, `create`, and `overwrite_with_backup` operations.
4. Merge local customizations before applying.

## Preserving local rules

The full workflow package is the kit, and its files are replaceable; your own
rules live in the project overlay `.agents/project/`, which no update edits. Keep runtime-specific instructions
inside thin runtime adapters, outside their `workflow-kit:managed` block.

Recommended structure:

```text
.agents/instructions.md                  # kit: neutral workflow source of truth
.agents/project/index.md                 # project catalog: own skills, extensions, shadows
.agents/project/skills/<name>/SKILL.md   # own skills (patterns, runbooks)
.agents/project/routing.md               # project routing rules
.agents/project/context.md               # project knowledge base
.agents/capabilities/registry.md         # local capability state
```

See `.agents/kit-boundary.md` for the extension levels (add, extend, shadow).

Default migration behavior installs the complete FHH IA Ecosystem workflow (the full `.agents` overlay shipped in `templates/repo-overlay-fhh-ia-ecosystem-full`) so the target repository receives a ready-to-use flow instead of placeholders.

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

Undo the last applied `init` or `update` with:

```bash
workflow-kit rollback --target /path/to/repo --dry-run
workflow-kit rollback --target /path/to/repo --apply --yes
```

It restores the files that run changed from their backups, removes the files
that run created, and restores the previous install state. As a fallback, you
can restore any file by hand from the `.workflow-kit-backup-<timestamp>` file
created during apply (files written with `--backup-mode none` have none).

Without the journal (`.agents/workflow-kit/last-apply.json`), `rollback`
restores the newest backup of each managed file instead. It cannot tell which
files changed after that backup, so it first keeps the current content of
each file it replaces as a new `.workflow-kit-backup-<timestamp>` file.
Created files and the install state stay as they are.

## Upgrading safely after migration

`workflow-kit update` uses `.agents/workflow-kit/install-state.json` to decide which files are managed.

Behavior on update (since `0.22.0`, by the class each path has in
`.agents/workflow-kit/manifest.json`; the contract is `.agents/kit-boundary.md`):

1. Kit and derived files are replaced when they still match what the last
   apply wrote; an edited one stays pending (`skip_modified`) until you decide
   it with `--edited`.
2. Adapters (`CLAUDE.md`, `AGENTS.md`, `ANTIGRAVITY.md`, the Copilot
   instructions, the block of `docs/README.md`) get only their
   `workflow-kit:managed` block regenerated; your text outside the markers is
   never changed.
3. Seeds (for example `.agents/project/context.md`) are created once; after
   that they are project files and `update` never writes them again.
4. Nothing under `.agents/project/` is changed, moved or deleted, except by
   the one-time layout migration below.
5. A kit file that no runtime of the new version ships is deleted when you did
   not edit it, always with a backup next to it; an edited one stays and
   `doctor` lists it.
6. Unmanaged files at colliding paths are preserved as `skip_unmanaged`.

No write replaces content without a backup unless that content matches the
hash the kit recorded for it, whatever `--backup-mode` says.

## Kit and project overlay layout (since 0.22.0)

Repositories installed before `0.22.0` have `install-state.json` with
`schemaVersion` `1.0.0`. Their first `workflow-kit update` migrates them once
to the layout where the kit is replaceable and the project's own content lives
in `.agents/project/`. Always look at the dry run first:

```bash
workflow-kit update --target /path/to/repo
workflow-kit update --target /path/to/repo --diff
```

The plan shows the migration `0.22.0-kit-overlay-layout` with what it does:

| Group | What happens |
| --- | --- |
| Own skills under `.agents/skills/` | Each folder moves to `.agents/project/skills/<name>/` (file modes kept) and gets a row in `.agents/project/index.md` |
| Own rows of the skill catalogs | Move to `.agents/project/index.md` with your trigger and cost; a moved skill is written as `Pattern`, any other row keeps `Pattern` or `Runbook` (other classes become `Pattern`, with a note) |
| Skill catalogs | Replaced by the kit version, with a backup, after their own rows moved |
| `.agents/project-context.md` | Moves to `.agents/project/context.md` when the new path does not exist; no template is created next to it |
| Quality gate | An unedited 0.18 or 0.19 default in `.agents/project/quality-gate.md` becomes the project-additions stub (the kit default now lives in `.agents/delegation/quality-gate.md`) |
| Retired kit files | Deleted when unedited, with a backup |
| Edited kit files and unmarked adapters | Pending until you decide (below) |

Every write of the migration keeps a backup, also with `--backup-mode none`,
and the whole migration is one block: a partial selection in the TUI cannot
leave half of it out. Apply it with:

```bash
workflow-kit update --target /path/to/repo --apply --yes
```

A second `update` right after writes nothing. To undo it:

```bash
workflow-kit rollback --target /path/to/repo --apply --yes
```

Rollback restores every moved, deleted or overwritten file and the `1.0.0`
install state, byte for byte. It undoes only the last apply: if you decide
pending files in a second apply, rolling back undoes that decision, and the
migration itself can then only be undone by hand from its
`.workflow-kit-backup-*` files. Decide pending files in the same apply as the
migration when you may want to roll back.

Things the migration does not do:

- **`init` does not migrate.** `init` over a `1.0.0` install stops and asks you
  to run `update`.
- **An unfinished apply blocks the next one.** If an apply stops halfway (a
  permission error, a full disk), `init` and `update` stop with "The last
  workflow-kit apply did not finish" until you run `workflow-kit rollback
  --apply --yes`, so the journal of that apply is never overwritten.
- **Empty folders are not recreated.** An empty folder inside an own skill
  stays in the old place (Git does not track empty folders); the plan names it.
- **Some items stay pending** and `doctor` lists each with what to do: an own
  skill with a symbolic link, with a name that collides with a kit skill or
  another project skill (letter case ignored), with an invalid name, mixed
  with kit files or with a file that is not UTF-8 text; a legacy context that
  is not UTF-8 or is a folder; a kit file the old state never recorded.
- **An index the migration cannot extend stops it.** When
  `.agents/project/index.md` already exists and its `## Skills` or
  `## Shadows` table does not have the header from `.agents/kit-boundary.md`
  (or sits inside a code block), and the migration has own catalog rows to
  move or a shadow candidate, `update` stops before writing anything. Fix the
  table header and run `update` again; the kit catalogs are only replaced
  together with the index that takes their own rows.

### Deciding edited files

Each pending file lists its valid decisions in the dry run:

```text
- pending .agents/instructions.md (edited_kit_file): keep | discard
- pending .agents/skills/<group>/<skill>/SKILL.md (edited_kit_file): keep | discard | shadow
- pending CLAUDE.md (unmarked_adapter): keep | discard | split
```

| Decision | Effect |
| --- | --- |
| `keep` (default) | The file stays as it is and stays pending |
| `discard` | The kit version replaces it; your version stays in the backup |
| `shadow` | Only while migrating, and only for a leaf skill that is not `workflow-router` or `instructions`: your version moves to `.agents/project/shadows/<skill>/` with a `shadow.json` (base hash and kit version) and a row in the `Shadows` table; the kit file takes the new version. `doctor` warns when the kit skill changes later |
| `split` | Only for an adapter without markers whose kit text appears unchanged inside it: the new block goes where the template puts it and your own text stays byte for byte outside the markers. An adapter with Windows (CRLF) line endings never qualifies; choose `keep` or `discard` |

```bash
workflow-kit update --target /path/to/repo --edited .agents/instructions.md=discard --edited CLAUDE.md=split --apply --yes
workflow-kit update --target /path/to/repo --edited all=discard --apply --yes
```

A decision that does not apply to a file exits with code 2 before anything is
written. `--edited all=<decision>` applies where it is valid and is a no-op
when nothing is pending. The TUI offers the same three ways: keep my edits,
replace all with the kit version, or decide file by file.

Reviewing an update (since `0.16.0`): the plan lists its one-time migrations
under "Migrations", and `workflow-kit update --target <repo> --diff` prints the
line diff of every file that would change, including managed files you edited
(`skip_modified`), so you can merge them by hand. Until `0.22.0` updates never
deleted or moved files; since then they delete unedited retired kit files and,
once, migrate the layout (above), always with backups. A second update right
after is a no-op. The full version history is in
`CHANGELOG.md`.

After an update (since `0.16.1`): if you copy the new version of a protected
file over your edited one, the next `update` reports it as `unchanged` and
stops protecting it. Between `0.17.2` and `0.21.x`, `update` added the rows of
newly shipped skills to project-kept skill catalogs; since `0.22.0` the
catalogs belong to the kit and project rows live in `.agents/project/index.md`.
It also adds `.agents/workflow-kit/last-apply.json`
to `.gitignore`. The steps that belong to each project
are listed in the README, section "Per-project setup after installing".

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
  `.agents/project/stack.md` from the `rails-react` pack on its next `update`
  only when it looks like Rails + React (a `Gemfile` and `react` in a
  `package.json` at the root or one folder down; since `0.17.1`, before that
  every such repository got it). The interactive TUI asks, with the detected
  stack preselected. Use `--stack none` or `--stack rails-react` to decide
  explicitly; new installs get no pack unless you pass `--stack rails-react`.
  The file is yours afterwards: if an earlier update installed it by mistake,
  run `update --stack none` and delete it.
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
`.agents/project/context.md` (legacy: `.agents/project-context.md`) after 2 or 3 clean implementations. QA re-entries
are focused on the repair and its impact radius; the first QA and the closure
suite stay complete.

Cheaper preparation (since `0.12.0`): the update creates the project context
(`.agents/project/context.md` since `0.22.0`, `.agents/project-context.md`
before) as a template when it is missing and never
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

The `equilibrado` profile (since `0.18.0`) is unknown to older toolkits. Before
downgrading the toolkit or pinning a tag older than `v0.18.0-equilibrado-profile`,
switch back with `--profile claude=calidad` (or `codex=calidad`); otherwise
`update` and `doctor` stop with "No equilibrado tier defined".

If your repo was installed before install-state support, run a one-time bootstrap:

```bash
workflow-kit update --target /path/to/repo --runtime codex,copilot --adopt-existing --apply --yes
```

This records the current baseline and avoids immediate overwrites.
