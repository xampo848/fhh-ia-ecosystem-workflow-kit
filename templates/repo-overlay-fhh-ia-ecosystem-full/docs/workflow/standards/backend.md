# Backend Standards Setup

This document explains how to configure and migrate backend standards when adopting workflow-kit in an existing repository.

## Minimum baseline

1. Define canonical backend standards location in this folder.
2. Reference the standards from your implementation workflow docs and PR templates.
3. Add validation commands in project scripts or CI.

## Recommended configuration checklist

- Pick a primary language/framework policy source (for example, framework guides + team conventions).
- Define formatting/linting command(s) and make them executable in CI.
- Define testing command(s) and expected pass criteria for PRs.
- Define API/contract validation expectations when backend serves frontend.
- Define migration and rollback expectations for data-affecting changes.

## Migration from legacy docs

If your project already had backend standards in other docs paths:

1. Locate candidates in `docs/workflow/migration/legacy-docs-map.md`.
2. Move the canonical doc(s) into `docs/workflow/standards/` using `git mv`.
3. Keep aliases/links in old locations only when needed for backward compatibility.
4. Update any old references in README, CONTRIBUTING, or CI docs.

## Suggested command hooks

- Lint: project-specific lint command
- Tests: project-specific unit/integration command
- Contracts: contract checks between backend/frontend when applicable

Keep this document technology-neutral and add repository-specific rules below this line.
