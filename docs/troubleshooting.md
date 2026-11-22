# Troubleshooting

## Dry-run shows `overwrite_with_backup`

The target file already exists with different content. If you apply, the installer creates a `.workflow-kit-backup-<timestamp>` file before writing the template.

Recommended action:

1. Review the existing file.
2. Run dry-run again after any manual merge.
3. Apply only when the planned overwrite is expected.

## Dry-run shows `merge_with_backup`

This is a smart composition write. The installer merges content and still creates a backup first.

Typical paths:

- `.agents/skills/registry.json`
- `docs/README.md`

Recommended action:

1. Review merged intent in the dry-run plan.
2. Apply if the merge path is expected.
3. If not expected, inspect existing file conventions before applying.

## Doctor reports missing files

Run `doctor` with the same runtime options used for install. If files are still missing, run `update` in dry-run mode to see what would be created (`init` stops on an existing install).

## Doctor reports semantic diagnostics

Each diagnostic includes a stable code, path, severity, and remediation text.
Common cases:

- `copilot/missing-apply-to`: add YAML frontmatter with `applyTo: "**"` to the
  repository-wide Copilot instruction file.
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
agent by hand; regenerate it:

```bash
workflow-kit update --target /path/to/repo --profile claude=calidad --apply --yes
```

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
| `project-context/not-initialized` | the file is still the installed template | run an initial Discovery of the project (an N2 task), review the result, and remove the template marker |
| `project-context/too-long` | more than 200 lines | point to other documents instead of copying them |
| `project-context/missing-path` | it names a path that no longer exists | fix it at the next closure; only the orchestrator edits this file |
| `project-context/both-paths` | the file exists at both paths | merge the legacy file into `.agents/project/context.md` and delete `.agents/project-context.md` |

## Doctor reports `workspace/*` or `prd/section-10-oversized` warnings

Temporary AI state (tracker, `events.log`, locks, handoffs, validation logs)
lives in `.ai-work/<prd-slug>/`, ignored by Git. These warnings never fail
`doctor`; they make leftovers visible:

| Code | Meaning | Action |
| --- | --- | --- |
| `workspace/not-ignored` | `.ai-work/` exists but is not in `.gitignore` | run `workflow-kit update`, or add `.ai-work/` |
| `workspace/closed-prd-leftover` | the PRD is closed but its workspace remains | delete that `.ai-work/<prd-slug>/` directory |
| `workspace/stale` | no activity for more than 14 days | close, split, or archive the change; an open or blocked change may keep it |
| `workspace/tracker-is-a-log` | the tracker grew past ~150 lines or repeats history blocks | keep the tracker as a snapshot; history goes to `events.log` |
| `workspace/legacy-meta` | a `docs/prd/**/_meta/` directory from the old layout | delete it once its PRD is closed |
| `prd/section-10-oversized` | `## 10. Evidencia de Implementacion` passes ~60 lines | keep a durable summary; repair history stays in the PR |

## Update shows `skip_modified` or `skip_unmanaged`

- `skip_modified`: a kit file you edited, an adapter without markers, or your
  own file at a kit path the install never recorded (`unrecorded_kit_file`) is
  pending. The plan lists the decisions it accepts, for example
  `keep | discard`.
- `skip_unmanaged`: a project file the kit only seeds, or an adapter whose
  markers are broken, so update does not overwrite it.

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
would build and names what is pending and how to resolve it.

| Code | Severity | Meaning | Action |
| --- | --- | --- | --- |
| `managed/legacy-layout` | warning | the install still has `install-state` `1.0.0` | run `workflow-kit update` (dry run first) to migrate; see `docs/migration.md` |
| `managed/apply-incomplete` | error | the last apply stopped halfway | `workflow-kit rollback --apply --yes`, then run the command again |
| `managed/apply-journal-unusable` | error | `.agents/workflow-kit/last-apply.json` cannot be read, so `rollback` cannot use it | fix it by hand (Git does not track it); only if you will not roll back the last apply, move it out of `.agents/workflow-kit/` |
| `managed/install-state-unusable` | error | `install-state.json` cannot be read | restore it from Git, or upgrade the CLI if a newer version wrote it |
| `managed/symlink` | warning | a path the kit manages is, or passes through, a symbolic link | replace the link with a real file or folder; `init` and `update` refuse to write through it |
| `managed/toolkit-version-mismatch` | warning | the last apply used another workflow-kit version than this CLI | run `workflow-kit update` (dry run first) |
| `managed/path-unreadable` | error | `doctor` met a path it cannot read: a file where a folder of the path should be (for example `.agents/project` as a file), a folder where a file should be, or no permission | fix that path, then run `doctor` again |
| `boundary/pending-edited_kit_file`, `boundary/pending-unrecorded_kit_file` | warning | a kit file differs from what the kit recorded (or was never recorded) | `workflow-kit update --edited <path>=<decision>` with `keep` or `discard` (or `shadow` when the message offers it) |
| `boundary/pending-unmarked_adapter` | warning | an adapter has no `workflow-kit:managed` block and was edited | `--edited <path>=<decision>` with `keep` or `discard`, or `split` when offered |
| `boundary/pending-retired_edited` | warning | the kit no longer ships this file and you edited it | delete it, or keep it as project content outside the kit folders |
| `boundary/pending-symlink`, `-project_skill_exists`, `-kit_skill_name`, `-invalid_skill_name`, `-mixed_with_kit_files`, `-binary_file` | warning | an own skill could not move to the overlay during the migration | follow the step in the message, move the folder by hand to `.agents/project/skills/<name>/` and add its row to `.agents/project/index.md` |
| `boundary/pending-legacy_path_unsupported` | warning | the legacy context is not UTF-8 text or a folder is in the way | fix the file, then run `update` |
| `boundary/pending-catalog_row_not_moved` | warning | a project row of an old catalog could not be moved | add it to `.agents/project/index.md` by hand |
| `boundary/adapter-block-edited` | warning | the text inside an adapter's `workflow-kit:managed` block was edited | the next `update` restores the block; keep your text outside the markers |
| `boundary/shadow-outdated` | warning | the kit skill changed since the shadow was made, or the kit no longer ships it | compare, refresh the shadow and its `base_sha256` (or remove it) |
| `boundary/shadow-invalid` | warning | a listed shadow has no valid `shadow.json` | write it as `.agents/kit-boundary.md` describes |
| `boundary/ignored-state-key` | warning | `install-state.json` has a key that is absolute or contains `.`/`..` | remove that key |
| `boundary/unowned-path` | warning | a file under a kit folder is neither shipped by the kit nor recorded | move it to `.agents/project/` (skills to `.agents/project/skills/<name>/` with a row in the project index) |
| `boundary/update-plan-failed` | warning | `doctor` could not build the update plan (for example, a `1.0.0` install whose `.agents/project/index.md` has a `## Skills` or `## Shadows` table with another header, so the migration stops) | fix the error in the message, then run `doctor` again |

Things to know:

- `init` never runs over an existing install: on a `1.0.0` or `2.0.0` install
  it stops and asks for `update` (with `--runtime`, `--stack` or
  `--profile` to change those choices; the TUI Install stops the same way).
- After an apply that stopped halfway, `init` and `update` refuse to run until
  `rollback` undoes it, so its journal is never overwritten.
- Empty folders inside an own skill are not recreated by the migration.
- A file where the plan needs a folder (for example `docs`, `.agents/project`
  or `.agents/project/skills` as a file), or a folder where it writes a file
  (for example `.agents/kit-boundary.md` as a folder), stops `init` and
  `update` before anything is written; move it aside.
- An adapter with Windows (CRLF) line endings never qualifies for `split`.

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

In TUI update mode, when managed local edits are detected, workflow-kit now asks what to do:

- protect local edits (keep `skip_modified`)
- overwrite with backup (apply update and keep a restore copy)

Choose overwrite only when you intentionally want toolkit content to replace local changes.

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
and restores the previous `.agents/workflow-kit/install-state.json`. Files
written with `--backup-mode none` have no backup and cannot be restored.

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
