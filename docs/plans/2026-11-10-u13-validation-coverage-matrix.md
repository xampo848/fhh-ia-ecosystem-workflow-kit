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
(chico). Investigación de solo lectura hecha por un subagente el 2026-11-10
sobre `_meta/`, la sección 10 de cada PRD, `log/ds04-s5-history/` y `git log`.
Verifiqué tres afirmaciones por muestreo (el commit del defecto escapado, que
el commit de ds-14 no toca servicios y la cantidad de handoffs); el resto no
tiene verificación independiente.

Límites de la evidencia:

- ds-04 solo tiene comandos con hora en `log/ds04-s5-history/`; el resto sale
  del tracker y de la sección 10, así que sus conteos son órdenes de magnitud.
- ds-14 no tiene tracker en disco; los datos salen de sus 29 handoffs.
- ds-05 corrió en un carril liviano (un writer y una QA independiente), sin
  `lint-ranger` ni `guardia-contrato`.
- "No se editó nada entre dos corridas" se decidió, en este orden, por hashes
  de contenido en handoffs y tracker, por lo que declara cada handoff, por los
  archivos de los commits y por fechas de archivo. Lo demás quedó "desconocido".

| | ds-05 | ds-04 | ds-14 | Total |
| --- | --- | --- | --- | --- |
| Ejecuciones de checks | ~20 | ~120 o más | ~160 | ~300 |
| Duplicados exactos | 1 | ~4 | ~14 (más 5 repeticiones intencionales de determinismo) | ~19 |
| Solapamiento con otro dueño | ~1 | ~13 | hasta 9, sin confirmar | ~23 |
| Fallas de entorno, harness o flaky | 3 | ~9 | ~10 | ~22 |
| Defectos de producto escapados | 0 | 1 | 0 | 1 |

Repeticiones observadas:

- **ds-14, duplicado exacto probado con git:** la suite de servicios (236
  tests) corrió 8 veces más después de la línea base sin que ningún commit
  tocara `app/services`, `app/models` ni `test/services`.
- **ds-14, QA final y reentrada:** volvieron a correr las suites de
  controladores, contrato e inventario sobre un contenido cuyo hash era igual
  al de la última corrida del implementador.
- **ds-14, lint:** rubocop corrió en dos slices consecutivos sobre los mismos 2
  archivos, y ambos handoffs dicen que no se tocó Ruby.
- **ds-04, solapamiento:** la validación independiente volvió a correr
  subconjuntos de Rails, lint y Node sobre contenido con hashes idénticos a los
  del writer en unos 13 casos. En los mismos gates, en cambio, **no** repitió
  la compilación ni la suite E2E completa: las "consumió" del writer.
- **ds-05 y ds-04, suite Rails tras un cambio solo de JS:** la suite de
  controladores se volvió a correr después de arreglos que tocaron solo
  JavaScript y specs (probable, sin hash que lo pruebe).
- **Builds:** no hay repeticiones sin cambio; cada build siguió a un cambio o se
  reutilizó.

Fallas detectadas:

- **Ninguna repetición sobre contenido idéntico detectó un defecto de
  producto.** Los defectos de producto aparecieron siempre en la primera
  corrida sobre contenido nuevo, o en la revisión de juicio de QA.
- Las repeticiones sobre contenido idéntico que "fallaron" expusieron
  inestabilidad: tests flaky bajo carga en ds-14, una medición de alineación
  que falló 1 de 5 veces en ds-04 y una variable de entorno faltante que falló
  dos veces en ds-05.
- **Defecto escapado (ds-04):** el commit `5786c472b` de ooh-backoffice
  (2026-11-02) corrige que el primer toque en el formulario de agencias se
  perdía mientras había un scroll en curso. Pasó todas las etapas locales y lo
  detectó la suite completa. Ninguna repetición lo habría detectado: faltaba
  ese escenario en los tests.

## 3. Clasificación y hallazgos

Solo son hallazgos los duplicados exactos o solapamientos de checks mecánicos
que aparecen en al menos 2 de los 3 PRDs, que nunca detectaron una falla de
producto y que D-11 no resuelve ya. **Todos están pendientes de aprobación del
usuario; ningún skill se modificó por ellos.**

| # | Hallazgo | Evidencia | Propuesta |
| --- | --- | --- | --- |
| H1 | La suite de tests de backend (controladores y requests) se vuelve a correr después de cambios que solo tocan JavaScript, specs o documentación | ds-05 (probable), ds-04 (probable), ds-14 (probado por hash en QA final y reentrada) | Ya lo cubre la reutilización por huella de IA-09 (suite unitaria con la misma huella), en modo sombra. No requiere un cambio adicional de skills |
| H2 | Lint sobre archivos que no cambiaron | ds-14 (dos slices seguidos), ds-04 (validación independiente sobre hashes idénticos) | Dejarlo: el lint es barato y D-20 decidió no reutilizar checks baratos. Sin cambio |
| H3 | La validación independiente repite subconjuntos de Rails y Node del writer sobre contenido idéntico | ds-04 (~13 casos); en ds-14 no se pudo confirmar | Un solo PRD con evidencia firme: **no alcanza** la regla de 2 de 3. Lo cubre IA-09 si la huella coincide. Sin cambio |
| H4 | La suite de servicios se repite sin que cambien los servicios | solo ds-14 (8 repeticiones) | Un solo PRD: no alcanza la regla. Lo cubre IA-09. Sin cambio |

Hallazgos en sentido contrario (cobertura que falta, D-19 punto 10):

| # | Hallazgo | Propuesta |
| --- | --- | --- |
| C1 | El defecto escapado de ds-04 era un escenario de interacción (primer toque durante un scroll) que ningún test cubría | No es un check que agregar al workflow; es un caso para la ronda de casos borde de `create-prd` (D-21): en formularios, preguntar por la primera interacción y por entradas táctiles |
| C2 | Cerca de 22 fallas de entorno, harness o flaky en 3 PRDs, varias con la misma causa repetida | Lo cubren D-11 (un intento de recuperación, un rerun) y `project-context.md` (peculiaridades del entorno, D-16). Conviene registrar ahí la variable de entorno y los tests flaky ya conocidos de ooh-backoffice |

Conclusión: la investigación **no justifica eliminar ningún check**. Lo que
sobra en la práctica son re-ejecuciones de suites caras sobre contenido
idéntico, y eso ya lo ataca la reutilización por huella sin borrar nada.
"Sin cambios" es un resultado válido de U-13 (D-19, punto 9).

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

- Aprobar o corregir los hallazgos H1 a H4 y C1 a C2 de la sección 3. La
  propuesta para todos es no modificar skills.
- Modo sombra en las 2 o 3 primeras implementaciones reales antes de activar
  la reutilización (`validation_reuse: active` en `project-context.md`).
- Calibración única de la QA enfocada contra la completa (D-20, ajuste 7).
- Registrar en el `project-context.md` de ooh-backoffice las fallas de entorno
  recurrentes que muestra la sección 2.
