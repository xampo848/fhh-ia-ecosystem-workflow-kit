# Standards Setup and Migration (One-Time Init)

Use this guide once, right after installing workflow-kit into an existing repository.

## Goal

Adopt workflow documentation structure without losing legacy documents.

## One-time initialization flow

1. Confirm workflow docs scaffold exists under `docs/workflow/`.
2. Open `docs/workflow/migration/legacy-docs-map.md` if it was generated.
3. Move legacy docs into coherent destinations using `git mv`.
4. Update backlinks from old docs, README, and contribution docs.
5. Validate your doc set and commit the migration.

## What is generated automatically

- `docs/README.md` workflow section (safe marker block; non-destructive).
- `docs/workflow/README.md` map for workflow docs.
- `docs/workflow/migration/legacy-docs-map.md` if legacy docs were detected.
- Standards setup docs for backend and frontend.

Note: workflow-kit does not auto-generate project-specific runtime instructions. Each target repository should provide `.github/instructions/backend.instructions.md` and `.github/instructions/frontend.instructions.md` when those code surfaces exist.

## Migration policy

- Prefer moving existing docs rather than duplicating content.
- Keep one canonical document per topic.
- Use links from old paths only when required for compatibility.
- Preserve git history with `git mv` whenever possible.

## Completion checklist

- Backend standards consolidated in `docs/workflow/standards/backend.md` or linked canonical docs.
- Frontend standards consolidated in `docs/workflow/standards/frontend.md` or linked canonical docs.
- Backend/frontend runtime instruction files are present at `.github/instructions/backend.instructions.md` and `.github/instructions/frontend.instructions.md` (or explicitly marked as N/A when the surface does not exist).
- Legacy docs either migrated or explicitly marked as archived.
- `docs/workflow/migration/legacy-docs-map.md` reviewed and updated.

Use `docs/workflow/standards/project-instructions-template.md` as a copy/paste starter.
