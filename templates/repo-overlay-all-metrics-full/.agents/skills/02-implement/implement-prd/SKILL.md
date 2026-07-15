---
name: implement-prd
description: "Efficient PRD implementation orchestrator for All Metrics. Primary target: Codex custom agents; secondary target: GitHub Copilot in VS Code with runSubagent; generic fallback for other agents. Use when turning an approved PRD into working code through proportional readiness review, discovery, slicing, implementation, tests, contract verification, validation, QA, and documentation handoff. Optimized for controlled implementation, minimal context loading, safe autonomy, explicit file ownership, and a teaching/challenge loop that explains trade-offs and pushes toward better engineering choices."
argument-hint: "Path to the PRD file, for example docs/prd/github-intelligence/2026-06-14-github-intelligence-ux-reset/github-intelligence-ux-reset.md"
license: MIT
metadata:
  author: all-metrics
  version: "2.5"
---

# Implement PRD

This skill is the control surface for implementing approved PRDs in All Metrics.
Keep this file loaded, then load detailed references only when the step applies.

Primary runtime target: Codex custom agents in `.codex/agents/*.toml`.
Secondary target: GitHub Copilot in VS Code with `runSubagent`.
Fallback target: any generic coding agent by running the same flow inline when subagents are unavailable.

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
- `.codex/agents/*.toml` - Codex runtime adapters that read the same shared skills.

## Operating Modes

Choose the smallest mode that can safely satisfy the PRD.

1. **Small/local mode** - strictly one or two files and small changes (~20 lines), with obvious validation. Run readiness, discovery, and implementation inline. This is the ONLY mode that can skip a task tracker.
2. **Controlled-lite mode** - bounded, approved PRD with one primary surface, usually backend-only or docs-only, no active cross-layer cutover, and clear acceptance criteria. Use a compact readiness/discovery/slicing preflight inline or through one lightweight delegate. Implementation may run inline or with one owner delegate per slice. Skip ceremony that does not reduce risk.
3. **Controlled-implementation mode** - bounded implementation with 2-5 files or one narrow backend/frontend area, explicit scope, and some material risk. Use delegation for phases where it reduces context, review bias, or ownership risk; do not delegate read-only gates merely because the mode is non-trivial.
4. **Standard mode** - non-trivial PRDs with cross-layer impact, backend/frontend contracts, migrations plus activation, jobs, analytics domain changes, authorization/tenancy risk, meaningful UI, or multiple acceptance criteria across layers. Use the full delegated flow when available.
5. **Autonomous-safe mode** - when the user asks for autonomous execution. Proceed through phases without asking at every gate, but stop on any stop condition.
6. **Resume mode** - when implementation already started. Reconstruct progress from PRD, diff, tests, and first incomplete acceptance criterion. Do not re-implement validated work.

## Design Principles

1. **Subagent-value policy**: Use subagents only when they reduce risk, context, rework, or review bias. Delegation is mandatory for `standard` risk boundaries, not for every non-trivial PRD. Inline execution is allowed in `controlled-lite` when one writer can own the slice safely and validation is focused.
2. **Explicit delegation checkpoint**: before the first implementation slice, record whether delegation is `avoided`, `recommended`, or `required`, and name the concrete reason. “Continuity”, “one writer”, “docs-only”, “focused validation”, “independent review”, or “disjoint ownership” are valid reasons; “because it felt faster” is not enough without the underlying risk/cost explanation.
3. **Context-window protection policy**: when the PRD naturally expands into multiple phase skills, surfaces, or acceptance streams, prefer subagents so each phase can keep a smaller, cleaner context. Do not collapse readiness, discovery, slicing, matching, coding, and validation into one giant inline run unless the mode and heuristics below explicitly allow it.
4. Project context wins over generic agent advice.
5. Read first, code second, but load only the smallest reliable context set.
6. Use exact skill paths for delegation; do not rely on persona summaries alone.
7. Keep one responsible orchestrator and one writer per file. Parallelize only disjoint write sets.
8. Implement one safe slice at a time and validate before expanding scope.
9. Treat backend/frontend contracts as first-class deliverables.
10. Validate each phase Definition of Done line by line before moving on.
11. Maintain a physical phase/task tracker at `docs/prd/_meta/task_tracker.md` for every mode except `small/local`. Create it at the start of Phase 2 or before the first write, whichever comes first. Use it to record progress, handoffs, phase state, and the delegation decision/rationale, keeping the main conversation context clean.
12. **Subagent wait barrier**: after launching any subagent, the orchestrator MUST wait for its completed handoff before reading dependent files, launching dependent subagents, validating, updating phase status, or producing the final answer. In Codex multi-agent runs, call `wait_agent` with the relevant agent id(s) whenever the next critical-path step depends on them. If the runtime exposes a different asynchronous/pending subagent handle, poll or re-open that handle until it returns a terminal result. If the runtime cannot wait, stop and tell the user the exact pending delegate instead of continuing from assumptions.
13. Report progress after each delegated run only after the handoff has been received and reviewed.
14. Challenge and teach: when there are better alternatives, explain the trade-off briefly, recommend one path, and proceed unless a stop condition applies.
15. Prefer evidence over confidence: acceptance criteria are only covered when linked to code, tests, validation output, or an explicit residual risk.
16. Avoid token waste: do not bulk-load all docs, all skills, or large files without a concrete reason.
17. Apply `.github/instructions/quality-gate.instructions.md` as the required quality gate for code-writing work. Subagents will load it directly.
18. Treat phases as milestones and slices as the executable unit. Never compensate for coarse tasks by validating only at phase end.
19. A dependent slice starts only after its predecessor is `VERIFIED`: implementation, focused tests, relevant validation, quality checks, and acceptance evidence are all present.
20. For any architectural replacement, cutover, snapshot/read-model migration, or persisted read-path change, implementation is not closable until **activation on existing data** is handled explicitly: bootstrap/backfill/repair path, rollout command, recovery path, and at least one real-data smoke check or equivalent operational verification.

## Delegation Heuristics

Decide `avoided`, `recommended`, or `required` before Phase 2 using these signals:

1. **Phase fan-out** - if the likely flow needs three or more distinct phases/skills (for example discovery + slicing + coding, or coding + contract verification + QA), delegation should move to at least `recommended`.
2. **Surface count** - if the PRD spans backend + frontend, or code + docs + rollout/activation, delegation should move upward.
3. **Ownership split** - if different slices naturally belong to different file owners or different validators, delegation should move upward.
4. **Context pressure** - if one agent would need to keep too many files, rules, or acceptance criteria active at once, delegation should move upward to protect the context window.
5. **Independence value** - if review bias, contract checking, or acceptance testing benefits from a fresh reader, delegation should move upward.

Default interpretation:

- `required` when the mode is `standard`, when three or more signals are true, or when the PRD already depends on multiple delegate-only phase skills for safe execution.
- `recommended` when two signals are true, or when one focused delegate would clearly reduce context churn even if the work is still bounded.
- `avoided` only when the work fits one surface, one writer, compact context, and focused validation without losing rigor.

If you choose `avoided` while phase fan-out is high, write an explicit exception note in the tracker explaining why inline execution is still safer.

## Mandatory Startup

Before planning or editing:

1. Read `.github/copilot-instructions.md`.
2. Read the PRD completely.
3. (CODE_QUALITY is no longer loaded globally; code-writing agents load `quality-gate.instructions.md` on demand).
4. Classify the work as `small/local`, `controlled-lite`, `controlled-implementation`, `standard`, `autonomous-safe`, or `resume`.
5. If backend files are touched, read `.github/instructions/backend.instructions.md`.
6. If frontend files are touched, read `.github/instructions/frontend.instructions.md`.
7. For non-trivial, cross-layer, architectural, migration-heavy, or tenancy-sensitive work, read `docs/foundations/ARCHITECTURE.md`.
8. Load only relevant pattern docs from `docs/patterns/README.md`.
9. Initialize the physical task tracker file at `docs/prd/_meta/task_tracker.md` using the exact TOON template in `reference/task-tracker-template.md`, except in `small/local` mode.
10. If the PRD changes how persisted data becomes visible in the UI/API, add an **activation checklist** to the tracker: existing-data bootstrap/backfill, deploy or repair command, success signal, failure signal, rollback/repair path, and smoke verification target.

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

Right-sized flow:

1. `small/local` - inline readiness, target read, edit, focused validation, close.
2. `controlled-lite` - compact readiness/discovery/slicing preflight; one owner per slice; focused validation; skip final QA unless risk warrants it.
3. `controlled-implementation` - targeted delegation for readiness/discovery/slicing/matching/implementation/validation where delegation lowers risk; no ceremonial subagents.
4. `standard` and `autonomous-safe` - full delegated flow:
   - `prd-readiness-review` - Capitana Alcance.
   - `codebase-discovery` - Sherlock Estructura.
   - `implementation-slicing` - Arquitecta Fases.
   - `implementation-skill-matcher` - maps each slice to required pattern skills, optional capabilities, fallback docs, and handoff metadata.
   - Implementation slices with `backend-phase-implementer`, `frontend-phase-implementer`, and `acceptance-test-engineer`.
   - `contract-verifier` whenever backend responses feed frontend behavior.
   - `validation-runner` after each meaningful slice.
   - For non-trivial visible frontend UI, run `frontend-design` before coding when direction is not already sharp, and run `impeccable` before closure when premium craft or visual QA is still material.
   - `qa-handoff-review` before final delivery for non-trivial or cross-layer work.
   - `react-doctor` after meaningful React changes; `playwright-testing` when formal E2E coverage is requested or required.
   - `document-development` as the next expected skill after implementation closure when durable knowledge changed.
5. Before closure of any data-activation or cutover slice, verify the surface against **existing realistic data**, not only factories/fixtures. If direct environment verification is impossible, the handoff must include an executable repair/bootstrap command and a clearly named unverified risk.

Mode-specific execution:

- In `small/local`, run readiness/discovery inline and skip delegation. This is the only mode where the task tracker may be skipped.
- In `controlled-lite`, run a compact preflight inline or through one lightweight delegate. Run matcher inline or through one lightweight delegate when slice-to-pattern-skill matching reduces ambiguity, protects the context budget, or is needed to select exact reusable skill paths before coding. Record whether matching happened or was intentionally skipped. Implement inline or with one owner delegate per slice only after matcher output or explicit skip rationale exists. Do not invoke QA handoff, React doctor, Playwright, or document-development by default unless risk warrants it.
- In `controlled-implementation`, use delegates selectively for phases or slices where independent context, file ownership, or validation evidence reduces risk. Delegates may use cavecrew helpers for narrow locate/edit/review subtasks when that reduces context without changing ownership.
- In `standard`, use the full delegated flow when available. Treat matcher completion as a blocking phase before any coding delegate starts on dependent slices.
- In `standard`, the existence of multiple phase skills is itself a signal to keep the work partitioned unless a clearly documented exception says otherwise.
- In every mode above `small/local`, state the delegation decision early enough that a reviewer can tell whether subagents were intentionally skipped or still expected later.
- For visible frontend UI in any mode above `small/local`, do not consider the slice complete until the premium visual bar from `.github/instructions/frontend.instructions.md` is accounted for.
- In `autonomous-safe`, use the standard flow but stop only on stop conditions.
- In `resume`, rebuild the plan from the first incomplete acceptance criterion and avoid redoing validated work.

## Delegation Rule

**Primary — Codex custom agents:**
Use the matching file in `.codex/agents/[alias].toml`. These are thin runtime adapters that must read the shared `SKILL.md` files before acting.
The Codex runtime set is: `capitana-alcance`, `sherlock-estructura`, `arquitecta-fases`, `turbo-backend`, `pixel-ninja`, `guardia-contrato`, `testinator-5000`, `lint-ranger`, `qa-relampago`.

**Delegation decision:**

- Use subagents by default in `standard` and high-risk `autonomous-safe` work.
- Use subagents selectively in `controlled-implementation`.
- Use subagents sparingly in `controlled-lite`; prefer inline execution when one writer, one surface, and focused validation are enough.
- If the PRD clearly needs several implement-prd phase skills to stay rigorous, treat that as a positive signal for subagents rather than an optional convenience.
- Do not delegate only to satisfy ceremony. Name the risk or context benefit each delegate provides.

**Mandatory join contract:**

- Treat every delegated run as a blocking call unless the slice plan explicitly marks it safe to run in parallel with other independent delegates.
- Treat matcher execution as part of the same blocking contract: do not start a coding delegate for a slice until the relevant matcher handoff is terminal (`success`, explicit inline skip, or a user-accepted blocked/partial decision).
- When parallel delegates are allowed, launch only delegates with disjoint write ownership, then wait for **all** their terminal handoffs before merging results or starting any dependent work. In Codex, use `wait_agent` over the launched agent ids until all critical-path delegates complete.
- Do not infer a delegate's result from partial terminal output, lack of errors, a changed diff, or elapsed time. The required handoff schema is the synchronization point.
- If a subagent modifies files, the orchestrator must inspect the resulting diff after the handoff and before any other writer touches overlapping files.
- If a subagent times out, disappears, or remains pending, mark the tracker item `BLOCKED`/`PENDING_SUBAGENT`, name the alias and slice, and ask the user whether to wait, retry, or resume inline. Do not continue optimistically.

**Secondary — VS Code Copilot native agents:**
Use `runSubagent` with the matching file in `.github/agents/[alias].agent.md`.
These agents have pre-configured tools, model selection, and `user-invocable: false`.

**Fallback — prompt cards or inline:**
When native agents are unavailable, use the matching prompt card in [agents/](agents/) or open the delegate `SKILL.md` directly and run its procedure inline.
Load [reference/delegate-skill-matrix.md](reference/delegate-skill-matrix.md) and [reference/subagent-prompts.md](reference/subagent-prompts.md) only when exact adapter paths or prompt templates are needed.

Do not invent tools or agents that are not available. When a delegate needs a lower-context helper, use the shared cavecrew helpers in `.agents/skills/05-caveman/` and the thin adapters in `.codex/agents/cavecrew-*.toml` or `.github/agents/cavecrew-*.agent.md`.

## Teaching And Challenge Loop

At the end of each meaningful phase, include a compact learning note:

```text
Aprendizaje recomendado:
- Concepto: [architecture, contract, testing, tenancy, UI state, etc.]
- Por que importa en All Metrics: [one sentence]
- Decision/desafio: [what was challenged or what alternative was rejected]
```

Keep it short. The goal is to improve the developer's judgment without slowing delivery.

## Stop Rule

Stop and ask the user before continuing when any stop condition in [reference/validation-and-stop-conditions.md](reference/validation-and-stop-conditions.md) applies.
In autonomous-safe mode, this is the only required user gate.

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
