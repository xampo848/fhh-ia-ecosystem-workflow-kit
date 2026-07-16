---
name: feature-flag-implementation
description: "Reusable backend pattern for safe feature-flag rollout, default behavior, and dual-state validation."
---

# Feature Flag Implementation

## Trigger

Load when a slice introduces or changes feature-flagged backend behavior.

## Must Read

- `.github/instructions/backend.instructions.md`
- `docs/foundations/ARCHITECTURE.md`

## Procedure

1. Define safe default state.
2. Make enabled and disabled paths explicit.
3. Record rollout and rollback expectations.
4. Add focused tests for both flag states.
5. Avoid scattering flag checks across unrelated files.

## Validation Hooks

- Dual-state automated tests
- Focused validation that proves default-safe behavior

## Stop Conditions

- Default state is unclear.
- Rollback behavior is undefined.
- Flag check placement would duplicate business logic broadly.

## Out of Scope

- Product-launch planning
- External flag-provider installation
