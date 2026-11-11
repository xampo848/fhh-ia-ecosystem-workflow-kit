---
name: backend-phase-implementer
description: "Delegate-only skill for implement-prd. Alias: Turbo Backend. Implements backend slices in any stack, including models, migrations, services, controllers, serializers, background jobs, i18n, and tests, following the project's own backend and stack rules. Use only with explicit file ownership from the orchestrator."
---

# Backend Phase Implementer

Alias: Turbo Backend.

Use for backend implementation slices delegated by `implement-prd`. Invoke it through the generated runtime adapter for this role (listed in `.agents/skills/02-implement/implement-prd/reference/delegate-skill-matrix.md`) with strict file ownership; run it inline when subagents are unavailable.

## Mission

Implement the assigned backend slice completely: code, tests, i18n, focused validation, and explicit code quality evidence.

## Inputs From Orchestrator

- PRD path and relevant acceptance criteria.
- Slice objective.
- Files owned and files forbidden.
- Discovery notes and required docs.
- Matcher output: `required_pattern_skills`, `optional_capabilities`, `fallback_docs`, `validation_hooks`, `handoff_required_fields`, `match_confidence`, `blocked_reason`.
- Quality gate loaded from `.agents/project/quality-gate.md`.
- Validation command target.

## Must Read

Use exists-or-skip for product docs. A missing optional path is not a failed search.

- `.agents/delegation/delegate-contract.md` (not `.agents/instructions.md` or the router)
- `.agents/project/backend.md` when it exists, and `.agents/project/stack.md` when it exists
- `docs/foundations/ARCHITECTURE.md` only when it exists and the slice is cross-layer, architectural, migration-heavy, authorization-sensitive, or tenancy-sensitive
- `.agents/project/quality-gate.md`. If it is missing, never skip it silently: report `quality gate: no configurado`; if the PRD requires it or the level is N3, return `blocked`
- Exact matcher-selected `required_pattern_skills` paths when present.
- Matcher-selected `fallback_docs` when required pattern skills are absent.
- Relevant backend docs from `docs/patterns/backend/`
- Existing analogous backend files and tests.

## Backend Rules

Framework, library, and command rules are the project's, not this skill's:
follow `.agents/project/backend.md` and `.agents/project/stack.md`. If neither
exists, reuse the conventions of the analogous files you read and say so in
the handoff. Stack-neutral rules that always apply:

- Entry points (controllers, handlers) delegate business logic to the project's service layer.
- Use the project's authorization mechanism; do not introduce a second one.
- Respect tenant and organization scoping.
- Never add cross-tenant queries without explicit inline justification and regression tests.
- Put user-facing text in the project's locale files, never inline.
- Use the project's test framework and the validation commands declared in `.agents/project-context.md`.

## Code Quality Gate

Before editing, identify and record:

- Existing backend pattern to reuse.
- SOLID risk: which class/service/module could gain too many responsibilities.
- DRY risk: duplicated business rules, enum/status mappings, query logic, authorization, serializer fields, or validations to avoid.
- KISS/YAGNI constraint: the simplest acceptable service/model/controller shape and any abstraction explicitly not needed.
- Hardcoding risk: strings, roles, tenant IDs, statuses, severity/category values, thresholds, credentials, URLs, API payload fields.
- Test evidence required for each acceptance criterion.

Reject the implementation or return `blocked` if satisfying the slice requires quality violations outside the assigned scope.

## Procedure

1. Reconfirm file ownership before editing.
2. Read every matcher-selected required pattern skill path before editing. If a required path is missing, return `blocked`.
3. If no required pattern skill exists, read the matcher-selected fallback docs and record which were used.
4. Read nearby tests first, then implementation files.
5. Name the existing pattern being reused before creating or changing code.
6. Record whether any matcher-suggested optional capability was actually used and whether it was active.
7. Implement the smallest backend change that satisfies the slice.
8. Keep business rules in services or domain collaborators, not controllers, serializers, jobs, or callbacks.
9. Add or update tests with positive, empty/error, auth, tenancy, and contract cases as relevant.
10. Add i18n keys for any user-facing backend text.
11. Run the narrowest validation that can falsify the slice, preserving matcher validation hooks when present. Use the backend commands declared in `.agents/project-context.md` (or `.agents/project/stack.md`): the fast focused test target first, a single test file only when it is the narrowest reliable check, and lint only for touched backend files.
12. Fix root causes. Do not silence tests, weaken assertions, bypass tenant checks, or lower standards.
13. Complete the quality gate result and matcher-consumption evidence in the handoff.

## Stop And Ask When

- A migration is destructive.
- The PRD does not define a required business rule.
- Authorization or tenancy behavior is unclear.
- A public API field must change outside the assigned slice.
- The slice requires duplicating business knowledge instead of using an existing authoritative representation.
- The slice requires hardcoding a value that should belong in i18n, config, constants, enums, permissions, serializers, or tests.
- A new abstraction or design pattern seems necessary but is not justified by the PRD or existing patterns.

## Handoff Output

Return exactly the TOON schema defined in `.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md` for `turbo-backend`.
