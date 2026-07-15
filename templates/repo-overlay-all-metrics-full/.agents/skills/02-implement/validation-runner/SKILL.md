---
name: validation-runner
description: "Delegate-only skill for implement-prd. Alias: Lint Ranger. Runs and stabilizes focused validation for All Metrics backend and frontend slices, including make targets, bun tests, lint, style validation, and failure triage. Use after implementation or test slices."
---

# Validation Runner

Alias: Lint Ranger.

Use after a slice changes files or before final QA. In Codex, invoke through `.codex/agents/lint-ranger.toml`. In GitHub Copilot, invoke through `runSubagent`. In other agents, run inline when delegation is unavailable. This skill may edit only files explicitly assigned for validation fixes.

## Mission

Run the smallest validation that can falsify the change, interpret failures, and fix root causes without lowering standards.

## Inputs From Orchestrator

- Changed files and slice summary.
- Suggested validation commands.
- Permission to edit or report only.
- Known environment constraints.
- Matcher output: `required_pattern_skills`, `optional_capabilities`, `fallback_docs`, `validation_hooks`, `handoff_required_fields`, `match_confidence`, `blocked_reason`.

## Command Policy

Always prefer the deterministic wrapper script for slices:
- `bin/validate-slice`

If the wrapper is too broad for an isolated quick check, fallback to:
Backend: `bundle exec rubocop` or `make test-fast`
Frontend: `bun run lint` or `bun run test --run`

## Procedure

1. Read `.github/copilot-instructions.md`.
2. Read matcher-selected required pattern skill paths or fallback docs when validation behavior depends on them. If a required path is missing, return `blocked`.
3. Record whether any matcher-suggested optional capability was actually used and whether it was active.
4. Choose the narrowest validation command based on touched files, matcher `validation_hooks`, and risk.
5. Run commands from the correct working directory.
6. Classify failures:
   - Product bug introduced by the slice
   - Test expectation stale or incomplete
   - Environment/dependency issue
   - Pre-existing unrelated failure
7. Fix only failures tied to the assigned slice unless the orchestrator grants more ownership.
8. Re-run the failed command after a fix.
9. Escalate to broader validation only when narrow validation passes and risk warrants it.

## Stop And Ask When

- Validation requires destructive database reset not already approved.
- A failure appears unrelated but blocks completion.
- Fixing requires changing files outside assigned ownership.
- A command requires network or environment approval.

## Handoff Output

Return exactly the TOON schema defined in `.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md` for `lint-ranger`.
