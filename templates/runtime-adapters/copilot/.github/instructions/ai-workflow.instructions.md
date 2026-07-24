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

This instruction file is a bootstrap wrapper, not a second workflow policy.
Outside an explicit skill invocation or a trivial direct answer, the selected
path must come from `workflow-router` after `.agents/instructions.md`, not from
hardcoded flow stacks in this adapter.

## Routing trace guarantee

- For non-trivial requests routed through `workflow-router`, emit a visible
	routing decision trace before loading the selected skill.
- Only trivial informational direct answers may skip that visible trace.
- The trace format is defined by `workflow-router` and must include at least:
	selected path and cost posture.

## Turn-by-turn re-routing

- Apply structured intake again for every new user prompt, including follow-up
	turns in the same chat.
- Never assume the workflow selected in a previous turn is still valid.
- For any later non-trivial prompt, re-enter `workflow-router` before planning,
	editing, or running implementation steps.

## User-owned PRD decision

- The assistant must not decide on its own to run `create-prd`, `create-epic`, or `generate-pm-ticket`.
- When those routes are candidates, present options and wait for explicit user choice.
- Only explicit user request can auto-authorize one of those workflows.

## Caveman response posture

- For routing traces and short progress updates, prefer caveman-compressed
	responses to reduce latency and token pressure.
- Default to caveman `full` style in low-ambiguity turns unless the user asks
	for expanded prose.
- Switch back to normal concise prose when clarity or safety wording is
	critical (security, destructive actions, legal/compliance, or confusion).

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
