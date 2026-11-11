# Execution Granularity Contract

Part of [SKILL.md](../SKILL.md). Read it in Phase 4, when writing phases and execution slices.

## Execution Granularity Contract

The PRD must be detailed enough that `implementation-slicing` does not need to invent behavior. Do not inflate the number of phases arbitrarily: use phases for meaningful milestones and **execution slices** for small, verifiable work.

### Required decomposition

- Split by failure, rollback, ownership, contract, or validation boundary — not by a slice-count quota. A single-slice phase is allowed when the work is genuinely atomic; record that atomicity reason.
- A slice delivers one observable outcome, stays within one contract boundary, and has one clear owner.
- A slice normally changes one primary production responsibility and 1–3 production files. Inseparable support files such as tests, styles, locales, factories, or fixtures may accompany it.
- Backend and frontend implementation belong in separate slices. A changed API contract requires its own contract-verification gate between them.
- Migrations, backfills, behavior activation, and cleanup must be separate slices when each can fail or be rolled back independently.
- A slice that combines more than one of these risks must be split: data migration, public contract, authorization/tenancy, background execution, external integration, or visible UI behavior.
- Existing-data activation, bootstrap, backfill, rollout command, and legacy cleanup must be separate slices when each can fail or be verified independently.
- No dependent slice starts until its predecessor is `VERIFIED`, unless the plan explicitly proves that the write sets and contracts are independent.

### Required task fields

Each execution slice must state:

| Field | Requirement |
| --- | --- |
| ID | Stable identifier such as `P2-S3` |
| Outcome | One externally observable or technically falsifiable result |
| Depends on | Prior slice IDs or `none` |
| Scope | Exact responsibility and likely files/components |
| Out of scope | Adjacent work this slice must not absorb |
| Acceptance criteria | PRD criterion IDs covered |
| Use cases | PRD use-case IDs (`UC-N`) this slice implements or verifies |
| Tests | Focused automated tests to add or update, inherited from the PRD Estrategia de Tests rows for the linked use cases |
| Validation | Exact narrow command or check |
| Quality checks | Relevant tenancy, auth, i18n, contract, performance, SOLID/DRY/KISS checks |
| Edge cases | PRD edge-case matrix rows this slice must satisfy, if any |
| Evidence | Artifact/output needed to mark the slice verified |
| Stop conditions | Ambiguities or failures that prohibit continuing |
| Activation | Existing-data bootstrap/backfill/repair step, deploy command, smoke target, rollback note |

Every acceptance criterion, use case, test-strategy row, and edge-case row declared in the PRD must appear in at least one slice's fields above. A row with no owning slice is a traceability gap and must be resolved before the plan is considered complete.

### Slice completion state

A slice advances only through this sequence:

`NOT_STARTED → IMPLEMENTED → TESTED → VALIDATED → VERIFIED`

- `IMPLEMENTED`: scoped code exists and ownership was respected.
- `TESTED`: focused automated coverage passes, or a justified non-automated check is recorded.
- `VALIDATED`: lint/static/contract/smoke checks relevant to the slice pass.
- `VERIFIED`: acceptance criteria and quality checks are linked to concrete evidence.

“Code complete” is not equivalent to complete.
