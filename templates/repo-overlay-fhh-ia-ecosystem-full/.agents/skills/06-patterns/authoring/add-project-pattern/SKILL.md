---
name: add-project-pattern
description: "Authoring helper for creating and registering project-specific pattern skills in repo overlays."
user-invocable: true
---

# Add Project Pattern

Use when the user asks to create, register, or evolve a pattern skill that
belongs to this project. Project patterns live only in the project overlay
`.agents/project/**` (contract: `.agents/kit-boundary.md`), so a kit update
never touches them.

This skill exists to keep project overlays extendible and avoid hard-coded
patterns from other products.

## Inputs

- The concrete technical surface to standardize (backend, frontend, domain, or
  another project-specific domain).
- The target pattern skill name (short and stable, and not the name of a kit
  skill).
- The expected trigger sentence for loading.
- Validation hooks that prove correct usage.
- Optional fallback docs if pattern coverage is not complete yet.

## Procedure

1. Confirm scope: one repeatable implementation class, not a whole workflow.
2. Check the name against the kit catalogs (`.agents/skills/index.md` and
   `.agents/skills/06-patterns/index.md`). If the user wants to change a kit
   skill instead, use extend or shadow (`.agents/kit-boundary.md`), not a new
   skill with the same name.
3. Choose path: `.agents/project/skills/<skill>/SKILL.md`. The folder name and
   the frontmatter `name` are equal (Agent Skills format).
4. Start from
   `.agents/skills/06-patterns/authoring/pattern-skill-template.md`.
5. Create `SKILL.md` with:
   - frontmatter (`name`, `description`),
   - trigger,
   - must-read references (kit skills by name, never by path),
   - step-by-step procedure,
   - validation hooks,
   - stop conditions,
   - out-of-scope notes.
   - `Rollout Lifecycle` when the pattern governs controlled production activation.
6. Register the skill in the `Skills` table of `.agents/project/index.md`
   (create the file with the table header from `.agents/kit-boundary.md` when it
   does not exist): stable name, class `Pattern`, narrow trigger, exact path,
   cost hint. The router and the implementation matcher read this table.
7. Validate no stale references to removed or foreign-project patterns remain.

Never write a project pattern under `.agents/skills/**` and never edit the kit
registries (`registry.md`, `registry.json`, `registry.cache.json`) or the kit
indexes for it: those are kit files and a kit update replaces them.

## Validation Hooks

- Path exists under `.agents/project/skills/` and ends with `SKILL.md`.
- `.agents/project/index.md` has one `Skills` row with the exact path.
- The name collides with no kit skill.
- `git status` shows no change under `.agents/skills/`.

## Stop Conditions

- The requested pattern is really a workflow orchestrator.
- The scope is too broad to define one repeatable pattern.
- Catalog entry cannot be made deterministic (name/path/trigger unclear).
- A rollout-governing pattern lacks owner, default disabled state, both-state tests, rollback path, or retirement plan.

## Out of Scope

- Installing external capabilities.
- Rewriting router policy beyond needed extension-routing metadata.
- Editing product code unrelated to pattern authoring.
