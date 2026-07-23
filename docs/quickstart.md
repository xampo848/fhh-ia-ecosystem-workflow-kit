# Quickstart

This guide shows the safe adoption path. Start with dry-run, inspect the plan, then apply only when ready.

If your repository already exists (has docs/skills/runtime conventions), start here first:

- [Get Started for Existing Repositories](get-started-existing-repo.md)

## 1. Preview an install

```bash
node bin/workflow-kit.mjs init --target /path/to/repo
```

Default behavior is dry-run. It prints planned files and writes nothing.

By default, `init` uses the complete FHH IA Ecosystem workflow overlay.

Operation meanings in preview:

- `create`: new file
- `unchanged`: no write
- `overwrite_with_backup`: write with backup first
- `merge_with_backup`: intelligent merge with backup first
- `skip_modified`: managed local edit protected during update
- `skip_unmanaged`: unmanaged collision protected during update
- `adopt_existing`: baseline captured during update bootstrap

## 2. Preview selected runtime adapters

```bash
node bin/workflow-kit.mjs init \
  --target /path/to/repo \
  --runtime codex,copilot
```

This always previews the complete FHH IA Ecosystem workflow package.

## 3. Apply after review

```bash
node bin/workflow-kit.mjs init \
  --target /path/to/repo \
  --runtime codex,copilot \
  --apply --yes
```

Apply requires both `--apply` and `--yes`. Changed existing files are backed up before overwrite.

For existing repositories, this apply step also enables:

- skills registry JSON merge,
- docs hub non-destructive insertion,
- one-time legacy docs migration map generation when legacy docs are detected.

## 4. Validate installed files

```bash
node bin/workflow-kit.mjs doctor \
  --target /path/to/repo \
  --runtime codex,copilot
```

`doctor` validates both installed files and workflow semantics. It reports
stable diagnostic codes for adapter coverage, per-turn intake, skill and
capability registries, and managed-file drift.

Supported first-class adapters are `codex`, `copilot`, `claude`, and
`antigravity`. The neutral workflow contract is always installed.

If doctor reports issues, go directly to [Troubleshooting](troubleshooting.md).

## 5. Upgrade the toolkit binary before updating repos

Preview the global toolkit upgrade command:

```bash
node bin/workflow-kit.mjs upgrade
```

Apply the latest `main` version to your machine:

```bash
node bin/workflow-kit.mjs upgrade --apply --yes
```

Pin to a released tag when needed:

```bash
node bin/workflow-kit.mjs upgrade --ref v0.7.0 --apply --yes
```

After that, run `update` in each target repository you manage.

## 6. Guided TUI

```bash
node bin/workflow-kit.mjs tui
```

The TUI index offers install, update, toolkit-upgrade, and capabilities-only flows. It always shows a preview before asking whether to write. The default confirmation writes nothing.
It can also open an optional capability guide (Context7, Engram, codebase-memory-mcp) with source/scope/mode confirmation and official install commands.
The install package is fixed to `Full FHH IA Ecosystem`.

## 7. Export templates without treating the output as a repo install

Preview export:

```bash
node bin/workflow-kit.mjs export --output /tmp/workflow-kit-export --runtime codex,copilot
```

Apply export after review:

```bash
node bin/workflow-kit.mjs export --output /tmp/workflow-kit-export --runtime codex,copilot --apply --yes
```

`export` uses the same dry-run-first planner and backup behavior as `init`.

## 8. Update an already-installed repo safely

Preview update:

```bash
node bin/workflow-kit.mjs update --target /path/to/repo
```

Apply update:

```bash
node bin/workflow-kit.mjs update --target /path/to/repo --apply --yes
```

Local edits in tracked files are preserved (`skip_modified`), and untracked path collisions are ignored (`skip_unmanaged`).

When an update includes a smart composition, it appears as `merge_with_backup`.

Legacy bootstrap when `.agents/workflow-kit/install-state.json` does not exist yet:

```bash
node bin/workflow-kit.mjs update \
  --target /path/to/repo \
  --runtime codex,copilot \
  --adopt-existing \
  --apply --yes
```

## 9. Optional alternative tools (Engram, Context7, codebase-memory-mcp)

After `init`, you can guide users to install or attach external capabilities.
Use the neutral integrations contract in `.agents/integrations/README`.

Recommended prompts in the target repo:

```text
Instala Context7 para este proyecto y adjuntalo al flujo neutral.
Antes de instalar, muestrame un resumen de confirmacion con fuente, scope y efecto esperado.
```

```text
Engram ya esta disponible globalmente. Haz solo attach en este repo y documenta el estado final.
```

```text
Quiero codebase-memory-mcp. Primero dime si es install+attach o attach-only y espera mi aprobacion antes de ejecutar comandos.
```

Minimum guardrails:

- Never install silently; require explicit approval first.
- Default to official/curated source unless user requests another source.
- Record selected scope (`user/global`, `repo/project`, or `hybrid`).
- A capability is complete only when it is attached and documented in the repo.

## 10. Common adoption doubts

- "How do I migrate docs I already had?"
: Use `docs/workflow/migration/legacy-docs-map.md` if generated. It includes suggested destinations and `git mv` commands.

- "Where do I configure backend/frontend standards?"
: Use `docs/workflow/standards/setup-and-migration.md`, `docs/workflow/standards/backend.md`, and `docs/workflow/standards/frontend.md` in the target repository.

- "How do I recover from a wrong apply?"
: Restore from `*.workflow-kit-backup-<timestamp>` files and re-run dry-run before applying again.
