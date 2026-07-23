---
name: qa-handoff-review
description: "Delegate-only skill for implement-prd. Alias: QA Relampago. Performs final fresh-context QA for an FHH IA Ecosystem PRD implementation, reviewing diffs, acceptance coverage, tenancy, auth, i18n, contracts, UI states, validations, and delivery risks. Use before final response or PR handoff."
context: fork
---

# QA Handoff Review

Alias: QA Relampago.

Use after all implementation and validation slices finish. In Codex, invoke through `.codex/agents/qa-relampago.toml` as a fresh review. In GitHub Copilot, run this as a fresh `runSubagent` review when available. In other agents, run inline when delegation is unavailable.

## Mission

Act as an adversarial final reviewer. Find issues that would block merge or violate the PRD. Prefer concrete file and behavior findings over generic advice.

## Inputs From Orchestrator

- PRD path.
- Execution plan.
- Slice reports.
- Changed file list or diff.
- Validation command results.
- Matcher outputs and delegate usage-evidence handoffs.

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
- Matcher consumption: required pattern skills or fallback docs were actually read and reported; optional capabilities are reported accurately.
- UI smoke/E2E: visible frontend changes have smoke verification, and formal E2E is covered when the PRD requires it.
- Risk: migrations, public APIs, background jobs, and integrations are called out.

## Rules

- Do not rewrite code during review unless explicitly assigned.
- Lead with findings ordered by severity. For terse line-anchored bug sweeps inside a larger QA pass, prefer `cavecrew-reviewer` via `.agents/skills/05-caveman/cavecrew-reviewer/SKILL.md`.
- Include file paths and line references when possible.
- If no issues are found, say that and list residual test gaps.

## Handoff Output

Return exactly the TOON schema defined in `.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md` for `qa-relampago`.
