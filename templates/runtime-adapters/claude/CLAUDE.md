# CLAUDE.md

This is a thin Claude Code runtime adapter.

For every new user prompt, read and apply `.agents/instructions.md` first and
treat it as the source of truth. Use `.agents/skills/registry.md` for discovery.
If the user explicitly invokes a skill, load it directly; otherwise load
`workflow-router` for non-trivial freeform work. Do not duplicate workflow logic
here.

Read `.agents/model-routing/README.md` before selecting a model or delegating
work. Only pin or report a delegated model when the active Claude runtime
exposes and confirms that capability.
