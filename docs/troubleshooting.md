# Troubleshooting

## Dry-run shows `overwrite_with_backup`

The target file already exists with different content. If you apply, the installer creates a `.workflow-kit-backup-<timestamp>` file before writing the template.

Recommended action:

1. Review the existing file.
2. Run dry-run again after any manual merge.
3. Apply only when the planned overwrite is expected.

## Doctor reports missing files

Run `doctor` with the same runtime and overlay options used for install. If files are still missing, rerun `init` in dry-run mode to see what would be created.

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
