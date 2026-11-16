# Example: Fresh Codex-ready Repository

Use when a new repository wants the full workflow package plus Codex runtime adapter.

## Preview

```bash
workflow-kit init --target ./my-repo --runtime codex
```

## Apply after review

```bash
workflow-kit init --target ./my-repo --runtime codex --apply --yes
```

## Validate

```bash
workflow-kit doctor --target ./my-repo --runtime codex
```

Expected adapter files include `AGENTS.md` and `.codex/README.md`.
