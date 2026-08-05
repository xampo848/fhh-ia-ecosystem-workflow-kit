# Validation And Stop Conditions

## Evidence Integrity

Before accepting a command result as slice evidence:

1. Confirm the exact command exercised every declared `required_checks` item for the slice.
2. Record the validated file scope and a content reference (commit SHA or file-hash manifest) in the handoff.
3. Mark `command_scope_confirmed: no` and `evidence_state: missing` when the command cannot be shown to cover that scope; a zero exit code alone is not evidence.
4. Mark evidence `stale` and rerun required checks when files inside the validated scope change.

## Backend Validation

Run from `backend/`. Prefer `make` targets:

- `make test-fast`
- `make tests_run`
- `make test-full`
- `make tests`
- `make test-coverage` only when risk warrants it

Use targeted `bundle exec rails test path/to/test.rb` only when it is already established for the slice or when it is the narrowest reliable check.

For lint, run targeted RuboCop against touched backend files when the slice warrants it.

## Frontend Validation

Run from `front/`:

- `bun run test`
- `bun run lint`
- `bun run lint:styles`
- `bun run validate:css`
- `bun run validate:all` only for broad changes

## Auxiliary Validation Skills

- Use `react-doctor` after meaningful React changes or final frontend review.
- Use `playwright-testing` when the PRD requests formal E2E coverage or when UI smoke verification cannot reasonably validate the workflow.
- Use `frontend-design` before coding visible frontend UI when you need a clearer visual direction or a more distinctive interface thesis.
- Use `impeccable` before coding visible frontend UI when the work needs full design craft, broad refinement, or deep visual QA.
- Do not mark visible frontend UI complete while it still feels generic, templated, low-hierarchy, or recognizably AI-generated.

## Code Quality Validation

Before marking any implementation slice complete, verify every configured quality-gate or domain-instruction path exists, then apply the relevant project quality gate:

- Existing project pattern was reused or any divergence is explicitly justified.
- SOLID risks were checked, especially single responsibility and dependency inversion.
- DRY risks were checked for duplicated business rules, contract mappings, enums, permissions, validation, and UI/data transformations.
- KISS/YAGNI risks were checked so the slice does not introduce speculative abstractions or unnecessary design patterns.
- Hardcoding risks were checked for strings, colors, secrets, roles, tenant IDs, permissions, statuses, thresholds, URLs, and API shapes.
- Acceptance criteria are mapped to testable evidence.
- Visible frontend UI passed the premium visual bar from `.github/instructions/frontend.instructions.md`, including hierarchy, rhythm, states, and Design System alignment.

Validation output must include a quality gate result in the delegate handoff or final response.

## Production-Ready Closure Gate

Before marking any PRD implementation done, record and satisfy all of these gates:

- Acceptance criteria gate: every criterion is complete with code/test/validation/smoke evidence, or explicitly blocked with named residual risk.
- Regression gate: the changed behavior and the most plausible adjacent regressions were checked with the narrowest reliable validation.
- Standards gate: project patterns, code quality, and domain instructions pass without unresolved exceptions.
- Test gate: required tests exist for the slice; any missing tests are justified concretely or block closure.
- Edge-case gate: relevant empty, error, boundary, permission, rollout, migration, and failure states are verified or block closure.
- QA gate: final QA ends with `ready_to_close: yes`.

If any gate is `FAIL`, `PARTIAL`, `INCOMPLETE`, `MISSING`, or unsupported by evidence, closure is blocked and the workflow must return to the owning slice.

## Phase And Global Rules

- A slice is complete only in state `VERIFIED`, after `IMPLEMENTED`, `TESTED`, and `VALIDATED` evidence is recorded.
- Run the narrowest falsifying checks at each slice; broad phase/global suites complement rather than replace slice validation.
- A dependent slice cannot start while its predecessor is implemented but untested, tested but unvalidated, or missing acceptance/quality evidence.
- Never move to the next dependent phase with failing relevant tests.
- Never silence failures without justification.
- Fix root causes; do not retry blindly.
- Validate each phase Definition of Done line by line.
- Ask before moving to the next PRD phase in interactive workflows only when the next phase changes scope, there is more than one valid technical option, validation exposes ambiguity, a stop condition applies, or the user explicitly asked to review each phase.
- In autonomous-safe mode, continue through phases unless a stop condition applies.
- At the end, validate the global Definition of Done from the PRD.
- Acceptance criteria require evidence: code path, test, validation output, smoke verification, or an explicit residual risk.
- Code quality criteria require evidence: existing pattern reused, hardcoding check, SOLID/DRY/KISS notes, and new abstraction rationale if any.
- Never treat "all current commands passed" as sufficient proof of production readiness when regressions, standards compliance, tests, or edge cases remain unverified.

## Stop Conditions

Stop and ask the user before continuing when:

- The PRD has unresolved blocking questions.
- There are multiple valid technical options not constrained by the PRD.
- A migration is destructive.
- Multi-tenancy or authorization behavior is ambiguous.
- A public API contract change goes beyond the PRD.
- API contract changes impact existing consumers.
- Validation reveals a requirement ambiguity.
- A fix requires editing outside the current ownership boundary.
- The implementation would introduce a new abstraction not requested by the PRD.
- A simpler existing pattern exists but the slice appears to require a divergent design.
- The agent cannot map an acceptance criterion to testable evidence.
- Any production-ready closure gate is unresolved: acceptance criteria, regressions, standards, tests, edge cases, or QA readiness.
- The fix requires changing behavior outside the PRD's stated scope.
- The agent would need to overwrite or revert unrelated user or agent changes.
- The slice requires hardcoding a value that should belong in i18n, design tokens, config, constants, enums, permissions, serializers, environment variables, factories, or fixtures.
- The slice requires duplicating authoritative business knowledge instead of reusing or extending the owning module.
- The slice cannot satisfy the `CODE_QUALITY.md` gate without broad unrelated refactoring.
- A required validation command cannot be shown to cover the declared slice scope.
- The handoff lacks a validated content reference for evidence required to reach `VERIFIED`.
- A configured quality-gate or required domain-instruction path is missing; report the exact path and stop until it is created or corrected.

Use this format:

```text
Pregunta antes de continuar:

[situacion concreta]

Opcion A: [...]
Opcion B: [...]

Cual prefieres?
```

## Resume Mode

When resuming a partial PRD implementation:

1. Read the physical task tracker file `docs/prd/_meta/task_tracker.md` to restore the orchestration state and see progress.
2. Run `prd-readiness-review` against the PRD and current user request.
3. Run `codebase-discovery` with resume context.
4. Detect implemented files.
5. Run existing relevant tests to determine completion.
6. Rebuild the slicing plan from the first incomplete acceptance criterion.
7. Do not re-implement validated work.
8. Preserve unrelated user or agent changes.

## Anti-Patterns

- Using persona names without loading their skill.
- Delegating without file ownership.
- Implementing before readiness and discovery.
- Bulk-loading all docs or all skills.
- Moving to another phase with failing relevant validation.
- Treating empty UI state as verified without checking the data source.
- Hardcoding user-facing strings or colors.
- Hardcoding secrets, permissions, tenant IDs, roles, statuses, thresholds, URLs, or API shapes.
- Adding backend business logic to controllers.
- Adding frontend business logic directly in components.
- Creating new abstractions before naming the existing pattern.
- Applying a design pattern without proving why a simpler design is insufficient.
- Duplicating business rules, enum mappings, contract shapes, permission checks, or data transformations.
- Marking acceptance criteria as complete without evidence.
- Marking a slice complete without a code quality gate result.
- Closing the PRD while any QA checklist item is incomplete, waived without evidence, or still phrased as a TODO.
- Asking the user to approve routine phase transitions when autonomous-safe mode was requested.
