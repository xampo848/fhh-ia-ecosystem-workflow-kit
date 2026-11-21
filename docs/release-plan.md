# Release Plan

This document records the intended release path. It is not a publishing script.

## Pre-release gates

Before any release:

1. Dry-run stays the default and apply requires `--apply --yes`.
2. Conflict preview, backups, and `rollback` are tested.
3. Template boundaries and runtime adapters are validated as thin wrappers.
4. README and docs install commands match the real CLI.
5. CI passes `check:security`, `test`, `check`, `check:workflow`, `check:docs`,
   `check:release`, and `check:legal` (template packs are validated inside
   `check:workflow`).

The step-by-step checklist is in [RELEASE.md](../RELEASE.md).

## Publishing approval

Do not run GitHub repository creation, package publication, release uploads, tag pushes, or push automation without explicit maintainer approval.

## Versioning

Versions follow [Versioning](versioning.md). The current version is the one in
`package.json` (`0.17.6-bounded-output` at the time of writing); its notes are
in `CHANGELOG.md`. Each released version has a `v<version>` tag; the list is
in [Versioning](versioning.md).
