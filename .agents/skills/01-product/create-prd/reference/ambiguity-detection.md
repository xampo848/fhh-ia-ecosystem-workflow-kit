# Ambiguity Detection

## Purpose

After calibration, identify only ambiguities that block the design or produce materially different implementations. Ask them together in one structured message, then persist the result in `<prd-directory>/_meta/orchestration.md` under `## Ambiguity Log`.

## Coverage

Cover these classes when applicable:

- scope boundary, business rules, data/persistence, ownership/placement, and contract/interface
- division/allocation, identifiers, feature flags, language, DDD placement, tenancy, lifecycle, enumerations, and traceability
- async/background behavior, success/partial/failure states, idempotency/retries, and observability
- verification evidence, rollout/recovery, activation/adoption, parent invariants, and future-scope exclusions

Use this format:

```text
Antes de continuar, necesito resolver estas dudas:

**[Category]**
1. [Concrete question]
2. [Concrete question]
```

Do not ask for facts that the repository already establishes.

## Required Artifact

Write these fields under `## Ambiguity Log`:

- blocking questions grouped by category
- a resolved-decisions table
- the explicit statement `no blocking ambiguity remains` before Phase 3 can start

## Summary Visibility

Persist the artifact even when no summary is shown in chat. Show it on explicit user request or when an inherited invariant conflicts, an architecture/data/contract ambiguity is unresolved, a decision changes ownership, or a required answer is missing.