# CLAUDE.md

This is a thin Claude Code runtime adapter.

<!-- workflow-kit:level-prefilter:start -->
Level pre-filter (apply to every new user prompt before loading any workflow file):

| Signal | Minimum level |
| --- | --- |
| Read-only question, lookup, or local command without side effects | N0 |
| Non-semantic edit (formatting, indentation, typo, comment, docs wording) | N0 |
| Behavior-changing edit in 1–2 files with clear scope | N1 |
| Uncertain scope, more than 2 files, or several pieces | N2 |
| Contracts, data or migrations, auth or tenancy, dependencies, CI, or anything irreversible (push, deploy, delete) | N3 |
| Hard triggers: explicit skill invocation, PR/review comments, explicit PRD | per that skill, whatever the level |

- The level is the highest signal that applies; when unsure between two levels, pick the higher one.
- N0: act directly without reading workflow files or emitting a trace; after 3 tool calls, stop and propose N1.
- N1: emit one line (`N1 · surgical · <files>`), wait for a short yes, edit only the target files, and run one focused check (lint, build, or test). Add or update a test only when behavior changes; for a bug, the test must fail before the fix.
- N2/N3: apply `.agents/instructions.md` and `workflow-router` before planning, editing, or implementing.
- If something unexpected appears in N0 or N1 (another file, a contract, a test you do not understand), stop and propose a higher level.
- The user can force a level ("hazlo quirúrgico", "hazlo completo"); forcing below an N3 signal requires naming the risk first.
<!-- workflow-kit:level-prefilter:end -->

For every new user prompt that the pre-filter classifies as N2 or N3, apply
this router-first order:

1. Read and apply `.agents/instructions.md` first. It is the source of truth.
2. Use `.agents/skills/index.md` for compact discovery.
	Use `.agents/skills/registry.md` only for full inventory, maintenance,
	or fallback.
3. If the user explicitly invokes a skill, load it directly.
4. Otherwise run structured intake and load `workflow-router` for non-trivial,
	iterative, implementation-adjacent, or multi-step freeform work.
5. Keep this adapter thin. Do not duplicate workflow logic here; the generated
	pre-filter above is the only exception.

This adapter is bootstrap-only. Outside an explicit skill invocation or an
N0/N1 request, it must not decide between `create-prd`,
`implement-prd`, review, or documentation flows; `workflow-router` owns that
decision after `.agents/instructions.md`.

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

PR comments hard trigger safeguard:

- If a prompt asks to resolve, review, process, or close PR/review comments,
	treat it as non-trivial and route through `workflow-router` in that turn,
	even in long follow-up conversations.
- After routing, execute the selected `pr-comments-resolution` path before
	performing other non-trivial implementation-adjacent actions.

Read `.agents/model-routing/README.md` before selecting a model or delegating
work. Only pin or report a delegated model when the active Claude runtime
exposes and confirms that capability.
