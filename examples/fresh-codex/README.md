# Example: Fresh Codex-ready Repository

Use when a new repository wants Codex plus starter local overlay placeholders.

## Preview

```bash
node bin/workflow-kit.mjs init --target ./my-repo --runtime codex --overlay starter
```

## Apply after review

```bash
node bin/workflow-kit.mjs init --target ./my-repo --runtime codex --overlay starter --apply --yes
```

## Validate

```bash
node bin/workflow-kit.mjs doctor --target ./my-repo --runtime codex --overlay starter
```

Expected adapter files include `AGENTS.md` and `.codex/README.md`.
