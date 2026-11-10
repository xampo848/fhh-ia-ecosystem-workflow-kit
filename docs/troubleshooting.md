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

Run `doctor` with the same runtime options used for install. If files are still missing, rerun `init` in dry-run mode to see what would be created.

## Doctor reports semantic diagnostics

Each diagnostic includes a stable code, path, severity, and remediation text.
Common cases:

- `copilot/missing-apply-to`: add YAML frontmatter with `applyTo: "**"` to the
  repository-wide Copilot instruction file.
- `adapter/missing-turn-intake`: update the runtime wrapper so every prompt
  applies the neutral intake contract.
- `skills/unregistered-file`: register the skill in
  `.agents/skills/registry.md`, then regenerate structured artifacts.
- `managed/content-drift`: a managed file changed locally; review it before
  running an update. This is a warning, not an automatic overwrite.

Regenerate and verify the skill registry with:

```bash
node scripts/sync-skill-registry.mjs --write
bun run check:workflow
```

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

Use the profile you actually want (`calidad` for subscriptions, `costo` for
Copilot or per-token APIs).

## Doctor reports `project-context/*` warnings

`.agents/project-context.md` is the project's fixed knowledge base: structure
map, validation commands with their cost, test conventions, environment
quirks, and pointers to architecture docs. Discovery reads it first.

| Code | Meaning | Action |
| --- | --- | --- |
| `project-context/not-initialized` | the file is still the installed template | run an initial Discovery of the project (an N2 task), review the result, and remove the template marker |
| `project-context/too-long` | more than 200 lines | point to other documents instead of copying them |
| `project-context/missing-path` | it names a path that no longer exists | fix it at the next closure; only the orchestrator edits this file |

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

- `skip_modified`: the file is managed but was changed locally after last apply, so update protects it.
- `skip_unmanaged`: file exists at a workflow-kit path but is not tracked in install state, so update does not overwrite it.

If you want that file managed, align content intentionally and re-run with review.

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

Use `neutral` when your runtime is not listed, then create a local thin adapter that points to `.agents/instructions.md`.

## Validation fails

Run checks individually:

```bash
bun run test
bun run check
bun run check:templates
bun run check:release
bun run check:docs
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

Review both versions, then restore the latest backup for every managed file with:

```sh
workflow-kit rollback --target /path/to/repo --dry-run
workflow-kit rollback --target /path/to/repo --apply --yes
```

`rollback` only restores files tracked in `.agents/workflow-kit/install-state.json` and only when a matching `.workflow-kit-backup-<timestamp>` file exists next to them; it never invents a backup or restores an unmanaged file.
