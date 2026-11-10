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
- Marking acceptance criteria as complete without evidence.
- Marking a slice complete without a code quality gate result.
- Closing the PRD while any QA checklist item is incomplete, waived without evidence, or still phrased as a TODO.
- Asking the user to approve routine phase transitions when the autonomous modifier was requested.
