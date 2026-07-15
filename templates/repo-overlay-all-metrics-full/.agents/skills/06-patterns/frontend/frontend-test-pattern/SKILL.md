---
name: frontend-test-pattern
description: "Reusable frontend testing pattern for realistic loading, success, empty, and error-state verification."
---

# Frontend Test Pattern

## Trigger

Load when a slice needs frontend test coverage for UI states, mocked data, or
server-state-driven behavior.

## Must Read

- `.github/instructions/frontend.instructions.md`
- Relevant files under `docs/patterns/frontend/`

## Procedure

1. Use realistic payloads rather than minimal fake objects.
2. Cover loading, success, empty, and error states when relevant.
3. Keep network mocking deterministic.
4. Verify visible strings/states via user-facing assertions.
5. Avoid brittle structure-only assertions when behavior/state assertions are possible.

## Validation Hooks

- Focused frontend test runs
- Contract verification when test payloads depend on backend shape

## Stop Conditions

- Payload shape is uncertain.
- State coverage expected by the PRD is ambiguous.
- Test setup would require broad unrelated environment changes.

## Out of Scope

- Browser E2E rollout by default
- Backend producer implementation
