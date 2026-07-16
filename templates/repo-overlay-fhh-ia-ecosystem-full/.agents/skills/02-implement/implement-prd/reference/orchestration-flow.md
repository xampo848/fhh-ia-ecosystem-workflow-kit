# Orchestration Flow

Use this reference after `implement-prd/SKILL.md` is loaded.

Load this file only when the selected mode is above `controlled-lite`, when a compact flow escalates, or when a stop condition/risk trigger requires the detailed phase flow.

## Mode Selection Contract

Before Phase 0, confirm the operating mode selected by the router or by `implement-prd` startup:

| Mode | Execution contract |
| --- | --- |
| `small/local` | Inline only. No subagents. Validate the narrow local change and close. Task tracker may be skipped. |
| `controlled-lite` | Compact preflight, one owner per slice, focused validation. Inline execution is allowed when it preserves one-writer ownership and context budget. Skip ceremonial subagents and final QA unless risk warrants them. |
| `controlled-implementation` | Targeted delegation. Delegate phases or slices when independent context, file ownership, validation, or review bias reduction materially lowers risk. Do not delegate merely because the task is non-trivial. |
| `standard` | Full delegated flow when available. Use explicit ownership, contract verification, validation runner, and QA handoff when risk warrants it. |
| `autonomous-safe` | Standard flow without routine phase approvals. Stop only on stop conditions. |
| `resume` | Reconstruct progress from PRD, diff, tests, and first incomplete acceptance criterion. Do not re-implement validated work. |

Escalate from `controlled-lite` to `controlled-implementation` when discovery shows any of these:

- 4+ production files or more than 5 exploratory file reads before a safe plan.
- Multiple non-trivial surfaces in one PRD.
- Migration plus activation/backfill/cleanup in the same slice.
- Backend/frontend contract producer and consumer changes in the same PRD.
- Authorization, tenancy, or security-sensitive ambiguity.

Escalate from `controlled-implementation` to `standard` when discovery shows any of these:

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
5. Update `docs/prd/_meta/task_tracker.md` only after the handoff has been reviewed.
6. Start the next dependent delegate only after the current slice is `VERIFIED` or explicitly marked blocked with user-visible reason.

Parallel delegation is allowed only for independent read-only work or disjoint write ownership. When parallel delegates are launched, the orchestrator must wait for all terminal handoffs before merging plans, validating, or closing the phase. In Codex, call `wait_agent` with the launched agent ids until every critical-path delegate has a final status.

If the runtime cannot wait for a pending Codex subagent, stop the workflow and report:

- pending alias,
- pending slice/objective,
- last known state,
- safe choices: wait/retry/resume inline.

## Phase 0: Readiness

Delegate to `prd-readiness-review` (Capitana Alcance), or run inline for `small/local` and `controlled-lite` mode.

Required output:

- Scope.
- Acceptance criteria.
- Phases.
- Touched surfaces.
- Blocking questions.
- Risks.
- Recommended operating mode: `small/local | controlled-lite | controlled-implementation | standard | autonomous-safe | resume`.
- `Decision: GO | STOP`.

If it returns `Decision: STOP`, ask the user the blocking questions and do not implement. If the user answers, update the PRD or preserve the decision in the work log before continuing.

For `controlled-lite`, compact readiness is enough when the PRD is approved, single-surface, and behavioral rules are explicit. Do not spend a separate subagent run restating the full PRD.

For `autonomous-safe` mode, stop only on real stop conditions. Do not pause just because a phase boundary was reached.

## Phase 1: Discovery

Delegate to `codebase-discovery` (Sherlock Estructura), or run inline for `small/local` and `controlled-lite` mode.

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

In `controlled-lite`, discovery should normally be limited to exact path/symbol/test lookup. If discovery requires broad exploration, escalate.

## Phase 2: Slicing

Delegate to `implementation-slicing` (Arquitecta Fases) for `standard`, cross-layer, ownership-sensitive work, and higher-risk `controlled-implementation`. Slicing is skipped or done inline for `small/local` and may be done inline for `controlled-lite`.

The resulting plan must define:

- Slice order.
- Owner skill and alias, or `orchestrator-inline` for controlled-lite inline slices.
- Files owned.
- Files forbidden.
- Acceptance criteria covered.
- Evidence expected for each acceptance criterion.
- Validation commands.
- Parallelization notes.
- User decision points, only when they are real stop conditions.
- One observable outcome per slice and an atomicity rationale for any non-trivial single-slice phase.
- Status progression and evidence bundle: `NOT_STARTED → IMPLEMENTED → TESTED → VALIDATED → VERIFIED`.

Present the implementation plan before coding when the user is interacting phase by phase, the scope is non-routine, the operating mode is `controlled-implementation` with material risks, or a stop condition applies. If the user has asked for autonomous execution or the plan is routine, proceed unless a stop condition applies.

Maintain a physical phase/task tracker mapped 1:1 to PRD phases and tasks. Create and update the file `docs/prd/_meta/task_tracker.md` using the TOON template in `reference/task-tracker-template.md` to record progress and handoffs, keeping the main conversation context clean. Skip only in `small/local`.

## Phase 3: Implementation Slices

For each slice:

1. Delegate to the owner skill, or run inline when the mode is `small/local` or `controlled-lite` and one-writer ownership is preserved. If the owner skill needs a tiny 1-2 file helper edit inside its owned scope, it should prefer `cavecrew-builder` over expanding context in the parent thread.
2. Review the handoff output when delegated, or review the local diff when inline.
3. Inspect the diff for ownership leaks, architecture violations, i18n gaps, duplicated logic, over-abstraction, and missing tests.
4. Run or delegate focused validation through `validation-runner` when validation is non-trivial, flaky, or needs separate stabilization. Otherwise run the exact focused command inline.
5. Fix failures before moving to the next dependent slice.
6. Validate the phase Definition of Done line by line.
7. Record acceptance criteria covered with evidence.
8. Report progress and current phase status.
9. Add a compact learning note when the phase involved a meaningful engineering decision.
10. If the slice contains visible frontend UI, verify that the result clears the premium visual bar from `.github/instructions/frontend.instructions.md`; do not close on “functional but generic”.
11. Mark it `VERIFIED` only after implementation, focused tests, relevant validation, quality checks, and acceptance evidence all exist.

Use backend and frontend implementers only with explicit file ownership. Use `acceptance-test-engineer` whenever acceptance criteria are not clearly proven by existing tests.
For visible frontend surfaces, treat `frontend-design` and `impeccable` as quality tools, not optional decoration, whenever the screen lacks a strong visual thesis or still feels templated.

Do not start the next dependent slice until its predecessor is `VERIFIED`. Do not start the next dependent PRD phase until every phase slice is verified and the phase Definition of Done is checked line by line.

In interactive workflows, ask before moving to the next PRD phase only when the next phase changes scope, there is more than one valid technical option, validation exposes ambiguity, a stop condition applies, or the user explicitly asked to review each phase.

## Phase 4: Contract Verification

Delegate to `contract-verifier` whenever backend API responses feed frontend hooks or components.

Require at least:

- Backend serializer/controller or contract test for changed fields.
- Frontend hook/component test with realistic payload.
- Positive-data scenario and empty/error scenario when relevant.
- Evidence that changed contracts do not silently break existing consumers.

Skip contract verification only when the PRD is backend-only and does not activate or alter a public response consumed by frontend/API clients. Record the reason.

## Phase 5: Validation

Delegate to `validation-runner` for `standard`, cross-layer, flaky, broad, or non-obvious validation. Run inline for `small/local` and `controlled-lite` when the exact focused command is known.

Choose the smallest validation command that can falsify the change. Expand only when risk or failures justify it.

For frontend React changes, run `react-doctor` after meaningful implementation or final frontend review. For formal E2E coverage, use `playwright-testing`.

Validation output must be captured as evidence. Do not mark an acceptance criterion complete from confidence alone.

## Phase 6: Final QA

Delegate to `qa-handoff-review` for standard PRDs, cross-layer work, security/tenancy-sensitive work, or any diff that would benefit from fresh-context review. Do not run QA handoff by default for `small/local`, `controlled-lite`, or low-risk `controlled-implementation` unless risk warrants it. Inside review-only sweeps, prefer `cavecrew-reviewer` when terse line-anchored findings are enough.

If findings are returned, fix them through the relevant owner skill or inline with explicit ownership, then re-run the affected validation.

QA review should report findings and also explain the pattern being protected, so it reinforces learning instead of only listing defects.

## Phase 7: Closure

Close only after acceptance criteria, relevant validations, and residual risks are explicitly accounted for.

Global closure checklist:

- Run all relevant tests for touched domains.
- Run lint checks for touched files when available and relevant.
- Validate the global Definition of Done from the PRD.
- If frontend UI changed, perform smoke verification and use `playwright-testing` when formal E2E is required.
- Summarize PRD phases completed, files changed, tests/lint results, acceptance criteria coverage, key trade-offs, learning notes, and open risks.
- Recommend `document-development` only when implementation knowledge should be captured; do not force documentation handoff for small/local, controlled-lite, or controlled closures with no durable knowledge value.