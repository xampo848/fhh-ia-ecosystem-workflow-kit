# Session Continuity And Required State

Part of [SKILL.md](../SKILL.md). Read it when resuming a formation session or persisting its state.

## Session continuity protocol

At the start of every turn:

1. Load the latest stage state from `project-formation/assets/session-state-template.md` fields.
2. Re-state in one line: current stage, last decision, and open blocker.
3. If user message is ambiguous, ask one recenter question before rerouting.
4. Preserve unresolved assumptions and risks unless explicitly closed.

If context is weak or contradictory, do not advance stage. Run a recovery turn first.

Recovery turn format:

- "Here is where we left off"
- "Here are the open decisions"
- "Choose your next move"

## Required session state

Track and refresh the following state each turn:

- current stage,
- stage confidence,
- open risks,
- unresolved assumptions,
- next question.

Also track:

- likely next stage,
- available user actions,
- last explicit user choice,
- interview prep status (`not-needed`, `queued`, `in-progress`, `completed`),
- ambiguity status (`high`, `partial`, `clear`),
- top ambiguity to resolve next.

State template: `project-formation/assets/session-state-template.md`.
