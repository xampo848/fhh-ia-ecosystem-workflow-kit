# Codex Adapter Notes

This directory is reserved for Codex-specific adapter metadata. The root
`AGENTS.md` comes from the shared `agents-md` adapter.

Keep Codex files thin: they should point back to `.agents/instructions.md`, `.agents/skills/index.md`, and the canonical `.agents/skills/registry.md` instead of redefining workflow logic.
For every new user prompt, apply structured intake before selecting non-trivial workflow execution.
If the user explicitly invokes a skill, load it directly.
Outside an explicit skill invocation or a trivial direct answer, Codex-specific
metadata should defer workflow selection to `workflow-router` rather than adding
parallel routing rules here.

Routing visibility requirement:

- For non-trivial routed work, emit the routing decision trace before loading
	the selected skill.
- Only trivial informational direct answers may skip visible routing trace.

Turn-by-turn routing guarantee:

- Re-run structured intake on every user prompt, including follow-ups in the
	same conversation.
- Do not reuse or cache the previous workflow decision across turns.

Execution authorization guarantee:

- Intent-only phrasing (for example "quiero" / "necesito") is not implementation authorization.
- Before explicit route authorization from the user, stay in route-selection mode and do not inspect product implementation files, do not plan implementation tasks, and do not edit code.
