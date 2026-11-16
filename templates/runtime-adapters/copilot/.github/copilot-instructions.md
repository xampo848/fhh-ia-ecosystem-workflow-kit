# Copilot Instructions

This is a thin GitHub Copilot runtime adapter; keep it thin. `.agents/instructions.md`
is the source of truth: if this file conflicts with it, `.agents/instructions.md`
wins. Route selection and route-specific safeguards belong to `workflow-router`.

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

Shared bootstrap for every new user prompt:

- Classify every new prompt with the level pre-filter. If it continues the
  active workflow, apply the continuation fast-path from
  `.agents/instructions.md`; re-route only on a break signal.
- For non-trivial (N2/N3) work that does not continue the active workflow, read
  `.agents/instructions.md`, then use `.agents/skills/index.md` for discovery
  (`.agents/skills/registry.md` only for full inventory or fallback). If the
  user explicitly invokes a skill, load it directly; otherwise load
  `workflow-router` and emit its routing decision trace before loading the
  selected skill. Only trivial informational direct answers may skip the trace.
  The selected workflow/skill is binding for the next non-trivial action; if
  workflow changes, emit a new trace first.
- Execution authorization: for routes that write (code, PRDs, tickets,
  installs), intent-only phrasing ("quiero", "necesito") is
  not implementation authorization; until the user authorizes the route, do not
  inspect product implementation files, do not plan implementation tasks, and
  do not edit code.
  Exceptions: N0 acts on intent, N1 needs a short "yes", and read-only routes
  or an explicit imperative naming the work ("revisa este PR") need no extra
  confirmation.

Runtime notes:

- For model routing, read `.agents/model-routing/README.md`. Use the Copilot
  model picker as the source of truth for models allowed to the active user.
  Organization or repository policy can hide models; do not infer availability
  from a global model list. Select a model or `Auto` only when the user
  requests it or the runtime exposes that choice. Do not claim that a
  delegated agent is pinned to a specific model unless Copilot confirms it.
