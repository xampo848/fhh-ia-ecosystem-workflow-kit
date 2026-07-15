# Troubleshooting

## Dry-run shows `overwrite_with_backup`

The target file already exists with different content. If you apply, the installer creates a `.workflow-kit-backup-<timestamp>` file before writing the template.

Recommended action:

1. Review the existing file.
2. Run dry-run again after any manual merge.
3. Apply only when the planned overwrite is expected.

## Doctor reports missing files

Run `doctor` with the same runtime and overlay options used for install. If files are still missing, rerun `init` in dry-run mode to see what would be created.

## Update fails with "No install state found"

Your repo was likely installed before state tracking was introduced. Bootstrap baseline state without overwriting current files:

```bash
workflow-kit update --target /path/to/repo --runtime codex,copilot --overlay all-metrics-full --adopt-existing --apply --yes
```

After that, regular `workflow-kit update --apply --yes` runs will perform managed, safe updates.

## Update shows `skip_modified` or `skip_unmanaged`

- `skip_modified`: the file is managed but was changed locally after last apply, so update protects it.
- `skip_unmanaged`: file exists at a workflow-kit path but is not tracked in install state, so update does not overwrite it.

If you want that file managed, align content intentionally and re-run with review.

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
npm test
npm run check
npm run check:templates
npm run check:release
npm run check:docs
```

The failure message should name the missing file, unsafe script, invalid template pack, or missing documentation phrase.

## I accidentally applied over a file

Look for a backup next to the overwritten file:

```text
<file>.workflow-kit-backup-<timestamp>
```

Restore manually after reviewing both versions.
