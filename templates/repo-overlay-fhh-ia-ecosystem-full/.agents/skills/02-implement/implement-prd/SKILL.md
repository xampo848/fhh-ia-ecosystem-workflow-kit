---
name: implement-prd
description: "Efficient PRD implementation orchestrator for FHH IA Ecosystem. Native custom-agent targets: Codex, GitHub Copilot, and Claude Code; Antigravity and unavailable runtimes use the shared skill inline. Use when turning an approved PRD into working code through proportional readiness review, discovery, slicing, implementation, tests, contract verification, validation, QA, and documentation handoff. Optimized for controlled implementation, minimal context loading, safe autonomy, explicit file ownership, and a teaching/challenge loop that explains trade-offs and pushes toward better engineering choices."
argument-hint: "Path to the PRD file, for example docs/prd/github-intelligence/2026-06-14-github-intelligence-ux-reset/github-intelligence-ux-reset.md"
license: MIT
metadata:
  author: fhh-ia-ecosystem
  version: "2.7"
---

# Implement PRD

This skill is the control surface for implementing approved PRDs in FHH IA Ecosystem.
Keep this file loaded, then load detailed references only when the step applies.

Native adapters: Codex in `.codex/agents/*.toml`, Copilot in `.github/agents/*.agent.md`, and Claude Code in `.claude/agents/*.md`.
Fallback target: Antigravity and any runtime without an installed native adapter run the same shared skill inline.

## Use When

- A PRD exists in `docs/prd/` and needs to be implemented.
- The user says "implement this PRD", "build this feature", or references a PRD file.
- Picking up a PRD that was created with `create-prd`.
- Resuming implementation of a partially completed PRD.

## Directory Map

- [reference/orchestration-flow.md](reference/orchestration-flow.md) - phase-by-phase implementation flow.
- [reference/delegate-skill-matrix.md](reference/delegate-skill-matrix.md) - delegate skills, aliases, paths, and write boundaries.
- [reference/subagent-prompts.md](reference/subagent-prompts.md) - reusable `runSubagent` prompt contracts.
- [reference/validation-and-stop-conditions.md](reference/validation-and-stop-conditions.md) - validation commands, stop rules, resume mode, and closure.
- [agents/](agents/) - one prompt card per alias for quick Copilot delegation.
- Native runtime adapters are generated from `scripts/delegate-agent-catalog.json`; do not edit them by hand.

## Operating Modes

Choose the smallest mode that can safely satisfy the PRD.

1. **Small/local mode** - strictly one or two files and small changes (~20 lines), with obvious validation. Run readiness, discovery, and implementation inline. This is the ONLY mode that can skip a task tracker.
2. **Controlled-lite mode** - bounded, approved PRD with one primary surface, usually backend-only or docs-only, no active cross-layer cutover, and clear acceptance criteria. Use a compact readiness/discovery/slicing preflight inline or through one lightweight delegate. Implementation may run inline or with one owner delegate per slice. Skip ceremony that does not reduce risk.
3. **Controlled-implementation mode** - bounded implementation with 2-5 files or one narrow backend/frontend area, explicit scope, and some material risk. Use delegation for phases where it reduces context, review bias, or ownership risk; do not delegate read-only gates merely because the mode is non-trivial.
4. **Standard mode** - non-trivial PRDs with cross-layer impact, backend/frontend contracts, migrations plus activation, jobs, analytics domain changes, authorization/tenancy risk, meaningful UI, or multiple acceptance criteria across layers. Use the full delegated flow when available.
5. **Autonomous-safe mode** - when the user asks for autonomous execution. Proceed through phases without asking at every gate, but stop on any stop condition.
6. **Resume mode** - when implementation already started. Reconstruct progress from PRD, diff, tests, and first incomplete acceptance criterion. Do not re-implement validated work.

## Deterministic Hazard Escalation

Classify hazards before choosing the operating mode. The fixed high-risk hazard list is:

- rollout mechanism or feature flag;
- data migration, backfill, or persisted cutover;
- background job or asynchronous execution;
- public API or cross-layer contract change;
- authorization or tenancy behavior;
- visible user-facing UI.

Rules:

1. A PRD or dependent slice with two or more listed hazards MUST use `standard` mode; file count, one-writer framing, or an inline preference cannot downgrade it.
2. `standard` under this rule requires blocking matcher completion before coding, independent validation, and fresh-context QA before closure.
3. `autonomous-safe` may remove routine user pauses, but it retains every `standard` gate when the hazard rule applies.
4. Record detected hazards and the resulting mode in the execution lock before the first coding slice.

## Design Principles

1. **Subagent-value policy**: Use subagents only when they reduce risk, context, rework, or review bias. Delegation is mandatory for `standard` risk boundaries, not for every non-trivial PRD. Inline execution is allowed in `controlled-lite` when one writer can own the slice safely and validation is focused.
2. **Explicit delegation checkpoint**: before the first implementation slice, record whether delegation is `avoided`, `recommended`, or `required`, and name the concrete reason. “Continuity”, “one writer”, “docs-only”, “focused validation”, “independent review”, or “disjoint ownership” are valid reasons; “because it felt faster” is not enough without the underlying risk/cost explanation.
3. **Context-window protection policy**: when the PRD naturally expands into multiple phase skills, surfaces, or acceptance streams, prefer subagents so each phase can keep a smaller, cleaner context. Do not collapse readiness, discovery, slicing, matching, coding, and validation into one giant inline run unless the mode and heuristics below explicitly allow it.
4. Project context wins over generic agent advice.
5. Read first, code second, but load only the smallest reliable context set.
6. Use exact skill paths for delegation; do not rely on persona summaries alone.
7. Keep one responsible orchestrator and one writer per file. Parallelize only disjoint write sets.
8. Implement one safe slice at a time and validate before expanding scope.
9. **Specialized-writer policy**: outside `small/local`, production code should be written by specialized implementer owners (`backend-phase-implementer`, `frontend-phase-implementer`, or `acceptance-test-engineer` for test-driven slices). The orchestrator coordinates, reviews, and validates; it does not become the default writer.
10. Treat backend/frontend contracts as first-class deliverables.
11. Validate each phase Definition of Done line by line before moving on.
12. Maintain a physical phase/task tracker at `<prd-directory>/_meta/task_tracker.toon` for every mode except `small/local`. Create or update it at the start of Phase 2 or before the first write, whichever comes first. Use it for coordination, progress, handoffs, phase state, and delegation rationale; it is not the authority for PRD closure.
13. **Subagent wait barrier**: after launching any subagent, the orchestrator MUST wait for its completed handoff before reading dependent files, launching dependent subagents, validating, updating phase status, or producing the final answer. In Codex multi-agent runs, call `wait_agent` with the relevant agent id(s) whenever the next critical-path step depends on them. If the runtime exposes a different asynchronous/pending subagent handle, poll or re-open that handle until it returns a terminal result. If the runtime cannot wait, stop and tell the user the exact pending delegate instead of continuing from assumptions.
14. Report progress after each delegated run only after the handoff has been received and reviewed.
15. Challenge and teach: when there are better alternatives, explain the trade-off briefly, recommend one path, and proceed unless a stop condition applies.
16. Prefer evidence over confidence: acceptance criteria are only covered when linked to code, tests, validation output, or an explicit residual risk.
17. Avoid token waste: do not bulk-load all docs, all skills, or large files without a concrete reason.
18. Apply `.github/instructions/quality-gate.instructions.md` as the required quality gate for code-writing work. Subagents should load it directly.
19. Before code-writing work, verify that every quality-gate or domain-instruction path required by the PRD or repository context exists. A missing configured path is a hard stop, not an implicit pass.
20. Treat phases as milestones and slices as the executable unit. Never compensate for coarse tasks by validating only at phase end.
21. A dependent slice starts only after its predecessor is `VERIFIED`: implementation, focused tests, relevant validation, quality checks, and acceptance evidence are all present.
22. For any architectural replacement, cutover, snapshot/read-model migration, or persisted read-path change, implementation is not closable until **activation on existing data** is handled explicitly: bootstrap/backfill/repair path, rollout command, recovery path, and at least one real-data smoke check or equivalent operational verification.
23. Production-ready closure is a hard gate, not a best-effort aspiration: do not stop at "implemented and tests pass" while any acceptance gap, regression risk, standards violation, missing test, or unreviewed edge case remains open.
24. Final QA is mandatory for every mode. The only variance is whether it runs inline or through a fresh-context reviewer; closure never skips the QA checklist itself.
25. **Discovery reuse policy**: persist the discovery brief at `<prd-directory>/_meta/discovery.md` after Phase 1 and reuse it for later slices and resumes instead of re-running exploration, subject to the freshness check in Phase 1. Skip full discovery delegation when the PRD already states complete touched files, reused patterns, and validation commands; verify those inline instead of exploring from scratch.

## Delegation Heuristics

Decide `avoided`, `recommended`, or `required` before Phase 2 using these signals:

1. **Phase fan-out** - if the likely flow needs three or more distinct phases/skills (for example discovery + slicing + coding, or coding + contract verification + QA), delegation should move to at least `recommended`.
2. **Surface count** - if the PRD spans backend + frontend, or code + docs + rollout/activation, delegation should move upward.
3. **Ownership split** - if different slices naturally belong to different file owners or different validators, delegation should move upward.
4. **Context pressure** - if one agent would need to keep too many files, rules, or acceptance criteria active at once, delegation should move upward to protect the context window.
5. **Independence value** - if review bias, contract checking, or acceptance testing benefits from a fresh reader, delegation should move upward.

Default interpretation:

- `required` when the mode is `standard`, when the deterministic hazard rule applies, when three or more signals are true, or when the PRD already depends on multiple delegate-only phase skills for safe execution.
- `recommended` when two signals are true, or when one focused delegate would clearly reduce context churn even if the work is still bounded.
- `avoided` only when the work fits one surface, one writer, compact context, and focused validation without losing rigor.

If you choose `avoided` while phase fan-out is high, write an explicit exception note in the tracker explaining why inline execution is still safer.

## Mandatory Startup

Before planning or editing:

1. Read `.github/copilot-instructions.md` or `.agents/instructions.md` if the Copilot adapter is absent. Use exists-or-skip; a missing configured path is a hard stop only when the PRD or selected mode requires that path.
2. Read the PRD completely.
3. If `<prd-directory>/_meta/orchestration.md` exists, read `## Calibration`, `## Pattern Lock`, and `## Self-Audit` before discovery or slicing. Reuse `touched_surfaces`, the locked pattern, and residual risks instead of rediscovering them. Historical PRDs without `_meta/` remain valid.
3.5. If `docs/design/<slug>-sketch.md` exists — path declared in the PRD or slug derived from the PRD directory — read that locked sketch. Do not invert it without an explicit critical-stance challenge. Missing sketch does not block historical PRDs.
3.6. If the PRD changes visible user-facing UI, read the Contrato Visual (UI lock). Treat `UI lock: locked` as an anchor: do not invent density, hierarchy, primary action, or required UI states. If the lock is missing, `not-applicable` without a reason, or still would force Pixel Ninja to invent the screen, stop and return to `create-prd` / the user. Historical PRDs without a UI lock remain valid only when they also lack a new visible surface. A mockup or photo cited by the lock is evidence, not permission to ignore the lock fields.
4. Identify the quality-gate and domain-instruction paths required by the PRD or repository context; verify each exists before relying on it. Missing optional product docs are exists-or-skip, not a failed search.
5. Classify the work as `small/local`, `controlled-lite`, `controlled-implementation`, `standard`, `autonomous-safe`, or `resume`.
6. If backend files are touched and `.github/instructions/backend.instructions.md` exists, read it.
7. If frontend files are touched and `.github/instructions/frontend.instructions.md` exists, read it.
8. Read `docs/foundations/ARCHITECTURE.md` only when it exists and the work is cross-layer, architectural, migration-heavy, authorization-sensitive, tenancy-sensitive, or changes persistent read paths.
9. Load only relevant pattern docs from `docs/patterns/README.md` when that index exists.
10. Initialize or update the physical task tracker file at `<prd-directory>/_meta/task_tracker.toon` using the exact TOON template in `reference/task-tracker-template.md`, except in `small/local` mode. Treat it as coordination state, not closure authority.
11. If the PRD changes how persisted data becomes visible in the UI/API, add an **activation checklist** to the tracker: existing-data bootstrap/backfill, deploy or repair command, success signal, failure signal, rollback/repair path, and smoke verification target.
12. For every mode above `small/local`, initialize an ignored execution lock at `<prd-directory>/_meta/execution-lock.toon` before the first coding slice. Minimum fields: `lock_id`, `prd_path`, `slice_id`, `hazards`, `selected_patterns`, `required_checks`, `evidence_state`, `waiver_state`.

## Execution Lock Baseline

For every mode above `small/local`, completion requires an explicit, ignored per-PRD execution lock. The lock is runtime coordination state; closure evidence is reported in the final response and durable PRD documentation, while the tracker cannot substitute for that evidence.

Minimum contract:

1. `lock_id` is stable for the PRD run and appears in every slice handoff.
2. The lock lives at `<prd-directory>/_meta/execution-lock.toon`, is ignored by Git, and must not contain the only durable record of a decision or validation result.
3. Each slice records `hazards`, `selected_patterns`, and exact `required_checks` before coding starts.
4. `evidence_state` must be `fresh` to promote a slice to `VERIFIED`.
5. If files inside the slice scope change after validation, mark `evidence_state` as `stale` and rerun required checks.
6. Waivers are allowed only as `waived_by_user` with a concrete reason and the exact acceptance/risk being waived.
7. Missing lock fields are a hard stop for dependent slices.

## Context Budget Policy

Use an index-first and path-first strategy:

- Pass exact `SKILL.md` paths to subagents.
- Pass only the PRD sections, discovery notes, ownership boundaries, and validation commands needed for the current slice.
- Do not summarize a skill as a substitute for reading the skill when the delegate will execute it.
- If you skip a potentially relevant doc, record why it was not needed.
- If the task starts requiring 4+ exploratory file reads, 2+ non-mechanical edits, or cross-layer reasoning, switch out of `small/local` and at least into `controlled-lite`.

Mode-specific context budgets:

- `small/local`: source-of-truth instructions, PRD/ticket if present, target file(s), and the narrowest validation command.
- `controlled-lite`: source-of-truth instructions, PRD/ticket, this `SKILL.md`, directly relevant domain instructions, and at most 5 exploratory source files before the first plan. Do not load delegate matrices, subagent prompt packs, broad architecture, or pattern docs unless a risk trigger justifies them.
- `controlled-implementation`: source-of-truth instructions, PRD/ticket, this `SKILL.md`, directly relevant backend/frontend instructions, compact readiness/discovery/slicing evidence, and targeted source files. Delegate only the phases that materially reduce risk or context.
- `standard`: load orchestration flow and relevant delegate references. Load architecture and pattern docs only when the affected surface requires them.
- `autonomous-safe`: same as standard, but do not pause between phases unless a stop condition applies.
- `resume`: load PRD/ticket, current diff, relevant tests, and enough context to identify the first incomplete acceptance criterion.

When a budget is exceeded, record why the heavier mode is now required instead of continuing to expand context silently.
When the budget is exceeded because one agent is carrying too many phase responsibilities, prefer raising the delegation level before simply loading more context inline.

## Quick Flow

Load [reference/orchestration-flow.md](reference/orchestration-flow.md) only when the selected mode is above `controlled-lite` or when a stop condition/risk trigger requires the detailed phase flow.

Slice granularity default (outside `small/local`):

- Aim for one observable outcome per slice and one primary acceptance objective.
- Prefer 1-2 owned production files per slice; split when a slice grows to 3+ owned production files unless there is a documented atomicity reason.
- Prefer one specialized writer per slice. If backend and frontend both change, split into separate slices by contract producer and consumer unless strict atomicity is required.
- Keep matcher inputs small: each slice should map cleanly to one primary owner skill plus optional supporting pattern skills.
- If a slice becomes "multi-surface + multi-owner", split before coding instead of relying on broad inline implementation.

Required stage pipeline (every mode except `small/local`):

Capitana Alcance → Sherlock Estructura → Arquitecta Fases → matcher → writer → validation → QA Relampago.

Do not omit a stage to save tokens. The cost cut is compact or inline execution of the same stage, not skipping it. `small/local` already runs readiness, target read, edit, focused validation, and close inline.

Right-sized flow:

1. `small/local` - inline readiness, target read, edit, focused validation, close.
2. `controlled-lite` - run the required stage pipeline as compact inline or one lightweight delegate per stage; one owner per slice; focused validation; mandatory QA checklist and closure evidence; escalate to fresh-context QA when risk triggers fire.
3. `controlled-implementation` - run the same required stage pipeline; delegate a stage only when independent context, ownership, or review bias lowers risk; no ceremonial extra subagents.
4. `standard` and `autonomous-safe` - full delegated flow of the same required stages:
   - `prd-readiness-review` - Capitana Alcance.
   - `codebase-discovery` - Sherlock Estructura.
   - `implementation-slicing` - Arquitecta Fases.
   - `implementation-skill-matcher` - maps each slice to required pattern skills, optional capabilities, fallback docs, and handoff metadata.
   - Implementation slices with `backend-phase-implementer`, `frontend-phase-implementer`, and `acceptance-test-engineer`.
   - `contract-verifier` whenever backend responses feed frontend behavior.
   - `validation-runner` after each meaningful slice.
   - For non-trivial visible frontend UI, require a locked Contrato Visual before any coding slice. Run `frontend-design` only to translate or sharpen that lock, never to invent the screen after JSX exists. Run `impeccable` before closure when premium craft or visual QA is still material.
    - `qa-handoff-review` before final delivery for non-trivial work and whenever closure needs a fresh-context adversarial review.
    - `react-doctor` after meaningful React changes; `playwright-testing` by default for most navigable user-facing UI changes when tooling is available, with documented exceptions only.
   - `document-development` as the next expected skill after implementation closure when durable knowledge changed.
5. Before closure of any data-activation or cutover slice, verify the surface against **existing realistic data**, not only factories/fixtures. If direct environment verification is impossible, the handoff must include an executable repair/bootstrap command and a clearly named unverified risk.

Mode-specific execution:

- In `small/local`, run readiness/discovery inline and skip delegation. This is the only mode where the task tracker may be skipped.
- In `controlled-lite`, run compact Capitana, Sherlock, Arquitecta, matcher, writer, validation, and QA. Compact or inline is allowed; omitting a named stage is not. A coding slice may proceed only with matcher `success`, or with user-accepted `partial/blocked` plus documented fallback docs and risk.
- In `controlled-implementation`, use delegates selectively for phases or slices where independent context, file ownership, or validation evidence reduces risk. Treat matcher completion as a blocking phase before any coding slice starts. Code-writing should default to specialized implementers, with inline writing reserved for narrowly scoped one-writer exceptions.
- In `standard`, use the full delegated flow when available. Treat matcher completion as a blocking phase before any coding delegate starts on dependent slices.
- In `standard`, the existence of multiple phase skills is itself a signal to keep the work partitioned unless a clearly documented exception says otherwise.
- In every mode above `small/local`, state the delegation decision early enough that a reviewer can tell whether subagents were intentionally skipped or still expected later.
- For visible frontend UI in any mode above `small/local`, do not start the coding slice until the PRD Contrato Visual is `locked`, and do not consider the slice complete until the premium visual bar from `.github/instructions/frontend.instructions.md` is accounted for.
- In `autonomous-safe`, use the standard flow but stop only on stop conditions.
- In `resume`, rebuild the plan from the first incomplete acceptance criterion and avoid redoing validated work.

## Delegation Rule

**Native adapters — Codex, Copilot, and Claude Code:**
Use the matching generated adapter for the active runtime: `.codex/agents/[alias].toml`, `.github/agents/[alias].agent.md`, or `.claude/agents/[alias].md`. Each is a thin adapter that must read the shared `SKILL.md` before acting.

**Delegation decision:**

- Use subagents by default in `standard` and high-risk `autonomous-safe` work.
- Use subagents selectively in `controlled-implementation`.
- Use subagents sparingly in `controlled-lite`; prefer inline execution when one writer, one surface, and focused validation are enough.
- If the PRD clearly needs several implement-prd phase skills to stay rigorous, treat that as a positive signal for subagents rather than an optional convenience.
- Do not delegate only to satisfy ceremony. Name the risk or context benefit each delegate provides.

**Mandatory join contract:**

- Treat every delegated run as a blocking call unless the slice plan explicitly marks it safe to run in parallel with other independent delegates.
- Treat matcher execution as part of the same blocking contract: outside `small/local`, do not start a coding delegate for a slice until the relevant matcher handoff is terminal (`success`), or `partial/blocked` with explicit user risk acceptance and documented fallback docs.
- When parallel delegates are allowed, launch only delegates with disjoint write ownership, then wait for **all** their terminal handoffs before merging results or starting any dependent work. In Codex, use `wait_agent` over the launched agent ids until all critical-path delegates complete.
- Do not infer a delegate's result from partial terminal output, lack of errors, a changed diff, or elapsed time. The required handoff schema is the synchronization point.
- If a subagent modifies files, the orchestrator must inspect the resulting diff after the handoff and before any other writer touches overlapping files.
- If a subagent times out, disappears, or remains pending, mark the tracker item `BLOCKED`/`PENDING_SUBAGENT`, name the alias and slice, and ask the user whether to wait, retry, or resume inline. Do not continue optimistically.

**Fallback — prompt cards or inline:**
When native agents are unavailable, use the matching prompt card in [agents/](agents/) or open the delegate `SKILL.md` directly and run its procedure inline. Antigravity uses this path until it documents a project custom-agent file format.
Load [reference/delegate-skill-matrix.md](reference/delegate-skill-matrix.md) and [reference/subagent-prompts.md](reference/subagent-prompts.md) only when exact adapter paths or prompt templates are needed.

Do not invent tools or agents that are not available. When a delegate needs a lower-context helper, use the shared cavecrew helpers in `.agents/skills/05-caveman/`. If runtime adapters exist, use them; otherwise execute via shared `SKILL.md` paths.

## Teaching And Challenge Loop

At the end of each meaningful phase, include a compact learning note:

```text
Aprendizaje recomendado:
- Concepto: [architecture, contract, testing, tenancy, UI state, etc.]
- Por que importa en FHH IA Ecosystem: [one sentence]
- Decision/desafio: [what was challenged or what alternative was rejected]
```

Keep it short. The goal is to improve the developer's judgment without slowing delivery.

## Stop Rule

Stop and ask the user before continuing when any stop condition in [reference/validation-and-stop-conditions.md](reference/validation-and-stop-conditions.md) applies.
In autonomous-safe mode, this is the only required user gate.

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
9. Every `VERIFIED` slice has fresh command evidence in the execution lock, or an explicit `waived_by_user` record.
10. Complete `## 10. Evidencia de Implementacion` in the PRD with delivered changes, acceptance-criterion status, executed validations, QA result, identifiable change reference, residual risks or waivers, and closure date. Include a "Resumen del Ledger de Hallazgos" subsection listing every `findings_ledger` row with its id, severity, final status, and resolution (repaired in which slice, or the exact quoted risk if `waived_by_user`); state explicitly when the ledger is empty. This durable record must not include prompts, trackers, handoffs, or internal agent state.
11. After `## 10. Evidencia de Implementacion` is complete, `<prd-directory>/_meta/` is removed. Do not declare closure while temporary AI coordination artifacts remain.

If any item above is incomplete, the orchestrator must loop back through the owning slice, rerun the affected validation, and rerun QA until the checklist is satisfied.

## Final Response

Final response must include:

- Operating mode used.
- PRD phases completed.
- Files changed by area.
- Tests and validation run.
- Acceptance criteria coverage.
- Code quality gate result.
- Key trade-offs challenged or improved.
- Open risks or follow-ups.
- Next expected skill only when useful; recommend `document-development` for standard or durable knowledge changes, but do not force it for small/local, controlled-lite, or controlled implementation closures with no durable knowledge value.
