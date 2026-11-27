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
and folders that run created (a folder you had before stays, even when empty),
and restores the previous install state. As a fallback, you
can restore any file by hand from the `.workflow-kit-backup-<timestamp>` file
created during apply (files written with `--backup-mode none` have none).

Since `0.23.2`, the journal is written before the first write of a run and lists
every file the run is about to touch with the checksum it had before, and it
is marked finished only at the end. A run stopped at any point (an error,
Ctrl-C, `SIGTERM`, or a process killed outright) therefore leaves a journal
that says it did not finish: `init` and `update` stop until you run
`workflow-kit rollback --target <repo> --apply --yes` (the stop prints it with
your absolute `--target`), and rollback undoes exactly that run
(files it never reached stay as they are). Ctrl-C or `SIGTERM` during an apply
lets the file being written finish, then stops (exit code 130 for Ctrl-C, 143
for `SIGTERM`); a second signal stops at once. Rolling back an unfinished run
always clears its journal, even when every file it wrote was already removed
by hand.

A run killed outright between taking its lock and writing its journal leaves no
journal, only the lock (`.agents/workflow-kit/apply.lock`), a temporary file and
the empty folders it created. A rollback killed at its very end, after it
deleted the journal, leaves the lock and the folders. For both, run
`workflow-kit rollback --target <repo> --apply --yes`: the dry run says the run
"was stopped before it finished" and lists each `remove` line (the lock, each
temporary file, each empty folder the run created; a folder that was already
there or holds anything stays). It cleans only that and does not undo any
apply: if an earlier finished apply left its journal, that journal is not
touched, and you run rollback once more to undo that apply on purpose. A
lock held by a live process still stops it, and so does a symbolic link on the
lock path.

Rollback is just as careful: it restores each file through a temporary copy
renamed into place, so a file is never left half-restored; Ctrl-C or
`SIGTERM` stops it between two files; it marks the journal before its first
change, so a rollback stopped at any point (even killed) makes `init` and
`update` stop ("A workflow-kit rollback … did not finish") and `doctor` report
it, and running `rollback --apply --yes` again completes it. Like an apply, a
rollback planned before another run applied stops instead of undoing the
wrong run. The plan
names the run it undoes (`init` or `update`, when, and by which version);
rolling back an `init` removes what it installed. An `install-state.json`
edited after the run is kept as a `-before-rollback` copy before the previous
state comes back, and a file removed by hand after the run is reported as
removed and left as it is.

Without the journal (`.agents/workflow-kit/last-apply.json`), `rollback` has
no applied run to undo and restores nothing: it lists the backup files that sit
next to managed files, with the date of each one. This is the case of a
project installed before `0.17.0`, of a removed journal, and of a second
`rollback` in a row (only the last apply is recorded). Those backups may come
from a run older than the one you mean to undo, for example the original
`init`, so restoring them is asked for by name (since `0.24.0`):
`workflow-kit rollback --target <repo> --from-backups` (a dry run; then add
`--apply --yes`) restores the newest backup of each managed file. Since
`0.24.1`, `rollback --apply --yes` without the flag exits with code 3 when
backups exist and none was restored. It cannot
tell which files changed after that backup, so it first keeps the current
content of
each file it replaces as a `.workflow-kit-backup-<timestamp>-before-rollback`
copy (listed after the run; a later rollback never restores those). Running
it again restores nothing more. Created and moved files and the install state
stay as they are: run `workflow-kit doctor` next. To return to this kit
version, run `workflow-kit update` (dry run first) and decide each pending
file with `--edited` (`split` keeps the own text of an adapter, `keep` an
edit). `--edited all=discard` would also take the kit version of every
pending file, so kept edits and adapter text would remain only in backups.

## Upgrading safely after migration

`workflow-kit update` uses `.agents/workflow-kit/install-state.json` to decide which files are managed.

Behavior on update (since `0.22.0`, by the class each path has in
`.agents/workflow-kit/manifest.json`; the contract is `.agents/kit-boundary.md`):

1. Kit and derived files are replaced when they still match what the last
   apply wrote; an edited one stays pending (`skip_modified`) until you decide
   it with `--edited`. So does your own file at a kit path the install never
   recorded (for example `.codex/README.md` when you add the Codex runtime):
   `unrecorded_kit_file`, with `keep` or `discard`.
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
6. Project files the kit only seeds (everything under `.agents/project/`) are
   listed as `skip_unmanaged` and left as they are. Your own file at a path
   the kit ships but the install never recorded is `skip_modified`
   (`unrecorded_kit_file`), and waits for `--edited`. An edited
   `.agents/skills/registry.json` is such a pending kit file: it is never
   merged, so `discard` replaces it with the kit version (backup kept).

No write replaces content without a backup unless that content matches the
hash the kit recorded for it, whatever `--backup-mode` says.

Checks that stop a run before it writes anything (since `0.23.2`):

- **One run at a time.** An apply or rollback holds
  `.agents/workflow-kit/apply.lock` while it writes; a second apply or
  rollback on the same repository stops with "Another workflow-kit run is
  changing this repository". Under the lock, an apply also checks that
  `install-state.json` and the journal are still what its plan read: a run
  that planned before another one applied stops ("changed after this plan was
  made") instead of replacing that run's journal, so rollback can still undo
  it; run the command again. A dry run and `doctor` only read, so a lock does
  not stop them. A lock that cannot belong to a running workflow-kit (its
  process is gone, its process id now belongs to another process, or the file
  is empty) is taken over. A lock that cannot be proved stale (written without
  its process start time, or on a system where that time cannot be read)
  stays: remove it only if you are sure no workflow-kit command is running. Backups are created exclusively, so a backup is
  never overwritten. The lock and the temporary files of a write
  (`.workflow-kit-tmp-*`) are in the kit's ignore entries, and the next run
  removes the ones a killed run left.
- **A state from a newer kit.** When `install-state.json` was written by a
  newer workflow-kit than the CLI you run, `update` stops and asks you to run
  `workflow-kit upgrade --apply --yes` first, instead of deleting the files
  the newer kit ships and replacing newer content with older.
- **Damaged state values.** A `runtimes`, `stackPack` or `modelProfiles`
  value this CLI cannot read is named together with `install-state.json`;
  it is never read as a default.
- **Names too long.** A path the file system would refuse, or a file whose
  backup name (37 more characters) would be longer than 255 bytes, is listed
  in the plan, dry run included; rename or move it and run again.
- **The target.** `--target` must be an existing folder: `init`, `update`
  and `rollback` say so when it is a file or does not exist (`init` does not
  create the folder; create it first, for example with `git init`). `export`
  creates its output folder.
- **Nothing to change.** A run whose plan writes no file and changes nothing
  in the state but its timestamp writes nothing at all, so a second `update`
  or a second `export` to the same folder leaves the tree as it is.

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
| Skill catalogs | Replaced by the kit version, with a backup, after their own rows moved; also when the old state recorded them and the team then added rows by hand (as the `add-project-pattern` skill of `0.19.x` told it to) |
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

A second `update` right after writes nothing (`install-state.json` included).
To undo it:

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

- **`init` does not migrate.** `init` over any existing install (`1.0.0` or
  `2.0.0`) stops and asks you to run `update` (with `--runtime <list>`,
  `--stack` or `--profile` to change those choices), so the recorded
  runtimes, stack, profiles and pending files are never reset. The TUI Install
  stops the same way right after you choose the target.
- **`export` never writes over an install.** Since `0.22.0` an export records
  `mode: "export"` in its `install-state.json`, and `export` refreshes only a
  folder with that mark. Over a folder with any other install state (a
  `1.0.0` or `2.0.0` install, or an export written before `0.22.0`, which
  recorded `mode: "repo"`) it stops before writing anything: export to an
  empty folder, or delete the old export's `install-state.json` first.
  `update` on an exported folder refreshes it and keeps `mode: "export"` (it
  does not turn the export into a `repo` install); `update --mode plugin`
  on it stops and points to `init --mode plugin --target <repo>`.
  Exporting into a subfolder of an install does not touch the install.
- **An unfinished apply blocks the next one.** If an apply stops halfway (a
  permission error, a full disk, Ctrl-C, a killed process), `init` and
  `update` stop with "The last workflow-kit apply did not finish" until you
  run `workflow-kit rollback --target <repo> --apply --yes`, so the journal of
  that apply is never overwritten.
- **Empty folders are not recreated.** An empty folder inside an own skill
  stays in the old place (Git does not track empty folders); the plan names it.
- **Some items stay pending** and `doctor` lists each with what to do: an own
  skill with a symbolic link, with a name that collides with a kit skill or
  another project skill (letter case ignored), with an invalid name, mixed
  with kit files or with a file that is not UTF-8 text; a legacy context that
  is not UTF-8 or is a folder; a kit file the old state never recorded.
- **An index the migration cannot extend stops it.** When
  `.agents/project/index.md` already exists and the migration has own catalog
  rows to move or a shadow candidate, `update` stops before writing anything
  if the index has one of these problems. The stop names only the one that
  applies, with its line and the fix, and prints the `update` command to run
  again:
  - the first visible table under `## Skills` or `## Shadows` has a header that is not the one in
    `.agents/kit-boundary.md`;
  - that table has no separator row (`| --- | --- |...`) after the header;
  - the heading appears twice;
  - the only heading sits inside a code block or an HTML comment;
  - the file mixes line endings (a line without a carriage return in a CRLF
    file);
  - the file has no `## Skills` section and ends inside a code block or an
    HTML comment that is never closed, where a new section would be hidden.

  Fix that one cause and run `update` again. A visible heading whose only table is commented out or in a
  code block is not a stop: the migration writes a new visible table under the
  heading and leaves the hidden one as it is; the kit catalogs are only replaced
  together with the index that takes their own rows. A row counts as already
  listed only when a row of that table names its path; prose that mentions
  the path does not.

### Deciding edited files

Each pending file lists its valid decisions in the dry run:

```text
- skip_modified: .agents/instructions.md (edited_kit_file): keep | discard
- skip_modified: .agents/skills/<group>/<skill>/SKILL.md (edited_kit_file): keep | discard | shadow
- skip_modified: CLAUDE.md (unmarked_adapter): keep | discard | split
```

| Decision | Effect |
| --- | --- |
| `keep` (default) | The file stays as it is and stays pending. `keep` is not remembered: every `update` and `doctor` lists the file again, and nothing overwrites it until you choose another decision |
| `discard` | The kit version replaces it; your version stays in the backup |
| `shadow` | Only while migrating, and only for a leaf skill that is not `workflow-router` or `instructions`: your version moves to `.agents/project/shadows/<skill>/` with a `shadow.json` (base hash and kit version) and a row in the `Shadows` table; the kit file takes the new version. `doctor` warns when the kit skill changes later |
| `split` | Only for an adapter without markers whose kit text appears unchanged inside it: the new block goes where the template puts it and your own text stays byte for byte outside the markers. An adapter with Windows (CRLF) line endings never qualifies; choose `keep` or `discard` |

```bash
workflow-kit update --target /path/to/repo --edited .agents/instructions.md=discard --edited CLAUDE.md=split --apply --yes
workflow-kit update --target /path/to/repo --edited all=discard --apply --yes
```

A pending kit file reached through a symbolic link offers only `keep`: the kit
does not write through links. The plan says so:

```text
- skip_modified: .agents/instructions.md (edited_kit_file): symbolic link (.agents/instructions.md), so only keep applies: the kit does not write through links; it stays as it is, also under --edited all=discard. Replace the link with a regular file to get the other decisions
```

`--edited all=discard` leaves that file as it is and discards the rest
(when the link is the only pending file, `all=discard` has nothing to apply to
and stops);
`--edited <path>=discard` on the link itself is rejected and writes nothing.
Replace the link with a regular file to get the other decisions.

A decision that does not apply to a file exits with code 2 before anything is
written. `--edited all=<decision>` applies where it is valid and is a no-op
when nothing is pending. The TUI offers three ways: keep my edits, replace all
with the kit version (`split` for an adapter where it applies, so its own text
stays; an adapter without markers where `split` does not apply, such as one
with Windows line endings, stays pending; `discard` for the rest), or decide
file by file.

Reviewing an update (since `0.16.0`): the plan lists its one-time migrations
under "Migrations", and `workflow-kit update --target <repo> --diff` prints the
line diff of every file that would change, including managed files you edited
(`skip_modified`), so you can merge them by hand. Until `0.22.0` updates never
deleted or moved files; since then they delete unedited retired kit files and,
once, migrate the layout (above), always with backups. A second update right
after is a no-op: it writes no file, `install-state.json` included. A seed the
project already owns is listed as `skip_unmanaged ... (project-owned; left as
it is)`, and the apply summary counts it as "Project-owned files left as they
are", apart from unmanaged files. The full version history is in
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
update. The profile is then stored and kept by later updates. Copilot also
takes a profile (`--profile copilot=<calidad|equilibrado|costo>`, `costo` by
default): it changes the tier and the `model:` list in the generated
`.github/agents/*.agent.md` files.

The `equilibrado` profile (since `0.18.0`) is unknown to older versions of
workflow-kit. Before going back to a version before `0.18.0` (for example the
tag `v0.17.3-contract-gaps`), switch back with `--profile claude=calidad` (or
`codex=calidad`); otherwise that version's `update` and `doctor` stop with "No
equilibrado tier defined".

If your repo was installed before install-state support, run a one-time bootstrap:

```bash
workflow-kit update --target /path/to/repo --runtime codex,copilot --adopt-existing --apply --yes
```

This records the current baseline and avoids immediate overwrites.
