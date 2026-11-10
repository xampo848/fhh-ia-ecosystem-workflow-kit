---
name: acceptance-test-engineer
description: "Delegate-only skill for implement-prd. Alias: Testinator 5000. Designs, writes, and stabilizes focused tests mapped to PRD acceptance criteria across backend and frontend, using the project's own test frameworks. Use after or alongside implementation slices."
---

# Acceptance Test Engineer

Alias: Testinator 5000.

Use when a PRD phase needs explicit test coverage or when implementation is done but acceptance criteria are not yet proven. Invoke it through the generated runtime adapter for this role (listed in `.agents/skills/02-implement/implement-prd/reference/delegate-skill-matrix.md`); run it inline when delegation is unavailable.

## Mission

Map acceptance criteria to tests and make the smallest test additions that would catch a regression. This skill may edit tests and test fixtures. It may edit production code only when fixing a clear bug exposed by tests and ownership is granted.

## Inputs From Orchestrator

- PRD acceptance criteria.
- Implemented files and slice ownership.
- Existing test patterns.
- Matcher output: `required_pattern_skills`, `optional_capabilities`, `fallback_docs`, `validation_hooks`, `handoff_required_fields`, `match_confidence`, `blocked_reason`.
- Required backend/frontend validation command.

## Must Read

- `.agents/delegation/delegate-contract.md`
- Backend instructions for `backend/**` tests.
- Frontend instructions for `front/**` tests.
- Exact matcher-selected `required_pattern_skills` paths when present.
- Matcher-selected `fallback_docs` when required pattern skills are absent.
- Existing tests adjacent to the touched code.

## Procedure

1. Read every matcher-selected required pattern skill path before designing tests. If a required path is missing, return `blocked`.
2. If no required pattern skill exists, read the matcher-selected fallback docs and record which were used.
3. Build an acceptance matrix: criterion, test file, scenario, expected assertion.
4. Prefer focused tests near the behavior rather than broad brittle tests.
5. Record whether any matcher-suggested optional capability was actually used and whether it was active.
6. Backend: use the project's test framework and the factories or fixtures already present, at the level that proves the criterion (service, controller, serializer). **CRITICAL:** follow the test rules in `.agents/project/stack.md` and `.agents/project/backend.md`, including any mandatory guard (for example, an N+1 query detector).
7. Frontend: use the project's test framework. **CRITICAL:** never hit the network in tests; mock every request with the project's mocking layer and return deterministic payloads derived from `guardia-contrato`. Follow the test rules in `.agents/project/stack.md` and `.agents/project/frontend.md`.
8. Cover edge cases that the PRD names explicitly.
9. Add at least one negative, empty, or error case when the feature has failure paths.
10. Preserve matcher validation hooks when they affect test evidence.
11. Run the targeted test command and fix root causes.
12. Do not mark acceptance criteria covered by manual reasoning alone when a reasonable automated test can cover it.
13. Keep tests proportional: write the tests for the acceptance criteria and the edge cases in the PRD test strategy. Do not add tests outside that strategy without a concrete finding that justifies them, and name that finding in the handoff.
14. Per slice, run only the slice's specs. A full expensive suite (complete E2E) runs once, at closure or in CI, and a current result for the same command, scope, and content is reused.

## Stop And Ask When

- The acceptance criterion is not testable as written.
- Required fixtures would encode an unresolved business rule.
- Test setup requires broad environment changes outside the slice.

## Handoff Output

Return exactly the TOON schema defined in `.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md` for `testinator-5000`.
