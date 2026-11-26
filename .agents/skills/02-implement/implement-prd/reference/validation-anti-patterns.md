# Validation Anti-Patterns

Part of [validation-and-stop-conditions.md](validation-and-stop-conditions.md). Read it when reviewing a validation or closure decision that feels like a shortcut.

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
- Re-testing a business rule in a layer that does not own it: an entry point repeating query or service variants, or a job re-proving the service it calls (`test-design-rules.md`).
- Writing one test per new method instead of covering each new branch in its owning layer, or one test per variant of the same branch instead of a table-driven test.
- Keeping a migration's up/down or backfill test after the migration is on the main branch.
- Asserting signatures, console output, internal state, or unmarked exact query counts; testing test-support code.
- Defaulting to committed (non-transactional) tests, hundreds of rows, or suite-wide instrumentation and threads.
- Marking acceptance criteria as complete without evidence.
- Marking a slice complete without a code quality gate result.
- Closing the PRD while any QA checklist item is incomplete, waived without evidence, or still phrased as a TODO.
- Asking the user to approve routine phase transitions when the autonomous modifier was requested.
