---
name: prd-readiness-review
description: "Delegate-only skill for implement-prd. Alias: Capitana Alcance. Reviews an FHH IA Ecosystem PRD before implementation, extracts scope, acceptance criteria, phases, blockers, and a stop or go decision. Use before codebase discovery, implementation planning, or resuming a partially implemented PRD. Optimized for compact readiness on bounded PRDs."
context: fork
---

# PRD Readiness Review

Alias: Capitana Alcance.

Use as the first `implement-prd` delegate when the selected mode requires delegation. Invoke it through the generated runtime adapter for this role (listed in `.agents/skills/02-implement/implement-prd/reference/delegate-skill-matrix.md`), passing this exact `SKILL.md` path; run the same procedure inline when delegation is unavailable or at compact N2.

## Mission

Determine whether a PRD is ready to implement and return a structured implementation brief. Do not edit application code.

Optimize for the smallest useful readiness verdict. A readiness review should prevent guessing, not restate the full PRD.

## Inputs From Orchestrator

- PRD path or PRD text.
- Any user clarifications already given in the thread.
- Current goal: new implementation or resume.
- Candidate operating mode when already selected by `implement-prd`.

## Must Read

Use exists-or-skip. A missing optional path is not a failed search.

- `.agents/delegation/delegate-contract.md` (not `.agents/instructions.md` or the router).
- The full PRD, including phases, decisions, open questions, and Definition of Done.
- `.ai-work/<prd-slug>/orchestration.md` `## Calibration`, `## Pattern Lock`, and `## Self-Audit` when they exist.
- `docs/foundations/ARCHITECTURE.md` only when it exists and the PRD is cross-layer, architectural, migration-heavy, authorization-sensitive, tenancy-sensitive, or changes persistent read paths.

Do not load code quality documents during readiness. Code-writing delegates load `.agents/project/quality-gate.md` when they actually write or review code.

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
10. Detect blocking ambiguity. Treat these as blockers: unresolved business rules, destructive migrations, public API changes, permissions gaps, multi-tenancy uncertainty, missing i18n requirements, unclear acceptance criteria, acceptance criteria with no falsifiable evidence path, or visible UI whose Contrato Visual is missing, unlocked, or would still force implementation to invent the screen. Use `cavecrew-investigator` for repo-answerable scope or ownership lookups before escalating a question to the user.
11. Recommend the safest level (N2 or N3) and produce a stop or go decision.
12. At N3, build the **PRD index** described below so later stages do not reread the whole PRD.

## PRD Index (N3)

Capitana Alcance reads the full PRD **once** and writes
`.ai-work/<prd-slug>/prd-index.toon`. Discovery, slicing, and the orchestrator
then work from the index plus the sections they need; the orchestrator keeps
the index, not the whole PRD, in context.

```
# prd_index
prd: <path-to-prd-file>
prd_sha256: <hash printed by verify-prd-index.mjs --prd <prd>>
acceptance_criteria[N]{id,text,section}: <AC id>,<verbatim criterion>,<PRD section>
use_cases[N]{id,section}: <UC id>,<PRD section>
edge_cases[N]{category,section}: <mandatory category>,<PRD section>
invariants[N]{id,section}: <INV id>,<PRD section>
slices[N]{id,section}: <P1-S1>,<PRD section>
decisions[N]{summary,section}: <one line>,<PRD section>
constraints[N]{summary,section}: <one line>,<PRD section>
read_in_full[N]{section,roles}: <PRD section>,<roles that must read it complete>
```

Rules:

1. **The index points; it does not paraphrase.** Acceptance criteria are
   copied verbatim. Sections with nuance (business rules in prose, the
   Contrato Visual) are not summarized: list them in `read_in_full` for the
   roles that need them.
2. **Verify it when it is created.** Run
   `node .agents/skills/02-implement/prd-readiness-review/scripts/verify-prd-index.mjs --prd <prd> --index <index>`.
   It compares the PRD's ids (AC, UC, INV, slice ids) and mandatory edge-case
   categories with the index and fails on any omission. Fix the index before
   handing off; catching a gap here is free, catching it at QA is rework.
3. **Freshness.** The index stores the PRD hash and lives in the workspace, so
   it survives a resume. If the PRD changes during implementation the hash no
   longer matches: regenerate the index.
4. Any delegate may ask for one PRD section by its reference.

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
4. If the PRD changes visible UI, can Pixel Ninja implement the screen from the Contrato Visual without inventing density, hierarchy, primary action, or required states?

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