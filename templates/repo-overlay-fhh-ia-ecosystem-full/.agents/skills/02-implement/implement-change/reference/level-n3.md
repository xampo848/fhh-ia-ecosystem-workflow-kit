# Level N3 · High-risk change

Read only when the confirmed level is N3 (former `standard`): cross-layer
impact, backend/frontend contracts, migrations plus activation, jobs, analytics
domain changes, authorization or tenancy risk, meaningful UI, acceptance
criteria across layers, two or more hazards, or any `criticalConcern`. The
required stage pipeline in `level-n2.md` applies, with the full delegated flow.

## Startup

1. `capitana-alcance` reads the input completely **once** (PRD sections per
   `input-types.md`) and delivers the PRD index
   (`.ai-work/<prd-slug>/prd-index.toon`, defined in
   `../../prd-readiness-review/SKILL.md`). Verify it with
   `verify-prd-index.mjs` as soon as it arrives. The orchestrator keeps the
   index, not the whole PRD, and reads a referenced section when it needs
   detail. Discovery and slicing receive the index and only the sections they
   need. Read `.agents/project-context.md` before any Discovery.
2. If `.ai-work/<prd-slug>/orchestration.md` exists, read `## Calibration`,
   `## Pattern Lock`, and `## Self-Audit` before discovery or slicing. Reuse
   `touched_surfaces`, the locked pattern, and residual risks.
3. Verify every quality-gate and domain-instruction path the input or the
   repository requires; a missing configured path is a hard stop.
4. Read layer instructions only for touched layers, and
   `docs/foundations/ARCHITECTURE.md` only when it exists and the work is
   cross-layer, architectural, migration-heavy, authorization- or
   tenancy-sensitive, or changes persistent read paths. Load only relevant
   pattern docs.
5. Initialize or update the physical task tracker at
   `.ai-work/<prd-slug>/task_tracker.toon` with the exact TOON template in
   `../../implement-prd/reference/task-tracker-template.md`. If the PRD has a
   complete orchestration brief and explicit slices, verify and reuse it.
6. If persisted data becomes visible in the UI/API in a new way, add an
   **activation checklist**: existing-data bootstrap/backfill, deploy or repair
   command, success and failure signals, rollback/repair path, and smoke target.
7. Initialize an ignored immutable execution lock for each coding slice at `.ai-work/<prd-slug>/locks/<slice-id>.toon` with `run_id`, `lock_id`, `prd_path`, `slice_id`, `hazards`, `selected_patterns`, `required_checks`, `evidence_state`, `waiver_state`.
8. For every delegated slice, initialize a `delegation-envelope/v1` record in
   the tracker per `.agents/model-routing/README.md`, recording requested
   invocation data separately from runtime-observed resolution data
   (`resolved_model: unknown` when evidence is unavailable).

Load `../../implement-prd/reference/orchestration-flow.md` for the
phase-by-phase flow.

Working rules carried from the former `standard` mode:

- Persist the discovery brief at `.ai-work/<prd-slug>/discovery.md` and reuse
  it for later slices and resumes, subject to the freshness check in the
  orchestration flow; skip full discovery delegation when the PRD already
  states touched files, reused patterns, and validation commands.
- Treat backend/frontend contracts as first-class deliverables and validate
  each phase Definition of Done line by line before moving on.
- Phases are milestones and slices are the executable unit; a dependent slice
  starts only after its predecessor is `VERIFIED`.
- Record the delegation decision (`avoided`, `recommended`, `required`) with
  its concrete reason before the first slice, so a reviewer can tell whether
  subagents were skipped on purpose.

## Delegation

- Delegation is `required` at N3, when the hazard rule applies, or when three
  or more heuristic signals hold (`.agents/model-routing/README.md`). N3 does
  not imply one delegate per named stage or per file.
- One compact preflight may cover `prd-readiness-review`, `codebase-discovery`,
  and `implementation-slicing` when the PRD and persisted briefs are complete.
- `implementation-skill-matcher` maps each slice to required pattern skills
  before coding; matcher completion is blocking for dependent slices. Apply
  its Proportional Entry first: with 0 candidates in the patterns index, record
  `matching: sin candidatos para <surface>` in the lock instead of delegating.
- Implementation groups use `backend-phase-implementer`,
  `frontend-phase-implementer`, and `acceptance-test-engineer`, one writer per
  cohesive PRD phase, not one per file. `contract-verifier` runs whenever
  backend responses feed frontend behavior; `validation-runner` after each
  meaningful slice.
- For non-trivial visible frontend UI, require a locked Contrato Visual before any coding slice. Run `frontend-design` only to translate or sharpen that lock, never to invent the screen after JSX exists. Run `impeccable` before closure when premium craft or visual QA is still material.
- `react-doctor` after meaningful React changes; `playwright-testing` by
  default for navigable user-facing UI when tooling is available, with
  documented exceptions only.
- Cost guardrails: retry an empty, timed-out, or invalid handoff at most once
  with the same bounded context, then continue inline or stop; never relaunch a
  broad delegate with the same objective. Use one validation delegate per phase
  when commands and scope are clear, and do not repeat an equivalent suite the
  writer already ran unless files or dependencies changed.

Native adapters for each runtime are listed in
`../../implement-prd/reference/delegate-skill-matrix.md`.
In GitHub Copilot, always load the `Copilot Invocation Protocol` section of `../../implement-prd/reference/subagent-prompts.md` immediately before any `runSubagent` delegation. Before each delegation the orchestrator interprets the task and supplies a structured `taskContext` (and cost constraints when a limit applies) to the resolver defined there; role defaults are only the fallback.
Without native agents, use the
prompt cards in `../../implement-prd/agents/` or run the delegate `SKILL.md`
inline. Use `.agents/skills/05-caveman/` helpers for narrow lower-context work.

## Runtime parity for delegation

The delegation rules are the same in every runtime; only the mechanism
changes. This skill is the applicable instruction that authorizes launching
the generated custom agents listed in the delegate matrix:

- **Claude Code:** launch the generated agent by name; its `model` comes from
  the project's model profile.
- **Codex:** spawn the generated agent by name and wait with `wait_agent`; its
  `model_reasoning_effort` comes from the profile and the model is inherited
  from the session unless the project pins one.
- **GitHub Copilot:** `runSubagent` with `agentName` and an explicit `model`
  on every delegation (`Copilot Invocation Protocol`).
- **Other runtimes:** run the role skill inline.

For every delegation record in `events.log` whether it ran as a subagent or
inline and, when the runtime exposes it, the model that executed. Closure
summarizes that in section 10. If a delegation that should have been a
subagent ran inline, say so; never present inline work as delegated.

## Join contract

- Every delegated run is blocking unless the slice plan marks it safe to run
  in parallel; parallel delegates need disjoint write ownership, and the
  orchestrator waits for **all** terminal handoffs before dependent work. In
  Codex, call `wait_agent` over the launched agent ids.
- Do not infer a result from partial output, lack of errors, a changed diff,
  or elapsed time. The handoff schema is the synchronization point.
- Inspect a delegate's diff before any other writer touches overlapping files.
- A delegate that times out, disappears, or stays pending marks the tracker
  item `BLOCKED`/`PENDING_SUBAGENT` and the user decides: wait, retry, or
  resume inline.

## Execution Lock Baseline

1. `run_id` is stable for the PRD run; `lock_id` is stable for its slice. Both appear in every slice handoff.
2. Each lock lives at `.ai-work/<prd-slug>/locks/<slice-id>.toon`, is ignored by Git, and must not contain the only durable record of a decision or validation result.
3. Each slice records `hazards`, `selected_patterns`, and exact `required_checks` before coding starts.
4. `evidence_state` must be `fresh` to promote a slice to `VERIFIED`; files changed inside the slice scope after validation make it `stale`.
5. Waivers are allowed only as `waived_by_user` with a concrete reason and the exact acceptance/risk being waived.
6. A slice may be `VERIFIED` only when `execution_lock_id` is present, not `none`, and matches its immutable slice lock for the same run and slice; its required command evidence must be `fresh`. A missing, `none`, mismatched, incomplete, stale, or missing lock/evidence record blocks `VERIFIED`.
7. This workflow validates the envelope as coordination evidence only; it does not assert an SDK schema, runtime hook, ID format, or model identity the runtime does not expose.

## Activation on existing data

For any architectural replacement, cutover, snapshot/read-model migration, or
persisted read-path change, the work is not closable until activation on
existing data is handled: bootstrap/backfill/repair path, rollout command,
recovery path, and at least one real-data smoke check. If direct verification
is impossible, the handoff includes an executable repair/bootstrap command and
a clearly named unverified risk.

## Iteration causes

Whenever the run iterates (a QA re-entry, a repair round, or a later
iteration), record its cause in section 10's "Iteraciones y causa" row: `hueco
del PRD`, `error de implementación`, `entorno`, or `cambio de requisito`. This
is how the project measures whether better PRD questions reduce rework. A PRD
that already arrives large (size signals in `create-prd/reference/self-audit.md`)
is not rewritten: propose phase-by-phase execution as in `modifiers.md`.

## Project context at closure

When the implementation changed patterns, validation commands, or structure,
or Discovery recorded `project_context_gaps`, the orchestrator proposes a small
diff to `.agents/project-context.md` that ships in the same PR. Only the
orchestrator edits that file, and only at closure; delegates never touch it
mid-run. Candidates come from `events.log`; when the optional Engram
capability is attached, it may be used to capture findings during the run and
to recall them here, but the flow must work fully without it.

## QA

Final QA runs through a fresh-context reviewer. It compares the PRD index
against the original PRD; a criterion, edge case, decision, or constraint
missing from the index is a `high` finding. Run one full QA by default;
re-entry QA is targeted to changed files, findings, and affected acceptance
criteria, and a full QA repeats only when a repair changes the risk boundary or
the prior evidence is stale.

## Mandatory Closure Contract

Do not declare the PRD complete until all of these are explicitly true:

1. Every acceptance criterion is `COMPLETE` with linked evidence, or is called out as an intentional residual risk accepted by the user.
2. Every PRD use case (`UC-N`) links to at least one implemented/verified slice and at least one executed test from the PRD Estrategia de Tests; every PRD edge-case matrix row is either verified with evidence or marked `No aplica` with a justification the user accepted. An orphan acceptance criterion, use case, test-strategy row, or edge-case row blocks closure.
3. Regression-sensitive behavior adjacent to the change has been checked, not just the happy path that was edited.
4. The code-quality gate and project standards pass with evidence, not narrative confidence.
5. Missing tests are either added, proven unnecessary with a concrete reason, or escalated as a blocker.
6. Coverage evidence exists for newly created production files and newly added methods/functions: each one maps to at least one executed test and at least one relevant edge-case assertion, or it is explicitly marked as `waived_by_user` with reason.
7. Relevant edge cases, failure states, empty states, and rollout/cutover scenarios are verified or explicitly blocked.
8. Final QA ends in `ready_to_close: yes`, which requires `blocking_findings_open: no` — no `critical`/`high` finding in `findings_ledger` remains `open` without being `repaired` or validly `waived_by_user` (a generic acknowledgement does not satisfy this for `critical`/`high` findings or authorization/tenancy/destructive-migration gaps).
9. Every `VERIFIED` slice has fresh command evidence in its immutable execution lock, or an explicit `waived_by_user` record.
10. Every `VERIFIED` delegated slice has a `delegation-envelope/v1` record with a matching non-`none` execution lock; `resolved_model: unknown` remains valid when runtime execution evidence is unavailable. In GitHub Copilot, `## 10. Evidencia de Implementacion` also carries a short executed-model table (`role | expected model | executed model | verdict`) produced with `.agents/model-routing/verify-copilot-model-evidence.mjs`; a `NOT_VERIFIED` or wrong-model row is recorded as a finding and blocks closure only for slices with a critical concern.
11. Complete `## 10. Evidencia de Implementacion` in the PRD with delivered changes, acceptance-criterion status, executed validations, QA result, identifiable change reference, residual risks or waivers, and closure date. Include a "Resumen del Ledger de Hallazgos" subsection listing every `critical` and `high` `findings_ledger` row with its id, severity, final status, and resolution (repaired in which slice, or the exact quoted risk if `waived_by_user`), and the remaining rows as counts by status; state explicitly when the ledger is empty. Section 10 is a durable summary, not a log: about 60 lines at N3 (15 at N1/N2 and per "Iteración N"); repair history stays in the PR and commits. This durable record must not include prompts, trackers, handoffs, or internal agent state.
12. After `## 10. Evidencia de Implementacion` is complete, `.ai-work/<prd-slug>/` is removed. Do not declare closure while temporary AI coordination artifacts remain.

If any item above is incomplete, loop back through the owning slice, rerun the
affected validation, and rerun QA until the checklist is satisfied.
