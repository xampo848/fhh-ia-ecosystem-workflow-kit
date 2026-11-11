# Changelog

Versions follow `docs/versioning.md`. While the package is `0.x`, installed
paths may change between versions; every change below is applied by
`workflow-kit update` without deleting or moving files in your repository.
Migration details are in `docs/migration.md`.

## 0.16.2-remove-slidev

- Removed the Slidev presentation (`slides.md`), its `slides:*` scripts and its
  CI build step. Nothing installed in target repositories changes.
- Removed the Slidev development dependencies, the three local dependency
  patches and the seven version overrides that existed only for that tree. The
  package now has one runtime and one development dependency.
- `check:security` accepts an empty patch inventory (then any advisory fails)
  and rejects a patch registered in `package.json` that the inventory does not
  document.

## 0.16.1-roadmap-closure

- A protected file whose content already equals the new version is reported as
  `unchanged` and stops being protected, so taking the new version by hand
  ends the `skip_modified` and `managed/content-drift` reports.
- `doctor` reports `skills/local-catalog-missing-skill` when a repository's own
  skill index or registry does not list an installed workflow-kit skill.
- `create-prd` proposes interaction-order edge cases for visible UI (first
  interaction after load, interaction while another is in progress, touch).
- README section "Per-project setup after installing".

## 0.16.0-safe-update

- `update` and `init` list the one-time migrations a plan carries, and
  `--diff` prints the line diff of every file that would change.
- The TUI asks for a stack pack on install and runs `doctor` after applying.
- End-to-end upgrade tests from the legacy layout for every runtime.

## 0.15.0-neutral-structure

- Project rules live in `.agents/project/` (quality gate, backend, frontend);
  Copilot gets generated copies that keep your `applyTo` frontmatter.
- Rails and React rules moved from the skills to the `rails-react` stack pack
  (`.agents/project/stack.md`); existing installs receive it by default.
- No own skill file exceeds 200 lines. Claude Code gets `.claude/skills/`
  wrappers. `opencode` is accepted as a runtime. Teaching notes are selective.

## 0.14.0-prd-pr-quality

- PRDs gain "Supuestos e integraciones" and "Que queda obsoleto"; `create-prd`
  asks edge cases by confirmation and measures PRD size signals.
- `solution-sketch` offers optional UI paths with HTML mockups.
- `pr-comments-resolution` evaluates every comment before offering options.

## 0.13.0-validation-reuse

- Expensive deterministic checks can reuse a result when a script-computed
  fingerprint proves nothing changed (starts in shadow mode). QA re-entries
  are focused on the repair.

## 0.12.0-cheaper-preparation

- `.agents/project-context.md` is the project's fixed knowledge base.
- Delegates read `.agents/delegation/delegate-contract.md` instead of the
  routing contract. N3 uses a verified PRD index.

## 0.11.0-execution-brakes

- At most 2 repair rounds per slice, one recovery attempt for an environment
  failure, one rerun for a flaky test. Temporary AI state moved to the
  Git-ignored `.ai-work/<prd-slug>/`.

## 0.10.0-implement-change

- `implement-change` is the general implementation route for PRDs, bugs,
  tickets, and iterations; `implement-prd` stays as a permanent alias.

## 0.9.0-model-profiles

- Delegate agents get their model from a per-project profile: `calidad`
  (subscription) or `costo` (Copilot and per-token APIs).

## 0.8.0-proportional-loading

- Task levels N0–N3 with a generated pre-filter in every runtime adapter; the
  router was split into a small core plus references.
