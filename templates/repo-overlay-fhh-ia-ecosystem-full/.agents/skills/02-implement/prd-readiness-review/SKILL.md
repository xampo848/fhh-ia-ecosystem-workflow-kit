---
name: prd-readiness-review
description: "Delegate-only skill for implement-prd. Alias: Capitana Alcance. Reviews an FHH IA Ecosystem PRD before implementation, extracts scope, acceptance criteria, phases, blockers, and a stop or go decision. Use before codebase discovery, implementation planning, or resuming a partially implemented PRD. Optimized for compact readiness on bounded PRDs."
context: fork
---

# PRD Readiness Review

Alias: Capitana Alcance.

Use as the first `implement-prd` delegate when the selected mode requires delegation. In Codex, invoke through `.codex/agents/capitana-alcance.toml`. In GitHub Copilot, invoke through `runSubagent` and pass this exact `SKILL.md` path. In other agents, run the same procedure inline when delegation is unavailable or when `implement-prd` selected `controlled-lite`.

## Mission

Determine whether a PRD is ready to implement and return a structured implementation brief. Do not edit application code.

Optimize for the smallest useful readiness verdict. A readiness review should prevent guessing, not restate the full PRD.

## Inputs From Orchestrator

- PRD path or PRD text.
- Any user clarifications already given in the thread.
- Current goal: new implementation or resume.
- Candidate operating mode when already selected by `implement-prd`.

## Must Read

- `.github/copilot-instructions.md`.
- The full PRD, including phases, decisions, open questions, and Definition of Done.
- `docs/foundations/ARCHITECTURE.md` only when the PRD is cross-layer, architectural, migration-heavy, authorization-sensitive, tenancy-sensitive, or changes persistent read paths.

Do not load code quality documents during readiness. Code-writing delegates load `.github/instructions/quality-gate.instructions.md` when they actually write or review code.

## Procedure

1. Extract the strict scope: included, excluded, future phases, and non-goals.
2. Extract all functional requirements and acceptance criteria.
3. Extract implementation phases, their executable slices/tasks, dependencies, and each phase Definition of Done.
4. Extract data model and migration requirements.
5. Extract API contracts and expected response/request shapes.
6. Extract confirmed decisions, open questions, risks, mitigations, and global Definition of Done.
7. Identify touched surfaces: backend, frontend, API contract, data model, background jobs, integrations, UI, E2E.
8. Build a traceability map from every acceptance criterion to a phase/task and expected verification evidence.
9. Run the granularity audit below. Distinguish a coarse plan that slicing can safely refine from a PRD that lacks enough behavioral detail to refine without guessing.
10. Detect blocking ambiguity. Treat these as blockers: unresolved business rules, destructive migrations, public API changes, permissions gaps, multi-tenancy uncertainty, missing i18n requirements, unclear acceptance criteria, or acceptance criteria with no falsifiable evidence path. Use `cavecrew-investigator` for repo-answerable scope or ownership lookups before escalating a question to the user.
11. Recommend the safest operating mode and produce a stop or go decision.

## Compact Readiness Path

Use compact readiness when all are true:

- The PRD is approved and behaviorally specific.
- The work is backend-only, docs-only, or single-surface.
- There is no active frontend consumer change in the same PRD.
- API/read-path activation, if any, is explicitly deferred or has a clear checklist.
- The likely implementation can be sliced without user decisions.

In compact readiness, still return the required handoff fields, but keep each field dense. Prefer IDs, short phrases, and traceability references over long prose.

## Granularity Audit

Flag a phase or task as `TOO_COARSE` when it:

- has more than one observable outcome;
- crosses backend/frontend, data/API, or implementation/rollout boundaries;
- combines two or more high-risk concerns: migration, public contract, auth/tenancy, jobs, external integration, or visible UI;
- cannot name a focused test and validation check;
- uses vague verbs such as “implement”, “integrate”, “complete UI”, or “add tests” without a bounded result;
- defers all testing or verification to the end;
- has no dependency order, ownership boundary, rollback/resume point, or stop condition where relevant.

The readiness reviewer does not need to force an arbitrary phase count. It must answer:

1. Can each acceptance criterion be implemented without inventing behavior?
2. Can `implementation-slicing` split the work deterministically at contract, risk, ownership, and validation boundaries?
3. Can every resulting slice reach `IMPLEMENTED → TESTED → VALIDATED → VERIFIED` independently?

Return `Decision: STOP` when any answer is no. Return `GO` with granularity findings when the PRD behavior is complete but the slicing skill can safely make the execution plan smaller.

## Stop And Ask When

Return `Decision: STOP` when implementation would require guessing. Group questions by:

- Behavior
- Data model
- API and contract
- Authorization and multi-tenancy
- UI and i18n
- Validation and rollout

Do not ask questions that can be answered by reading the repo.

## Handoff Output

Return exactly:

```text
Status: success | partial | blocked
Decision: GO | STOP
Scope:
Functional requirements:
Acceptance criteria:
Traceability map:
Data model and migrations:
API contracts:
Confirmed decisions:
Open questions:
Phases:
Granularity findings:
Candidate slice boundaries:
Phase Definition of Done:
Global Definition of Done:
Touched surfaces:
Required follow-up skills:
Blocking questions:
Risks:
Mitigations:
Recommended operating mode:
Next: codebase-discovery | implementation-slicing | STOP
```

For compact readiness, `Next` may be `implementation-slicing` when codebase discovery is not needed beyond targeted file lookup already available to the orchestrator.