# Example: Full Workflow Without Adapters

Use when a team wants the full `.agents` workflow package and will add runtime adapters later.

## Preview

```bash
node bin/workflow-kit.mjs init --target ./platform-repo --runtime neutral
```

## Apply after review

```bash
node bin/workflow-kit.mjs init --target ./platform-repo --runtime neutral --apply --yes
```

This installs the full workflow package. No runtime adapter files are created (`AGENTS.md`, Copilot, Claude, etc.) while runtime stays `neutral`.
