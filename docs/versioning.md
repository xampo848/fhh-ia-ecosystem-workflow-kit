# Versioning Policy

The kit is distributed from its public GitHub repository (not npm) and uses
semantic versioning with a descriptive suffix, for example
`0.16.0-safe-update` or `0.17.0-audit-hardening`. The history is in
[CHANGELOG.md](../CHANGELOG.md).

## Two update surfaces

- the globally installed `workflow-kit` binary on a user's machine;
- the managed workflow files already installed inside target repositories.

Every rollout therefore needs two steps:

1. upgrade the toolkit binary (`workflow-kit upgrade --apply --yes`);
2. update each managed repository (`workflow-kit update --target <repo> --apply --yes`).

If step 1 is skipped, `update` can only apply the templates bundled with the
older binary.

## Rollout channels

- **`main`:** `workflow-kit upgrade --apply --yes` installs the latest merged
  version.
- **Pinned tag:** `workflow-kit upgrade --ref <tag> --apply --yes`. Pinned tags
  are the better choice for coordinated team rollouts.

A tag is the version with a `v` prefix and points at the commit on `main` that
released it. Tags of the current lines:

| Tag | Notes |
| --- | --- |
| `v0.21.0-project-runbooks` | current |
| `v0.20.0-kit-overlay-contract` | |
| `v0.19.2-visual-lock` | |
| `v0.19.1-tui-option-clarity` | |
| `v0.19.0-test-design` | |
| `v0.18.1-orchestrator-reads` | |
| `v0.18.0-equilibrado-profile` | |
| `v0.17.6-bounded-output` | |
| `v0.17.5-slice-checkpoint` | |
| `v0.17.4-usage-measurement` | |
| `v0.17.3-contract-gaps` | |
| `v0.17.2-catalog-rows` | |
| `v0.17.1-stack-detection` | |
| `v0.17.0-audit-hardening` | |
| `v0.16.2-remove-slidev` | |
| `v0.16.1-roadmap-closure` | |
| `v0.16.0-safe-update` | |
| `v0.10.0-implement-change` | |
| `v0.7.40-contextual-model-selection` | last `0.7.x` |

Versions `0.8.0`, `0.9.0` and `0.11.0`–`0.15.0` were merged inside larger pull
requests and have no commit of their own on `main`, so they have no tag; pin
the next tagged version instead. Older `0.7.x` tags are on the
[Releases page](https://github.com/xampo848/fhh-ia-ecosystem-workflow-kit/releases).

## What requires a version bump

`bun run check:release` fails when `.agents/**`, `templates/**`, `src/**`,
`bin/**`, `scripts/**`, or the CI workflow changed without a
`package.json.version` bump.

- Patch: fixes downstream repos should consume, and documentation-only fixes.
- Minor: a new user-visible command or flow (for example `rollback` or a new
  TUI route), or backward-compatible template additions.
- Major (after `1.0.0`): incompatible changes to install-state contracts,
  installed paths, or overwrite semantics. While on `0.x`, such changes are
  allowed but must be called out in the changelog and `docs/migration.md`.

`1.0.0` requires stable CLI commands, documented template contracts, CI, and
the release checklist.

## Release gates

Every version must pass (CI runs the same set; there `check:templates` runs
inside `check:workflow`):

```bash
bun run check:security
bun run test
bun run check
bun run check:workflow
bun run check:templates
bun run check:docs
bun run check:legal
bun run check:release
```

Publishing a tag or release remains approval-gated even when all checks pass;
see [RELEASE.md](../RELEASE.md).
