---
name: workflow-router
description: "Safe and cost-aware workflow router for FHH IA Ecosystem AI work. Use for N2/N3 freeform requests (see the level pre-filter in .agents/instructions.md) when the user did not explicitly invoke a skill. N0 operational and N1 surgical requests do not load this router. Classifies intent, prevents accidental epic creation, prevents skipping implement-change for development work, keeps context proportional, and guides the user with plain-language options."
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
such as `create-epic` when a smaller artifact is enough, and over-loading context.

This file is the decision core. Load a reference only when its condition holds:

| Reference | Read it only when |
| --- | --- |
| [reference/route-menus.md](reference/route-menus.md) | you must present two or more route options and stop in `awaiting-user-choice` (a single proposed route needs no menu) |
| [reference/route-gates.md](reference/route-gates.md) | the candidate route is review/QA, production code (PRD or not), an N1 surgical offer, an epic, or workflow extension |
| [reference/project-overlay.md](reference/project-overlay.md) | `.agents/project/index.md` or `.agents/project/routing.md` exists |
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

Catalogs: `.agents/skills/index.md`, then `.agents/project/index.md` and `.agents/project/routing.md` when they exist (else empty); project entries never weaken a kit gate (`reference/project-overlay.md`).

Read `.agents/instructions.md` and this file once per session or right after a genuine workflow switch. On continuation turns apply the continuation fast-path from `.agents/instructions.md`: the latest routing trace visible in the conversation (session memory) is enough, and this file is not re-read.

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
3. Take the default cost posture from the level (N2 `balanced`, N3
   `premium`); documentation and workflow-maintenance routes may go one step
   lower (`.agents/instructions.md`); never raise it silently.
4. Explain the selected path in one plain sentence and emit the routing trace.
5. If the route writes and requires user choice, stop in `awaiting-user-choice`.
6. Load the selected skill and follow it once the gate below is satisfied.
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
`generate-pm-ticket`; "usa solution-sketch" or "haz el sketch" runs
`solution-sketch`. Without such an explicit invocation, never auto-load `project-formation`, `create-prd`,
`create-epic`, or `generate-pm-ticket`: propose the route (the options from
`reference/route-menus.md` when there are several) and wait.

## Execution authorization gate

- The gate applies to routes that write (code, PRDs, epics, tickets, installs). Read-only routes (review, audit, explanation, discovery the user asked for) and an explicit imperative that names the work ("audita X", "revisa este PR", "implementa este PRD") need no extra confirmation.
- Treat intent language ("quiero", "necesito", "hagamos") as routing input, not as execution authorization.
- Before explicit route authorization of a writing route, stay in `awaiting-user-choice`.
- In `awaiting-user-choice`, do not inspect product implementation files, do not generate implementation plans, and do not edit code.
- Start execution only after an explicit authorization utterance for a route ("procede", "usa create-prd", "implementa este PRD", "haz el ticket").
- An affirmative reply authorizes a route when the previous turn proposed exactly one, or when it points at one menu option by number, skill name, label, or an unmistakable description; say which route starts. A bare yes to a menu of several options authorizes none: ask which one.
- N1 surgical offers are authorized by a short "yes" to the one-line proposal. An irreversible action (push, deploy, delete) always names its risk and waits for an explicit yes.

## Routing decision trace

Emit a trace before loading the selected skill. Use COMPACT when confidence is
High, CONTINUATION when the fast-path applies, FULL otherwise.

- COMPACT: `[skill | direct-answer | direct-edit | direct-action] · [lean | balanced | premium] · [reason in ≤8 words]` (`direct-edit`: an authorized edit with no workflow skill, such as project context setup or workflow maintenance; `direct-action`: an irreversible operational action)
- CONTINUATION: `[skill] · continuing · no reroute`
- N1 offer: `N1 · surgical · <files>`

FULL format:

```markdown
Routing decision:
- Selected workflow: `[skill | direct-answer | direct-edit | direct-action]`
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
| Irreversible operational action | push, deploy, delete, publish, or a project runbook trigger | name the concrete risk, wait for explicit confirmation, then act directly; no workflow skill. A matching project runbook sets the steps (`reference/project-overlay.md`) | Yes, always |
| Project formation | end-to-end shaping: discovery, roadmap, GTM, dossier | propose `project-formation` plus alternatives | Yes |
| Product ambiguity | problem, need, strategy, priority, unclear direction; a request that names the feature ("quiero agregar X") is "Feature specification", not this row | propose `create-epic` or `create-prd` | Yes |
| Broad initiative | multi-phase work, research, appetite, several PRDs | `create-epic` | Yes unless the user asked for an epic |
| Feature specification | clear feature with rules, UX states, API/data impact, AC | propose `create-prd` | Yes |
| Tiny backlog item | small task with clear AC, no full PRD | propose `generate-pm-ticket` | Yes |
| Workflow extension maintenance | add/edit router rules, registry entries, `.agents/skills/**` | direct workflow-maintenance edits with validation | No when the imperative names the edit; else Yes |
| Project context setup | the user asks for the initial Discovery or to fill in `.agents/project/context.md` / `backend.md` / `frontend.md` ("haz el Discovery inicial del proyecto") | once authorized, direct edit of those project files from a bounded read of the code (N2; trace `direct-edit`; no workflow skill, no product code edits): fill every section of `context.md` (structure map, validation commands and their cost, test conventions, environment quirks, pointers) and the rule file of each layer, within the file's 200-line limit; what the code cannot settle is one line `not determined: <reason>`, never `[TODO`, and the template marker and the template notice go only when no `[TODO` is left (delete the template notice block and the marker line); a layer the project lacks keeps its file with one line that says so (never deleted); the user reviews the diff | No when the imperative names it; else Yes |
| Production code change | build, implement, fix behavior, backend/frontend, tests; a request for a feature with no imperative to build it ("quiero agregar X") is "Feature specification", not this row | `implement-change` when a PRD, a reproducible bug, a ticket with criteria, or an iteration over an implemented PRD exists; else offer N1 when it fits, or propose `create-prd` / `generate-pm-ticket` | Yes, unless the imperative names the input ("arregla este bug") |
| PRD implementation | PRD path or "implement this PRD" | `implement-change` (alias `implement-prd`) | No (`implement-change` asks once when the PRD's `Estado` is not `Aprobado`) |
| Review / QA | review PR or diff, validate quality, audit UI | stack-gated review skill (see `reference/route-gates.md`) | No |
| Documentation | explain delivered feature, guide, preserve knowledge | `document-development` | No |

## Deterministic intent resolution (required in every route)

1. Explicit skill invocation wins.
2. Check hard triggers and apply route precedence when several match.
3. Otherwise classify with the table above.
4. Resolve confidence (High/Medium/Low) and pick the smallest safe workflow; on a tie, choose the smaller safe option and say so in the trace. Smallest-first order: direct answer, N1 surgical, `generate-pm-ticket`, `create-prd`, `create-epic`; but prefer `implement-change` over direct coding whenever production quality, contracts, tests, tenancy, or cross-layer impact matter.
5. Set level and cost posture (default from the level; see Router promise 3).
6. Set delegation state (`avoided | recommended | required`) with one concrete reason.
7. If the route writes and explicit route authorization is missing, stop in `awaiting-user-choice`.

### Hard triggers

#### PR comments hard trigger

Route to `pr-comments-resolution` when the user intent is to resolve, process, close, or work through PR/review comments, including mixed Spanish/English phrasing ("resuelve comentarios del PR", "vamos cerrando comentarios de la PR", "fix Copilot/Sentry comments"). Do not downgrade it to inline review. Inside another active workflow it is a break signal: re-route in that turn. A purely explanatory question about the skill gets a direct answer.

#### Project formation hard trigger

Route to `project-formation` as the recommended option (not auto-execution) when the user asks for end-to-end project shaping: discovery, scope shaping, phased roadmap, GTM planning, or dossier handoff ("necesito formar el proyecto completo", "quiero pasar de discovery a roadmap y go-to-market"). Do not collapse it into `create-prd` unless the user narrows scope to one feature. Once authorized, it stays binding across its stages (skill execution lock) until a break signal.

#### Solution sketch hard trigger

Offer `solution-sketch` as the recommended next step and never auto-start it when the user asks to sketch classes, compare architectures, or brainstorm the solution before a spec ("dibujemos las clases", "brainstorm de la solucion", "comparemos arquitecturas antes del PRD"). Do not add `solution-sketch` as a fifth standing option in the product-shaping menu. If the user declines, continue routing the parent product path.

#### Explicit PRD hard trigger

"Explicit PRD" in the level pre-filter means the user gives the path of an existing PRD or asks to implement one ("implementa este PRD", "el PRD ya está aprobado, avanza"). Route to `implement-change` whatever the level: the PRD is the input and naming it is the authorization (`implement-change` checks the PRD's `Estado` and sets the level, which only decides the ceremony). A request to write a PRD is not this trigger: it is a `create-prd` proposal that waits for the user's choice.

### Route precedence for ambiguous prompts

1. explicit skill invocation
2. `pr-comments-resolution` hard trigger
3. `implement-change` / production implementation gates
4. `project-formation` hard trigger
5. `solution-sketch` hard trigger (offer only; never auto-start)
6. `create-prd` / `generate-pm-ticket` / `create-epic`
7. review or documentation routes
8. direct answer

Example: "resolve PR comments and implement the PRD changes" applies rule 2 first; after comment resolution, emit a new trace for `implement-change`.

## Confidence levels

- High: one workflow clearly fits. Emit the COMPACT trace. Load the skill and proceed when the route is read-only or the imperative names the work; for a route that writes, propose that one route, stop in `awaiting-user-choice`, and load the skill only after the user authorizes it.
- Medium: two workflows are plausible. Recommend one, include the cheaper safe alternative in the trace, ask at most one short question. The alternative in the trace is not a second offer: when the message proposes only the recommended route, a plain yes authorizes it; when it offers both, the reply must pick one.
- Low: outcome, scope, or artifact is missing. Show the options menu from `reference/route-menus.md`, recommend the smallest safe workflow, and wait for explicit authorization.

## Router output

Before loading the selected skill, give a short note (route, why, cost posture,
state `routing | awaiting-user-choice | executing:<skill>`, next action) and
then the trace. Keep it short: a route plus a trace is usually enough. Report
AI efficiency only when it adds value: large, autonomous, or multi-agent work,
explicit user interest in cost, an avoided heavy workflow, or retries.
