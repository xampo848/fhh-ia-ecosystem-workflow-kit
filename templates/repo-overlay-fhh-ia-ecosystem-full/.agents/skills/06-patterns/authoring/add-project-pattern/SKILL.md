---
name: add-project-pattern
description: "Authoring helper for creating and registering project-specific pattern skills in repo overlays."
user-invocable: true
---

# Add Project Pattern

Use when the user asks to create, register, or evolve a local pattern skill in
`.agents/skills/06-patterns/**`.

This skill exists to keep project overlays extendible and avoid hard-coded
patterns from other products.

## Inputs

- The concrete technical surface to standardize (backend, frontend, domain, or
  another project-specific domain).
- The target pattern skill name (short and stable).
- The expected trigger sentence for loading.
- Validation hooks that prove correct usage.
- Optional fallback docs if pattern coverage is not complete yet.

## Procedure

1. Confirm scope: one repeatable implementation class, not a whole workflow.
2. Choose path:
   `.agents/skills/06-patterns/<domain>/<skill>/SKILL.md`.
3. Start from
   `.agents/skills/06-patterns/authoring/pattern-skill-template.md`.
4. Create `SKILL.md` with:
   - frontmatter (`name`, `description`),
   - trigger,
   - must-read references,
   - step-by-step procedure,
   - validation hooks,
   - stop conditions,
   - out-of-scope notes.
5. Register the skill in `.agents/skills/registry.md` under standards/pattern
   skills with:
   - stable name,
   - class `Standards/pattern`,
   - exact path,
   - narrow trigger,
   - loading posture (usually `Just-in-time`),
   - cost hint,
   - stable key.
6. Regenerate/update derived artifacts:
   `.agents/skills/registry.json` and `.agents/skills/registry.cache.json`.
7. Validate no stale references to removed or foreign-project patterns remain.

## Validation Hooks

- Path exists and ends with `SKILL.md`.
- `registry.md` contains matching row with the exact path.
- `registry.json` pattern skill entry matches `registry.md`.
- `registry.cache.json` contains matching `pattern_skills` entry.
- Overlay manifest includes the new pattern skill when it is part of shipped
  overlay defaults.

## Stop Conditions

- The requested pattern is really a workflow orchestrator.
- The scope is too broad to define one repeatable pattern.
- Registry entry cannot be made deterministic (name/path/trigger unclear).

## Out of Scope

- Installing external capabilities.
- Rewriting router policy beyond needed extension-routing metadata.
- Editing product code unrelated to pattern authoring.
