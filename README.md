# All Metrics Workflow Kit

Private, installable AI workflow kit for bringing the All Metrics-style agent workflow into other repositories safely.

> Current status: **private GitHub install/export ready**. The package provides a dry-run-first CLI, guided TUI, template export, doctor validation, manifest-validated template packs, release guardrails, and adoption docs. It is intentionally **not published to npm**.

## Install from the private GitHub repository

You need access to the private repository: `xampo848/all-metrics-workflow-kit`.

Using SSH:

```bash
npm install -g git+ssh://git@github.com/xampo848/all-metrics-workflow-kit.git
```

Using GitHub shorthand with HTTPS auth already configured:

```bash
npm install -g github:xampo848/all-metrics-workflow-kit
```

Then verify:

```bash
workflow-kit --help
```

## Quickstart: install into a repo safely

Always preview first. Dry-run is the default and writes nothing:

```bash
workflow-kit init --target /path/to/repo --runtime codex,copilot
```

By default, the installer uses the complete All Metrics workflow overlay so the target repo gets the full ready-to-use flow.

Apply only after reviewing the plan:

```bash
workflow-kit init --target /path/to/repo --runtime codex,copilot --apply --yes
```

Validate the installed files:

```bash
workflow-kit doctor --target /path/to/repo --runtime codex,copilot
```

## Safe updates for already-installed repositories

Use `update` to refresh only workflow-kit managed files.

### Real upgrade flow (update the toolkit binary first)

When you release a new toolkit version, users should update their global install first, then run `workflow-kit update` inside each target repository.

Install a specific released tag:

```bash
bun add -g github:xampo848/all-metrics-workflow-kit#v0.7.0
```

Or track the latest default branch:

```bash
bun add -g github:xampo848/all-metrics-workflow-kit
```

Verify installed version:

```bash
workflow-kit --help
```

Then run repository update:

```bash
workflow-kit update --target /path/to/repo --apply --yes
```

Preview first:

```bash
workflow-kit update --target /path/to/repo
```

Apply after review:

```bash
workflow-kit update --target /path/to/repo --apply --yes
```

Update behavior:

- Only files tracked in `.agents/workflow-kit/install-state.json` are eligible for overwrite.
- If a tracked file was edited locally, it is skipped as `skip_modified`.
- If an untracked file exists at the same path, it is skipped as `skip_unmanaged`.
- Missing tracked files are recreated.

### One-time bootstrap for legacy installs

Older installs may not have an install state file yet. Bootstrap safely without overwriting current files:

```bash
workflow-kit update --target /path/to/repo --runtime codex,copilot --overlay all-metrics-full --adopt-existing --apply --yes
```

This records the current baseline in `.agents/workflow-kit/install-state.json` and preserves existing content.

## Export templates without installing into a repo

Preview export:

```bash
workflow-kit export --output /tmp/workflow-kit-export --runtime codex,copilot
```

Apply export:

```bash
workflow-kit export --output /tmp/workflow-kit-export --runtime codex,copilot --apply --yes
```

## Guided TUI

```bash
workflow-kit tui
```

The TUI asks for target path, runtimes, and overlay, then shows a preview before asking whether to write. The default answer writes nothing.

## Supported runtimes

- `neutral` — portable `.agents` core only.
- `codex` — adds `AGENTS.md` and Codex adapter notes.
- `copilot` — adds GitHub Copilot instruction adapters.
- `claude` — adds `CLAUDE.md`.
- `antigravity` — adds `ANTIGRAVITY.md` and Antigravity adapter notes.

Combine runtimes with commas:

```bash
workflow-kit init --target /path/to/repo --runtime codex,copilot,claude,antigravity
```

## Installation Mode

The normal install path always uses the complete All Metrics workflow surface, including the full `.agents` tree, skills, manifests, and workflow metadata.

The CLI and TUI now treat that full install as the standard path so users do not have to choose between partial or placeholder setups.

## Safety guarantees

- Dry-run is the default.
- Apply requires `--apply --yes`.
- Existing changed files are backed up before overwrite.
- Runtime adapters stay thin and point back to `.agents/instructions.md`.
- Portable core and repo overlay stay separate.
- The package remains `private: true` to prevent accidental npm registry publication.

## Project structure

```text
all-metrics-workflow-kit/
  bin/workflow-kit.mjs
  src/                       # CLI, planner, apply, doctor, TUI
  templates/                 # manifest-validated portable/adapters/overlay packs
  docs/                      # install, quickstart, migration, troubleshooting
  examples/                  # adoption scenarios
  scripts/                   # validation guardrails
  test/                      # Node test suite
```

## Validation for maintainers

```bash
npm test
npm run check
npm run check:templates
npm run check:release
npm run check:docs
npm pack --dry-run
```

If your local npm cache has permission issues, use a temporary cache:

```bash
npm_config_cache=/tmp/workflow-kit-npm-cache npm pack --dry-run
```

## Documentation

- [Private GitHub install](docs/private-github-install.md)
- [Quickstart](docs/quickstart.md)
- [Adapter authoring](docs/adapter-authoring.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Migration](docs/migration.md)
- [Versioning](docs/versioning.md)
- [Release Checklist](RELEASE.md)

## Examples

- [Fresh Codex repository](examples/fresh-codex/README.md)
- [Existing GitHub Copilot repository](examples/existing-copilot/README.md)
- [Neutral core only](examples/neutral-core/README.md)

## Release/publishing note

This repository is private. Do not run `npm publish`, create public releases, or change repository visibility without explicit maintainer approval.
