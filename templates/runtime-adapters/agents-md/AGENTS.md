# AI Agent Bootstrap

This repository uses one tool-neutral AI workflow contract.

Apply the level pre-filter below to every new user prompt first.

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

Router-first startup for every new user prompt that the pre-filter classifies
as N2 or N3:

1. Read and apply `.agents/instructions.md` before answering, planning, or
   editing. It is the source of truth.
2. Use `.agents/skills/index.md` for startup-minimal discovery.
   Use `.agents/skills/registry.md` only for full inventory, maintenance,
   or fallback.
3. If the user explicitly invokes a skill, load it directly.
4. Otherwise run structured intake. If the request is non-trivial, iterative,
   implementation-adjacent, or multi-step freeform work, load
   `.agents/skills/00-router/workflow-router/SKILL.md` before acting.
5. Treat the selected workflow from the latest routing trace as binding for the
   next non-trivial action. If the route changes, emit a new trace first.
6. Keep runtime adapters thin and avoid duplicating workflow logic; the
   generated pre-filter above is the only exception.
7. Reuse already-loaded context when its source file has not changed.
   Do not bulk-load every skill or pattern.

This bootstrap does not decide whether the work should become `create-prd`,
`implement-prd`, review, documentation, or another workflow. Outside an
explicit skill invocation or an N0/N1 request, that decision belongs to
`workflow-router` after `.agents/instructions.md` has been applied.

Runtime-specific files may describe tools, models, sandboxes, or invocation
syntax, but must not redefine workflow logic. Use
`.agents/model-routing/README.md`, `.agents/capabilities/README.md`,
`.agents/integrations/README.md`, and `.agents/memory/README.md` when their
respective policies apply.

This bootstrap is compatible with Codex and GitHub Copilot agent surfaces that
support root `AGENTS.md`.
