# Router-Skill Enforcement Manual Checklist

## Purpose

Ensure natural-language requests follow the repository workflow contract without skipping router or skill execution.

## Required files in target repository

- `AGENTS.md`
- `.agents/instructions.md`
- `.agents/skills/index.md`
- `.agents/skills/00-router/workflow-router/SKILL.md`
- `.github/copilot-instructions.md`
- `.github/instructions/ai-workflow.instructions.md`

## Manual smoke checks

1. A non-trivial natural-language request emits a routing decision trace before implementation actions.
2. The selected workflow in the trace is the one executed next.
3. `awaiting-user-choice` blocks edits until explicit route authorization.
4. Any workflow switch emits a new routing trace first.
5. Explicit natural-language skill invocation is honored as binding (`usa create-prd`, `implementa este PRD`, `run implement-prd`).

## Operational note

No single IDE toggle guarantees this behavior alone.
Reliability comes from versioned workflow files, thin runtime adapters, and recurring manual smoke checks.
