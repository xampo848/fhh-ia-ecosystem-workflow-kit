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

## Must Read

- `.github/copilot-instructions.md`
- Relevant backend/frontend instructions for touched files.
- PRD acceptance criteria.
- Matcher-required pattern skills / fallback docs when relevant to the review.
- The diff or changed files.

## Review Checklist

- PRD scope: no missing acceptance criteria and no unrequested expansion.
- Backend: service boundaries, CanCanCan, tenancy, i18n, Minitest.
- Frontend: hooks/API modules, design system, i18n, tokens, tests.
- Contract: backend response shape matches frontend consumer.
- Data: empty states are backed by real source checks when relevant.
- Validation: commands are appropriate and failures are resolved or explained.
- Regressions: changed behavior and adjacent existing flows are still safe.
- Standards: code quality gate, domain instructions, and existing patterns were actually satisfied.
- Tests: required coverage exists; missing coverage is either justified concretely or escalated.
- Edge cases: empty/error/boundary/permission/rollout states are verified or explicitly blocked.
- Matcher consumption: required pattern skills or fallback docs were actually read and reported; optional capabilities are reported accurately.
- UI smoke/E2E: visible frontend changes have smoke verification, and formal E2E is covered when the PRD requires it.
- Risk: migrations, public APIs, background jobs, and integrations are called out.

## Rules

- Do not rewrite code during review unless explicitly assigned.
- Lead with findings ordered by severity. For terse line-anchored bug sweeps inside a larger QA pass, prefer `cavecrew-reviewer` via `.agents/skills/05-caveman/cavecrew-reviewer/SKILL.md`.
- Include file paths and line references when possible.
- A clean validation run is not enough to return `ready_to_close: yes`; the full closure gate must pass.
- If no issues are found, say that and list residual test gaps.

## Handoff Output

Return exactly the TOON schema defined in `.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md` for `qa-relampago`.
