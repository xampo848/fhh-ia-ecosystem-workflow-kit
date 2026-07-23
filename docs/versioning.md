# Versioning Policy

Use semantic versioning once the project is approved for public distribution.

## Operational release contract for this private GitHub install

This toolkit has two independent update surfaces:

- the globally installed `workflow-kit` binary on a user's machine;
- the managed workflow files already installed inside target repositories.

Because of that, every real rollout needs two steps:

1. upgrade the toolkit binary;
2. update each managed repository.

If step 1 is skipped, `workflow-kit update` can only apply the template files bundled with the older binary already installed locally.

## Current pre-publication versions

Pre-publication versions can use descriptive prerelease-like identifiers in `package.json` while the package remains private, for example:

- `0.1.0-cli-mvp`
- `0.2.0-tui-mvp`
- `0.3.0-template-packs`

While the package remains private, every merge to `main` that changes the portable core, template packs, runtime adapters, planner/update logic, doctor semantics, or TUI update surface should also bump `package.json.version` before rollout consumption.

## Public version rules

After approval:

- `0.x` versions may change installer contracts while adoption is early.
- `1.0.0` requires stable CLI commands, documented template contracts, CI, and release checklist.
- Breaking changes to installed file paths require a major version after `1.0.0`.
- Template additions can be minor versions when backward-compatible.
- Documentation-only fixes can be patch versions.

## What requires a version bump in this repo

- Bump at least a patch version when `.agents/**`, `templates/**`, runtime adapter templates, or managed update behavior change in a way downstream repos should consume.
- Bump a minor version when you add a new user-visible command or flow such as `workflow-kit upgrade` or a new TUI route.
- Use a major version only when install-state contracts, installed paths, or overwrite semantics change incompatibly.

## Recommended rollout channels

- Fast channel: `workflow-kit upgrade --ref main --apply --yes`
- Pinned rollout: `workflow-kit upgrade --ref vX.Y.Z --apply --yes`

Prefer pinned tags for coordinated team rollouts. Use `main` only when you explicitly want the latest merged core.

## Release gates

Every version must pass:

```bash
npm test
npm run check
npm run check:templates
npm run check:release
```

Publishing remains approval-gated even when all checks pass.

