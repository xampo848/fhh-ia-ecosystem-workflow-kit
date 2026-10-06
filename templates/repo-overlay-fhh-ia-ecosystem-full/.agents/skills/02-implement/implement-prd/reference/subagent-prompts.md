# Subagent Prompts

Use these prompts as generic fallback cards. In Codex, Copilot, and Claude Code, prefer the generated native adapters in `.codex/agents/*.toml`, `.github/agents/*.agent.md`, or `.claude/agents/*.md`; each reads the same shared skill before acting. In Antigravity and runtimes without an installed adapter, open the shared skill path and run the procedure inline.

## Copilot Invocation Protocol

Load this section immediately before any GitHub Copilot `runSubagent` delegation. Do not paste it into delegate prompts.

1. Task context and target tier: before every new non-trivial invocation, the orchestrator interprets the task and builds a structured `taskContext` (`objective`, `workKind`, `risk`, `ambiguity`, `contextCompleteness`, explicit boolean `bounded`, optional `criticalConcerns`; enums in `.agents/model-routing/README.md`, `Contextual task selection`). The resolver derives the tier from it; role defaults are only the fallback for legacy calls without context, and are not strength metrics. An explicit tier below the contextual requirement blocks; a higher one needs its reason. A technical tier is not a billing level. If `clarificationRequired` is true, clarify before delegating; uncertainty never lowers the tier.
2. Observed options: take them only from the runtime's exposed catalog or tool validation options, or from names the user confirms in the model picker. Unqualified picker names must be confirmed as Copilot-provided; for another or unknown provider, require the exact qualified identifier instead of inventing a qualifier. Repository code has no live discovery API; a saved list is stale until revalidated in the current session.
3. Resolve: pass `taskContext` (and, when a cost limit applies, `costEstimate` with caller-supplied token counts plus `budget`) through `node .agents/model-routing/copilot-model-routing.mjs --input <file|->` with `agentSlug` and `availableModels` in the same JSON object; or use `--agent <slug> --available "<option>"` for a legacy call, which the output marks `decisionMode: legacy`. Add `tier` only for an explicit task escalation. It only checks observed strings against the catalog and the supplied context and counts; it does not intercept the VS Code tool and cannot call `runSubagent`. A `blocked` result (exit 1: invalid context, tier conflict, no candidate, unpriceable or over-budget pin, no candidate within budget) stops the delegation. A user-pinned model that is below the required tier is kept but its `overrideWarning` and `contextMismatch` must be shown and recorded.
4. Invoke: call `runSubagent` with `agentName` = `invocation.agentName` (the registered Copilot alias, never the `.claude` slug) and `model` = `invocation.model` (qualified, for example `Claude Sonnet 5.5 (copilot)`). Do not rely on a role hint in the prompt, the static `model` list of the agent file, or parent inheritance.
5. Record `requested_model` as the selected model, the `decision_mode`, contextual tier and reasons, any `budgetExclusions`, and keep `resolved_model: unknown` until runtime evidence is verified. Cost figures are list-rate estimates from supplied counts, not spend; suitability stays `unbenchmarked`.
6. One correction only: when the tool rejects the agent name or model before any work started and the message lists a valid observed option in the same required tier, re-resolve with that option and invoke once. Never replay after a timeout, tool failure, task failure, partial output, or whenever execution may have begun; mark `PENDING_SUBAGENT` and ask the user.
7. A pinned model that is unavailable needs explicit user consent before any fallback (`--allow-pinned-fallback`); no silent tier downgrade or upgrade.
8. If the tier has no observed candidate or the runtime blocks it for cost or policy, stop with an actionable choice (another observed model of the same tier, an explicitly authorized tier, or inline execution). Do not silently inherit the parent model. A budget never moves a task to a cheaper tier, and a budget without complete token counts and `billingMode: token` is blocked, not guessed.
9. Selecting or configuring a model is not proof of execution. Verify with `node .agents/model-routing/verify-copilot-model-evidence.mjs` using request IDs from this invocation's run interval; the operational recipe (including the workflow-kit checkout paths under `scripts/`) is `docs/workflow/copilot-subagent-model-routing.md` in the workflow-kit repository.

## Standard Writable Delegate

```text
Actua como [ALIAS].

Usa esta skill:
.agents/skills/02-implement/[skill-name]/SKILL.md

Contexto:
- PRD: [path]
- Operating mode: [small/local | standard | autonomous-safe | resume]
- Delegation envelope: `delegation-envelope/v1` with `run_id`, `slice_id`, `execution_lock_id`, role, exact skill path, invocation, task, context, verification, and expected output fields
- Model record: `requested_model` is a request; set `resolved_model: unknown` unless runtime evidence confirms execution identity
- Slice: [objective]
- Acceptance criteria: [criteria]
- Evidence expected: [tests, validation, files, behavior]
- Files owned: [paths]
- Must not touch: [paths]
- Relevant discovery notes: [notes]
- Validation expected: [commands]

Reglas:
1. Lee la skill indicada y las instrucciones del repo que apliquen.
2. No estas solo en el codebase: no reviertas cambios de otros agentes.
3. Edita solo archivos dentro de tu ownership.
4. Puedes crear, actualizar o eliminar archivos dentro de tu ownership.
5. Puedes ejecutar comandos de terminal para buscar, testear, lintiar y validar.
6. Debes leer y aplicar las skills y docs relevantes antes de implementar.
7. Antes de editar, nombra el patron existente que vas a seguir.
8. Si ves una alternativa mejor, desafiala en una frase y recomienda una opcion.
9. No optimices fuera del alcance del slice.
10. No dejes trabajo a medias: implementa, valida y reporta usando el formato de la skill.
11. Output constraint: Return findings strictly in TOON format matching your schema in `.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md`. Avoid conversational filler.
12. If one subtask collapses to pure locate-code lookup, a bounded 1-2 file patch, or a terse diff sweep, prefer the relevant cavecrew helper under `.agents/skills/05-caveman/` instead of expanding inline context.
13. Synchronization: the parent orchestrator is blocked on your terminal handoff. Do not end until your assigned slice is either complete with evidence or explicitly blocked with the blocker and safe next action.
14. Do not invent SDK fields, runtime schemas, generated IDs, automatic enforcement, or a resolved model identity. A `VERIFIED` outcome requires a present, matching, non-`none` execution lock and fresh command evidence.

Salida obligatoria:
- Files changed.
- Acceptance criteria covered.
- Validation run and result.
- Trade-off or challenge raised.
- Learning note.
- Residual risks or none.
```

## Standard Read-Only Delegate

```text
Actua como [ALIAS].

Usa esta skill:
.agents/skills/02-implement/[skill-name]/SKILL.md

Contexto:
- PRD: [path]
- Operating mode: [small/local | standard | autonomous-safe | resume]
- Delegation envelope: `delegation-envelope/v1` with correlated identity, invocation, task, context, verification, and output fields
- Model record: preserve `requested_model`; report `resolved_model: unknown` without runtime execution evidence
- Objetivo: [read-only objective]
- Datos disponibles: [briefs, files, constraints]

Reglas:
1. Lee la skill indicada y las instrucciones del repo que apliquen.
2. No edites archivos.
3. No propongas arquitectura nueva hasta describir los patrones existentes.
4. Puedes ejecutar comandos de terminal de solo lectura para buscar e inspeccionar.
5. Identifica el menor contexto suficiente para la siguiente fase.
6. Reporta usando el formato de salida de la skill.
7. Output constraint: Return findings strictly in TOON format matching your schema in `.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md`. Avoid conversational filler.
8. When a smaller locate-code or terse review helper is enough, use the relevant cavecrew helper under `.agents/skills/05-caveman/`.
9. Synchronization: the parent orchestrator is blocked on your terminal handoff. Do not end until the assigned review/discovery is either complete with evidence or explicitly blocked with the blocker and safe next action.
10. Do not invent SDK fields, runtime schemas, generated IDs, automatic enforcement, or a resolved model identity. Report any absent, `none`, mismatched, incomplete, stale, or missing lock/evidence condition as blocking `VERIFIED`.

Salida obligatoria:
- Patterns found.
- Files likely touched.
- Validation commands.
- Risks and stop conditions.
- Suggested next skill or inline action.
- Learning note, when relevant.
```

## Handoff Review Prompt

```text
Actua como QA Relampago.

Usa esta skill:
.agents/skills/02-implement/qa-handoff-review/SKILL.md

Contexto:
- PRD: [path]
- Operating mode: [small/local | standard | autonomous-safe | resume]
- Delegation envelope: verify `delegation-envelope/v1` correlation, including `execution_lock_id`, invocation record, verification evidence, and output
- Execution plan: [summary]
- Slice reports: [summaries]
- Changed files or diff: [paths/diff]
- Validation results: [commands and results]
- Acceptance criteria evidence: [mapping]

Reglas:
1. Revisa como fresh-context reviewer.
2. No edites archivos.
3. Lidera con findings concretos por severidad.
4. Verifica que cada criterio de aceptacion tenga evidencia.
5. Desafia sobreingenieria, duplicacion, ownership leaks, contratos rotos y deuda tecnica nueva.
6. Si no hay issues, dilo claramente y lista riesgos residuales.
7. Incluye una nota docente breve sobre el patron de calidad protegido.
8. Do not treat a requested model as execution evidence. `resolved_model: unknown` is valid without runtime evidence, but `VERIFIED` is invalid when the required lock is absent, `none`, mismatched, incomplete, stale, or missing evidence.
```

## Prompt Card Files

For quick copy/paste, use the matching file in `agents/`:

- [agents/capitana-alcance.md](../agents/capitana-alcance.md)
- [agents/sherlock-estructura.md](../agents/sherlock-estructura.md)
- [agents/arquitecta-fases.md](../agents/arquitecta-fases.md)
- [agents/turbo-backend.md](../agents/turbo-backend.md)
- [agents/pixel-ninja.md](../agents/pixel-ninja.md)
- [agents/guardia-contrato.md](../agents/guardia-contrato.md)
- [agents/testinator-5000.md](../agents/testinator-5000.md)
- [agents/lint-ranger.md](../agents/lint-ranger.md)
- [agents/qa-relampago.md](../agents/qa-relampago.md)
