# Example: Existing GitHub Copilot Repository

Use when a repository already has Copilot instructions and you need to preview conflicts safely.

## Preview

```bash
node bin/workflow-kit.mjs init --target ./existing-repo --runtime copilot --overlay starter
```

If `.github/copilot-instructions.md` already exists, dry-run may show `overwrite_with_backup`. Review before applying.

## Apply after review

```bash
node bin/workflow-kit.mjs init --target ./existing-repo --runtime copilot --overlay starter --apply --yes
```

Backups are created next to changed files before overwrite.
