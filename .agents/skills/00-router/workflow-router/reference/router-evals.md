# Router evals (maintainers only)

Never load this file during execution. It holds the level test prompts, the
trigger examples, the anti-patterns, and the definition of done used to
maintain `../SKILL.md` and the level pre-filter in `.agents/instructions.md`.

## Level test prompts

Each prompt has the level and route a correct run must produce. `check:workflow`
validates the table shape and coverage; the behavior is verified by running
the prompts in each runtime (Claude Code, Codex, GitHub Copilot) after any
change to the pre-filter or the router, and recording the result in the PR.

<!-- router-evals:level-prompts:start -->
| ID | Prompt | Expected level | Expected route |
| --- | --- | --- | --- |
| L01 | "¿Qué hace el comando workflow-kit doctor?" | N0 | direct-answer |
| L02 | "Corre los tests de cli y dime si pasan" | N0 | direct-answer |
| L03 | "Arregla la indentación de este archivo" | N0 | direct-answer |
| L04 | "Corrige el typo en el título del README" | N0 | direct-answer |
| L05 | "El botón Guardar no valida el email vacío; arréglalo en ese formulario" | N1 | n1-surgical |
| L06 | "Cambia el timeout por defecto de 30 a 60 segundos en la config del cliente" | N1 | n1-surgical |
| L07 | "Agrega filtros por fecha y estado al listado de campañas" | N2 | create-prd |
| L08 | "Implementa este PRD: docs/prd/x/x.md" | N2 | implement-prd |
| L09 | "Agrega una columna nueva a la tabla de cotizaciones con su migración" | N3 | create-prd |
| L10 | "Cambia los permisos para que los agentes vean solo sus anunciantes" | N3 | create-prd |
| L11 | "Resuelve los comentarios del PR" | N2 | pr-comments-resolution |
| L12 | "Haz push de la rama y despliega a staging" | N3 | direct-answer |
<!-- router-evals:level-prompts:end -->

Notes:

- L09 and L10 hit N3 signals (migration, authorization or tenancy). Without a
  PRD the router proposes `create-prd` or a ticket and waits for the user's
  choice; the expected route names the recommended option.
- L12 is irreversible: the action itself is not routed to a workflow, but it is
  N3, so it always asks before acting.
- L05 is a bug: the N1 test must fail before the fix.

## Trigger examples

| User says | Route | Cost posture |
| --- | --- | --- |
| "Explícame si esta idea tiene sentido" | direct answer, or `create-prd` if the user wants a spec-ready decision | `lean` or `balanced` |
| "Quiero agregar un dashboard de métricas DORA" | propose `create-prd` (or `generate-pm-ticket` if tiny) and wait | `balanced` |
| "Implementa este PRD" | `implement-prd` | `balanced` |
| "Crea la épica para GitHub Intelligence" | `create-epic` | `balanced`; `premium` if architecture impact is high |
| "Arregla este bug en frontend" | N1 surgical offer if very small and clear; otherwise `implement-prd` or a predecessor | `lean` for N1, otherwise `balanced` |
| "Haz un ticket para esto" | `generate-pm-ticket` | `lean` |
| "Agrega un workflow nuevo al router" | workflow extension maintenance | `lean` |
| "Crea una skill propia y déjala registrada" | workflow extension maintenance (`SKILL.md` + registry) | `lean` |
| "Quiero agregar un pattern para mi proyecto" | workflow extension maintenance with `add-project-pattern` | `lean` |
| "Revisa si esta pantalla está bien" | `frontend-design`, `impeccable`, or `react-doctor` by depth | `lean` or `balanced` |
| "Documenta lo que se hizo" | `document-development` | `lean` |

## Anti-patterns

- Coding directly for N2/N3 development work.
- Starting `create-epic` because the idea sounds big when one PRD fits.
- Asking the user to choose from a long skill list, or loading every skill or pattern.
- Treating `implement-prd` as optional when production code changes are non-trivial.
- Routing workflow-extension maintenance to product workflows.
- Hiding that a skill was skipped, or hiding the N1 option when it fits.
- Using `premium` without a concrete risk, or claiming an automatic model switch the runtime did not confirm.
- Long routing explanations when a route plus a trace is enough.
- Invoking subagents for ceremony, or justifying delegation only after the fact.
- Exploring code, planning implementation, or editing before route authorization.
- Reading this file or the menus during a routing turn that does not need them.

## Definition of done

Routing is complete when:

- the selected workflow is the smallest safe path for the request's level;
- heavy workflows are protected by confirmation;
- development work cannot bypass `implement-prd` unless an N1 surgical change was explicitly offered and authorized;
- the trace records workflow, level, confidence, reason, cost posture, delegation state with one reason, and the precedence rule when several triggers matched;
- the route authorization state is explicit and execution does not start before it;
- only the references whose condition held were loaded.
