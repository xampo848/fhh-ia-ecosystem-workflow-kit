---
name: implementation-slicing
description: "Delegate-only skill for implement-prd. Alias: Arquitecta Fases. Converts an approved PRD and discovery brief into ordered implementation slices with file ownership, delegated skills, validation gates, and stop conditions. Use before any coding subagent starts. Supports compact slicing for controlled-lite PRDs."
context: fork
---

# Implementation Slicing

Alias: Arquitecta Fases.

Use after `prd-readiness-review` and `codebase-discovery` when the selected mode requires delegated planning. In Codex, invoke through `.codex/agents/arquitecta-fases.toml`. In GitHub Copilot, invoke through `runSubagent`. In other agents, run inline when delegation is unavailable or when `implement-prd` selected `controlled-lite`. This skill plans execution; it does not edit product code.

## Mission

Turn PRD phases into atomic, safe, reviewable, and independently verifiable slices. Assign one writer per file, identify parallelizable work, and select the exact delegate skills.

For compact PRDs, the goal is not to create more slices. The goal is to find the smallest safe rollback and validation boundaries.

## Inputs From Orchestrator

- PRD readiness brief.
- Codebase discovery brief, targeted lookup notes, or explicit reason discovery was skipped.
- Candidate operating mode.
- User constraints, branch status, and resume state.

## Procedure

1. Preserve PRD milestone order unless discovery proves a dependency problem. Phases are milestones; slices are the executable unit.
2. Map every acceptance criterion to one or more slices and define the evidence that will prove it.
3. Split first by failure/rollback boundary, then by contract boundary: migration, domain behavior, API/serializer, frontend API/hook, UI, rollout/backfill, cleanup.
4. Apply the atomicity rules below. Recursively split every `TOO_COARSE` slice before handing off implementation.
5. Assign each slice a single owner skill and one observable outcome.
6. Assign strict write ownership. Do not let two active subagents edit the same file.
7. Mark which slices can run in parallel. Only parallelize disjoint write sets with stable contracts and no dependency edge. Use `cavecrew-investigator` for quick ownership, test, or path lookups when the answer does not need prose.
8. Put tests and the smallest useful validation command in every slice. If a separate test owner is necessary, pair it as a blocking verification sub-slice; implementation cannot advance until the pair is verified.
9. Add a contract verification slice whenever backend response data feeds frontend logic.
10. Add a micro-gate after every slice and a phase gate after every PRD phase.
11. Add `qa-handoff-review` only for `standard`, cross-layer, security/tenancy-sensitive, release-critical, or unusually large diffs. For `controlled-lite`, prefer per-slice validation and skip final QA unless a concrete risk warrants it.
12. Prepare each slice for `implementation-skill-matcher` by making the handoff deterministic: slice ID, outcome, owner skill, files owned, acceptance criteria, tests, validation, quality checks, and stop conditions must be explicit.

## Controlled-lite Slicing

Use compact slicing when all are true:

- Scope is single-surface or backend-only.
- The PRD is approved and acceptance criteria are falsifiable.
- There is no frontend/backend contract cutover in the same PRD, or the producer contract is not consumed yet.
- A single implementation owner can safely make the first slice.
- Validation can start with focused tests instead of broad suites.

A controlled-lite plan may have 1-3 slices if each slice is independently reversible and testable. Do not create ceremonial read-only sub-slices just to satisfy the full standard flow.

Escalate out of controlled-lite when slicing reveals:

- two active writers need overlapping files;
- a public API producer and consumer change together;
- migration, backfill, activation, and cleanup are mixed;
- tenancy or authorization rules are not explicit;
- validation would require running the entire suite because no focused falsification exists.

## Atomic Slice Rules

A valid slice:

- produces exactly one observable or technically falsifiable outcome;
- stays inside one primary contract and one risk boundary;
- changes one primary production responsibility, normally across 1–3 production files;
- may include inseparable support files such as tests, styles, locales, factories, or fixtures;
- has one owner, explicit dependencies, forbidden scope, and stop conditions;
- names focused automated tests plus an exact validation command/check;
- can be reviewed and reverted without requiring unfinished dependent behavior;
- can independently reach `IMPLEMENTED → TESTED → VALIDATED → VERIFIED`.

Split a candidate slice when any of these is true:

- its outcome contains “and” because it delivers independent behaviors;
- it spans backend and frontend implementation;
- it mixes migration/backfill with behavior activation or cleanup;
- it changes an API producer and consumer without an intermediate contract gate;
- it combines two or more high-risk concerns: data migration, public contract, auth/tenancy, background execution, external integration, visible UI;
- it requires multiple owner skills;
- its focused validation would be “run everything” because no smaller falsification target exists;
- a failure would leave the next task unable to distinguish partial from complete work.

Do not manufacture slices solely to increase their count. A non-trivial phase normally has at least two slices; a single-slice phase requires a written atomicity justification.

## Mandatory Slice Gate

Each slice must carry this evidence bundle before a dependent slice starts:

1. **Implementation evidence** — owned diff and scope review.
2. **Test evidence** — focused automated test result, or explicit justification for a non-automated check.
3. **Validation evidence** — lint/static/contract/smoke command relevant to the slice.
4. **Quality evidence** — applicable tenancy, authorization, i18n, contract, performance, accessibility, SOLID/DRY/KISS, and hardcoding checks.
5. **Acceptance evidence** — criterion IDs linked to concrete proof.

Allowed status progression:

`NOT_STARTED → IMPLEMENTED → TESTED → VALIDATED → VERIFIED`

Failures return the slice to the earliest invalid state. `VERIFIED_WITH_RISK` is not a completion state; unresolved risk must be fixed, explicitly accepted by the user, or recorded as a stop condition.

## Skill Routing

- Backend implementation: `backend-phase-implementer`
- Frontend implementation: `frontend-phase-implementer`
- Tests mapped to acceptance criteria: `acceptance-test-engineer`
- Backend/frontend contract: `contract-verifier`
- Lint and command stabilization: `validation-runner`
- Final QA and delivery risk review: `qa-handoff-review`

This skill does not perform reusable-skill matching itself. After slicing, the
next phase is `implementation-skill-matcher`, which consumes the slice handoff
and returns `required_pattern_skills`, `optional_capabilities`, `fallback_docs`,
and matcher-specific validation/handoff metadata.

For `controlled-lite`, the orchestrator may run the implementation inline instead of delegating when one writer owns the slice and the context budget remains under control. If delegation is used, pass exact owned files and expected evidence.

## Stop And Ask When

- A destructive migration is required.
- A public API contract changes beyond the PRD.
- Multi-tenancy or authorization rules are ambiguous.
- A slice requires touching shared architecture beyond the PRD.

## Handoff Output

Return exactly:

```text
Status: success | partial | blocked
Execution plan:
Slice table:
- Slice:
- Outcome:
- Depends on:
- Owner skill:
- Alias:
- Files owned:
- Must not touch:
- Acceptance criteria:
- Tests:
- Validation:
- Quality checks:
- Evidence required:
- Stop conditions:
- Atomicity rationale:
- Status: NOT_STARTED
Matcher handoff:
- Required matcher inputs:
- Matcher-ready context:
Parallelization notes:
Acceptance-to-slice traceability:
Per-slice micro-gates:
Phase gates:
Stop conditions:
Next: implementation-skill-matcher | orchestrator-inline
```

For `controlled-lite`, keep the output compact and use `Next: orchestrator-inline`
only when the orchestrator can run matching inline without ambiguity. Otherwise
handoff to `implementation-skill-matcher`.
