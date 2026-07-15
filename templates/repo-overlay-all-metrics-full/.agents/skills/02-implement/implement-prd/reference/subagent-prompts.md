# Subagent Prompts

Use these prompts in GitHub Copilot with `runSubagent` or as generic fallback prompt cards. In Codex, prefer the thin runtime adapters in `.codex/agents/*.toml`, which must read the same shared skills before acting. For other agents without subagents, open the same skill path and run the procedure inline.

## Standard Writable Delegate

```text
Actua como [ALIAS].

Usa esta skill:
.agents/skills/02-implement/[skill-name]/SKILL.md

Contexto:
- PRD: [path]
- Operating mode: [small/local | standard | autonomous-safe | resume]
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
