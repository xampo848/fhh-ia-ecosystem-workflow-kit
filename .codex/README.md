# Codex Adapter Notes

This directory is reserved for Codex-specific adapter metadata. The root
`AGENTS.md` comes from the shared `agents-md` adapter.

Keep Codex files thin: they should point back to `.agents/instructions.md`, `.agents/skills/index.md`, and the canonical `.agents/skills/registry.md` instead of redefining workflow logic.
Outside an explicit skill invocation or a trivial direct answer, Codex-specific
metadata should defer workflow selection to `workflow-router` rather than adding
parallel routing rules here.
