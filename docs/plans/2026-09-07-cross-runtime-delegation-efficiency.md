# Plan: delegacion eficiente y verificable en Copilot y Claude Code

Fecha: 2026-09-07.
Estado: plan para revision; no autoriza ni representa implementacion terminada.
Alcance: contrato neutral, adapters Copilot/Claude Code, distribucion, contexto,
validacion y evidencia. Mantener compatibilidad de los otros runtimes.

## 1. Objetivo y criterio de exito

Minimizar el esfuerzo total necesario para entregar correctamente: contexto de
entrada, salida, delegaciones, latencia, validaciones y retrabajo. No optimizar
solo cantidad de lecturas ni obligar a usar modelos distintos por apariencia.

El workflow debe seleccionar un agente apropiado, solicitar un modelo permitido
cuando el runtime lo soporte, entregar contexto suficiente, validar el resultado
y dejar evidencia honesta. La calidad y la seguridad son restricciones, no
variables que puedan reducirse para ahorrar.

Interpretacion de Claude: Claude Code, tanto terminal como su integracion de IDE.
Claude usado como modelo dentro de Copilot sigue el adapter Copilot. No extender
automaticamente las conclusiones a Claude Desktop, Agent SDK o agentes cloud.

## 2. Evidencia y rectificaciones

| Observacion | Evidencia actual | Consecuencia |
| --- | --- | --- |
| La autopsia reporta cuatro llamadas `functions.task` sin `model` | Relato de la otra sesion; faltan llamadas crudas y schema | No demuestra ausencia de seleccion de adapter ni modelo ejecutado |
| Writers y QA usan el mismo preferido | [catalogo](../../scripts/delegate-agent-catalog.json) y perfiles generados | Mediano puede elegir Sonnet para ambos; no constituye fallo por si solo |
| El tracker y schemas no incluyen routing | [tracker](../../.agents/skills/02-implement/implement-prd/reference/task-tracker-template.md), [handoffs](../../.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md) | Integrar politica con entradas, validacion y registro |
| El resolver compara cadenas exactas e imprime JSON | [resolver](../../scripts/copilot-model-routing.mjs) | No regenera perfiles ni adapta IDs entre superficies |
| Claude se genera con `model: inherit` | [generador](../../scripts/sync-delegate-runtime-adapters.mjs) | Herencia deliberada; evaluar capacidades reales antes de cambiar defaults |
| `_meta/` se elimina al cierre | [contrato](../../.agents/skills/02-implement/implement-prd/SKILL.md) | Separar evidencia de entrega y diagnostico local opcional |
| La politica de costos referenciada no se encuentra | Ruta `docs/internal-documentation/workflows/ai-cost-efficiency-policy.md` desde router | Corregir referencia o consolidar autoridad; no inventar otra politica duplicada |
| Estimaciones de 60% de repeticion y 5-8 lecturas | Sin trazas ni metodo reproducible | No utilizarlas como baseline cuantitativo |

Correcciones a conclusiones anteriores:

- No se ha probado que `functions.task` equivalga a una llamada generica ni que
  el perfil nativo fuera omitido. El nombre de una herramienta no basta.
- No imponer `agentName` ni un formato de `model` universal: dependen del schema
  realmente expuesto por cada herramienta y de la identidad registrada.
- QA independiente significa contexto y revision independientes; cambiar de
  proveedor/modelo es opcional y no garantiza eliminar sesgos.
- Leer una skill requerida o instrucciones aplicables no es desperdicio por
  definicion. Un subagente nuevo no hereda automaticamente lo leido por el padre.
- La limpieza no pudo destruir metricas que nunca se registraron. No atribuirle
  por defecto todos los datos ausentes.
- El ticket historico asignaba otros tiers; la politica vigente permite QA
  Mediano y escalamiento por riesgo. Documentar evolucion, no restaurar ciegamente
  defaults antiguos. Migracion no destructiva no implica automaticamente Grande.

## 2.1 Casos de uso y edge cases

| ID | Caso de uso | Evidencia de aceptacion |
| --- | --- | --- |
| UC-01 | El orquestador prepara un envelope versionado para un slice con identidad, contexto, ownership y comprobaciones. | Validacion positiva y negativa de campos requeridos. |
| UC-02 | Un adapter solicita un modelo permitido sin afirmar que el runtime lo ejecuto. | `requested_model` separado de `resolved_model`; este ultimo es `unknown` sin evidencia runtime. |
| UC-03 | El workflow recibe un lock ausente, incorrecto o incompleto. | El slice no puede avanzar a `VERIFIED`. |
| UC-04 | El runtime permite un candidato, requiere fallback o no tiene candidato compatible. | Seleccion, fallback autorizado o bloqueo se registran sin degradacion silenciosa. |
| UC-05 | Un usuario instala o actualiza el overlay con una personalizacion local. | Override preservado, conflicto visible, backup y rollback verificables. |
| UC-06 | El workflow reutiliza contexto de un delegado nuevo, precargado o reanudado. | Solo reutiliza contenido completo, vigente y observable; si no, realiza la lectura dirigida requerida. |
| UC-07 | El piloto opt-in registra diagnostico de una ejecucion. | No versiona prompts, secretos ni trazas completas; metricas no observables son `unknown`. |
| UC-08 | El mantenedor prepara el release tras los pilotos disponibles. | Documentacion distingue capacidades documentadas, configuradas y observadas, y no afirma compatibilidad sin smoke. |

| ID | Escenario limite | Resultado requerido |
| --- | --- | --- |
| EC-01 | Schema o runtime inaccesible. | Registrar `unknown` y bloquear solo el slice que necesite ese dato como requisito duro. |
| EC-02 | Modelo ejecutado no expuesto por el runtime. | `resolved_model: unknown`; no bloquear entrega por esa sola ausencia. |
| EC-03 | Override global impide especializacion. | Hacer visible la limitacion; no ignorar el override ni prometer diversidad de modelos. |
| EC-04 | Un solo modelo permitido. | Usarlo si satisface el riesgo; no exigir diversidad artificial. |
| EC-05 | Timeout o error despues de una escritura. | Inspeccionar efectos parciales antes de un reintento acotado. |
| EC-06 | Contexto previo con cambio irrelevante o dependencia modificada. | Reutilizar en el primer caso y revalidar de forma dirigida en el segundo. |
| EC-07 | Repositorio instalado sin scripts internos del mantenedor. | No depender de ellos; distribuir la dependencia necesaria o eliminarla de la ruta instalada. |
| EC-08 | Diagnostico, tokens o costo no observables. | Registrar `unknown`; no estimar ni afirmar ahorro monetario. |

## 3. Fuentes y limites runtime

Consultadas mediante Context7 el 2026-09-07:

- [VS Code: subagents](https://code.visualstudio.com/docs/agents/run/subagents).
- [VS Code 1.109: custom agents y fallback](https://code.visualstudio.com/updates/v1_109).
- [Claude Code: subagents](https://code.claude.com/docs/en/sub-agents).
- [Claude Code: variables de entorno](https://code.claude.com/docs/en/env-vars).

Estas fuentes describen capacidades del producto, no acreditan disponibilidad en
la instalacion del usuario. Copilot documenta herencia por defecto y overrides en
custom agents, incluyendo listas ordenadas de modelos. Claude Code documenta
aliases/IDs, `inherit`, skills precargadas y prioridades que pueden incluir
`CLAUDE_CODE_SUBAGENT_MODEL`, parametros de invocacion y frontmatter.

La fase 0 debe verificar cada capacidad en las versiones objetivo, sin trasladar
interfaces de SDK a CLI/IDE ni tomar un catalogo del tool como el del selector.

## 4. Diseno propuesto

### 4.1 Contrato neutral y adapters

- El nucleo decide riesgo, tier, ownership, contexto, controles y escalamiento.
- El adapter decide sintaxis, identidad del agente, seleccion de modelo,
  restricciones de herramientas, disponibilidad, espera y capacidad de resume.
- Separar capacidades documentadas, configuradas y observadas en la sesion.
- Diferenciar fallback nativo antes de iniciar de reintento despues de fallar;
  no reiniciar trabajo con escritura sin inspeccionar efectos parciales.
- Registrar modelo solicitado y evidencia de ejecucion por separado. Admitir
  `resolved_model: unknown`; nunca pedir al modelo que adivine su identidad.
- Si solo hay un modelo permitido, usarlo con limitacion explicita cuando sea
  compatible con el riesgo. Si no cumple un requisito duro, detener ese slice.
- Respetar overrides del usuario, permisos y politicas organizacionales. Un
  override global que impida especializacion debe hacerse visible, no ignorarse.
- Preferir mecanismos nativos soportados a construir un motor propio de fallback.
  Mantener fallback portable explicito para versiones sin esas capacidades.

### 4.2 Contrato compacto de delegacion

Definir un envelope versionado con campos comunes y extensiones por rol. Los
campos se registran una vez en el tracker; no copiar todo el tracker al prompt.

Entrada minima:

- Identidad: `schema_version`, `run_id`, `slice_id`, `execution_lock_id` cuando
  aplique, rol y skill exacta.
- Invocacion: runtime/superficie, agente registrado, tier solicitado, razon de
  escalamiento, modo de control, modelo pedido o herencia explicita y fuente de
  disponibilidad. No fabricar `resolved_model` antes de ejecutar.
- Tarea: objetivo observable, AC relevantes, ownership, prohibiciones,
  predecesores verificados y contrato productor/consumidor.
- Contexto: lecturas obligatorias, referencias por seccion, breve discovery
  relevante, patrones seleccionados, procedencia/frescura y preguntas abiertas.
- Comprobacion: comandos enfocados, evidencia esperada y schema de retorno.

Salida minima: identidad correlacionada, estado, archivos/cambios, AC cubiertos,
comandos y resultados, gaps/riesgos, modelo confirmado solo si hay evidencia
runtime y razon de fallback si se conoce. Conservar campos especificos de
seguridad, UI, contratos, waiver y QA cuando apliquen.

Un lock ausente, distinto o `none` donde es obligatorio impide marcar `VERIFIED`.
Un modelo real no expuesto no bloquea por si solo; se reporta como desconocido.
No exigir al delegado que produzca telemetria inaccesible.

### 4.3 Politica de lectura con criterio

| Situacion | Leer | Reutilizar o evitar |
| --- | --- | --- |
| Agente nuevo | Skill completa requerida, instrucciones aplicables y fuente que controla el cambio | No asumir contexto del padre; no cargar instrucciones de otra superficie |
| Contenido ya inyectado completo y vigente por el runtime | Aplicarlo y registrar procedencia cuando sea observable | Evitar volver a abrir exactamente el mismo contenido |
| Slice conocido y acotado | Secciones del PRD relevantes, archivos poseidos, contrato y prueba vecina | Discovery fresco y decisiones cerradas, sin exploracion global |
| Implementacion ambigua | Una lectura adicional dirigida a una hipotesis concreta | No prohibir lecturas mediante cuota rigida |
| Seguridad, datos o contratos compartidos | Fuentes normativas completas aplicables, invariantes, consumidores y escenarios limite | No sustituirlos por un resumen del padre |
| QA independiente | AC, diff y evidencia primaria suficiente; PRD completo si hay impacto transversal | No aceptar solo la conclusion del writer ni repetir toda su exploracion |
| Resume del mismo agente | Delta y dependencias afectadas tras comprobar frescura | Contexto previo solo si runtime conserva esa sesion y sigue vigente |
| Skills/patrones faltantes | Comprobar ruta exacta y diferencia canonica/compatibilidad | No buscar repetidamente todo el repositorio; bloquear o aplicar fallback autorizado |

Reglas adicionales:

- Una referencia ahorra duplicacion de texto, no garantiza menos lecturas ni
  menos tokens. Para un dato corto usar un extracto con procedencia; para una
  norma ejecutar la skill completa, no una sustitucion resumida.
- Separar lecturas de bootstrap, dominio, fuente y QA. Un numero de archivos
  no mide por si solo sobrecarga ni correccion.
- Presupuesto blando por tarea: ampliar con una razon vinculada a riesgo o
  incertidumbre; no subir modo/delegacion solo porque se leyeron varios archivos.
- Frescura depende de archivos, contratos, tests, instrucciones y entorno
  relevante; no invalidar todo por un commit ajeno ni aceptar todo por compartir
  SHA. Incluir cambios sin commit y dependencias de comandos compartidos.
- Los delegados ejecutan un alcance delegado, no reinician intake, readiness y
  descubrimiento del PRD entero. Conservan instrucciones superiores y pueden
  detenerse si el alcance es invalido. No cargar la matriz de todos los agentes.

### 4.4 Delegacion, validacion y permisos

- Unificar reglas contradictorias de granularidad: una unidad cohesiva con un
  writer puede contener sub-slices verificados; contar archivos no manda.
- Agrupar S1/S2 solo si comparten contexto, ownership y ciclo de validacion sin
  ocultar dependencias o riesgos. No fusionar automaticamente por ser backend.
- Paralelizar con ownership disjunto y contrato estable, incluyendo fixtures,
  migraciones, lockfiles y servicios de test compartidos. Distinguir menor
  latencia de menor costo total; introducir limite de concurrencia.
- No lanzar por defecto un delegado por etapa; mantener etapas necesarias en
  preflight compacto cuando exista evidencia. Evitar delegacion anidada no
  autorizada o no soportada, especialmente en Claude Code.
- Prueba enfocada tras cada cambio significativo; suite de integracion al
  completar el grupo; suite amplia al cierre cuando la superficie la requiera.
- Un test fallido por vista pendiente no es `PASS`: etiquetar dependencia
  pendiente y verificar integracion antes de cerrar. No paralelizar para ocultarlo.
- Reusar evidencia solo si scope, contenido, comando y entorno siguen siendo
  validos; QA puede corroborar independientemente sin repetir toda la suite.
- Auditar herramientas: un agente denominado read-only con terminal puede
  escribir. Diferenciar prohibicion por instrucciones de aislamiento real;
  usar permisos/hooks nativos solo cuando esten disponibles y comprobados.

### 4.5 Evidencia y diagnostico

Mantener la seccion de evidencia del PRD centrada en entrega y calidad. Para
pilotos, ofrecer un resumen local, ignorado por Git y opt-in fuera del `_meta/`
que se elimina: identificadores, modelo pedido/confirmado, razones, comandos,
conteos medidos disponibles y limites de observabilidad. Definir retencion y
borrado; no almacenar prompts, secretos ni trazas completas por defecto.

Promover solo conclusiones saneadas a documentacion compartida con autorizacion.
Lecturas/tokens/costo no disponibles se registran como `unknown`, no se estiman
como hechos. Ausencia de diagnostico no bloquea entrega si hay evidencia de calidad.

## 5. Secuencia de implementacion

Cada fase termina con evidencia y revision antes de ampliar alcance. Los
archivos listados son ownership propuesto, no autorizacion para editarlos ahora.

| Fase | Cambio y ownership principal | Dependencia y salida verificable |
| --- | --- | --- |
| 0. Baseline | Runbook de compatibilidad y casos piloto; catalogo/configuracion instalados | Version kit, VS Code/Copilot y Claude Code, superficie, schema real, agente efectivo, overrides y permisos; datos ausentes explicitos |
| 1. Contrato neutral | `.agents/model-routing/README.md`, `implement-prd` SKILL, prompts, handoff schemas, tracker | Envelope comun, estados unknown/unsupported y validacion de lock; pruebas de entradas incompletas y falsas confirmaciones |
| 2. Adapters | `scripts/delegate-agent-catalog.json`, `scripts/copilot-model-routing.mjs`, generador y perfiles derivados | Tras 0/1: Copilot con IDs/listas validos por superficie; Claude con aliases soportados y prioridad de overrides; sin catalogos inventados |
| 3. Contexto y flujo | `.agents/instructions.md`, router, referencias de orchestration/validation y skills delegadas afectadas | Tras 1: carga por rol, preflight compacto, freshness precisa, sin rerouting recursivo ni eliminacion de controles |
| 4. Distribucion | `templates/`, `src/planner.mjs`, `src/cli/`, `src/doctor.mjs` y pruebas relevantes segun necesidad | Tras 2/3: instalacion nueva y update ofrecen mismas capacidades; decision explicita sobre distribuir resolver o eliminar dependencia de el |
| 5. Diagnostico y cierre | Politica de memoria, cierre, runbook y contrato de evidencia | Tras 1/3: resumen opt-in saneado, sin retener estado privado en PRD; cleanup y retencion probados |
| 6. Piloto comparativo | Fixtures, pruebas de contrato/instalacion y smoke en ambos runtimes | Tras 4/5: matriz de escenarios, calidad sin regresiones y ahorro medido donde sea observable |
| 7. Release | `docs/release-plan.md`, migracion, troubleshooting, version y artefactos generados | Tras 6: checks completos, instrucciones de update verificadas, rollback y limitaciones publicados |

Notas de implementacion por fase:

- Fase 0: recuperar llamadas/schema y perfiles del proyecto destino solo con
  acceso autorizado. No es requisito recuperar una sesion ya perdida: ejecutar
  un piloto pequeno reproducible como reemplazo, identificandolo como nuevo.
- Fase 1: utilizar datos estructurados y validadores existentes o parsers
  adecuados. Distinguir checks automatizados de simples instrucciones. Donde
  no haya hook runtime, un validador previo/posterior invocado por el workflow
  no equivale a enforcement automatico; documentar esa limitacion.
- Fase 2: separar label, ID runtime y alias sin deducirlos con reemplazos de
  texto. Preferir listas nativas cuando version y politica las permitan. No
  ampliar un fallback fuera del tier ni de un override sin politica explicita.
- Fase 3: consolidar contradicciones entre un writer por fase y split por 3+
  archivos, entre reusar brief y volver a descubrir, y entre intake del padre y
  ejecucion del delegado. Revisar wrappers y referencias rotas relacionadas.
- Fase 4: comprobar el paquete realmente distribuido y repo instalado; los
  scripts internos del mantenedor no deben convertirse en dependencia ausente.
  Separar actualizar CLI de actualizar overlay. Definir archivo local de
  overrides y ownership sin secretos; preservar modificaciones y conflictos
  con backups/consentimiento. Probar reinstalacion y update idempotentes.
- Fase 5: no desplegar plataforma de telemetria; ampliar de forma explicita el
  alcance anterior solo para diagnostico minimo opcional y gobernado.
- Fase 7: regenerar adapters y espejos desde fuente canonica, sincronizar hashes
  del registry y versionar solo cuando los cambios distribuibles lo requieran.
  No modificar personalizaciones locales ajenas ni publicar sin autorizacion.

## 6. Matriz de pruebas y aceptacion

Tres niveles separados: contrato estructural, distribucion real y smoke runtime.
Un test que encuentra texto `model:` no prueba que el runtime lo haya utilizado.

| Caso | Resultado exigido |
| --- | --- |
| Copilot custom agent y delegacion generica | Identidad y capacidades verificadas; selector correcto segun schema, sin suponer equivalencia de herramientas |
| Claude custom agent, inherit y override global | Prioridad documentada corroborada por version; ninguna promesa de especializacion si la configuracion la impide |
| Preferido disponible, fallback y ningun candidato | Seleccion explicita y fallback autorizado; no candidato inventado ni downgrade silencioso |
| Modelo solicitado pero ejecucion no expuesta | `resolved_model: unknown` con limite visible, sin falsear confirmacion |
| Modelo unico para todos los roles | Permitido si satisface riesgo; no exigir diversidad artificial |
| Writer nuevo vs resume | Nuevo lee lo obligatorio; resume reusa solo contexto verificablemente vigente |
| Skill precargada vs solo mencionada por el padre | Solo la precargada completa evita lectura duplicada; referencia no cuenta como contenido recibido |
| Brief fresco, cambio irrelevante y dependencia modificada | Reuso, reuso y revalidacion dirigida respectivamente |
| Backend pequeno y slices cohesivos | Sin frontend/bootstrap global inutil ni un delegado por archivo |
| Backend/UI con contrato bloqueado | Paralelo solo si dependencias y ownership permiten integracion verificable |
| Seguridad/migracion/QA con riesgo alto | Lecturas y revision suficientes; escalamiento justificado, no ahorro a costa de omitir escenarios |
| Lock ausente, incorrecto o handoff incompleto | No `VERIFIED`; reparacion acotada o bloqueo, no continuar por confianza |
| Timeout, error y retry | Revisar cambios parciales, reintento acotado y sin doble escritura |
| Read-only con terminal o herramientas heredadas | Permisos reales documentados; no anunciar sandbox inexistente |
| Instalacion nueva y update personalizado | Rutas funcionales, overrides preservados, conflicto visible, backups y rollback |
| Cierre con/sin diagnostico opt-in | Evidencia de entrega durable, limpieza correcta y ningun dato privado versionado |

Comandos base existentes para las futuras fases, ajustando scope al cambio:

```sh
node --test test/template-packs.test.mjs test/workflow-contract.test.mjs test/turn-routing-contract.test.mjs
node --test test/planner.test.mjs test/doctor.test.mjs test/upgrade.test.mjs
bun run check:workflow
bun run check:docs
bun run check:release
```

Agregar pruebas de semantica/envelope y escenarios antes de dar por cubiertos
los cambios; revisar primero cobertura existente de install/update/upgrade.
Suite completa y demas gates aplicables solo en cierre de release. Registrar
fallos preexistentes por separado. Los smoke manuales deben dejar version,
configuracion relevante, solicitud, resultado observable y limitaciones.

Benchmark: comparar baseline y candidato en fixtures equivalentes para tarea
acotada, backend cohesivo y cambio transversal con QA. Mantener controles y
criterios iguales; repetir para distinguir variacion del modelo. Medir lecturas
y bytes, bootstrap repetido, llamadas, reintentos, duracion, gaps y retrabajo;
tokens facturados/costo solo si hay fuente real. No equiparar bytes o tool calls
con costo monetario ni ignorar cache. No fijar un porcentaje de ahorro sin baseline.

## 7. Definition of Done y rollback

- Copilot y Claude Code tienen matriz de capacidades/versiones verificada y
  smoke representativo. Si un entorno no esta disponible, queda pendiente y no
  se declara compatibilidad probada de punta a punta.
- Politica, templates, perfiles, instalacion y registros concuerdan. Cada campo
  requerido tiene prueba negativa; las limitaciones son explicitas.
- No hay regresiones de AC, seguridad, ownership, QA o validacion por ahorro.
- El piloto evidencia reduccion de trabajo redundante sin aumentar gaps ni
  retrabajo; casos de mayor lectura justifican el beneficio de calidad.
- Upgrade/update mantiene configuracion local y puede volver a perfiles/contrato
  anteriores usando backups y version fijada; no borrar evidencia del usuario.
- Desactivar optimizaciones por separado: reuso, agrupacion o seleccion de
  modelos. El rollback no desactiva los gates de calidad.
- Las pruebas y documentos distinguen lo pedido, lo configurado y lo observado.

## 8. Fuera de alcance

- Cambiar codigo del PRD en el proyecto externo o ejecutarlo desde este repo.
- Seleccionar modelos en la UI del usuario o afirmar acceso a su catalogo.
- Saltar instrucciones obligatorias, rebajar QA o cargar todas las skills siempre.
- Crear un nuevo SDK/orquestador, motor adaptativo o plataforma de facturacion.
- Garantizar ahorro numerico o compatibilidad con versiones no verificadas.
- Publicar, hacer commit o aplicar las fases de implementacion en esta sesion.

Nota de alcance: el usuario autorizo explicitamente, en esta misma sesion, aplicar
las fases de implementacion descritas en la seccion 5 (contrato neutral, adapters,
contexto/flujo, distribucion y diagnostico), reemplazando la restriccion anterior
de esta linea para ese trabajo puntual. No autorizo publicar ni hacer push.

## 10. Evidencia de Implementacion

Cierre completo. 6 de 6 slices planificados (`baseline-runtime`, `neutral-envelope`,
`workflow-context`, `adapters`, `distribution`, `diagnostics-release`) tienen
lock inmutable correlacionado y estan `VERIFIED`. 7 de 8 criterios de aceptacion
estan `COMPLETE`; `AC-08` fue aceptado explicitamente por el usuario como riesgo
residual (`WAIVED_BY_USER`) el 2026-09-07 (ver mas abajo).

### Cambios entregados por slice

- `neutral-envelope` / `workflow-context`: contrato `delegation-envelope/v1` en
  [.agents/model-routing/README.md](../../.agents/model-routing/README.md),
  contexto delegado en [.agents/instructions.md](../../.agents/instructions.md),
  [workflow-router/SKILL.md](../../.agents/skills/00-router/workflow-router/SKILL.md)
  y referencias de `implement-prd` (`handoff-schemas.md`, `orchestration-flow.md`,
  `subagent-prompts.md`, `task-tracker-template.md`,
  `validation-and-stop-conditions.md`), con locks inmutables por slice en
  `_meta/locks/<slice-id>.toon`.
- `baseline-runtime`: [docs/workflow/cross-runtime-capability-matrix.md](../workflow/cross-runtime-capability-matrix.md)
  y [docs/workflow/cross-runtime-delegation-runbook.md](../workflow/cross-runtime-delegation-runbook.md),
  ambos con baseline `unknown` honesto (sin CLI de Copilot/Claude Code disponible
  en este entorno).
- `adapters`: `scripts/copilot-model-routing.mjs` ahora soporta `overrideModel`
  explicito (`user-pinned-model`) con fallback visible o error explicito cuando
  ni el override ni un candidato de tier estan disponibles; `scripts/sync-delegate-runtime-adapters.mjs`
  etiqueta las capacidades generadas como `configured`, no `observed`.
- `distribution`: nuevo comando `workflow-kit rollback` ([src/rollback.mjs](../../src/rollback.mjs),
  wireado en `src/cli/commands.mjs` y `src/cli/args.mjs`) que restaura el backup
  `.workflow-kit-backup-<timestamp>` mas reciente de cada archivo gestionado en
  `install-state.json`; documentado en [docs/troubleshooting.md](../troubleshooting.md).
- `diagnostics-release`: [docs/workflow/delegation-diagnostics-policy.md](../workflow/delegation-diagnostics-policy.md)
  (diagnostico local opt-in, ignorado por Git, sin prompts/secretos/telemetria
  inventada) y [docs/workflow/cross-runtime-delegation-benchmark.md](../workflow/cross-runtime-delegation-benchmark.md)
  (contrato de piloto comparativo que prohibe afirmar ahorro sin baseline
  observado).
- Correccion de defecto: numeracion duplicada/fuera de orden en el "Mandatory
  Closure Contract" de `implement-prd/SKILL.md` (encontrada y reparada durante
  la re-auditoria de esta sesion).
- `package.json` version bump a `0.7.37-cross-runtime-delegation-efficiency`
  (requerido por `check:release` al cambiar superficies distribuibles).

### AC/UC/EC y validaciones ejecutadas en esta sesion

| AC | Estado | Evidencia |
| --- | --- | --- |
| AC-01 | COMPLETE | `test/workflow-contract.test.mjs` (envelope) |
| AC-02 | COMPLETE | `test/workflow-contract.test.mjs` + `test/template-packs.test.mjs` (override/fallback) |
| AC-03 | COMPLETE | `test/workflow-contract.test.mjs` + `test/turn-routing-contract.test.mjs` (lock correlation) |
| AC-04 | COMPLETE | `test/template-packs.test.mjs` (override/no-candidate explicito) |
| AC-05 | COMPLETE | `test/docs.test.mjs` (matrix/runbook) + `delegate-skill-matrix.md` |
| AC-06 | COMPLETE | `test/cli.test.mjs` (rollback) |
| AC-07 | COMPLETE | `test/docs.test.mjs` (diagnostics policy) |
| AC-08 | WAIVED_BY_USER | Contrato y prueba existen (`docs/workflow/cross-runtime-delegation-benchmark.md`, `test/docs.test.mjs`); el piloto real de fixtures (Fase 6) no se pudo ejecutar porque este entorno no expone CLI de Copilot ni de Claude Code; el usuario acepto explicitamente este riesgo residual el 2026-09-07 |

Comandos re-ejecutados y observados en esta sesion (no heredados de una sesion
anterior):

```
node --test                                   -> tests 161, pass 161, fail 0
bun run check:workflow                        -> sincronizado (registry, adapters, template packs)
bun run check:docs                             -> passed
bun run check:release                          -> passed (tras bump de version)
```

### Resumen del Ledger de Hallazgos

- `FIND-01` (low, `implement-prd/SKILL.md`): numeracion duplicada/fuera de orden
  en el Mandatory Closure Contract tras la edicion previa de S1/S4. Reparado en
  el slice `workflow-context` en esta sesion; verificado con
  `node --test test/workflow-contract.test.mjs`.
- `FIND-02` (medium, `.agents/skills/registry.cache.json`): cache de registro
  desactualizado respecto al Markdown canonico tras el cambio de redaccion en
  `delegate-skill-matrix.md`. Reparado en el slice `adapters` regenerando con
  `node scripts/sync-skill-registry.mjs --write`; verificado con
  `node --test test/skill-registry-sync.test.mjs`.

### Riesgo residual (aceptado por el usuario)

`AC-08` no se cerro con un piloto real: el contrato que prohibe afirmar ahorro
sin baseline esta implementado y probado, pero el piloto comparativo real
(Fase 6, fixtures baseline vs candidato) requiere ejecutar Copilot y/o Claude
Code, y este entorno no expone ninguno de los dos CLI. No se fabrico ningun
dato de piloto para evitar este bloqueo.

El usuario acepto explicitamente este riesgo residual el 2026-09-07: "AC-08's
fixture pilot (Fase 6) cannot execute in this environment because no
Copilot/Claude Code CLI is available; the benchmark contract exists and is
tested, but no real baseline/candidate measurement was taken." Un piloto real
queda pendiente como trabajo futuro fuera de este PRD, para un entorno con
Copilot y/o Claude Code disponibles.

Fecha de cierre: 2026-09-07.
