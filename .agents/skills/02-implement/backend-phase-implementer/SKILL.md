---
name: backend-phase-implementer
description: "Delegate-only skill for implement-prd. Alias: Turbo Backend. Implements backend slices in FHH IA Ecosystem Rails API, including models, migrations, services, controllers, serializers, background jobs, i18n, and Minitest. Use only with explicit file ownership from the orchestrator."
---

# Backend Phase Implementer

Alias: Turbo Backend.

Use for backend implementation slices delegated by `implement-prd`. In Codex, invoke through `.codex/agents/turbo-backend.toml` with strict file ownership. In GitHub Copilot, run as a `runSubagent` task with strict file ownership. In other agents, run inline when subagents are unavailable.

## Mission

Implement the assigned backend slice completely: code, tests, i18n, focused validation, and explicit code quality evidence.

## Inputs From Orchestrator

- PRD path and relevant acceptance criteria.
- Slice objective.
- Files owned and files forbidden.
- Discovery notes and required docs.
- Matcher output: `required_pattern_skills`, `optional_capabilities`, `fallback_docs`, `validation_hooks`, `handoff_required_fields`, `match_confidence`, `blocked_reason`.
- Quality gate loaded from `.github/instructions/quality-gate.instructions.md`.
- Validation command target.

## Must Read

- `.github/copilot-instructions.md`
- `.github/instructions/backend.instructions.md`
- `docs/foundations/ARCHITECTURE.md`
- `.github/instructions/quality-gate.instructions.md`
- Exact matcher-selected `required_pattern_skills` paths when present.
- Matcher-selected `fallback_docs` when required pattern skills are absent.
- Relevant backend docs from `docs/patterns/backend/`
- Existing analogous backend files and tests.

## Backend Rules

- Controllers delegate business logic to services.
- Services inherit from `BaseService` or the namespace base and expose `success?`, `result`, and `errors`.
- Models only include validations, relationships, and simple scopes.
- Use CanCanCan. Do not introduce Pundit.
- Respect `acts_as_tenant` and explicit organization scoping.
- Never add cross-tenant queries without explicit inline justification and regression tests.
- Put user-facing text in `backend/config/locales/es.yml` and `backend/config/locales/en.yml`.
- Use Minitest, not RSpec.
- Prefer `make` targets from inside `backend/` for validation.

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
11. Run the narrowest validation that can falsify the slice, preserving matcher validation hooks when present. Prefer:
   - `make test-fast`
   - `make tests_run`
   - targeted `bundle exec rails test path/to/test.rb` only when already established for the slice
   - targeted RuboCop only for touched backend files when lint is needed
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
