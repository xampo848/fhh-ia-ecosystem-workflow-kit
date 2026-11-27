# Troubleshooting

## Dry-run shows `overwrite_with_backup`

The target file already exists with different content. If you apply, the installer creates a `.workflow-kit-backup-<timestamp>` file before writing the template.

Recommended action:

1. Review the existing file.
2. Run dry-run again after any manual merge.
3. Apply only when the planned overwrite is expected.

## Dry-run shows `merge_with_backup`

This is a smart composition write. The installer composes the file in place and still creates a backup first.

Typical paths:

- an adapter you already had (`CLAUDE.md`, `AGENTS.md`, the Copilot instruction files): the kit adds its `workflow-kit:managed` block and keeps your text
- `docs/README.md`: the kit adds its marker block

`.agents/skills/registry.json` is never merged: it is a kit file. `init` replaces
an existing one with a backup, and `update` leaves an edited one pending
(`skip_modified`) until you choose `keep` or `discard`.

Recommended action:

1. Review merged intent in the dry-run plan.
2. Apply if the merge path is expected.
3. If not expected, inspect existing file conventions before applying.

## Doctor reports missing files

Run `doctor` with the same runtime options used for install. If files are still missing, run `update` in dry-run mode to see what would be created (`init` stops on an existing install).

## Doctor reports semantic diagnostics

Each diagnostic includes a stable code, path, severity, and remediation text.
Common cases:

- `copilot/missing-apply-to`: `.github/instructions/ai-workflow.instructions.md`
  lost its front matter. Put these three lines at the very top of that file
  (not in `.github/copilot-instructions.md`), then run `doctor` again:

  ```text
  ---
  applyTo: "**"
  ---
  ```
- `adapter/missing-turn-intake`, `*/missing-rerouting-guarantee`,
  `*/missing-execution-gate`: the runtime adapter lacks the shared bootstrap
  block. Run `workflow-kit update`; as a warning it means the adapter still has
  the wording of an older version.
- `managed/install-state-unusable`: `install-state.json` is corrupt or was
  written by a newer CLI. Restore it from Git or upgrade the CLI.
- `skills/unregistered-file` (warning): a `SKILL.md` under `.agents/skills/`
  that the kit registry does not list, so it is not kit content. If a
  `boundary/*` finding names it or its folder, follow that; otherwise move the
  skill to `.agents/project/skills/<name>/` with a row in
  `.agents/project/index.md`. Do not register it in `.agents/skills/registry.md`:
  that is a kit file, and editing it leaves it pending.
- `boundary/*`: a kit file you edited, an own file inside a kit folder, or a
  shadow to review. See "Doctor reports `boundary/*` or `managed/*` findings"
  below. These are warnings, never an automatic overwrite.

Run `workflow-kit doctor` again after fixing a finding.

## Legacy docs map was generated and I am not sure what to do

When initializing an existing repository, workflow-kit may generate:

- `docs/workflow/migration/legacy-docs-map.md`

This is a one-time migration aid. It does not move files automatically.

Recommended action:

1. Open the map and review suggested destinations.
2. Move docs with `git mv` to preserve history.
3. Keep one canonical location per document topic.
4. Update stale links in README/CONTRIBUTING/docs indexes.

## Legacy docs map was not generated

Expected reasons:

- no legacy docs were found under `docs/` outside `docs/workflow/`, or
- map already exists from a previous init.

Recommended action:

1. Confirm whether docs already live under `docs/workflow/`.
2. If you still need migration support, create your own mapping file under `docs/workflow/migration/` and follow the same `git mv` flow.

## I do not know where backend/frontend standards should be configured

Use these target-repo files:

- `docs/workflow/standards/setup-and-migration.md`
- `docs/workflow/standards/backend.md`
- `docs/workflow/standards/frontend.md`

They are intended to be repository-specific and should be completed during initial adoption.

## Update fails with "No install state found"

Your repo was likely installed before state tracking was introduced. Bootstrap baseline state without overwriting current files:

```bash
workflow-kit update --target /path/to/repo --runtime codex,copilot --adopt-existing --apply --yes
```

After that, regular `workflow-kit update --apply --yes` runs will perform managed, safe updates.

## Doctor reports `model-profile/agent-mismatch`

A delegate agent's model setting (`model:` in `.claude/agents`, the model list
in `.github/agents`, or `model_reasoning_effort` in `.codex/agents`) does not
match the profile stored in `.agents/workflow-kit/install-state.json`. This
usually means a manual edit or a copy from another project. Do not fix the
agent by hand; run the fix `doctor` prints. It is one command that carries the
absolute `--target` and, for an agent that the update plan holds as an edited
kit file, the `--edited <path>=discard` decision, so it runs as printed from
any folder and settles the error (the discarded file keeps a backup). For an
edited Claude Code agent it looks like this:

```bash
workflow-kit update --target /path/to/repo --profile claude=calidad --edited .claude/agents/<agent>.md=discard --apply --yes
```

Without `--edited`, a plain `update --profile` leaves an edited agent as it is
and the error stays.

Use the profile you actually want (`calidad` for subscriptions, `equilibrado`
for subscriptions that often hit their weekly limits, `costo` for Copilot or
per-token APIs).

## Doctor reports `project-instructions/*` or `stack-pack/missing`

Project rules live in `.agents/project/`; runtime folders only hold generated
copies.

| Code | Meaning | Action |
| --- | --- | --- |
| `project-instructions/not-migrated` | rules exist only in `.github/instructions/`, so other runtimes skip them | run `workflow-kit update`; it copies them to `.agents/project/` and regenerates the Copilot file with a backup |
| `project-instructions/wrapper-stale` | the generated Copilot file differs from the neutral one | run `workflow-kit update`; edit `.agents/project/<name>.md`, never the generated copy |
| `stack-pack/missing` | a stack pack is recorded but `.agents/project/stack.md` is gone | restore it from Git, or copy `templates/stack-packs/<pack>/stack.md` again by hand: `update` never recreates a project file it created once |

Since `0.22.0` the quality gate default belongs to the kit
(`.agents/delegation/quality-gate.md`) and always applies;
`.agents/project/quality-gate.md` only holds project additions and may be
missing.

## Doctor reports `project-context/*` warnings

`.agents/project/context.md` (legacy path: `.agents/project-context.md`) is the project's fixed knowledge base: structure
map, validation commands with their cost, test conventions, environment
quirks, and pointers to architecture docs. Discovery reads it first.

| Code | Meaning | Action |
| --- | --- | --- |
| `project-context/not-initialized` | the file is still the installed template | ask your agent for the initial Discovery of the project (an N2 task the router handles as project context setup), review the diff, and check that the template marker is gone |
| `project-context/too-long` | more than 200 lines | point to other documents instead of copying them |
| `project-context/missing-path` | it names a path that no longer exists (in plugin mode, kit paths are skipped: the plugin delivers them) | fix it at the next closure; only the orchestrator edits this file |
| `project-context/both-paths` | the file exists at both paths | merge the legacy file into `.agents/project/context.md` and delete `.agents/project-context.md` |

## Doctor reports `workspace/*` or `prd/section-10-oversized` warnings

Temporary AI state (tracker, `events.log`, locks, handoffs, validation logs)
lives in `.ai-work/<prd-slug>/`, ignored by Git. These warnings never fail
`doctor`; they make leftovers visible:

| Code | Meaning | Action |
| --- | --- | --- |
| `workspace/not-ignored` | `.ai-work/` exists but is not in `.gitignore` | run `workflow-kit update`, or add `.ai-work/` |
| `workspace/backups-not-ignored` | `.gitignore` lacks `*.workflow-kit-backup-*`, so `git add -A` would version the backups | run `workflow-kit update --target <path>`, or add that line; if `.gitignore` is a symbolic link, `update` leaves it alone, prints a `Note:` naming the lines, and you add them to the file it points to |
| `workspace/closed-prd-leftover` | the PRD is closed but its workspace remains | delete that `.ai-work/<prd-slug>/` directory |
| `workspace/stale` | no activity for more than 14 days | close, split, or archive the change; an open or blocked change may keep it |
| `workspace/tracker-is-a-log` | the tracker grew past ~150 lines or repeats history blocks | keep the tracker as a snapshot; history goes to `events.log` |
| `workspace/legacy-meta` | a `docs/prd/**/_meta/` directory from the old layout | delete it once its PRD is closed |
| `prd/section-10-oversized` | `## 10. Evidencia de Implementacion` passes ~60 lines | keep a durable summary; repair history stays in the PR |

## Update shows `skip_modified` or `skip_unmanaged`

- `skip_modified`: a kit file you edited, an adapter without markers, or your
  own file at a kit path the install never recorded (`unrecorded_kit_file`) is
  pending. The plan lists the decisions it accepts, for example
  `keep | discard`. A kit file reached through a symbolic link offers only
  `keep`: the plan says "symbolic link (<path>), so only keep applies". The kit
  does not write through links, so `--edited all=discard` leaves that file as
  it is and discards the rest, and `--edited <path>=discard` on it is rejected.
  Replace the link with a regular file to get the other decisions.
- `skip_unmanaged`: a project file the kit only seeds (the plan says
  `project-owned; left as it is`, for example `.agents/project/context.md`),
  or an adapter whose markers are broken, so update does not overwrite it.
  Your own file at a path the kit ships is not `skip_unmanaged`: it is
  `skip_modified` (`unrecorded_kit_file`) and waits for your decision.

Decide a pending file with `--edited` (since `0.22.0`; see
`docs/migration.md`, "Deciding edited files"):

```bash
workflow-kit update --target /path/to/repo --edited .agents/instructions.md=discard --apply --yes
```

Before taking the kit version, move any rule of your own to the project
overlay: `.agents/project/routing.md` for routing rules,
`.agents/project/quality-gate.md` for quality additions, a project skill or a
shadow for a skill (`.agents/kit-boundary.md`). A file whose content equals
what this version would write is reported as `unchanged` and stops being
pending. `update --diff` shows the difference beforehand.

## Doctor reports `boundary/*` or `managed/*` findings (since 0.22.0)

The kit owns a closed list of paths (`.agents/workflow-kit/manifest.json`);
the project owns `.agents/project/`. `doctor` reads the same plan `update`
would build and names what is pending and how to resolve it. For each pending
file the message gives one runnable command per decision, with the absolute
`--target` quoted for the shell and the `--edited <path>=<decision>` already
filled in (`keep`, `discard`, and `shadow` or `split` when they apply), each
with what it does; they are dry runs, so add `--apply --yes` after reading the
plan. Run the one you want as printed, from any folder.

| Code | Severity | Meaning | Action |
| --- | --- | --- | --- |
| `managed/legacy-layout` | warning | the install still has `install-state` `1.0.0` | run `workflow-kit update` (dry run first) to migrate; see `docs/migration.md` |
| `managed/apply-incomplete` | error | the last apply stopped halfway | run the `rollback --target <repo> --apply --yes` command the message prints, then run the command again |
| `managed/apply-journal-unusable` | error | `.agents/workflow-kit/last-apply.json` cannot be read, so `rollback` cannot use it | fix it by hand (Git does not track it); only if you will not roll back the last apply, move it out of `.agents/workflow-kit/` |
| `managed/install-state-unusable` | error | `install-state.json` cannot be read | restore it from Git, or upgrade the CLI if a newer version wrote it |
| `managed/symlink` | warning | a path the kit manages is, or passes through, a symbolic link | replace the link with a real file or folder; `init` and `update` refuse to write through it |
| `managed/toolkit-version-mismatch` | warning | the last apply used another workflow-kit version than this CLI | run `workflow-kit update` (dry run first) |
| `managed/apply-lock-held` | error | `.agents/workflow-kit/apply.lock` is held by a workflow-kit run that is still going, so it is changing this repository; also reported when the lock path is a folder, and for a lock whose process is alive but has no recorded start time (an error by design: the kit cannot prove it stale) | wait for the run to finish; only if you are sure none is running, remove the lock. For a folder, the kit never deletes it: remove the folder by hand, then run the command again |
| `managed/apply-lock-stale` | warning | `.agents/workflow-kit/apply.lock` was left by a run that no longer runs, or its content cannot be read or is not valid (no usable process id or start time) | nothing to do: the next apply or rollback takes it over. After a run killed before it wrote its record, run `rollback --target <repo> --apply --yes` to clean what it left (see below) |
| `managed/file-empty` | error | a kit file or adapter is empty, so the agent finds no rules in it | run the `update` command in the message: it takes the kit version back, with a backup |
| `managed/path-unreadable` | error | `doctor` met a path it cannot read: a file where a folder of the path should be (for example `.agents/project` as a file), a folder where a file should be, or no permission | fix that path, then run `doctor` again |
| `boundary/pending-edited_kit_file`, `boundary/pending-unrecorded_kit_file` | warning | a kit file differs from what the kit recorded (or was never recorded) | `workflow-kit update --edited <path>=<decision>` with `keep` or `discard` (or `shadow` when the message offers it) |
| `boundary/pending-unmarked_adapter` | warning | an adapter has no `workflow-kit:managed` block and was edited | `--edited <path>=<decision>` with `keep` or `discard`, or `split` when offered |
| `boundary/pending-retired_edited` | warning | the kit no longer ships this file and you edited it | delete it, or keep it as project content outside the kit folders |
| `boundary/pending-symlink`, `-project_skill_exists`, `-kit_skill_name`, `-invalid_skill_name`, `-mixed_with_kit_files`, `-binary_file` | warning | an own skill could not move to the overlay during the migration | follow the step in the message, move the folder by hand to `.agents/project/skills/<name>/` and add its row to `.agents/project/index.md` |
| `target/not-found` | error | `--target` is not a folder, or does not exist | check `--target`: `doctor` checks the folder of a project where workflow-kit is installed |
| `mode/kit-location-missing` | error | plugin mode: an adapter's workflow-kit block lost its `kit-location` block | run the `update` command in the message; it restores the block with a backup |
| `boundary/pending-legacy_path_unsupported` | warning | the legacy context is not UTF-8 text or a folder is in the way | fix the file, then run `update` |
| `boundary/pending-catalog_row_not_moved` | warning | a project row of an old catalog could not be moved | add it to `.agents/project/index.md` by hand |
| `boundary/adapter-block-edited` | warning | the text inside an adapter's `workflow-kit:managed` block was edited | the next `update` restores the block; keep your text outside the markers |
| `boundary/shadow-outdated` | warning | the kit skill changed since the shadow was made, or the kit no longer ships it | compare, refresh the shadow and its `base_sha256` (or remove it) |
| `boundary/shadow-invalid` | warning | a listed shadow has no valid `shadow.json` | write it as `.agents/kit-boundary.md` describes |
| `boundary/ignored-state-key` | warning | `install-state.json` has a key that is absolute or contains `.`/`..` | remove that key |
| `boundary/unowned-path` | warning | a file under a kit folder is neither shipped by the kit nor recorded | move it to `.agents/project/` (skills to `.agents/project/skills/<name>/` with a row in the project index) |
| `boundary/update-plan-failed` | warning | `doctor` could not build the update plan (for example, a `1.0.0` install whose `.agents/project/index.md` cannot be extended by the migration, or a folder at the lock path) | fix the one cause the message names, then run `doctor` again |

Things to know:

- `init` never runs over an existing install: on a `1.0.0` or `2.0.0` install
  it stops and asks for `update` (with `--runtime`, `--stack` or
  `--profile` to change those choices; the TUI Install stops the same way).
- After an apply that stopped halfway, `init` and `update` refuse to run until
  `rollback` undoes it, so its journal is never overwritten. The journal is
  written before the first write of a run and marked finished only at the end,
  so an interrupt leaves a recorded unfinished run: Ctrl-C or `SIGTERM` lets
  the file being written finish and exits with code 130 (143 for `SIGTERM`; a
  second signal stops at once), and a killed process leaves the same journal.
  The message is "The last workflow-kit apply did not finish";
  `workflow-kit rollback --apply --yes` undoes exactly that run, and files it
  never reached stay as they are.
- A rollback that stopped halfway (even a killed one) is recorded too: `init`
  and `update` stop with "A workflow-kit rollback … did not finish" and `doctor`
  reports `managed/apply-incomplete` until you run
  `workflow-kit rollback --apply --yes` again, which finishes it.
- One run at a time: an apply or rollback holds
  `.agents/workflow-kit/apply.lock` while it writes. A second one stops with
  "Another workflow-kit run is changing this repository"; wait for the first
  and run it again. A dry run and `doctor` are not stopped by the lock. A lock
  whose process is gone, whose process id now belongs to another process, or
  that is empty is taken over by the next run. A lock that cannot be proved
  stale (it has no start time, or the system cannot tell) stays, and the
  message says to remove `.agents/workflow-kit/apply.lock` only if you are sure
  no workflow-kit command is running on that repository (for example after a
  crash); then delete the file and run the command again. A lock with a live
  process and no start time stays an error by design. A lock whose content is
  not valid is reported as unreadable or invalid (`managed/apply-lock-stale`)
  and the next apply or rollback takes it over. A folder at the lock path
  stops `init`, `update` and `rollback` and `doctor` reports
  `managed/apply-lock-held`; the kit never deletes it, so remove the folder by
  hand and run the command again.
- A run killed before it wrote its record (an apply between its lock and its
  journal) or a rollback killed at its very end leaves the lock, temporary
  files and empty folders it created, and maybe no journal. Run
  `workflow-kit rollback --target /path/to/repo --apply --yes`: the dry run
  says the run "was stopped before it finished" and lists each `remove` line
  (the lock, the temporary files, the empty folders it created); apply removes
  only those. It does not undo any apply, and it leaves the record of an
  earlier finished apply alone: run rollback once more to undo that one. It
  refuses when the lock path goes through a symbolic link.
- "No apply journal found, so there is no applied run to undo": the project
  has no record of an apply (installed before `0.17.0`, the record was
  removed, or the last apply was already rolled back). `rollback` restores
  nothing and lists the backup files it found with their dates. They may come
  from an older run, such as the original `init`. To restore the newest backup
  of each managed file anyway, run
  `workflow-kit rollback --target /path/to/repo --from-backups` (a dry run),
  then add `--apply --yes`; the content it replaces is kept as
  `-before-rollback` copies. `rollback --apply --yes` without the flag exits
  with code 3 in this case, so a script can tell "backups exist and none was
  restored" from "nothing to roll back" (code 0). The list includes the
  backup of `.gitignore`. "Nothing to restore: … each managed file already has
  the content of its newest backup" means the backups were already restored.
  Every `rollback` that gets as far as a plan ends with a line `Result: …` a script can read
  (`rolled-back`, `restored-from-backups`, `cleaned-up`, `nothing-to-undo`,
  `backups-not-restored`; a dry run prints `Result: dry-run (would be: …)`).
  After `--from-backups` the kit stays installed: a restored `CLAUDE.md` or
  `.gitignore` loses what the install added, `doctor` reports it, and `update`
  puts it back.
- "A project file is missing": a file under `.agents/project/` was deleted.
  `workflow-kit update --apply --yes` recreates it from its template; a file
  that exists is never rewritten (`doctor` names the command). If the project does not have that layer,
  keep the file with one line that says so.
- "changed after this plan was made": another run changed the repository
  between your plan and your write. Nothing was written; run the command again
  so it plans from the repository as it is now. The same stop applies to
  `rollback`, which never undoes a run other than the one it planned.
- A state from a newer kit: when `install-state.json` was written by a newer
  workflow-kit than the CLI you run, `update` stops and asks for
  `workflow-kit upgrade --apply --yes` first; run that, then `update` again.
- Empty folders inside an own skill are not recreated by the migration.
- A file where the plan needs a folder (for example `docs`, `.agents/project`
  or `.agents/project/skills` as a file), or a folder where it writes a file
  (for example `.agents/kit-boundary.md` as a folder), stops `init` and
  `update` before anything is written; move it aside.
- An adapter that holds the kit text with Windows (CRLF) line endings, or
  with a line of it edited, never qualifies for `split`. One with no kit text
  at all does: `split` adds the block and keeps the whole file.

## `last-apply.json` was committed

`.agents/workflow-kit/last-apply.json` is the journal `workflow-kit rollback`
uses to undo the last apply. It only makes sense on the machine that ran that
apply: a teammate running `rollback` from a committed copy would undo someone
else's update. Since `0.17.2`, install and update add it to `.gitignore`. If it
was committed earlier, remove it from the index once:

```bash
git rm --cached .agents/workflow-kit/last-apply.json
```

`install-state.json` in the same directory stays versioned: it records which
files the kit manages.

In the TUI update flow, when managed files have local edits, it asks what to
do with them:

- `Conservar mis ediciones (recomendado)`: every edited file stays as it is and
  the next update lists it again;
- `Reemplazar todos los archivos editados por la versión del kit`: a backup of
  your version is saved first;
- `Decidir archivo por archivo`: one question per file, with only the choices
  that apply to it.

Replace only when you intentionally want kit content to replace local changes.

## Unsupported runtime

Supported runtimes are:

- `neutral`
- `codex`
- `copilot`
- `claude`
- `antigravity`
- `opencode` (uses the shared `AGENTS.md`)

Use `neutral` when your runtime is not listed, then create a local thin adapter that points to `.agents/instructions.md`.

## Validation fails

Run checks individually:

```bash
bun run check:security
bun run test
bun run check
bun run check:workflow
bun run check:templates
bun run check:docs
bun run check:legal
bun run check:release
```

If `bun test` reports runner-specific limitations or nested-test false negatives,
run the canonical Node test runner to confirm real failures:

```bash
node --test
```

If failure is `overlay/content-drift` for `.agents/skills/00-router/workflow-router` (the core `SKILL.md` or its `reference/` files), align canonical and overlay skill contents before re-running validation.

If failure is `Level pre-filter drift in <adapter>`, an adapter copy of the
N0–N3 pre-filter no longer matches `.agents/instructions.md`. Do not edit the
adapter block by hand; run `node scripts/sync-level-prefilter.mjs --write` and
re-run `bun run check:workflow`.

The failure message should name the missing file, unsafe script, invalid template pack, or missing documentation phrase.

## Agent announces a skill but executes a different path

If a runtime shows a routing trace selecting one workflow but execution continues through another path, treat this as a workflow-contract drift issue.

Recommended action:

1. Verify these files exist and remain aligned in the target repo:
  - `AGENTS.md`
  - `.agents/instructions.md`
  - `.agents/skills/00-router/workflow-router/SKILL.md`
  - `.github/copilot-instructions.md`
  - `.github/instructions/ai-workflow.instructions.md`
2. Re-apply workflow-kit in dry-run and then apply mode for the active runtime.
3. Confirm the latest routing trace remains execution-binding for the next non-trivial action.
4. If workflow selection must change, require a new routing trace before implementation actions.

## I accidentally applied over a file

Look for a backup next to the overwritten file:

```text
<file>.workflow-kit-backup-<timestamp>
```

To undo the whole last apply, preview and then run `rollback`:

```sh
workflow-kit rollback --target /path/to/repo --dry-run
workflow-kit rollback --target /path/to/repo --apply --yes
```

`rollback` undoes only the last applied `init` or `update`: it restores the
files that run changed from their backups, removes the files that run created,
the folders that run created (a folder you had before stays, even when empty),
and restores the previous `.agents/workflow-kit/install-state.json`. Rolling
back an unfinished run always clears its journal, even when every file it wrote
was already removed by hand. Files written with `--backup-mode none` have no
backup and cannot be restored.

Manual fallback: review both versions and copy the backup over the file
yourself, then re-run dry-run before applying again.

## Apply refuses to write through symbolic links

The kit refuses the whole plan when a file it would write sits behind a
symbolic link in the target repository, for example a symlinked `.agents`
directory or an adapter such as `CLAUDE.md` linked to `AGENTS.md`. The content
would land in another file, possibly outside the repository, and the backup
would not protect it. The error lists each link.

Recommended action: replace each link with a real file or directory, or leave
that runtime out with `--runtime`, then run dry-run and apply again.
