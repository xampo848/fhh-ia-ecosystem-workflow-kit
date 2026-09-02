# Ticket: Reforzar cuatro contratos de costo en `implement-prd`

## Contexto

- El usuario reportó que implementar PRDs consume muchos créditos de IA.
- Una auditoría read-only de `implement-prd/SKILL.md`, `reference/orchestration-flow.md` y `reference/validation-and-stop-conditions.md` confirmó que la mayoría de los mecanismos de ahorro ya existen: modos proporcionales, reutilización de `discovery.md`, `cavecrew-investigator` en discovery, `cavecrew-reviewer` en QA, validación por el comando más angosto posible, y tiers Liviano/Mediano/Grande ya declarados en `.agents/model-routing/README.md`.
- Quedan cuatro huecos concretos y acotados donde el contrato depende de intención sin campo o regla explícita:
  1. El principio de diseño 2 ("Explicit delegation checkpoint") pide registrar `avoided/recommended/required` y su razón, pero `task-tracker-template.md` no tiene ningún campo para persistir esa decisión — se pierde entre turnos.
  2. "Context Budget Policy" no prohíbe explícitamente repegar el PRD completo en cada prompt de subagente; solo dice "pass only the PRD sections... needed".
  3. "Phase And Global Rules" dice "run the narrowest falsifying checks" pero no aclara que las suites amplias/completas deben reservarse para el cierre de fase o de PRD, no repetirse tras cada micro-edición.
  4. El modo `resume` dice "do not re-implement validated work" pero no vincula explícitamente esa regla con `evidence_state: fresh` para saltar revalidación de slices ya `VERIFIED`.

> **Alcance estricto**: este ticket modifica únicamente `.agents/skills/02-implement/implement-prd/SKILL.md`, `.agents/skills/02-implement/implement-prd/reference/task-tracker-template.md` y `.agents/skills/02-implement/implement-prd/reference/validation-and-stop-conditions.md`, más sus espejos en `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/02-implement/implement-prd/**`. **No** modifica `create-prd`, el router, el registry de skills (más allá del hash que `sync-skill-registry.mjs --write` recalcula), ni introduce telemetría de tokens/costo — eso permanece fuera de alcance según `.agents/model-routing/README.md`.

## Objetivo

Que el checkpoint de delegación quede registrado y auditable, que el presupuesto de contexto prohíba explícitamente repegar el PRD completo, que la cadencia de validación evite suites amplias redundantes, y que el modo resume salte explícitamente slices con evidencia fresca.

## Alcance

- Agregar `delegation_posture` y `delegation_reason` al template del tracker.
- Agregar una regla explícita de "no re-paste" en Context Budget Policy.
- Agregar una regla explícita de cadencia de validación (angosta por slice, amplia solo al cierre) en Phase And Global Rules.
- Agregar una regla explícita de skip de revalidación para slices `VERIFIED` con `evidence_state: fresh` en modo resume.

## Fuera de alcance

- Telemetría de tokens/costo/latencia.
- Selección automática de modelo o cambios a `.agents/model-routing/README.md`.
- Cambios a `create-prd`, `implementation-slicing`, `qa-handoff-review`, `validation-runner` u otros skills delegados.
- Cualquier relajación de los gates de calidad o del Production-Ready Closure Gate.

## Reglas funcionales

- El campo `delegation_posture` acepta solo `avoided | recommended | required`; `delegation_reason` es texto libre de una línea.
- La regla de "no re-paste" no prohíbe pasar referencias a secciones del PRD; prohíbe repetir el texto completo del PRD en cada prompt de subagente.
- La regla de cadencia de validación no reemplaza el Production-Ready Closure Gate; el cierre de fase/PRD sigue exigiendo la suite relevante completa.
- La regla de resume solo aplica a slices ya `VERIFIED` con `evidence_state: fresh`; cualquier slice `stale`, `BLOCKED`, o no `VERIFIED` se revalida igual.

## Casos borde y estados

- PRD en modo `small/local`: no aplica (el tracker se puede omitir); las nuevas reglas no fuerzan tracker donde no existía.
- PRD resumido sin tracker previo: si no hay `execution-lock.toon` o tracker con `evidence_state`, no hay slice para saltar y se revalida todo, como hoy.
- `delegation_posture` sin valor registrado: se trata como gap de tracker, igual que otros campos requeridos hoy.

## Contrato visual

`not-applicable`: cambio de documentación de skills, sin superficie de UI.

## Criterios de aceptación

1. `task-tracker-template.md` incluye `delegation_posture` y `delegation_reason` como campos de nivel superior junto a `quality_gate`.
2. `implement-prd/SKILL.md` Design Principle 2 referencia esos campos como el lugar donde se persiste la decisión.
3. `implement-prd/SKILL.md` Context Budget Policy incluye una regla explícita contra repegar el PRD completo en prompts de subagentes.
4. `validation-and-stop-conditions.md` Phase And Global Rules incluye una regla explícita de cadencia: comandos angostos por slice, suites amplias reservadas para cierre de fase/PRD.
5. `validation-and-stop-conditions.md` incluye una regla explícita de resume que vincula `evidence_state: fresh` con slices `VERIFIED` a saltar revalidación.
6. Los tres archivos canónicos y sus espejos en `templates/repo-overlay-fhh-ia-ecosystem-full/**` son idénticos.
7. `bun run check:workflow` y `node --test test/workflow-contract.test.mjs test/template-packs.test.mjs` pasan.

## Notas para desarrollo

- Los cuatro cambios son aditivos (nuevas líneas/campos), no se elimina ni reformula texto existente, para minimizar riesgo de romper aserciones literales en `test/workflow-contract.test.mjs`.
- Después de editar los canónicos, mirror manual a `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/02-implement/implement-prd/**` y correr `node scripts/sync-skill-registry.mjs --write` para recalcular hashes del registry.

## Riesgos o dependencias

- Bajo: son adiciones de una línea/campo en archivos ya estables; el principal riesgo es drift entre canónico y overlay, mitigado por `check:workflow`.

## Preguntas abiertas

- Ninguna bloqueante.

## Definición de terminado

- Los tres archivos canónicos actualizados y espejados en el overlay.
- Registry resincronizado.
- Tests enfocados y `check:workflow` en verde.
- Diff revisado para confirmar que no se tocó ninguna superficie fuera de alcance.
