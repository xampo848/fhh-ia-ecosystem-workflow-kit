# Migration Guide

Use this guide when moving from manual `.agents` copying to installer-managed templates.

## From manual copy to dry-run planning

1. Keep your current `.agents` files in place.
2. Run `workflow-kit init` without `--apply`.
3. Review `unchanged`, `create`, and `overwrite_with_backup` operations.
4. Merge local customizations before applying.

## Preserving local rules

Local domain rules belong in the repo overlay. Do not move product-specific instructions into portable core.

Recommended structure:

```text
.agents/instructions.md                  # neutral workflow source of truth
.agents/skills/registry.md               # skill discovery
.agents/skills/06-patterns/README.md     # local pattern-skill entrypoint
.agents/capabilities/registry.md         # local capability state
```

Default migration behavior installs the complete FHH IA Ecosystem `.agents2`-derived workflow so the target repository receives a ready-to-use flow instead of placeholders.

## Runtime adapters

Adapters should remain thin. If you already have `AGENTS.md`, `.github/copilot-instructions.md`, or `CLAUDE.md`, merge them so they point to `.agents/instructions.md` instead of duplicating workflow logic.

## Rollback

The installer does not delete files. For overwritten conflicts, use the `.workflow-kit-backup-<timestamp>` file created during apply.

## Upgrading safely after migration

`workflow-kit update` uses `.agents/workflow-kit/install-state.json` to decide which files are managed.

Behavior on update:

1. Managed and unchanged-from-last-apply files can be updated.
2. Managed but locally edited files are preserved as `skip_modified`.
3. Unmanaged files at colliding paths are preserved as `skip_unmanaged`.

If your repo was installed before install-state support, run a one-time bootstrap:

```bash
workflow-kit update --target /path/to/repo --runtime codex,copilot --overlay fhh-ia-ecosystem-full --adopt-existing --apply --yes
```

This records the current baseline and avoids immediate overwrites.

