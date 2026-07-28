# CLAUDE.md

This is a thin Claude Code runtime adapter.

For every new user prompt, apply this router-first order:

1. Read and apply `.agents/instructions.md` first. It is the source of truth.
2. Use `.agents/skills/index.md` for compact discovery.
	Use `.agents/skills/registry.md` only for full inventory, maintenance,
	or fallback.
3. If the user explicitly invokes a skill, load it directly.
4. Otherwise run structured intake and load `workflow-router` for non-trivial,
	iterative, implementation-adjacent, or multi-step freeform work.
5. Keep this adapter thin. Do not duplicate workflow logic here.

This adapter is bootstrap-only. Outside an explicit skill invocation or a
trivial direct answer, it must not decide between `create-prd`,
`implement-prd`, review, or documentation flows; `workflow-router` owns that
decision after `.agents/instructions.md`.

Read `.agents/model-routing/README.md` before selecting a model or delegating
work. Only pin or report a delegated model when the active Claude runtime
exposes and confirms that capability.
