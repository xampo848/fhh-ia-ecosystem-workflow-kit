# Create PRD Orchestrator Smoke Check

## Purpose

Use this manual checklist after changing the `create-prd` orchestration contract. It validates the five sequential phases, phase artifacts, summary visibility, and compatibility of historical PRDs without requiring automated tests.

## Preconditions

- Read `.agents/skills/01-product/create-prd/SKILL.md` and its four `reference/*.md` files.
- Choose one writer for each active PRD directory; do not run concurrent agents against the same `_meta/orchestration.md`.
- Create a new PRD directory and `_meta/orchestration.md` with `## Calibration`, `## Ambiguity Log`, `## Pattern Lock`, and `## Self-Audit`.

## Backend-Like Scenario

Example: add a repository-owned validation to a service that persists a domain record.

- [x] Phase 1 loads the applicable architecture, backend standards, registry, capabilities/integrations, and memory when available.
- [x] `## Calibration` records `work_type`, `touched_surfaces`, a comparable PRD anchor, risks, and unanswered questions.
- [x] With no material risk and no explicit request, the calibration summary is not shown in chat.
- [x] Phase 2 groups only blocking questions; it covers ownership, persistence, tenancy, rollout, and test evidence.
- [x] `## Ambiguity Log` contains the grouped questions, resolved decisions, and `no blocking ambiguity remains` before Phase 3.
- [x] Phase 3 names a local service-validation pattern, lists its anchor files, reused and different parts, and its justification.
- [x] Phase 4 keeps the use cases, test strategy, edge-case matrix, execution slices, and validation evidence in the drafted PRD.
- [x] Phase 5 records residual risks and `ready for implement-prd` or `not ready` with a concrete reason.

## Frontend-Like Scenario

Example: add a visible state to an existing product screen.

- [x] Calibration identifies the frontend standards and a comparable screen or PRD anchor.
- [x] Ambiguity detection covers scope boundaries, UI/API contract, empty/error states, permissions, analytics or observability, and future-scope exclusions.
- [x] A user request to show the calibration summary produces a compact persisted-summary view even without material risk.
- [x] Pattern Locking names the local component or state-management pattern, or records `no local comparable pattern found`.
- [x] The draft's tests and edge cases cover the visible behavior and its failure/empty states.
- [x] Self-Audit identifies any unresolved contract or accessibility risk and marks the PRD `not ready` until it is resolved.

## Async/Background Scenario

Example: add a background reconciliation job for existing records.

- [x] Calibration identifies the job owner, persistence surfaces, activation/backfill concerns, and a comparable async pattern where available.
- [x] Ambiguity detection covers idempotency, retries, partial failure, ordering, observability, rollout, and repair/rollback.
- [x] An unresolved architecture, data, or contract ambiguity shows the phase summary in chat without waiting for a user request.
- [x] Pattern Locking either records the comparable job pattern or explicitly records `no local comparable pattern found` and shows the material-risk summary.
- [x] The draft contains focused validation, activation, and recovery evidence for existing data.
- [x] Self-Audit leaves the PRD `not ready` when a residual rollout or repair risk has no mitigation.

## Cross-Cutting Checks

- [x] Every completed Phase 1, 2, 3, and 5 updates its matching section in `_meta/orchestration.md`, independent of chat visibility.
- [x] The no-summary default is respected when no explicit request or material-risk signal exists.
- [x] Material-risk summaries occur for inherited-invariant contradictions, unresolved architecture/data/contract ambiguity, missing comparable patterns, and low calibration confidence.
- [x] A historical PRD created before this model remains valid without `_meta/orchestration.md` or a five-phase retrofit.
- [x] `execution-lock.toon` remains the responsibility of `implement-prd`; `orchestration.md` does not replace it.

## Completion Record

### 2026-08-05 Contract Smoke Record

- PRD directory: `docs/prd/workflow-skills/2026-08-05-create-prd-phase-orchestrator/`
- Scenarios: backend-like, frontend-like, and async/background-like contract checks passed.
- Evidence: `node --test test/workflow-contract.test.mjs`, `bun run check:docs`, `bun run check:workflow`, and the manual marker check documented in the execution lock.
- Material-risk behavior: reviewed against the phase-specific reference signals; no contradictory behavior found.
- Historical compatibility: the 2026-08-04 PRD remains outside the prospective metadata requirement.
- Deviations: none.