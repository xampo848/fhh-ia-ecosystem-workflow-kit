# Get Started for Existing Repositories

This guide is the no-surprises adoption path when your project already exists and already has docs, skills, or runtime conventions.

## Routing trace

`workflow-router · lean · workflow-maintenance documentation path`

This document focuses on practical execution and recovery for real repositories.

## What this guide solves

- Safe installation without losing local changes.
- Intelligent merge of workflow-kit and existing skills metadata.
- One-time recovery map for pre-existing docs.
- Clear backend/frontend standards setup and migration flow.
- Fast troubleshooting when dry-run output is confusing.

## 0) Preflight checklist

Before running `init`:

1. Confirm toolkit is available: `workflow-kit --help`
2. Confirm your repository path is correct.
3. Optional but recommended: commit or stash current work.
4. Decide runtime adapters (`neutral`, `codex`, `copilot`, `claude`, `antigravity`).

## 1) Preview first (always)

```bash
workflow-kit init --target /path/to/repo --runtime codex,copilot
```

Dry-run is default and writes nothing.

### How to read operation types

- `create`: new file will be added.
- `unchanged`: file already matches planned content.
- `overwrite_with_backup`: file differs; a timestamped backup will be created before write.
- `merge_with_backup`: intelligent in-place composition (for example skills registry/docs hub) with backup first.
- `skip_modified`: update mode protected local change in managed file.
- `skip_unmanaged`: update mode found collision at unmanaged path and will not overwrite.
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

## 4) Existing skills: what is merged vs preserved

During init on an existing repository:

- `.agents/skills/**/SKILL.md` files already present in the target repo are auto-discovered and merged into `.agents/skills/registry.json`.
- `.agents/skills/registry.json` is merged by union so local custom entries are preserved.
- `.agents/skills/index.md` and `.agents/skills/registry.md` are preserved if they already exist.
- `docs/README.md` gets a non-destructive workflow block.

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

The map is generated once. If it already exists, it is not regenerated on subsequent init runs.

Workflow-kit does not relocate legacy docs for you. Use the generated map and move the files manually with `git mv` so you stay in control of duplicates, naming, and history preservation.

## 6) Backend/frontend standards setup

Start here:

- `docs/workflow/standards/setup-and-migration.md`
- `docs/workflow/standards/backend.md`
- `docs/workflow/standards/frontend.md`

Use these files to define repository-specific rules, commands, and migration decisions.

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

Skill registry JSON is merged; local catalogs in markdown are preserved if already present.

### "How do I know what was changed?"

Use dry-run plan output before apply and review backups (`*.workflow-kit-backup-*`) after apply when overwrite/merge operations occur.

### "I do not want to install optional capabilities yet"

That is fine. Capabilities are optional and should only be installed/attached after explicit confirmation.

## 9) Escalation path

If something still looks wrong:

1. Re-run dry-run and inspect operations.
2. Run `workflow-kit doctor`.
3. Open [troubleshooting.md](troubleshooting.md) and apply the matching section.
4. If needed, restore from backup files and retry.
