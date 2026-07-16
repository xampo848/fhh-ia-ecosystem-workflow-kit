# Versioning Policy

Use semantic versioning once the project is approved for public distribution.

## Current pre-publication versions

Pre-publication versions can use descriptive prerelease-like identifiers in `package.json` while the package remains private, for example:

- `0.1.0-cli-mvp`
- `0.2.0-tui-mvp`
- `0.3.0-template-packs`

## Public version rules

After approval:

- `0.x` versions may change installer contracts while adoption is early.
- `1.0.0` requires stable CLI commands, documented template contracts, CI, and release checklist.
- Breaking changes to installed file paths require a major version after `1.0.0`.
- Template additions can be minor versions when backward-compatible.
- Documentation-only fixes can be patch versions.

## Release gates

Every version must pass:

```bash
npm test
npm run check
npm run check:templates
npm run check:release
```

Publishing remains approval-gated even when all checks pass.

