---
name: workflow-router
description: "Safe and cost-aware workflow router for FHH IA Ecosystem AI work. Use before any non-trivial freeform request when the user did not explicitly invoke a skill. Classifies intent, prevents accidental epic creation, prevents skipping implement-prd for development work, optimizes input/output token usage, and guides the user with plain-language options."
argument-hint: "Freeform user request"
user-invocable: true
license: MIT
metadata:
  author: fhh-ia-ecosystem
  version: "1.2"
---

# Workflow Router

Use this skill as the safe entrypoint when the user makes a freeform request and did not explicitly name a skill.

The router exists to solve three problems:

1. Avoid skipping production-ready workflows, especially `implement-prd`, when the user asks for development work.
2. Avoid starting heavy workflows, especially `create-epic`, when the user only needs a smaller artifact or guidance.
3. Avoid unnecessary AI spend by recommending the smallest workflow, smallest context, and lowest safe model tier.

The user should not need to memorize skill names. Explain the selected path in plain language, leave a visible routing trace, recommend a cost posture, then load the correct skill.

## Source of truth

Before routing, read `.github/copilot-instructions.md`. If any rule conflicts with this skill, `.github/copilot-instructions.md` wins.

For large, autonomous, multi-agent, or cost-sensitive work, apply `docs/internal-documentation/workflows/ai-cost-efficiency-policy.md`. For simple routing, use the summary in `.github/copilot-instructions.md` and do not load the full guide.

## Router promise

For every non-trivial freeform request:

1. Classify the request.
2. Choose the smallest workflow that can produce a production-ready result.
3. Consider AI cost across input context, output length, subagents, validation, and rework risk, then recommend the lowest safe cost posture: `lean`, `balanced`, or `premium`.
4. Explain the selected path in one plain sentence.
5. Emit the routing decision trace.
6. Load the selected skill and follow it.
7. Ask only one clarifying question when ambiguity materially changes the workflow.

Do not stay generic. The output of this skill is a routing decision, cost posture, plus the next action.

## Routing decision trace

For every non-trivial routing decision, emit a trace before loading the selected skill.
If confidence is `High`, use the COMPACT format. Otherwise, use the FULL format.

**COMPACT format (High confidence only):**
`[skill or direct-answer] · [lean | balanced | premium] · [short reason in ≤8 words]`

**FULL format:**
```markdown
Routing decision:
- Selected workflow: `[skill or direct-answer]`
- Confidence: Medium | Low
- Reason: [razon concreta]
- Alternative considered: [skill alternativa o `none`]
- Why not: [por que no se eligio]
- Cost posture: `lean | balanced | premium`
- Cost reason: [por que ese tier es suficiente o por que se justifica subir]
- Delegation: `avoided | recommended | required`
- Delegation reason: [por qué inline es mejor o qué beneficio concreto aporta delegar]
- Context loaded: [archivos/docs minimos planificados]
```

Requirements for FULL trace:
- Be specific about the signal that triggered the route.
- Name one real alternative when confidence is Medium or Low.
- If the route is `create-epic`, the trace must make clear why a smaller flow is insufficient.
- If the route is `implement-prd`, the trace must make clear why direct coding is not acceptable.
- If the route is `implement-prd`, the trace must also say whether the phase fan-out, context-window pressure, or file-ownership split makes subagents `recommended` or `required`.
- If the work is multi-step, docs/process-sensitive, or implementation-adjacent, the trace must make an explicit delegation decision even when the answer is `avoided`.
- If a heavier workflow was avoided for efficiency, mention the safer smaller workflow chosen.
- If the cost posture is `premium`, explain the concrete risk that justifies it.
- Do not invent exact token counts unless the tool provides actual telemetry.

## Classification table

| Request class | Signals | Primary action | Confirmation required? | Default cost posture |
| --- | --- | --- | --- | --- |
| Direct answer | Explanation, advice, comparison, small command, no repo changes | Answer directly | No | `lean` |
| Product ambiguity | Problem, user need, strategy, priority, roadmap, JTBD, unclear direction | `product-studio` | No, explain why | `balanced` |
| Broad initiative | Multi-phase work, major capability, research, roadmap, appetite, multiple PRDs | `create-epic` | Yes unless user explicitly asked for epic/initiative/research | `balanced`; `premium` only for major architecture or commercial risk |
| Feature specification | Clear feature, business rules, UX states, API/data impact, acceptance criteria needed | `create-prd` | No, unless user only wanted a quick answer | `balanced` |
| Tiny backlog item | Small task, no full PRD needed, clear AC expected | `generate-pm-ticket` | No | `lean` |
| Workflow extension maintenance | User asks how to add/edit router rules, skill registry entries, or custom `.agents/skills/**` skills; or asks the AI to perform those edits | Direct workflow-maintenance edits with validation (or explanation-only if requested) | No | `lean` |
| Production code change | Build, implement, develop, fix behavior, add UI, change backend/frontend, modify tests | `implement-prd` if PRD exists; otherwise route to `create-prd` or `generate-pm-ticket` first | Ask only if PRD/ticket path is unclear | `balanced`; `premium` for high-risk architecture or debugging |
| PRD implementation | User references PRD path or says implement this PRD | `implement-prd` | No | `balanced` |
| Review / QA | Review PR, review diff, validate quality, inspect frontend, audit UI, or sharpen visual direction | stack-gated review skill (`frontend-design`, `react-doctor`, `impeccable`, `pr-comments-resolution`, `playwright-testing`, `contract-verifier`, or inline review) | No | `lean` for pure visual direction, otherwise `balanced`; `premium` for large or release-critical diffs |
| Documentation | Explain delivered feature, write guide, preserve knowledge | `document-development` | No | `lean` |

## Review/QA applicability gate (required)

Before loading any review/QA skill, run this gate in order:

1. Detect changed surface from user request and current diff: backend-only, frontend non-React, React frontend, contract-only, or mixed.
2. Select only applicable quality skills:
  - Backend-only: prefer inline review and/or `contract-verifier`; do not load `react-doctor` or `playwright-testing` by default.
  - Frontend non-React: do not load `react-doctor`; load `playwright-testing` only if formal E2E coverage is explicitly requested or required.
  - React frontend: load `react-doctor` for meaningful React changes.
  - Formal E2E ask or release-critical flow validation: load `playwright-testing` when a navigable UI flow exists.
3. If no specialized quality skill applies, continue with inline review and explain why specialized skills were skipped.

Do not invoke `react-doctor` or `playwright-testing` unless this gate says they apply.

## Workflow extension handling

When the request is about extending the workflow itself (router, registry, custom skills):

1. Decide mode first:
  - explanation-only (user asks "how"),
  - execution (user asks to apply changes).
2. Keep edits scoped to workflow contract files unless user asks broader changes.
3. Preserve boundaries:
  - routing policy in `workflow-router/SKILL.md`,
  - startup contract in `.agents/instructions.md`,
  - discovery metadata in `.agents/skills/registry.md`,
  - algorithm details in each skill `SKILL.md`.
4. After execution-mode edits, run relevant repository checks and report outcomes.

## Cost posture rules

### `lean`

Use when the task is low-risk, repetitive, mostly summarization, routing, ticketing, documentation, or validation interpretation.

Typical examples:

- `workflow-router`
- direct explanations
- `generate-pm-ticket`
- small `document-development`
- `validation-runner` on clear failures
- simple `contract-verifier` checks

### `balanced`

Use when the task needs reliable reasoning but is not high-risk enough for a premium model.

Typical examples:

- `product-studio`
- `create-prd`
- normal `create-epic`
- normal `implement-prd`
- backend/frontend implementation
- `react-doctor`
- `qa-handoff-review` on normal diffs

### `premium`

Use only when the cost is justified by risk or ambiguity.

Escalate to `premium` when the task involves:

- architecture decisions with long-term impact,
- deep debugging across layers,
- major refactors,
- multi-tenancy risk,
- migrations or data loss risk,
- release-critical QA,
- product/commercial decisions that affect roadmap or pricing.

Do not use `premium` for routine docs, small tickets, boilerplate, simple validation fixes, or mechanical refactors.

## Model selection limitation

Skills can recommend a cost posture and model tier, but they cannot guarantee an automatic model switch unless the runtime tool supports model routing.

Behavior:

- If the tool supports model selection per request or subagent, select the recommended tier before loading the skill.
- If the tool does not support model selection, still emit the cost posture so the human, IDE, CLI, or orchestration layer can choose the right model.
- Never claim a model was switched automatically unless the runtime confirms it.

## Production-ready implementation gate

If the user asks for any development work, assume production readiness is required.

Development work includes:

- Build this
- Implement this
- Create this screen
- Add this endpoint
- Fix this behavior
- Modify backend or frontend
- Change API contracts or serializers
- Change data models, migrations, jobs, analytics, permissions, tenancy, or tests
- Make the code do X

Default rule:

```text
Development request -> do not code directly -> route through implement-prd or its safe predecessor.
```

If the user asks for "just do it" but the work is still non-trivial, keep the rule. Speed does not override production safety.

### When a PRD exists

Use `implement-prd` immediately when:

- The user provides a PRD path.
- The user says the PRD is approved.
- The request says "implement this PRD", "build this feature from the PRD", or equivalent.

Say:

```text
Voy a usar implement-prd porque esto ya es trabajo de desarrollo y necesitamos mantener discovery, slicing, tests, contratos y QA antes de tocar código.
```

Then load `.agents/skills/02-implement/implement-prd/SKILL.md`.

### When no PRD exists

Do not silently code. Choose the smallest predecessor:

- Use `generate-pm-ticket` for tiny backlog-sized changes.
- Use `create-prd` for feature work with business rules, UX, API, data, tests, acceptance criteria, tenancy, or cross-layer impact.
- Use `create-epic` only for a broad initiative that needs research, phases, appetite, and multiple PRDs.

Say:

```text
Antes de implementar necesito dejar el alcance ejecutable. Recomiendo [create-prd/generate-pm-ticket] porque [razón breve].
```

## Surgical edit exception

A direct edit may skip `implement-prd` only if all conditions are true:

1. The change touches at most one or two files.
2. The target files and exact change are already clear.
3. There is no database, API contract, authorization, tenancy, background job, analytics, cross-layer, or migration impact.
4. The validation command is obvious and can be named before editing.
5. The final response explicitly says why `implement-prd` was not required.

If any condition is false, use `implement-prd` or create the missing PRD/ticket first.

## Epic safety gate

Do not start `create-epic` just because the request sounds important.

Use `create-epic` only when one of these is true:

- The user explicitly asks for an epic, iniciativa, roadmap, fases, MVP, research document, or multi-PRD plan.
- The work clearly spans multiple phases, product areas, integrations, or capabilities.
- The result needs research, appetite shaping, evidence, risks, and a PRD queue.

If unclear, ask:

```text
Puedo tomar esto como PRD acotado o como épica completa. ¿Prefieres una especificación pequeña para implementar o una investigación con fases?
```

When autonomy is preferred and the request can still fit safely in one feature spec, default to `create-prd`, not `create-epic`.

## Plain-language guidance

When the user is unsure, do not dump the full skill catalog. Offer at most three options:

```text
Puedo tomar esto de 3 formas:
1. Respuesta rápida / análisis sin crear archivos.
2. Ticket o PRD acotado para implementar.
3. Épica completa con investigación y fases.

Mi recomendación: [opción], porque [razón breve].
```

If the user says "no sé" or gives no preference, choose the safest smallest workflow and state the assumption.

## Teach, challenge, improve

Routing is not only classification. It must also mentor.

For substantial requests, add a lightweight coaching layer:

1. Teach one concrete concept the user is implicitly touching.
2. Challenge one assumption, shortcut, or hidden risk if it affects quality.
3. Improve the path by recommending the smallest stronger workflow when the user is under-scoping the work.

Use `engineering-mentor` as a cross-cutting overlay when:

- the user explicitly wants coaching or explanation,
- the tradeoff is subtle enough that a bare routing choice would hide important reasoning,
- or the developer would likely repeat the same workflow mistake later.

Do not let mentoring replace the selected workflow. The mentor layer exists to sharpen understanding, not to block progress.

## AI cost efficiency routing

Route for quality per unit of AI effort, not for minimum tokens alone.

Before selecting a workflow, consider:

- **Input cost:** how much context, how many docs, how many skills, and how many files must be loaded.
- **Output cost:** how much explanation is useful versus repetitive.
- **Delegation cost:** whether a subagent reduces risk/rework or just adds ceremony.
- **Validation cost:** whether targeted validation can falsify the change before broad suites.
- **Rework cost:** whether skipping a heavier workflow would likely create bugs, ambiguity, or future cleanup.

Rules:

- Prefer direct answer for simple explanations with no repo change.
- Prefer `generate-pm-ticket` over `create-prd` when a backlog item is enough.
- Prefer `create-prd` over `create-epic` when one feature spec is enough.
- Prefer surgical edit over `implement-prd` only when all surgical exception conditions are true.
- Prefer `implement-prd` over direct coding when production quality, contracts, tests, tenancy, or cross-layer impact matter.
- For non-trivial routed work, decide delegation state explicitly: `avoided` when inline execution is cheaper and safer, `recommended` when a focused helper lowers context or review risk, `required` when ownership/contract boundaries demand it.
- When delegation is avoided, name the concrete reason, for example single-writer continuity, tiny scope, focused validation, or docs-only work.
- Prefer concise routing notes; do not output long policy explanations unless the user asks about efficiency.

### Delegation heuristics for routed implementation work

When the selected route is `implement-prd`, do not leave delegation as a vague preference. Use these heuristics before loading the skill:

- Mark delegation as `required` when the work already implies multiple implementation phases/skills, cross-layer contracts, separate file owners, or enough moving parts that one agent would need to keep too many open threads in one context window.
- Mark delegation as `recommended` when a focused delegate would clearly reduce exploration noise, isolate one slice, or preserve review independence, even if one agent could still finish the work inline.
- Mark delegation as `avoided` only when the likely execution fits a compact preflight plus one writer path, with obvious validation and no meaningful benefit from phase separation.

Good signals that delegation should move upward:

- more than one implementation surface or acceptance stream,
- discovery/slicing/matching are materially different cognitive tasks from coding,
- backend responses feed frontend behavior,
- the PRD already names multiple phases or deliverables,
- context would likely exceed a small working set without separate owners.

Do not treat “subagents exist” as sufficient reason by itself. The point is smarter context partitioning, not ceremony.

Report AI efficiency only when it adds value: large/autonomous/multi-agent work, explicit user interest in cost, meaningful trade-offs, avoided heavy workflow, retries/failures, or expensive validation choices.

## Confidence levels

### High confidence

The request clearly maps to one workflow.

Behavior:

- State the selected workflow in one sentence.
- Emit the COMPACT routing trace with cost posture (e.g. `[skill] · balanced · [reason]`).
- Load the skill.
- Proceed.

### Medium confidence

Two workflows are plausible and the choice affects scope or artifacts.

Behavior:

- Recommend one.
- Include the lower-cost safe alternative in the trace.
- Ask one short question only if needed.
- Do not ask multiple discovery questions.

### Low confidence

The request lacks outcome, scope, or artifact type.

Behavior:

- Show the three-option menu.
- Recommend a default.
- Prefer the smallest safe workflow.
- Wait for the user or proceed with the safest smallest path if the user requested speed/autonomy.

## Trigger examples

| User says | Route | Cost posture |
| --- | --- | --- |
| "Explícame si esta idea tiene sentido" | Direct answer or `product-studio` if product direction is unclear | `lean` or `balanced` |
| "Quiero agregar un dashboard de métricas DORA" | `create-prd` unless explicitly broad/multi-phase | `balanced` |
| "Implementa este PRD" | `implement-prd` | `balanced` |
| "Crea la épica para GitHub Intelligence" | `create-epic` | `balanced`; `premium` if architecture impact is high |
| "Arregla este bug en frontend" | `implement-prd` if non-trivial; surgical exception only if very small and clear | `lean` for surgical, otherwise `balanced` |
| "Haz un ticket para esto" | `generate-pm-ticket` | `lean` |
| "Agrega un workflow nuevo al router" | Workflow extension maintenance path (explain or edit, based on user intent) | `lean` |
| "Crea una skill propia y dejala registrada" | Workflow extension maintenance path (create `SKILL.md` + update registry, and router only if needed) | `lean` |
| "Quiero agregar un pattern para mi proyecto" | Workflow extension maintenance path using `add-project-pattern` + registry sync | `lean` |
| "Revisa si esta pantalla está bien" | `frontend-design` si el problema es visual/dirección, `impeccable` si requiere craft/polish/audit amplio, o `react-doctor` si es revisión técnica React | `lean` o `balanced` según profundidad |
| "Documenta lo que se hizo" | `document-development` | `lean` |

## Final router output format

Before loading the selected skill, produce a short routing note:

```markdown
Ruta recomendada: `[skill]`
Por qué: [una frase simple]
Cost posture: `lean | balanced | premium`
Siguiente acción: [leer skill / pedir una aclaración / responder directo]
```

Then emit the routing trace. For direct answers, keep it brief, but still leave the trace when the request required actual routing judgment.

## Anti-patterns

Do not:

- Code directly for non-trivial development work.
- Start `create-epic` because the idea sounds big but could fit in one PRD.
- Ask the user to choose from a long skill list.
- Load every skill or every pattern doc.
- Treat `product-studio` as a replacement for `create-prd`.
- Treat `implement-prd` as optional when production code changes are non-trivial.
- Route workflow-extension maintenance to product workflows when no product artifact is needed.
- Hide the fact that a skill was skipped.
- Route to `create-epic` when `create-prd` would be enough.
- Give a routing answer with no teach/challenge/improve value when the user is making a meaningful engineering decision.
- Use `premium` cost posture without a concrete risk.
- Claim automatic model switching happened when the runtime does not support it.
- Produce long routing explanations when a short route plus trace is enough.
- Invoke subagents for ceremony when inline work is safer and cheaper.
- Skip the delegation decision entirely and later justify it only after the fact.

## Definition of done

Routing is complete when:

- The selected workflow is the smallest safe path.
- Heavy workflows are protected by confirmation when needed.
- Development work cannot bypass `implement-prd` unless the surgical exception is explicitly justified.
- The cost posture is explicit for non-trivial routed work.
- The user receives a clear, understandable explanation of what happens next.
- The routing trace records the selected workflow, confidence, reason, discarded alternative, cost posture, and minimal context.
- The routing trace also records whether delegation was avoided, recommended, or required, with one concrete reason.
- For `implement-prd`, the routing trace also makes explicit whether the decision was driven by phase count, ownership boundaries, or context-window protection.
- AI cost efficiency was considered without sacrificing quality, safety, or maintainability.
- The interaction leaves the user a little sharper than before, not just unblocked.
