# Orchestration Flow: Implementation Through Closure

Part of [orchestration-flow.md](orchestration-flow.md). Read it when the first implementation slice starts, and through contract verification, validation, QA, and closure.

## Phase 3: Implementation Slices

For each slice:

1. Delegate code-writing to the owner skill by default. Inline writing is allowed only in N1, and in narrowly scoped compact N2 slices where one-writer ownership is preserved and matcher evidence is already recorded. In N2, N3, and the autonomous modifier, treat specialized implementers as the default writers for production code. If the owner skill needs a tiny 1-2 file helper edit inside its owned scope, it should prefer `cavecrew-builder` over expanding context in the parent thread.
2. Review the handoff output when delegated, or review the local diff when inline.
3. Inspect the diff for ownership leaks, architecture violations, i18n gaps, duplicated logic, over-abstraction, and missing tests.
4. Run or delegate focused validation through `validation-runner` when validation is non-trivial, flaky, or needs separate stabilization. Otherwise run the exact focused command inline.
5. Fix failures before moving to the next dependent slice.
6. Validate the phase Definition of Done line by line.
7. Record acceptance criteria covered with evidence.
8. Report progress and current phase status.
9. Add a compact learning note when the phase involved a meaningful engineering decision.
10. If the slice contains visible frontend UI, confirm the PRD Contrato Visual is `locked` before coding, implement that lock rather than inventing layout, and verify that the result clears the premium visual bar from `.agents/project/frontend.md`; do not close on “functional but generic”.
11. Mark it `VERIFIED` only after implementation, focused tests, relevant validation, quality checks, acceptance evidence, and a present, non-`none`, matching, complete immutable slice lock for the same `run_id` and `slice_id` all exist.

Use backend and frontend implementers only with explicit file ownership. Use `acceptance-test-engineer` whenever acceptance criteria are not clearly proven by existing tests.
For visible frontend surfaces, treat `frontend-design` as a pre-code translator of the locked Contrato Visual, not as a substitute for it. Use `impeccable` for craft, polish, or visual QA after the lock exists. If the screen is still unlocked, stop; do not invent it in JSX.

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

Delegate to `validation-runner` for N3, cross-layer, flaky, broad, or non-obvious validation. Run inline for N1 and compact N2 when the exact focused command is known.

Choose the smallest validation command that can falsify the change. Expand only when risk or failures justify it.

For frontend React changes, run `react-doctor` after meaningful implementation or final frontend review. For most navigable user-facing UI changes, run `playwright-testing` by default when tooling is available; skip only with an explicit documented exception or user waiver.

Validation output must be captured as evidence. Do not mark an acceptance criterion complete from confidence alone.

Validation must prove both the changed behavior and the most plausible adjacent regression paths. If the focused command only proves the happy path, add the narrowest extra check that could falsify regressions, missing standards enforcement, or relevant edge conditions.

## Phase 6: Final QA

Run one full QA checklist for every PRD implementation before closure. This stage is mandatory outside N1; compact/inline QA is allowed, omitting QA is not. Delegate to `qa-handoff-review` for standard PRDs, cross-layer work, security/tenancy-sensitive work, contract changes, user-visible changes, rollout-sensitive work, or any diff that would benefit from fresh-context review. Re-entry QA is targeted to repaired findings, changed files, and affected acceptance criteria; repeat a full QA only when the repair changes the risk boundary or prior evidence is stale. Inside review-only sweeps, prefer `cavecrew-reviewer` when terse line-anchored findings are enough.

If `## Self-Audit` exists, reconcile its residual risks before allowing `ready_to_close: yes`.

If findings are returned, fix them through the relevant owner skill or inline with explicit ownership, then re-run the affected validation. Before requesting any re-entry QA pass, append every finding from the previous handoff to `findings_ledger` in the task tracker with a stable id; never overwrite a row. The next `qa-handoff-review` pass must read `findings_ledger` and confirm each prior finding is `repaired` or explicitly `waived_by_user` before it can return `ready_to_close: yes` — a finding missing from the ledger on re-entry is treated as still open, not as resolved.

The QA checklist must explicitly answer all of these before closure:

- Acceptance criteria: complete or blocked with evidence.
- Regressions: checked on adjacent flows and existing consumers.
- Standards: project rules and quality gate pass without unresolved violations.
- Tests: required coverage exists; missing coverage is justified or blocked.
- Coverage for new scope: each newly created production file and newly added method/function has executed-test evidence plus at least one relevant edge-case assertion, or an explicit blocker/waiver.
- Edge cases: relevant empty/error/boundary/rollout states are verified or blocked.
- Blocking findings: `blocking_findings_open: no` — no `critical`/`high` finding remains `open` in `findings_ledger` without being `repaired` or validly `waived_by_user` (see Waiver Floor in `qa-handoff-review/SKILL.md`).

QA review should report findings and also explain the pattern being protected, so it reinforces learning instead of only listing defects.

Do not advance to closure while QA reports `ready_to_close: no`, `blocking_findings_open: yes`, `validation_status: FAIL | PARTIAL`, incomplete acceptance evidence, unresolved regressions, unresolved standards gaps, missing required tests, missing coverage evidence for newly created files or newly added methods/functions, or unreviewed edge cases.

## Phase 7: Closure

Close only after acceptance criteria, relevant validations, and residual risks are explicitly accounted for.

Global closure checklist:

- Run all relevant tests for touched domains.
- Run lint checks for touched files when available and relevant.
- Validate the global Definition of Done from the PRD.
- If frontend UI changed, perform smoke verification and, in most navigable user-facing flows, require `playwright-testing` when tooling is available unless an explicit documented exception or user waiver applies.
- Confirm the QA checklist status for acceptance criteria, regressions, standards, tests, and edge cases is fully resolved.
- If any closure item fails, return to the owning slice, fix the root cause, rerun the affected validation, and rerun QA before attempting closure again.
- Complete `## 10. Evidencia de Implementacion` in the PRD: delivered changes, AC status and evidence, validation commands and results, quality/QA result, commit/PR/diff reference, residual risks or waivers, and closure date. Include a "Resumen del Ledger de Hallazgos" subsection listing every `critical` and `high` row from `findings_ledger` (id, severity, final status, and resolution: repaired in which slice, or the exact quoted risk if `waived_by_user`) and summarizing the other rows as counts by status. If `findings_ledger` is empty, state that explicitly rather than omitting the subsection. Section 10 is a durable summary, not a log: aim for about 60 lines at N3 and 15 at N1/N2 (and per "Iteración N"); repair history stays in the PR and commits. Do not copy temporary AI coordination content into this section.
- After the PRD evidence section is complete — including the Resumen del Ledger de Hallazgos — remove `.ai-work/<prd-slug>/`, including the tracker, `events.log`, `locks/`, `logs/`, and PRD-creation orchestration notes.
- Summarize PRD phases completed, files changed, tests/lint results, acceptance criteria coverage, key trade-offs, learning notes, and open risks.
- Recommend `document-development` only when implementation knowledge should be captured; do not force documentation handoff for N1, compact N2, or controlled closures with no durable knowledge value.
