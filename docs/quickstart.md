# Quickstart

This guide shows the safe adoption path. Start with dry-run, inspect the plan, then apply only when ready.

## 1. Preview a neutral-core install

```bash
node bin/workflow-kit.mjs init --target /path/to/repo
```

Default behavior is dry-run. It prints planned files and writes nothing.

By default, `init` uses the complete All Metrics workflow overlay.

## 2. Preview selected runtime adapters

```bash
node bin/workflow-kit.mjs init \
  --target /path/to/repo \
  --runtime codex,copilot

This always previews the complete All Metrics workflow package.
```

## 3. Apply after review

```bash
node bin/workflow-kit.mjs init \
  --target /path/to/repo \
  --runtime codex,copilot \
  --apply --yes
```

Apply requires both `--apply` and `--yes`. Changed existing files are backed up before overwrite.

## 4. Validate installed files

```bash
node bin/workflow-kit.mjs doctor \
  --target /path/to/repo \
  --runtime codex,copilot
```

## 5. Guided TUI

```bash
node bin/workflow-kit.mjs tui
```

The TUI prompts for target, runtimes, and overlay; it always shows a preview before asking whether to write. The default confirmation writes nothing.

## 6. Export templates without treating the output as a repo install

Preview export:

```bash
node bin/workflow-kit.mjs export --output /tmp/workflow-kit-export --runtime codex,copilot
```

Apply export after review:

```bash
node bin/workflow-kit.mjs export --output /tmp/workflow-kit-export --runtime codex,copilot --apply --yes
```

`export` uses the same dry-run-first planner and backup behavior as `init`.
