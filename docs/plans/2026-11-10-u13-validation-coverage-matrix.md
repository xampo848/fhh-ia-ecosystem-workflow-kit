# U-13 · Matriz de cobertura de validación por etapa

Fecha: 2026-11-10. Método: decisión D-19 del
[roadmap](2026-11-10-workflow-kit-improvement-roadmap.md). Este documento no
autoriza ningún recorte: cada hallazgo se presenta al usuario y se aprueba uno
a uno antes de modificar un skill (D-19, punto 12).

## 1. Matriz declarada (qué dice verificar cada etapa)

Fuente: los `SKILL.md` de cada etapa en `.agents/skills/02-implement/`, al
commit del Lote 4.

| Etapa | Lint | Tipos / build | Tests unitarios | Tests de aceptación | Contrato | E2E | Revisión de juicio |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Implementador backend (`turbo-backend`) | sí, solo archivos tocados | — | sí, el más angosto que falsifique el slice | — | — | — | — |
| Implementador frontend (`pixel-ninja`) | sí (`lint`, `lint:styles`, `validate:css`) | — | sí (`test`) | — | — | — | barra visual del Contrato Visual |
| `testinator-5000` | — | — | — | sí, por criterio de aceptación y casos borde del PRD | — | solo specs del slice | suficiencia de tests |
| `guardia-contrato` | — | — | tests de serializer/controller relacionados | — | sí, forma del contrato, autorización y scoping | — | contrato productor-consumidor |
| `lint-ranger` (`validation-runner`) | sí | sí cuando aplica | sí, el comando más angosto | — | — | — | clasifica fallas (producto, entorno, ajena) |
| `qa-relampago` | — | — | — | — | — | — | compuertas de cierre, 6 categorías de casos borde, ledger |
| Cierre del orquestador | sí, archivos tocados | — | sí, dominios tocados | — | — | suite completa, una vez | Definition of Done global |

Solapamientos **declarados** (candidatos a revisar con la matriz observada):

1. **Lint**: implementador, `lint-ranger` y cierre lo corren sobre los mismos
   archivos si nada cambió entre medio.
2. **Tests unitarios del slice**: implementador y `lint-ranger` corren el mismo
   comando angosto; el cierre vuelve a correr los dominios tocados.
3. **Tests relacionados al contrato**: `guardia-contrato` corre tests de
   serializer/controller que el implementador backend ya pudo correr.

No son candidatos, por D-19 punto 9: las revisiones de juicio
(`qa-relampago`, `guardia-contrato`, suficiencia de tests), cualquier check de
un slice con `criticalConcern` y la suite completa del cierre.

## 2. Matriz observada (qué corrió en ejecuciones reales)

Datos: ooh-backoffice, PRDs ds-04 (grande), ds-14 (6 rondas de QA) y ds-05
(chico). Investigación de solo lectura.

_Pendiente: se completa con el resultado de la investigación._

## 3. Clasificación y hallazgos

_Pendiente de la matriz observada._ Cada repetición se clasifica como duplicado
exacto, re-ejecución tras un cambio, solapamiento con otro propósito o
complementaria. Solo son hallazgos los duplicados exactos o solapamientos de
checks mecánicos que aparezcan en al menos 2 de los 3 PRDs, que no hayan
detectado ninguna falla y que D-11 no resuelva ya.

## 4. Qué se aplicó sin esperar la investigación

Lo siguiente no elimina ningún check; cambia cuándo se reutiliza un resultado
y arranca en modo sombra, así que no depende de los hallazgos:

- **IA-09** · reutilización de checks vigentes con huella calculada por
  `validation-fingerprint.mjs` (sección "Evidence Reuse" de
  `validation-and-stop-conditions.md`). Solo typecheck, suites unitarias y
  build; nunca integración, E2E, slices críticos ni la suite del cierre.
- **IA-10** · QA incremental (`qa-handoff-review`, "Incremental Re-entry").
- **D-11** (Lote 3) · suite cara completa una sola vez y tope de rondas.

## 5. Pendiente de aprobación del usuario

- Revisar los hallazgos de la sección 3 uno a uno.
- Prueba contra defectos reales (D-19, punto 10): ningún cambio se aplica si
  una falla histórica dejaría de detectarse.
- Modo sombra en las 2 o 3 primeras implementaciones reales antes de activar
  la reutilización (`validation_reuse: active` en `project-context.md`).
- Calibración única de la QA enfocada contra la completa (D-20, ajuste 7).
