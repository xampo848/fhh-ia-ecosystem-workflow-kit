# Orchestration Flow

Use this reference after `implement-change/SKILL.md` (alias `implement-prd`) and its level reference are loaded.

Load this file only for N3, for N2 work with selective delegation, when a compact flow escalates, or when a stop condition/risk trigger requires the detailed phase flow. "Compact N2" means N2 work on one primary surface that runs the stages inline or with one lightweight delegate.

## Level Selection Contract

Before Phase 0, confirm the level selected by the router or by `implement-change` startup:

| Level | Execution contract |
| --- | --- |
| N1 | Inline only. No subagents. Validate the narrow local change and close. Task tracker may be skipped. |
| compact N2 | Compact inline or lightweight-delegate versions of Capitana, Sherlock, Arquitecta, matcher, writer, validation, and QA. One owner per slice. Do not omit a named stage. Skip only ceremonial extra subagents, never the QA checklist or closure evidence. |
| N2 | Targeted delegation. Delegate phases or slices when independent context, file ownership, validation, or review bias reduction materially lowers risk. Do not delegate merely because the task is non-trivial. |
| N3 | Risk-complete flow with compact delegation. Use explicit ownership, contract verification, validation runner, and one QA handoff as closure gates; do not create one delegate per file or named stage by default. |
| autonomous (modifier) | Same level flow without routine phase approvals. Stops on stop conditions, repair-round limits, and environment failures. |
| resume (modifier) | Reconstruct progress from PRD, diff, tests, and first incomplete acceptance criterion. Do not re-implement validated work. |

Escalate from compact N2 to N2 when discovery shows any of these:

- 4+ production files or more than 5 exploratory file reads before a safe plan.
- Multiple non-trivial surfaces in one PRD.
- Migration plus activation/backfill/cleanup in the same slice.
- Backend/frontend contract producer and consumer changes in the same PRD.
- Authorization, tenancy, or security-sensitive ambiguity.

Escalate from N2 to N3 when discovery shows any of these:

- 6+ files or multiple non-trivial surfaces.
- Backend/frontend contract ambiguity or impact to existing consumers.
- Migration, job, analytics-domain, authorization, tenancy, or security-sensitive change with unclear rollback or validation.
- New abstraction or divergent pattern not explicitly required by the PRD.

## Subagent Join Barrier

The orchestrator may delegate, but it may not outrun its delegates.

For every delegated phase or slice:

1. Launch the delegate with explicit objective, ownership, forbidden paths, expected evidence, and handoff schema.
2. Wait until the delegate returns a terminal handoff. In Codex, call `wait_agent` for the delegated agent id when the next critical-path step depends on it. Partial progress, terminal logs, a changed diff, or silence are not enough.
3. Parse the handoff and confirm it includes status, files changed/read, evidence, validation result, risks, and stop conditions as required by the delegate skill.
4. Inspect any changed files or diff before assigning overlapping ownership to another writer.
5. Update `.ai-work/<prd-slug>/task_tracker.toon` only after the handoff has been reviewed.
6. Start the next dependent delegate only after the current slice is `VERIFIED` or explicitly marked blocked with user-visible reason.

### Delegated Context Preflight

Before launching a delegate, prepare only the role-relevant envelope input:
the observable objective and ACs, owned and forbidden files, verified
predecessors, required reads, selected patterns, relevant discovery, focused
checks, open questions, and context provenance/freshness. Do not paste the
full PRD, tracker, or unrelated agent matrix.

- A new delegate reads its complete required skill, applicable instructions,
   and the source that controls its change. A parent read, summary, or source
   reference does not satisfy that requirement.
- Do not re-read an identical source when the runtime pre-injected its complete
   content and makes both provenance and current freshness observable; record
   that reuse in the envelope.
- A resumed delegate may reuse prior context only after directed revalidation
   of the relevant delta and affected dependencies. Ignore irrelevant changes;
   revalidate a changed dependency or contract.
- Delegates execute the assigned slice and must not restart intake, readiness,
   discovery, slicing, matching, or router selection. They may stop when the
   supplied scope is invalid or a required control is missing.
- `unknown` does not prove injection, freshness, lock validity, or runtime
   capability. It cannot enable a skipped read or a `VERIFIED` transition.

Parallel delegation is allowed only for independent read-only work or disjoint write ownership. When parallel delegates are launched, the orchestrator must wait for all terminal handoffs before merging plans, validating, or closing the phase. In Codex, call `wait_agent` with the launched agent ids until every critical-path delegate has a final status.

If the runtime cannot wait for a pending Codex subagent, stop the workflow and report:

- pending alias,
- pending slice/objective,
- last known state,
- safe choices: wait/retry/resume inline.

## Phase 0: Readiness

If `.ai-work/<prd-slug>/orchestration.md` exists, reuse `## Calibration` and `## Self-Audit` as the starting readiness brief. Still produce a Capitana verdict; do not skip the stage.

Delegate to `prd-readiness-review` (Capitana Alcance), or run the same procedure inline for N1 and compact N2 mode.

Required output:

- Scope.
- Acceptance criteria.
- Phases.
- Touched surfaces.
- Blocking questions.
- Risks.
- Recommended operating mode: `N1 | N2 | N3`, plus modifiers `autonomous | resume`.
- `Decision: GO | STOP`.

If it returns `Decision: STOP`, ask the user the blocking questions and do not implement. If the user answers, update the PRD or preserve the decision in the work log before continuing.

For compact N2, compact readiness is enough when the PRD is approved, single-surface, and behavioral rules are explicit. Do not spend a separate subagent run restating the full PRD.

For the autonomous modifier mode, stop only on real stop conditions. Do not pause just because a phase boundary was reached.

## Phase 1: Discovery

Before delegating, decide whether discovery can be skipped or reused:

1. **Check for a persisted brief.** If `.ai-work/<prd-slug>/discovery.md` exists, verify freshness before reusing it:
   - If `codebase-memory-mcp` tools are exposed and index status is `ready`, run its change-detection capability scoped to the persisted brief's `files_likely_touched` and `patterns`. If it reports no relevant changes, reuse the persisted brief and skip delegation entirely.
   - If MCP is unavailable, unready, or has no change-detection capability, do not guess freshness: treat the persisted brief as stale if any commit or slice has landed since it was written, and re-run discovery.
2. **Check for an explicit PRD.** If no persisted brief applies and the PRD already states complete `touched files`, `patterns to reuse`, and `validation commands`, do not delegate a full discovery subagent. Verify inline (`rg`/`ls`) that the listed paths and patterns still exist, and build the discovery brief directly from the PRD with `source: prd-explicit`. Escalate to a full delegated discovery if verification fails or the PRD's claims do not hold.
3. Otherwise, delegate to `codebase-discovery` (Sherlock Estructura), or run inline for N1 and compact N2 mode.
4. **Persist the result.** Whichever path was taken (reused, inline-explicit, inline, or delegated), write or refresh `.ai-work/<prd-slug>/discovery.md` with the discovery brief fields below plus `source: reused-persisted | prd-explicit | inline | subagent` and the date. Later slices and resumes in the same PRD read this file first instead of re-discovering.

The discovery brief must identify:

For pure locate-code scouting inside discovery, prefer `cavecrew-investigator` over broader prose-heavy exploration when the structured compressed output is sufficient.

- Existing patterns.
- Likely touched files.
- Likely tests.
- Docs loaded.
- Docs intentionally skipped and why.
- Validation commands.
- Risks and open questions.
- Required domain instructions (e.g., `backend.instructions.md`, `frontend.instructions.md`).
- Simpler existing patterns that should be reused.

The orchestrator MUST read the paths listed in `required_instructions` and pass them to implementers. Do not load domain instructions before discovery unless the touched surface is already explicit from the PRD.

Do not propose a new abstraction until the existing pattern has been named.

In compact N2, discovery should normally be limited to exact path/symbol/test lookup. If discovery requires broad exploration, escalate.

## Phase 2: Slicing

Outside N1, Arquitecta still runs: compact/inline for compact N2, delegated when ownership or risk requires it. N1 may keep a single implicit slice.

If `## Calibration` records `touched_surfaces`, treat any newly introduced surface as scope expansion and stop or re-slice before coding

Delegate to `implementation-slicing` (Arquitecta Fases) for N3, cross-layer, ownership-sensitive work, and higher-risk N2. Slicing is skipped or done inline for N1 and may be done inline for compact N2.

The resulting plan must define:

- Slice order.
- Slice granularity intent (what was split and why).
- Owner skill and alias, or `orchestrator-inline` for compact N2 inline slices.
- Files owned.
- Files forbidden.
- Acceptance criteria covered.
- Evidence expected for each acceptance criterion.
- Validation commands.
- Parallelization notes.
- User decision points, only when they are real stop conditions.
- One observable outcome per slice and an atomicity rationale for any non-trivial single-slice phase.
- Status progression and evidence bundle: `NOT_STARTED → IMPLEMENTED → TESTED → VALIDATED → VERIFIED`.

Slicing quality bar (outside N1):

- Prefer one primary acceptance objective per slice.
- Prefer one cohesive implementation group per PRD phase, usually 2-6 related production files. Split only for disjoint ownership, a contract boundary, or a materially independent acceptance stream; file count alone is not a split trigger.
- Prefer one specialized writer owner per implementation group; split backend/frontend producer-consumer changes unless the PRD requires atomic cutover.
- Split before coding whenever matcher confidence drops because a slice maps to multiple unrelated pattern families.

Present the implementation plan before coding when the user is interacting phase by phase, the scope is non-routine, the operating mode is N2 with material risks, or a stop condition applies. If the user has asked for autonomous execution or the plan is routine, proceed unless a stop condition applies.

Maintain a physical phase/task tracker mapped 1:1 to PRD phases and tasks. Create and update `.ai-work/<prd-slug>/task_tracker.toon` using the TOON template in `reference/task-tracker-template.md` to record progress and handoffs, keeping the main conversation context clean. It is ignored temporary state and is cleaned at closure. Skip only in N1.

## Phase 2.5: Skill Matching

Run `implementation-skill-matcher` after slicing and before any coding starts.

Mandatory rule:

- Outside N1, matcher is required and cannot be skipped.
- A coding slice may start only after matcher output exists for that slice.

Accepted matcher outcomes:

- `success`.
- `partial` or `blocked` only when the user accepts the risk and fallback docs are documented in the tracker.

Minimum evidence to record per slice:

- required pattern skills selected.
- fallback docs used when no pattern skill exists.
- validation hooks and handoff required fields.
- match confidence and any blocked reason.

## References

Load a reference only when its condition holds:

- [orchestration-flow-execution.md](orchestration-flow-execution.md) — read it when the first implementation slice starts, and through contract verification, validation, QA, and closure
