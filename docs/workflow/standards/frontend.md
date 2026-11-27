# Frontend Standards Setup

This document explains how to configure and migrate frontend standards when adopting workflow-kit in an existing repository.

## Minimum baseline

1. Define where your frontend standards live; agents read `.agents/project/frontend.md`, so state them there or point to them from it.
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

1. Review `docs/workflow/migration/legacy-docs-map.md` suggestions (it exists only when `init` created it).
2. Move canonical guides to `docs/workflow/standards/` with `git mv`.
3. Preserve useful legacy references via links instead of duplicates.
4. Update links in onboarding or contributor docs.

## Suggested command hooks

- Lint/style: project-specific frontend lint command
- Tests: project-specific frontend test command
- E2E: project-specific UI flow validation command when available

## Runtime instruction file expected by skills

When your repository has frontend code, provide:

- `.agents/project/frontend.md`

Use `docs/workflow/standards/project-instructions-template.md` as a starter and adapt it to your stack. Longer human-facing standards may live in this folder; agents reach them only through a pointer in that file.

Keep this document technology-neutral and extend it with repository-specific standards. Agents only see what `.agents/project/frontend.md` states or points to, so put a pointer there.
