# Example: Neutral Core Only

Use when a team wants only the neutral `.agents` workflow contract and will create runtime adapters later.

## Preview

```bash
node bin/workflow-kit.mjs init --target ./platform-repo --runtime neutral --overlay none
```

## Apply after review

```bash
node bin/workflow-kit.mjs init --target ./platform-repo --runtime neutral --overlay none --apply --yes
```

This installs portable core files only. It does not create `AGENTS.md`, Copilot, or Claude adapter files.
