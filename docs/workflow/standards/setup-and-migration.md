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

Note: the project's own rules live in `.agents/project/backend.md`, `.agents/project/frontend.md` and `.agents/project/context.md`. `init` creates them as templates, with a template marker, and does not fill them in: each repository does, usually by asking its agent for the initial Discovery of the project.

## Migration policy

- Prefer moving existing docs rather than duplicating content.
- Keep one canonical document per topic.
- Use links from old paths only when required for compatibility.
- Preserve git history with `git mv` whenever possible.

## Completion checklist

- Backend standards stated in `.agents/project/backend.md` or reached by a pointer from it to a document in `docs/workflow/standards/` or elsewhere.
- Frontend standards stated in `.agents/project/frontend.md` or reached by a pointer from it to a document in `docs/workflow/standards/` or elsewhere.
- Backend/frontend runtime instruction files are present at `.agents/project/backend.md` and `.agents/project/frontend.md` and filled in. When the project lacks one of those surfaces, its file holds one line that says so; the file is never deleted (`workflow-kit doctor` reports a deleted one as missing).
- `.agents/project/context.md` (legacy: `.agents/project-context.md`) filled in with an initial Discovery (structure map, validation commands with their cost, environment quirks) and its template marker removed; `workflow-kit doctor` stops reporting `project-context/not-initialized`.
- Own skills live in `.agents/project/skills/<name>/` with a row in `.agents/project/index.md`, never in the kit's `.agents/skills/` catalogs; `workflow-kit doctor` reports `boundary/unowned-path` for an own file left in a kit folder.
- Validation reuse stays in shadow mode until 2 or 3 implementations show identical results; only then add `validation_reuse: active` to `.agents/project/context.md` (legacy: `.agents/project-context.md`).
- Legacy docs either migrated or explicitly marked as archived.
- `docs/workflow/migration/legacy-docs-map.md` reviewed and updated, if it was generated.

`docs/workflow/standards/project-instructions-template.md` says how to fill in the files `init` created.
