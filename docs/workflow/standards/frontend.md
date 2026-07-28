# Frontend Standards Setup

This document explains how to configure and migrate frontend standards when adopting workflow-kit in an existing repository.

## Minimum baseline

1. Define canonical frontend standards location in this folder.
2. Reference the standards from implementation and review workflows.
3. Ensure automated validation is available locally and in CI.

## Recommended configuration checklist

- Define design system or UI consistency rules.
- Define lint/format commands and required pass conditions.
- Define testing strategy (unit, integration, and E2E where applicable).
- Define accessibility and responsive behavior checks.
- Define performance and bundle constraints when relevant.

## Migration from legacy docs

If your project already had frontend guidance in scattered docs:

1. Review `docs/workflow/migration/legacy-docs-map.md` suggestions.
2. Move canonical guides to `docs/workflow/standards/` with `git mv`.
3. Preserve useful legacy references via links instead of duplicates.
4. Update links in onboarding or contributor docs.

## Suggested command hooks

- Lint/style: project-specific frontend lint command
- Tests: project-specific frontend test command
- E2E: project-specific UI flow validation command when available

Keep this document technology-neutral and extend it with repository-specific standards.
