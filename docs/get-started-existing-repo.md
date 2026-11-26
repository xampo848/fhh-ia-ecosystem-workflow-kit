# Get Started for Existing Repositories

This guide is the no-surprises adoption path when your project already exists and already has docs, skills, or runtime conventions.

This document focuses on practical execution and recovery for real repositories.

## What this guide solves

- Safe installation without losing local changes.
- Safe composition of workflow-kit adapters and docs hub with your existing files.
- One-time recovery map for pre-existing docs.
- Clear backend/frontend standards setup and migration flow.
- Fast troubleshooting when dry-run output is confusing.

## 0) Preflight checklist

Before running `init`:

1. Confirm the toolkit is available: `workflow-kit --version` (and `workflow-kit --help` for usage).
2. Confirm your repository path is correct.
3. Optional but recommended: commit or stash current work.
4. Decide runtime adapters (`neutral`, `codex`, `copilot`, `claude`, `antigravity`, `opencode`).
5. Make sure `.agents` and the adapter files you will install (`AGENTS.md`, `CLAUDE.md`, …) are not symlinks; the kit refuses to write through them.

## 1) Preview first (always)

```bash
workflow-kit init --target /path/to/repo --runtime codex,copilot
```

Dry-run is default and writes nothing.

### How to read operation types

- `create`: new file will be added.
- `unchanged`: file already matches planned content.
- `overwrite_with_backup`: file differs; a timestamped backup will be created before write.
- `merge_with_backup`: in-place composition (an adapter's managed block, the `docs/README.md` block) with backup first. `.agents/skills/registry.json` is never merged.
- `skip_modified`: update mode protected local change in managed file.
- `skip_unmanaged`: update left a project file the kit only seeds as it is (`project-owned; left as it is`, for example `.agents/project/context.md`), or an adapter with broken markers. Your own file at a path the kit ships is `skip_modified` (`unrecorded_kit_file`) and waits for your decision with `--edited`.
- `adopt_existing`: update bootstrap recorded existing file baseline.

## 2) Apply after review

```bash
workflow-kit init --target /path/to/repo --runtime codex,copilot --apply --yes
```

## 3) Validate install

```bash
workflow-kit doctor --target /path/to/repo --runtime codex,copilot
```

If diagnostics appear, jump to [Troubleshooting](troubleshooting.md).

Then complete the one-time steps that belong to your project (project context,
project rules, model profile, local skill catalogs, validation reuse): see
[Per-project setup after installing](../README.md#per-project-setup-after-installing).

## 3.1) Manual routing smoke check

Before rolling the workflow to a team, run one manual interaction check in the target runtime:

1. Send one non-trivial natural-language request.
2. Confirm a routing trace appears before implementation actions.
3. Confirm the selected workflow is the one actually executed next.
4. If route changes, confirm a new routing trace appears first.

## 4) Existing skills: what is merged vs preserved

During init on an existing repository:

- `.agents/skills/` holds kit skills only. A `SKILL.md` of your own there is not registered (`doctor` names it); move it to `.agents/project/skills/<name>/` and add its row to `.agents/project/index.md`.
- The kit catalogs (`.agents/skills/index.md`, `.agents/skills/06-patterns/index.md`, `.agents/skills/registry.md`, `.agents/skills/registry.json`) are kit files: init replaces an existing one and keeps a backup. Your own rows go to `.agents/project/index.md`.
- `docs/README.md` gets a non-destructive workflow block (idempotent marker block).
- `docs/workflow/README.md` is created as an initial docs map when missing, and `docs/workflow/standards/` adds setup guides for backend/frontend standards.
- Project rules are runtime-neutral and live in the project overlay `.agents/project/`, which no update edits: the installer creates `.agents/project/quality-gate.md` (project additions to the kit quality gate), templates for `.agents/project/backend.md` and `.agents/project/frontend.md`, and `.agents/project/context.md`. Existing hand-written `.github/instructions/*.instructions.md` files are migrated with a backup, and Copilot gets generated copies.
- `.ai-work/` (temporary AI state) and `.agents/workflow-kit/last-apply.json` (the local rollback journal) are added to `.gitignore`.

## 5) Existing docs: one-time intelligent recovery

If legacy docs are detected, init generates:

- `docs/workflow/migration/legacy-docs-map.md`

This file suggests coherent destinations under `docs/workflow/` and includes `git mv` commands.

### Recommended migration routine

1. Open `docs/workflow/migration/legacy-docs-map.md`.
2. Review suggested destinations.
3. Execute moves with `git mv` to preserve history.
4. Keep one canonical source per topic.
5. Update old links in README/CONTRIBUTING/docs indexes.

The map is generated once. If it already exists, later updates do not regenerate it (init stops on an existing install).

Workflow-kit does not relocate legacy docs for you. Use the generated map and move the files manually with `git mv` so you stay in control of duplicates, naming, and history preservation.

## 6) Backend/frontend standards setup

Start here:

- `docs/workflow/standards/setup-and-migration.md`
- `docs/workflow/standards/backend.md`
- `docs/workflow/standards/frontend.md`
- `docs/workflow/standards/project-instructions-template.md`

Use these files to define repository-specific rules, commands, and migration decisions.

Important: implementation workflows expect project-owned runtime instruction files at `.agents/project/backend.md` and `.agents/project/frontend.md` when those code surfaces exist.

## 7) Update and upgrade safely

Upgrade toolkit binary first:

```bash
workflow-kit upgrade --apply --yes
```

Then update each managed repo:

```bash
workflow-kit update --target /path/to/repo --apply --yes
```

For legacy installs without state:

```bash
workflow-kit update --target /path/to/repo --runtime codex,copilot --adopt-existing --apply --yes
```

## 8) Fast answers to common doubts

### "Will this overwrite my existing project docs?"

Not by default. Workflow docs are added in a dedicated subtree and docs hub updates are marker-based and non-destructive.

### "What happens with my existing skills?"

`.agents/skills/registry.json` and the other kit catalogs are kit files, not merged: `init` replaces an existing one with a backup, and `update` leaves an edited one pending (`skip_modified`) until you choose `keep` or `discard` with `--edited`. Your own skills and rows live under `.agents/project/`, which no update edits.

### "How do I know what was changed?"

Use dry-run plan output before apply (add `--diff` for line diffs) and review backups (`*.workflow-kit-backup-*`) after apply when overwrite/merge operations occur.

### "I do not want to install optional capabilities yet"

That is fine. Capabilities are optional and should only be installed/attached after explicit confirmation.

## 9) Escalation path

If something still looks wrong:

1. Re-run dry-run and inspect operations.
2. Run `workflow-kit doctor`.
3. Open [troubleshooting.md](troubleshooting.md) and apply the matching section.
4. If needed, undo the last apply with `workflow-kit rollback --target /path/to/repo --dry-run`, then `--apply --yes`, and retry. Manual restore from the backup files remains a fallback.
