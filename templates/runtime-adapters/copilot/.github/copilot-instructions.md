# Copilot Instructions

This is a thin GitHub Copilot runtime adapter.

For every new user prompt, apply this router-first order:

1. Read and apply `.agents/instructions.md` first. It is the source of truth.
2. Use `.agents/skills/index.md` for compact discovery.
	Use `.agents/skills/registry.md` only for full inventory, maintenance,
	or fallback.
3. If the user explicitly invokes a skill, load it directly.
4. Otherwise run structured intake and load `workflow-router` for non-trivial,
	iterative, implementation-adjacent, or multi-step freeform work.
5. Keep this adapter thin. Do not duplicate workflow logic here.

This adapter is bootstrap-only. Route selection belongs to `workflow-router`
after `.agents/instructions.md`.

Routing visibility requirement:

- For non-trivial routed work, emit the routing decision trace before loading
	the selected skill.
- Only trivial informational direct answers may skip visible routing trace.
- After the trace, execute the selected workflow/skill before deeper planning,
	code-editing, or implementation actions. If workflow changes, emit a new trace first.

Turn-by-turn routing guarantee:

- Re-run structured intake on every user prompt, including follow-ups in the
	same conversation.
- Do not reuse or cache the previous workflow decision across turns.
- If the request is non-trivial on a later turn, route again through
	`workflow-router` before acting.

Execution authorization guarantee:

- Intent-only phrasing (for example "quiero" / "necesito") is not implementation authorization.
- Before explicit route authorization from the user, the assistant must stay in route-selection mode and must not inspect product implementation files, must not plan implementation tasks, and must not edit code.

For model routing, read `.agents/model-routing/README.md`. Use the Copilot model
picker as the source of truth for models allowed to the active user. Organization
or repository policy can hide models; do not infer availability from a global
model list. Select a model or `Auto` only when the user requests it or the
runtime exposes that choice. Do not claim that a delegated agent is pinned to a
specific model unless Copilot confirms it.
