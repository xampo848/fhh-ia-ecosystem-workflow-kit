---
applyTo: "**"
---

# AI Workflow Instructions

This file exists for GitHub/Copilot surfaces that load `.github/instructions/**`.

For every new user prompt, apply this router-first order:

1. Apply `.agents/instructions.md` before choosing a response path.
2. Use `.agents/skills/index.md` for compact discovery.
	Use `.agents/skills/registry.md` only for full inventory, maintenance,
	or fallback.
3. If the user explicitly invokes a skill, load it directly.
4. Otherwise, for non-trivial, iterative, implementation-adjacent, or
	multi-step freeform work, load `workflow-router` before acting.
5. Keep this adapter thin.

This instruction file is bootstrap-only. Workflow policy remains in
`.agents/instructions.md` and `workflow-router`.

## Routing trace guarantee

- For non-trivial requests routed through `workflow-router`, emit a visible
	routing decision trace before loading the selected skill.
- Only trivial informational direct answers may skip that visible trace.
- The trace format is defined by `workflow-router` and must include at least:
	selected path and cost posture.
- After the trace, the selected workflow is binding for the next non-trivial
	action. If the workflow must change, emit a new trace before proceeding.

## Turn-by-turn re-routing

- Apply structured intake again for every new user prompt, including follow-up
	turns in the same chat.
- Never assume the workflow selected in a previous turn is still valid.
- For any later non-trivial prompt, re-enter `workflow-router` before planning,
	editing, or running implementation steps.

## PR Comments Hard Trigger Safeguard

- If the user asks to resolve, review, process, or close PR/review comments,
	treat the prompt as non-trivial and re-enter `workflow-router` in that turn,
	even in long follow-up chats.
- After routing, execute the selected `pr-comments-resolution` path before
	other non-trivial implementation-adjacent actions.

## Execution Authorization Gate

- Intent phrasing alone (for example "quiero" / "necesito") is not authorization to execute implementation work.
- Until the user explicitly authorizes the selected route, stay in route-selection mode and do not inspect product implementation files, do not plan implementation tasks, and do not edit code.

## Standards and documentation loading

- Documentation ownership is split by purpose:
	- `docs/**` explains standards, architecture, and rationale for humans.
	- `.agents/skills/**/SKILL.md` defines executable AI procedure.
- Do not preload standards docs in this wrapper.
- The selected workflow decides just-in-time what to load:
	- `workflow-router` is the default workflow authority for non-trivial work.
	- `workflow-router` decides the path.
	- `implement-prd` loads layer-specific instructions and architecture docs
		only when the touched surface and risk require them.
	- Pattern skills in `.agents/skills/06-patterns/**` or fallback docs in
		`docs/patterns/**` are loaded only when a slice explicitly needs them.

Use `.agents/model-routing/README.md` for tier, fallback, and user-control
semantics. The Copilot model picker is the source of truth for the active
catalog; organizational or repository policy may restrict it.
