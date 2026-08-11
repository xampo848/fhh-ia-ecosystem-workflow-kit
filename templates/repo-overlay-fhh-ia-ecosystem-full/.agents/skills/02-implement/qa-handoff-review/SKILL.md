---
name: qa-handoff-review
description: "Delegate-only skill for implement-prd. Alias: QA Relampago. Performs final fresh-context QA for an FHH IA Ecosystem PRD implementation, reviewing diffs, acceptance coverage, tenancy, auth, i18n, contracts, UI states, validations, and delivery risks. Use before final response or PR handoff."
context: fork
---

# QA Handoff Review

Alias: QA Relampago.

Use after all implementation and validation slices finish. In Codex, invoke through `.codex/agents/qa-relampago.toml` as a fresh review. In GitHub Copilot, run this as a fresh `runSubagent` review when available. In other agents, run inline when delegation is unavailable.

## Mission

Act as an adversarial final reviewer. Find issues that would block merge, violate the PRD, or make the result non-production-ready. Prefer concrete file and behavior findings over generic advice. Do not allow closure while acceptance evidence, regression checks, standards compliance, tests, or edge cases are still incomplete.

## Inputs From Orchestrator

- PRD path.
- Execution plan.
- Slice reports.
- Changed file list or diff.
- Validation command results.
- Matcher outputs and delegate usage-evidence handoffs.
- Closure gate status from the task tracker when available.

## Mandatory Preconditions

- The PRD, changed-file scope, slice reports, and relevant validation results are available.
- Each claimed `VERIFIED` slice has fresh evidence, or an explicit user waiver with its residual risk.
- Required inputs missing from the handoff are a review gap: emit `partial` or `blocked`, never infer their result.

## Must Read

- `.github/copilot-instructions.md`
- Relevant backend/frontend instructions for touched files.
- PRD acceptance criteria.
- Matcher-required pattern skills / fallback docs when relevant to the review.
- The diff or changed files.

## Executable Procedure

### Mandatory Steps

1. Validate the preconditions. If acceptance evidence, changed scope, or required validation output is absent, skip directly to the incomplete-evidence decision.
2. Read the PRD acceptance criteria, applicable instructions, matcher output, slice reports, and changed scope.
3. Review the ordered closure gates: PRD scope and acceptance evidence; use-case-to-test traceability; edge-case coverage by category; validation and regressions; standards and existing patterns; required tests; relevant edge cases and delivery risks.
4. Compare every gate result with the TOON handoff fields, then make exactly one decision for this review run.

### Edge-Case Coverage Gate

When the PRD defines a Matriz de Edge Cases, report coverage explicitly by category, not as a single pass/fail aggregate:

- Check each of the six mandatory categories (datos vacíos, límites, errores, permisos/tenancy, concurrencia/orden, rollout/rollback) against the PRD matrix and the implementation evidence.
- A category is `PASS` only when every PRD row for it has concrete validation evidence (test, contract, smoke, or an explicit user-accepted manual justification).
- A category is a `gap` when a PRD row lacks evidence, or the PRD marks it `No aplica` without a justification grounded in actual scope.
- `ready_to_close: yes` is not allowed while a critical-category gap is open and unaccepted. Name the exact category and missing row in the review output.

### Decision And Re-entry

- **Close**: return `success` and `ready_to_close: yes` only when every required gate is `PASS` or `COMPLETE`, evidence is fresh, and no material finding or gap remains.
- **Repair and rerun**: return `partial` and `ready_to_close: no` when a named owner can repair a concrete finding or produce missing evidence. Set `next` to the exact repair or validation step. The owner repairs and reruns affected validation before a fresh QA review.
- **Block and escalate**: return `blocked` and `ready_to_close: no` when a material ambiguity changes closure interpretation, required evidence cannot be obtained, or the next action needs a user or orchestrator decision. State the ambiguity and required decision in `next`.

The reviewer does not retry automatically. A re-entry is valid only after the named repair or validation step supplies new evidence; otherwise return `blocked` rather than creating another review loop.

### Permitted Exceptions

- Mark a domain-specific checklist item `not-applicable` only when the changed scope demonstrably does not touch that domain, and record that basis in the relevant handoff field.
- Inline QA may replace a fresh-context delegate only when the selected operating mode permits inline execution. It still runs every applicable closure gate and emits the same TOON handoff.
- No exception permits skipping acceptance evidence, regression review, standards, tests, edge cases, or the final `ready_to_close` decision.

## Review Checklist

Use this checklist as coverage for the mandatory procedure; it does not replace the ordered gates or decision.

- PRD scope: no missing acceptance criteria and no unrequested expansion.
- Use cases: every PRD use case links to an implemented/verified slice and at least one executed test; report orphans by ID.
- Edge cases: every mandatory category (datos vacíos, límites, errores, permisos/tenancy, concurrencia/orden, rollout/rollback) is reported `PASS` or `gap` by name; empty/error/boundary/permission/rollout states are verified or explicitly blocked.
- Backend: service boundaries, CanCanCan, tenancy, i18n, Minitest.
- Frontend: hooks/API modules, design system, i18n, tokens, tests.
- Contract: backend response shape matches frontend consumer.
- Data: empty states are backed by real source checks when relevant.
- Validation: commands are appropriate and failures are resolved or explained.
- Regressions: changed behavior and adjacent existing flows are still safe.
- Standards: code quality gate, domain instructions, and existing patterns were actually satisfied.
- Tests: required coverage exists; missing coverage is either justified concretely or escalated.
- Coverage for new scope: every newly created production file and newly added method/function has executed-test evidence and at least one relevant edge-case assertion, or a named blocker/waiver.
- Matcher consumption: required pattern skills or fallback docs were actually read and reported; optional capabilities are reported accurately.
- UI smoke/E2E: visible frontend changes have smoke verification, and most navigable user-facing flows include E2E when tooling is available unless an explicit documented exception or user waiver applies.
- Risk: migrations, public APIs, background jobs, and integrations are called out.

## Rules

- Do not rewrite code during review unless explicitly assigned.
- Lead with findings ordered by severity. For terse line-anchored bug sweeps inside a larger QA pass, prefer `cavecrew-reviewer` via `.agents/skills/05-caveman/cavecrew-reviewer/SKILL.md`.
- Include file paths and line references when possible.
- A clean validation run is not enough to return `ready_to_close: yes`; the full closure gate must pass.
- If no issues are found, say that and list residual test gaps.

## Handoff Output

Return exactly the TOON schema defined in `.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md` for `qa-relampago`.
