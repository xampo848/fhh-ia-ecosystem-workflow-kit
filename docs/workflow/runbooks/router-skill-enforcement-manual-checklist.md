# Router-Skill Enforcement Manual Checklist

## Purpose

Ensure natural-language requests follow the repository workflow contract without skipping router or skill execution.

## Required files in target repository

- `AGENTS.md`
- `.agents/instructions.md`
- `.agents/skills/index.md`
- `.agents/skills/00-router/workflow-router/SKILL.md` (core, at most 200 lines)
- `.agents/skills/00-router/workflow-router/reference/` (menus, gates, evals)
- `.github/copilot-instructions.md`
- `.github/instructions/ai-workflow.instructions.md`

## Manual smoke checks

1. A non-trivial natural-language request emits a routing decision trace before implementation actions.
2. The selected workflow in the trace is the one executed next.
3. `awaiting-user-choice` blocks edits until explicit route authorization.
4. Any workflow switch emits a new routing trace first.
5. Explicit natural-language skill invocation is honored as binding (`usa create-prd`, `implementa este PRD`, `run implement-prd`).
6. Level pre-filter: an N0 prompt (question, formatting, typo) is answered or applied without reading workflow files or showing a trace.
7. An N1 prompt (behavior change in 1–2 clear files) shows one line such as `N1 · surgical · <files>` and waits for a short yes.
8. Run the level test prompts in `.agents/skills/00-router/workflow-router/reference/router-evals.md` after any change to the pre-filter or the router, and record the result per runtime in the PR.

## Operational note

No single IDE toggle guarantees this behavior alone.
Reliability comes from versioned workflow files, thin runtime adapters, and recurring manual smoke checks.
