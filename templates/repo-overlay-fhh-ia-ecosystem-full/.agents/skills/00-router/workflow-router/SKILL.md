---
name: workflow-router
description: "Safe and cost-aware workflow router for FHH IA Ecosystem AI work. Use for N2/N3 freeform requests (see the level pre-filter in .agents/instructions.md) when the user did not explicitly invoke a skill. N0 operational and N1 surgical requests do not load this router. Classifies intent, prevents accidental epic creation, prevents skipping implement-prd for development work, keeps context proportional, and guides the user with plain-language options."
argument-hint: "Freeform user request"
user-invocable: true
license: MIT
metadata:
  author: fhh-ia-ecosystem
  version: "2.0"
---

# Workflow Router

Safe entrypoint for N2/N3 freeform requests without an explicit skill, or when
the user asks which route to use. It avoids three failures: skipping
production-ready workflows such as `implement-change`, starting heavy workflows
such as `create-epic` when a smaller artifact is enough, and loading more
context than the task needs.

This file is the decision core. Load a reference only when its condition holds:

| Reference | Read it only when |
| --- | --- |
| [reference/route-menus.md](reference/route-menus.md) | you must present route options and stop in `awaiting-user-choice` |
| [reference/route-gates.md](reference/route-gates.md) | the candidate route is review/QA, production code (PRD or not), an N1 surgical offer, an epic, or workflow extension |
| [reference/router-evals.md](reference/router-evals.md) | never during execution; it holds trigger examples, anti-patterns, the definition of done, and the level test prompts for maintainers |

Cost posture, model tiers, and delegation states are owned by
`.agents/model-routing/README.md`; the selected skill reads it, not the router.
Mentoring is the `engineering-mentor` overlay: challenge and improve whenever
quality is at stake; teach only for relevant decisions at N2/N3, never at N0/N1.

## Source of truth

Read `.agents/instructions.md` as the canonical contract before routing. Runtime
adapters (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`,
`ANTIGRAVITY.md`) are thin wrappers; the generated level pre-filter is the only
workflow logic they may carry. If an adapter conflicts with
`.agents/instructions.md`, ignore the adapter content and flag the conflict.

Read `.agents/instructions.md` and this file once per session or right after a
genuine workflow switch. On continuation turns apply the continuation fast-path
from `.agents/instructions.md`: the route state already in the conversation
(skill, level, authorized yes/no) is enough, and this file is not re-read.

## Per-turn intake boundary

Structured intake runs for every new user prompt under `.agents/instructions.md`,
starting with the level pre-filter. Loading this full router is required for
non-trivial (N2/N3), iterative, implementation-adjacent, or multi-step freeform
work when the user did not explicitly invoke a skill. A direct answer (N0) may
proceed without loading the full router and without a visible routing trace;
an N1 surgical change uses its one-line trace instead. Emit a trace when intake
selects a meaningful workflow, skill, capability, cost, delegation, or risk decision.

## Router promise

1. Classify the request and its level (N2 or N3; offer N1 explicitly when the
   N1 criteria in `reference/route-gates.md` hold).
2. Choose the smallest workflow that produces a production-ready result.
3. Take the cost posture from the level (N2 `balanced`, N3 `premium`). The
   selected skill may run its own delegates at a lower posture when its policy
   says so (for example `document-development`).
4. Explain the selected path in one plain sentence and emit the routing trace.
5. If the route requires user choice, stop in `awaiting-user-choice`.
6. Load the selected skill and follow it only after route authorization.
7. Ask only one clarifying question, and only when it changes the workflow.

## Skill execution lock (mandatory)

After a routing trace selects a workflow or skill:

1. It is execution-binding for the next non-trivial action.
2. Load and execute it before deeper planning, code exploration for
   implementation, or file edits.
3. To switch workflows, emit a new routing trace first and satisfy any
   required authorization gate. Never advertise one workflow and run another.
4. The lock persists across continuation turns; only a genuine break signal
   (see `.agents/instructions.md`) justifies a new trace.

Delegates inherit the selected workflow and bounded slice from the
orchestrator. They execute the supplied role-specific context and do not rerun
router intake, readiness, discovery, or route selection. `unknown` runtime
metadata never authorizes inherited context, a skipped required read, or a
runtime capability; stop or use the explicitly authorized fallback instead.

Natural-language binding: "usa create-prd" runs `create-prd`; "implementa este
PRD" runs `implement-change` (alias `implement-prd`); "haz el ticket" runs
`generate-pm-ticket`; "usa solution-sketch" or "hacé el sketch" runs
`solution-sketch`. For `project-formation`, `create-prd`, `create-epic`, and
`generate-pm-ticket`, never auto-load the skill: present the options from
`reference/route-menus.md` and wait.

## Execution authorization gate

- Treat intent language ("quiero", "necesito", "hagamos") as routing input, not as execution authorization.
- Before explicit route authorization, stay in `awaiting-user-choice`.
- In `awaiting-user-choice`, do not inspect product implementation files, do not generate implementation plans, and do not edit code.
- Start execution only after an explicit authorization utterance for a route ("procede", "usa create-prd", "implementa este PRD", "haz el ticket").
- If the reply is affirmative but names no route, ask the user to confirm the route by name.
- N1 surgical offers are authorized by a short "yes" to the one-line proposal.

## Routing decision trace

Emit a trace before loading the selected skill. Use COMPACT when confidence is
High, CONTINUATION when the fast-path applies, FULL otherwise.

- COMPACT: `[skill or direct-answer] · [lean | balanced | premium] · [reason in ≤8 words]`
- CONTINUATION: `[skill] · continuing · no reroute`
- N1 offer: `N1 · surgical · [files and check]`

FULL format:

```markdown
Routing decision:
- Selected workflow: `[skill or direct-answer]`
- Level: N2 | N3
- Confidence: Medium | Low
- Reason: [concrete signal]
- Cost posture: `balanced | premium`
- Delegation: `avoided | recommended | required` + one concrete reason
- Optional - Alternative considered / Why not / Context loaded
```

Name the triggering signal and the precedence rule applied. For `implement-change`,
say why direct coding is not acceptable; for `create-epic`, why a smaller flow
is insufficient; for `premium`, the concrete risk. Never invent token counts.

## Classification table

| Request class | Signals | Primary action | Confirmation? |
| --- | --- | --- | --- |
| Project formation | end-to-end shaping: discovery, roadmap, GTM, dossier | propose `project-formation` plus alternatives | Yes |
| Product ambiguity | problem, need, strategy, priority, unclear direction | propose `create-epic` or `create-prd` | Yes |
| Broad initiative | multi-phase work, research, appetite, several PRDs | `create-epic` | Yes unless the user asked for an epic |
| Feature specification | clear feature with rules, UX states, API/data impact, AC | propose `create-prd` | Yes |
| Tiny backlog item | small task with clear AC, no full PRD | propose `generate-pm-ticket` | Yes |
| Workflow extension maintenance | add/edit router rules, registry entries, `.agents/skills/**` | direct workflow-maintenance edits with validation | No |
| Production code change | build, implement, fix behavior, backend/frontend, tests | `implement-change` when a PRD, a reproducible bug, a ticket with criteria, or an iteration over an implemented PRD exists; else offer N1 when it fits, or propose `create-prd` / `generate-pm-ticket` | Yes when no input exists |
| PRD implementation | PRD path or "implement this PRD" | `implement-change` (alias `implement-prd`) | No |
| Review / QA | review PR or diff, validate quality, audit UI | stack-gated review skill (see `reference/route-gates.md`) | No |
| Documentation | explain delivered feature, guide, preserve knowledge | `document-development` | No |

## Deterministic intent resolution (required in every route)

1. Explicit skill invocation wins.
2. Check hard triggers and apply route precedence when several match.
3. Otherwise classify with the table above.
4. Resolve confidence (High/Medium/Low) and pick the smallest safe workflow; on a tie, choose the smaller safe option and say so in the trace. Smallest-first order: direct answer, N1 surgical, `generate-pm-ticket`, `create-prd`, `create-epic`; but prefer `implement-prd` over direct coding whenever production quality, contracts, tests, tenancy, or cross-layer impact matter.
5. Set level and cost posture (N2 `balanced`, N3 `premium`).
6. Set delegation state (`avoided | recommended | required`) with one concrete reason.
7. If explicit route authorization is missing, stop in `awaiting-user-choice`.

### Hard triggers

#### PR comments hard trigger

Route to `pr-comments-resolution` when the user intent is to resolve, process, close, or work through PR/review comments, including mixed Spanish/English phrasing ("resuelve comentarios del PR", "vamos cerrando comentarios de la PR", "fix Copilot/Sentry comments"). Do not downgrade it to inline review. A purely explanatory question about the skill gets a direct answer.

#### Project formation hard trigger

Route to `project-formation` as the recommended option (not auto-execution) when the user asks for end-to-end project shaping: discovery, scope shaping, phased roadmap, GTM planning, or dossier handoff ("necesito formar el proyecto completo", "quiero pasar de discovery a roadmap y go-to-market"). Do not collapse it into `create-prd` unless the user narrows scope to one feature.

#### Solution sketch hard trigger

Offer `solution-sketch` as the recommended next step and never auto-start it when the user asks to sketch classes, compare architectures, or brainstorm the solution before a spec ("dibujemos las clases", "brainstorm de la solucion", "comparemos arquitecturas antes del PRD"). Do not add `solution-sketch` as a fifth standing option in the product-shaping menu. If the user declines, continue routing the parent product path.

### Route precedence for ambiguous prompts

1. explicit skill invocation
2. `pr-comments-resolution` hard trigger
3. `implement-change` / production implementation gates
4. `project-formation` hard trigger
5. `solution-sketch` hard trigger (offer only; never auto-start)
6. `create-prd` / `generate-pm-ticket` / `create-epic`
7. review or documentation routes
8. direct answer

Example: "resolve PR comments and implement the PRD changes" applies rule 2
first; after comment resolution, emit a new trace for `implement-change`.

## Confidence levels

- High: one workflow clearly fits. Emit the COMPACT trace, load the skill, proceed.
- Medium: two workflows are plausible. Recommend one, include the cheaper safe alternative in the trace, ask at most one short question.
- Low: outcome, scope, or artifact is missing. Show the options menu from `reference/route-menus.md`, recommend the smallest safe workflow, and wait for explicit authorization.

## Router output

Before loading the selected skill, give a short note (route, why, cost posture,
state `routing | awaiting-user-choice | executing:<skill>`, next action) and
then the trace. Keep it short: a route plus a trace is usually enough. Report
AI efficiency only when it adds value: large, autonomous, or multi-agent work,
explicit user interest in cost, an avoided heavy workflow, or retries.
