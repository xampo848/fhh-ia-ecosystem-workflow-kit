# Roadmap: mejoras del workflow kit (backlog U/IA)

Fecha de inicio: 2026-11-10.
Estado: **implementación cerrada el 2026-11-10.** Las decisiones D-00 a D-33
están tomadas y los 8 lotes están en `main` (#61 y #62). Lo que queda después
del cierre (piloto manual, verificaciones por runtime y tareas de cada
proyecto) está en la [sección 8](#8-cierre-del-roadmap-y-pendientes-posteriores).
Este documento no autoriza implementación por sí solo: cada lote se implementó
cuando el usuario lo autorizó explícitamente.

## 1. Cómo usar este documento

- Primero se decide, después se implementa. Las dudas se conversan **una a la
  vez**; cada decisión registra contexto, opciones, recomendación de la IA y lo
  que eligió el usuario.
- **Un lote = un commit, todos en un PR único** (ajuste del usuario,
  2026-11-10; antes era un PR por lote). Los PRs del roadmap son
  [#61](https://github.com/xampo848/fhh-ia-ecosystem-workflow-kit/pull/61)
  (lotes 1, 1b y 2, mergeado) y
  [#62](https://github.com/xampo848/fhh-ia-ecosystem-workflow-kit/pull/62)
  (lotes 3 a 8, mergeado). El
  commit de cada lote actualiza este documento: estado de los ítems,
  decisiones aplicadas y una fila en la bitácora (sección 7). Los problemas
  que aparezcan (CI, revisión, smoke) se corrigen sobre la marcha en el mismo
  PR.
- Además, cada commit de lote (D-33):
  - actualiza la documentación que su cambio afecta directamente (README,
    guías, runbooks);
  - sube `package.json.version`, como exige `docs/versioning.md`;
  - si cambia la estructura instalada (mover, renombrar, eliminar o generar
    archivos), agrega su migración versionada e idempotente al CLI/TUI, con
    su test de actualización.

  El Lote 8 hace la pasada final consolidada y el release.
- Estados de ítem: `Pendiente` · `En decisión` · `Listo para implementar` ·
  `En implementación` · `Hecho` · `Verificar` (posiblemente resuelto, falta
  evidencia) · `Descartado`.
- Estados de decisión: `Abierta` · `Propuesta` (hay recomendación, falta el
  usuario) · `Decidida` · `Reabierta`.

## 2. Roadmap por lotes

Orden de ejecución (D-04, decidido; D-33 agrega el Lote 8 al final): **1 → 1b → 2 → 3 → 5 → 4 → 7 → 8**, con el
Lote 6 en paralelo en cualquier momento. Los números de lote son
identificadores, no el orden; la tabla ya está ordenada por ejecución. U-10
(dividir skills a 200 líneas) va al final a propósito: hacerlo antes generaría
conflictos en todos los demás lotes.

| # | Lote | Ítems | Depende de | Estado | PR |
| --- | --- | --- | --- | --- | --- |
| 1 | Carga proporcional y vía rápida | U-03, U-18, U-09 (parte router), IA-03, U-19a | — | Hecho (mergeado en #61) | #61 |
| 1b | Política de modelos | D-05a, D-07, D-12, U-19b, U-04 (rehacer), U-02 (verificación, D-27) | — | Hecho (mergeado en #61) | #61 |
| 2 | Ruta general de implementación | U-11, U-08, U-09 (parte ejecución), IA-02, D-26 | Lote 1 | Hecho (mergeado en #61) | #61 |
| 3 | Frenos de costo en ejecución | U-17, U-16, IA-11, IA-08, IA-07 | Lote 2 | Hecho (mergeado en #62) | #62 |
| 5 | Preparación más barata | U-12, IA-04, IA-05, IA-06, IA-01 | Lote 2 | Hecho (mergeado en #62) | #62 |
| 4 | Validación sin duplicar | U-13, IA-09, IA-10 | Lote 3 | Hecho (mergeado en #62). U-13: hallazgos aprobados el 2026-11-10; no se elimina ningún check y C1 se aplicó en el PR de cierre | #62 |
| 6 | Calidad de PRD y PR | U-07, U-06, U-01, U-05, D-25 | — (paralelizable) | Hecho (mergeado en #62) | #62 |
| 7 | Runtimes y estructura | U-15, U-02 (solo si D-27 encuentra fallas), U-20, U-14, U-10, IA-12, U-19c | Lotes 1–6 | Hecho (mergeado en #62). U-15 y U-02 quedan en `Verificar`: la verificación en Codex y Copilot está diferida (sección 8) | #62 |
| 8 | Cierre: documentación, actualización segura y release | D-33 | Lote 7 | Hecho (mergeado en #62). El piloto real en ooh-backoffice es manual y condiciona el release, no el cierre (sección 8) | #62 |

## 3. Inventario de ítems

| ID | Prio | Mejora (resumen) | Lote | Estado | Notas |
| --- | --- | --- | --- | --- | --- |
| U-03 | P0 | Carga de instrucciones proporcional a la tarea | 1 | Hecho | D-01, D-02 |
| U-18 | P0 | Vía rápida para consultas operativas | 1 | Hecho | Se vuelve el nivel N0 de D-01 |
| U-09 | P0 | Cambios quirúrgicos como opción explícita | 1 / 2 | Hecho (router en Lote 1, ejecución en Lote 2) | Lote 1: el router lo ofrece. Lote 2: cómo se ejecuta |
| IA-03 | P1 | Router liviano después de decidir | 1 | Hecho | D-06 |
| U-19 | P0 | Optimizar para Claude Code | 1 / 1b / 7 | Hecho (U-19a y U-19b en #61; U-19c en #62) | Dividido en U-19a (Lote 1), U-19b (Lote 1b) y U-19c (Lote 7); ver D-03 |
| U-11 | P0 | Ruta general de implementación (renombrar implement-prd) | 2 | Hecho | D-08 |
| U-08 | P0 | Iteración económica sobre lo ya implementado (delta) | 2 | Hecho | D-09 |
| IA-02 | P0 | Orquestador cargado por modo | 2 | Hecho | D-10 |
| U-17 | P0 | Freno a implementaciones y tests excesivos | 3 | Hecho | |
| U-16 | P0 | Tracking de tareas largas (archivos que no se cierran) | 3 | Hecho | P0 asignado en D-04. Diagnosticar antes con la tarea de OAuth GitHub (>7 días) |
| IA-11 | P1 | Tracker compacto | 3 | Hecho | |
| IA-08 | P0 | Logs de validación acotados | 3 | Hecho | |
| IA-07 | P1 | Entregas de subagentes compactas | 3 | Hecho | |
| U-13 | P1 | Investigar redundancia de pruebas por slice | 4 | Hecho (hallazgos aprobados el 2026-11-10: ningún check se elimina; C1 aplicado en `create-prd`) | D-19; la investigación (solo lectura) puede adelantarse |
| IA-09 | P0 | Reutilizar checks vigentes | 4 | Hecho (arranca en modo sombra; cada proyecto la activa) | D-20 |
| IA-10 | P1 | QA incremental | 4 | Hecho (la calibración única se hace en cada proyecto) | D-20 |
| U-12 | P0 | Base de conocimiento fija para Discovery | 5 | Hecho | |
| IA-04 | P0 | Lectura delegada del PRD | 5 | Hecho | |
| IA-05 | P1 | Preparación combinada (fases 0–2) | 5 | Hecho | |
| IA-06 | P1 | Matcher proporcional | 5 | Hecho | D-18 |
| IA-01 | P0 | Arranque mínimo de delegados | 5 | Hecho | D-18; incluye contrato de delegado con garantía de cobertura |
| U-07 | P0 | PRD con más y mejores preguntas (casos borde, APIs) | 6 | Hecho | D-21 |
| U-06 | P0 | Detectar y retirar lo que queda obsoleto | 6 | Hecho | D-22; toca también discovery, slicing y QA |
| U-01 | P1 | Sketch de UI con impeccable y crítica de vistas | 6 | Hecho | D-23 |
| U-05 | P1 | PR comments siempre evaluados críticamente | 6 | Hecho | D-24; critical-stance hoy no lo cubre |
| U-15 | P0 | Funcionamiento completo en Codex (y Claude) | 7 | Verificar (reglas y guía listas; el smoke y la ejecución real en Codex están diferidos, sección 8) | D-28 |
| U-02 | P0 | Modelo correcto por subagente en Copilot | 1b (verificación) / 7 (corrección si hace falta) | Verificar (guía y tabla de cierre listas; las pruebas A y B en Copilot están diferidas, sección 8) | D-27: smoke controlado + ejecución real con verificador; implementado en #55 solo para invocación explícita |
| U-20 | P1 | Referencias neutrales a la plataforma (rutas por runtime) | 7 | Hecho | D-29; era el segundo U-13 de la tabla (ID duplicado) |
| U-14 | P1 | Extraer reglas de frameworks y librerías | 7 | Hecho | D-30 |
| U-10 | P1 | Skills de máximo 200 líneas por archivo | 7 | Hecho | D-31; último a propósito |
| IA-12 | P2 | Notas docentes selectivas | 7 | Hecho | D-32 |
| U-04 | P0 | document-development con modelo pequeño | 1b | Reemplazado | D-05 prohíbe el tier Liviano. document-development pasa a Mediano; lo que se mantiene de #54 es la lectura acotada |

## 4. Correcciones a la tabla original

| Problema | Resolución propuesta | Estado |
| --- | --- | --- |
| U-13 aparece dos veces con contenidos distintos | El segundo (limpieza de referencias a plataformas) pasa a ser **U-20** | Decidida (D-04) |
| U-19 no tiene descripción | Dividido en U-19a, U-19b y U-19c | Decidida (D-03) |
| U-16 no tiene prioridad | P0: afecta tiempo y costo de las tareas largas | Decidida (D-04) |

## 5. Registro de decisiones

### D-00 · Dónde vive el seguimiento

- Estado: **Decidida** (2026-11-10)
- Decisión: este archivo en `docs/plans/`, versionado en el repo, para que
  Claude Code, Codex y Copilot lo lean al implementar.

### D-01 · Niveles de tarea y autonomía por nivel (U-03, U-18, U-09)

- Estado: **Decidida** (2026-11-10)
- Contexto: hoy solo hay dos casos: "trivial" (0–2 llamadas) y el router
  completo. El camino quirúrgico es una excepción de 5 condiciones que el router
  no ofrece. Evidencia: en la sesión del 2026-11-10, pedirle al usuario una
  tabla obligó a leer ~45 KB de política (`instructions.md` y el router completo).
- Alternativa descartada: que N1 no pregunte y solo avise. Era más rápido,
  pero con riesgo de elegir quirúrgico cuando no corresponde.

**Decisión:**

1. **Cuatro niveles, cada uno con su carga y su autonomía:**

   | Nivel | Qué carga | Presupuesto | ¿Pregunta antes? | Cost posture |
   | --- | --- | --- | --- | --- |
   | N0 Operativo | nada del workflow | hasta 3 llamadas; si necesita más, se detiene y propone N1 | No: la intención del usuario basta | `lean` |
   | N1 Quirúrgico | archivos objetivo, sus tests y a lo sumo un PRD | sin tracker, sin delegados, sin Discovery; un check focalizado | Sí, un "sí" corto | `lean` |
   | N2 Estándar | ruta de implementación normal (Lote 2) | según la ruta | Sí | `balanced` |
   | N3 Alto riesgo | gates completos | según la ruta | Sí | `premium` |

   La cost posture sale del nivel y deja de ser una decisión aparte.

2. **Clasificación por señales.** El nivel es el más alto que active
   cualquier señal:

   | Señal | Nivel mínimo |
   | --- | --- |
   | Solo lectura, consulta o comando local sin efectos | N0 |
   | Edición **no semántica** (formato, indentación, typo, comentario, texto de docs) | N0 |
   | Edición que cambia comportamiento, en 1–2 archivos y con alcance claro | N1 |
   | Alcance incierto, más de 2 archivos o varias piezas | N2 |
   | Contratos, datos o migraciones, auth o tenancy, dependencias, CI, algo irreversible (push, deploy, borrado) | N3 |
   | Hard triggers (PR comments, PRD explícito) | según su skill, sin importar el nivel |

   El límite entre N0 y N1 no es "lee o escribe", sino si el cambio es
   **semántico**: las ediciones no semánticas entran en N0 sin preguntar.

3. **Check focalizado en N1**, no "test obligatorio": lint, build o test,
   según lo que corresponda. Agregar o actualizar un test es obligatorio solo
   cuando cambia comportamiento. Si es un **bug**, el test debe fallar antes
   del arreglo (ver U-11).

4. **Ajuste del gate de autorización** en `instructions.md` y en el router: en
   N0 la intención del usuario basta; en N1 alcanza con un "sí" corto. N2 y N3
   mantienen el gate actual.

5. **Visibilidad:** N0 no muestra trace. N1 muestra una línea, por ejemplo
   `N1 · quirúrgico · toca X y su test`. El trace completo queda para N2 y N3.
   El usuario puede forzar el nivel con "hazlo quirúrgico" o "hazlo completo".

6. **Escalada y bajada:** si en N0 o N1 aparece algo inesperado (otro archivo,
   un contrato, un test que no se entiende), la IA se detiene y propone subir.
   Si en N2 el Discovery muestra que el cambio es chico, puede proponer bajar a
   N1. En ambos casos se le pregunta al usuario.

7. **Validación:** un set fijo de ~10 prompts de prueba, cada uno con el nivel
   esperado, que se corre en Claude Code, Codex y Copilot. Se agrega como
   fixture a `check:workflow` (la forma exacta se define al implementar).

### D-02 · Dónde vive la clasificación de nivel

- Tensión: para que N0 no lea archivos del workflow, los adapters que siempre
  se cargan (`CLAUDE.md`, `AGENTS.md`, `copilot-instructions`) necesitan un
  pre-filtro corto (~10 líneas). Eso contradice en parte la regla de "adapter
  delgado sin lógica de workflow".
- Opciones:
  - A. Pre-filtro escrito a mano en cada adapter. Cumple "cero lecturas", pero
    las copias se desincronizan con el tiempo.
  - B. Adapters sin cambios y un `instructions.md` núcleo muy corto. Sigue
    siendo una lectura en cada prompt, y no cumple el criterio de éxito de U-03
    ("una indentación se corrige sin leer archivos de workflow").
  - C. Fuente única con copia generada: la tabla de señales vive en
    `instructions.md` y un script la copia tal cual a cada adapter, entre
    marcadores. Un check falla si alguna copia difiere.
- Estado: **Decidida** (2026-11-10): opción **C**.
- Detalle:
  - La tabla de señales de D-01 vive en `instructions.md` (fuente única).
  - Un script la copia tal cual a `CLAUDE.md`, `AGENTS.md` y
    `copilot-instructions`, entre marcadores. Un check falla si alguna copia
    difiere.
  - La regla de adapter delgado pasa a decir: "el adapter solo puede llevar el
    pre-filtro generado; ninguna otra lógica de workflow".
  - Al implementar el Lote 1 se verifica si algún generador existente cubre
    estos archivos o si hay que extenderlo.

### D-03 · Alcance de U-19 ("Optimizar para Claude Code")

- Estado: **Decidida** (2026-11-10), con el mapeo de modelos de U-19b
  reemplazado por D-05.
- Evidencia (2026-11-10):
  - Los 13 agentes de `.claude/agents/` tienen `model: inherit`. Todos los
    delegados corren con el modelo del orquestador, incluido `escriba-doc`,
    que debería ser Liviano según #54.
  - No existe `.claude/skills/`. Las skills del kit no aparecen como skills
    nativas de Claude Code, así que el router y las skills se leen como
    archivos completos (~33 KB solo el router) en vez de cargarse bajo demanda.
- Propuesta de la IA: U-19 se divide en tres partes concretas:
  - **U-19a (Lote 1):** pre-filtro de nivel en `CLAUDE.md` (D-02).
  - **U-19b (Lote 1b, justo después del Lote 1):** modelo por agente en
    Claude Code según su tier, generado desde el catálogo de delegados. Claude
    Code admite `model:` en el frontmatter del agente. Mapeo según D-05:
    Mediano → `sonnet`, Grande → `opus`.
  - **U-19c (Lote 7):** exponer las skills del kit como skills nativas
    (`.claude/skills/`, generadas o con symlinks) para que Claude Code muestre
    solo la descripción y cargue el cuerpo cuando hace falta. Riesgo: Claude
    Code puede invocar una skill sola por su descripción y saltarse el router.
    Hay que controlarlo con el frontmatter (por ejemplo,
    `disable-model-invocation` en las skills que solo deben entrar vía router).
- Decisión del usuario: aprobada (2026-11-10), con modelos según D-05a.

### D-05 · Condición general de modelos (todo el workflow)

- Estado: **Reemplazada por D-05a** (2026-11-10). El usuario decidió
  diferenciar por modelo de cobro. La condición de abajo aplica solo al perfil
  `calidad` (Claude Code y Codex por suscripción).
- Condición:
  1. **No se usa el tier Liviano** en ninguna parte: ni Haiku, ni GPT Luna, ni
     ningún modelo de ese tamaño (Flash, mini, etc.).
  2. **Mediano por defecto:** se priorizan Claude Sonnet o GPT Sol para la
     mayoría de las tareas.
  3. **Grande para tareas importantes**, como implementar: Claude Opus, o GPT
     Sol con razonamiento extra high o max.
- Estado actual que contradice esta condición (catálogo
  `delegate-agent-catalog.json`):
  - `sherlock-estructura`, `lint-ranger`, `escriba-doc` y
    `cavecrew-investigator` están en Liviano.
  - `mechanicalTier` es Liviano: lookup, validación mecánica y síntesis de
    evidencia caen ahí.
  - Los implementadores (`turbo-backend`, `pixel-ninja`) están en Mediano.
    Solo suben a Grande si aparece un `criticalConcern`.
  - La lista Grande de Copilot incluye modelos que no son Opus ni Sol (GPT-5.5,
    GPT-5.6 Terra, Claude Fable, Grok xhigh).
- Consecuencias para implementar:
  - Se elimina el tier Liviano de la política, del catálogo, de los
    generadores y de los adapters. El piso pasa a ser Mediano.
  - La cost posture deja de significar "modelo más chico". `lean` pasa a
    significar menos contexto y menos delegación (D-01), no un modelo menor.
  - En GPT, Mediano y Grande pueden ser el mismo modelo (Sol). La diferencia
    está en el nivel de razonamiento. Hay que verificar, por runtime, si se
    puede fijar el nivel de razonamiento por subagente (Codex, Copilot). Si no
    se puede, se documenta el límite y una alternativa.
  - U-04 queda reemplazado: document-development usa Mediano.
  - Costo: los 4 roles que hoy son Liviano y los que pasen a Grande cuestan
    más por delegación. Lo compensa en parte D-01, porque N0 y N1 no delegan.

### D-05a · Perfiles de modelo según quién cobra (reabre D-05)

- Estado: **Decidida** (2026-11-10)
- Idea: el perfil depende del **modelo de cobro**, no del modelo de IA. Claude
  usado dentro de Copilot sigue el perfil de Copilot. Cada runtime trae un
  perfil por defecto, y un proyecto puede cambiarlo en su configuración.

  | Perfil | Runtimes por defecto | Cómo se cobra | Criterio |
  | --- | --- | --- | --- |
  | `calidad` | Claude Code, Codex | Suscripción: el límite es de uso por ventana, no créditos por request | Calidad primero; sin Liviano |
  | `costo` (Copilot/API) | GitHub Copilot y cualquier runtime que use API key con cobro por token (por ejemplo OpenCode o Claude Code con API) | Premium requests con multiplicador por modelo, o pago por token | Parecido al catálogo original |

- Asignación por rol propuesta:

  | Rol | Perfil `calidad` | Perfil `costo` (Copilot/API) |
  | --- | --- | --- |
  | `turbo-backend`, `pixel-ninja`, `testinator-5000`, `guardia-contrato` | Grande | Mediano |
  | `arquitecta-fases` | Grande | Mediano |
  | `qa-relampago` | Grande | Mediano |
  | `capitana-alcance`, `cavecrew-builder`, `cavecrew-reviewer` | Mediano | Mediano |
  | `sherlock-estructura`, `cavecrew-investigator` | Mediano | Liviano |
  | `lint-ranger` | Mediano | Liviano |
  | `escriba-doc` | Mediano | Liviano, escalando a Mediano según #54 |

  - En ambos perfiles, los `criticalConcerns` (seguridad, migraciones,
    contratos, etc.) suben cualquier rol a Grande. En el perfil `costo`, es la
    única vía a Grande.
  - Perfil `calidad`: Grande = Claude Opus o GPT Sol con razonamiento extra
    high o max; Mediano = Sonnet o GPT Sol.
  - Perfil `costo` (Copilot/API): en Copilot se mantienen las listas del catálogo actual; con API se usan los modelos equivalentes por tier.
    La condición "sin Liviano" de D-05 no aplica aquí.
- Recomendación de la IA sobre `lint-ranger` y `escriba-doc`: Liviano **solo
  en el perfil `costo`**. En el perfil `calidad` no hay crédito que ahorrar;
  lo único que se gana es algo de velocidad, y un error de Liviano (un fix de
  lint que rompe algo, un documento impreciso) cuesta más en retrabajo. Además,
  `lint-ranger` aplica fixes, no solo ejecuta comandos.
- Advertencia: la suscripción no es ilimitada. Opus consume más rápido los
  límites de uso (por ventana de horas y semanales). Si se alcanzan seguido,
  el primer rol a bajar a Mediano en `calidad` es `qa-relampago`.
- Decisión del usuario: aprobada (2026-11-10), con el perfil `costo` ampliado
  a Copilot/API.

### D-04 · Orden de los lotes

- Estado: **Decidida** (2026-11-10)
- Propuesta de la IA, aprobada por el usuario (ya aplicada en la sección 2):

  `1 → 1b → 2 → 3 → 5 → 4 → 7`, con el Lote 6 en paralelo en cualquier
  momento.

  - **1 antes que todo:** todos los demás lotes pasan por el router y
    `instructions.md`.
  - **1b justo después:** no comparte archivos con otros lotes (catálogo,
    generadores, `.claude/agents`) y da el ahorro y la calidad más inmediatos.
  - **2 antes que 3 y 5:** los frenos y la preparación se escriben sobre la
    ruta de implementación nueva, no sobre `implement-prd`.
  - **5 antes que 4 (cambio respecto al orden original):** el Lote 5 tiene
    más P0 (U-12, IA-04, IA-01) y el Lote 4 empieza con una investigación (U-13)
    que necesita datos de ejecuciones reales; esos datos se acumulan mientras
    tanto.
  - **6 en paralelo:** solo toca create-prd, solution-sketch y pr-comments; no
    choca con los demás. Puede ir en otra sesión cuando haya capacidad.
  - **7 al final:** U-10 (dividir skills) tiene que ir después de todo lo que
    edita esas skills.
- Incluye las correcciones de la sección 4: el segundo U-13 pasa a U-20 y U-16
  queda en P0.
- Decisión del usuario: aprobada (2026-11-10).

### D-06 · Separar el router en "decidir" y "ejecutar" (IA-03)

- Estado: **Decidida** (2026-11-10)
- Contexto: `workflow-router/SKILL.md` tiene 646 líneas (~33 KB) en un solo
  archivo y se lee completo para decidir cualquier ruta. Mezcla tres cosas:
  1. Lo que sirve para **decidir**: tabla de clasificación, hard triggers,
     precedencia, gate de autorización, formato del trace, execution lock.
  2. Lo que sirve **solo en algunas rutas**: menús de opciones, gate de
     review/QA, gate de épica, reglas de PRD existente o no.
  3. Lo que **no es del router**: reglas de cost posture, delegación y
     selección de modelo (ya viven en `.agents/model-routing/`), la capa
     teach/challenge/improve (es `engineering-mentor`), ejemplos,
     anti-patrones y definition of done (sirven para mantener el router, no
     para ejecutarlo).
- Hallazgo: el router referencia
  `docs/internal-documentation/workflows/ai-cost-efficiency-policy.md`, que
  **no existe**. Ya estaba señalado en el plan del 2026-09-07 y sigue sin
  corregirse.
- Propuesta de la IA:

  | Archivo | Contenido | Cuándo se lee |
  | --- | --- | --- |
  | `SKILL.md` (núcleo, ≤200 líneas) | clasificación por señales (D-01), hard triggers, precedencia, gate de autorización, formatos de trace, execution lock | solo en turnos N2/N3 sin ruta activa, o al cambiar de ruta |
  | `reference/route-menus.md` | menús de opciones y textos de guía | solo cuando hay que presentar opciones (`awaiting-user-choice`) |
  | `reference/route-gates.md` | gates de review/QA, épica y PRD existente o no | solo cuando la ruta candidata es esa |
  | `.agents/model-routing/README.md` | cost posture, delegación y modelos (D-05a) | lo lee la skill elegida, no el router |
  | `engineering-mentor` | teach/challenge/improve | como overlay, cuando aplica |
  | `reference/router-evals.md` | ejemplos de disparo, anti-patrones, definition of done | nunca en ejecución; es la base del set de prompts de prueba de D-01 punto 7 |

  - **Continuaciones:** con una ruta activa, el router no se relee. Basta con
    el estado de ruta que ya está en la conversación (skill, nivel,
    autorizado sí/no). La skill elegida define sus propias señales de salida
    (cuándo hay que volver a rutear).
  - Se elimina la referencia rota a la política de costos; su autoridad es
    `.agents/model-routing/`.
  - El router queda como **piloto de U-10**: el núcleo cumple el límite de
    200 líneas desde ahora, y en el Lote 7 se aplica el mismo patrón al resto
    de las skills.
- Decisión del usuario: aprobada (2026-11-10).

### D-07 · Cómo se elige el perfil de modelo en cada proyecto (Lote 1b)

- Estado: **Decidida** (2026-11-10)
- Contexto: D-05a define dos perfiles (`calidad` y `costo`), pero los
  archivos de agentes son estáticos: el frontmatter de `.claude/agents/*.md` o
  de `.github/agents/*.agent.md` se genera una vez. El runtime no sabe en
  tiempo de ejecución si el usuario paga por suscripción o por API.
- Hallazgos en `delegate-agent-catalog.json` → `runtimeCapabilities`:
  - `claude.pinSubagentModel` está en `false`, pero Claude Code **sí** permite
    fijar el modelo de un subagente (`model:` en el frontmatter del agente y
    un parámetro `model` al delegar). El flag está desactualizado y explica en
    parte que los 13 agentes usen `inherit`.
  - `codex.pinSubagentModel` también está en `false`. Hay que verificar en
    Codex si se puede fijar el modelo y el nivel de razonamiento por
    subagente (se relaciona con U-15).
- Propuesta de la IA:
  1. El catálogo define los dos perfiles (asignación por rol y listas de
     modelos) y un **perfil por defecto por runtime**: `claude` y `codex` →
     `calidad`; `copilot` → `costo`.
  2. **Es una configuración que fija el usuario**, una vez por proyecto y por
     runtime. `workflow-kit init` pregunta "¿suscripción o API?" solo para
     Claude Code y Codex, y guarda la respuesta en
     `.agents/workflow-kit/install-state.json`. Los generadores leen ese
     valor y escriben el `model:` de cada agente.
     - Si existe `ANTHROPIC_API_KEY` u `OPENAI_API_KEY`, la pregunta viene
       con "API" preseleccionado. Es solo una pista: el usuario confirma.
     - Sin terminal interactiva (CI) se usa el default, sin preguntar.
     - `workflow-kit update` conserva el valor guardado y no vuelve a
       preguntar.
  3. Para cambiar de perfil después, se usa
     `workflow-kit update --profile <runtime>=<calidad|costo>` o se edita el
     valor y se regenera; no se editan los agentes a mano.
     `workflow-kit doctor` muestra el perfil activo de cada runtime, y un check
     falla si el modelo de un agente no coincide con su perfil.
  4. Corregir `claude.pinSubagentModel` a `true`. Verificar Codex y
     documentar el resultado; si Codex no lo permite, se registra el límite
     exacto y una alternativa (igual que en U-02).
- Alternativa considerada: detectar el modo de cobro en tiempo de ejecución.
  Se descarta porque ningún runtime lo expone de forma confiable, y adivinar
  podría poner Opus en un proyecto que paga por token.
- Decisión del usuario: aprobada (2026-11-10). El perfil se puede cambiar
  cuantas veces se quiera; `init` solo fija el valor inicial.

### D-08 · Ruta general de implementación (U-11, Lote 2)

- Estado: **Decidida** (2026-11-10)
- Contexto: `implement-prd` ya tiene 6 modos (small/local, controlled-lite,
  controlled-implementation, standard, autonomous-safe, resume) y una regla
  de riesgo: 2 o más hazards obligan a `standard`. Con D-01 aparecen los
  niveles N0–N3 en el router. Si no se unifican, habría **dos
  clasificaciones de ceremonia** que pueden contradecirse.
- Propuesta de la IA:
  1. **Nombre:** `implement-change`. `implement-prd` queda como **alias
     permanente**: cuesta una línea en el índice y protege los PRDs, docs y
     hábitos existentes ("implementa este PRD").
  2. **Dos ejes independientes:**
     - El **nivel** (D-01) decide la ceremonia: tracker, delegados, Discovery,
       QA.
     - El **tipo de entrada** decide qué evidencia se exige.
  3. **Una sola clasificación:** los modos actuales se absorben en los niveles.

     | Nivel | Modo actual equivalente |
     | --- | --- |
     | N1 | small/local |
     | N2 | controlled-lite y controlled-implementation |
     | N3 | standard (incluye la regla de 2 o más hazards) |

     `autonomous-safe` y `resume` dejan de ser modos y pasan a ser
     **modificadores** que se aplican sobre cualquier nivel.
  4. **Tipos de entrada:**

     | Tipo | Cómo se reconoce | Evidencia obligatoria |
     | --- | --- | --- |
     | PRD | ruta a un PRD o "implementa este PRD" | matriz de cobertura de criterios de aceptación (como hoy) |
     | Bug | comportamiento observado distinto del esperado | reproducción, test que falla antes del arreglo y pasa después, una línea de causa raíz |
     | Ticket | ID de ticket o criterios de aceptación cortos | sus criterios de aceptación cubiertos por tests o checks |
     | Iteración | cambio sobre algo ya implementado con PRD | delta contra el PRD y su Evidencia de Implementación (detalle en D-09, U-08) |

  5. **Bug sin reproducción posible** (por ejemplo, el entorno no permite
     reproducir): la IA no arregla a ciegas. Se detiene y lo dice. Solo sigue
     sin test que falle si el usuario lo autoriza explícitamente, y el motivo
     queda registrado. Se relaciona con U-17: los fallos de entorno no deben
     disparar ciclos de reintentos.
- Decisión del usuario: aprobada (2026-11-10).

### D-09 · Iteración económica sobre lo ya implementado (U-08, Lote 2)

- Estado: **Decidida** (2026-11-10)
- Contexto: hoy, agregar algo a un PRD ya implementado reabre el flujo
  completo: Discovery, slicing, delegados y los 12 puntos del contrato de
  cierre. Pero el PRD cerrado ya tiene `## 10. Evidencia de Implementacion`,
  con cambios entregados, una referencia identificable del cambio
  (commit o PR) y la fecha de cierre. Ese es el mapa.
- Propuesta de la IA:
  1. **El mapa es el PRD y su sección 10**, no un Discovery nuevo. Se leen
     solo los archivos que nombra la evidencia y que el delta toca.
  2. **La frescura se mide por cambios, no por tiempo.** Con la referencia del
     cambio se revisa qué pasó desde el cierre en los archivos entregados
     (`git log` o `git diff <ref>..HEAD` sobre esos archivos):
     - sin cambios → el mapa está vigente y se va directo al delta;
     - cambios en pocos archivos → se releen solo esos;
     - archivos movidos o eliminados, o cambios amplios → Discovery acotado
       solo a esa área.

     El tiempo queda solo como alerta (por ejemplo, más de 90 días → se
     avisa). Un módulo que nadie tocó en un año sigue vigente; uno
     refactorizado ayer no.
  3. **Preguntas solo sobre el delta:** casos borde e incertidumbres del
     cambio nuevo. Si hay una API externa involucrada, se propone una prueba
     exploratoria (se conecta con U-07).
  4. **El nivel del delta sale de D-01**, por lo general N1. Como pide U-08,
     siempre se le propone al usuario y se espera su "sí".
  5. **Cierre proporcional:** no se repiten los 12 puntos del contrato de
     cierre. Se agrega una subsección "Iteración N" en la sección 10 del PRD,
     con el delta, los criterios de aceptación agregados o cambiados, los
     tests ejecutados y la referencia del cambio. Así el mapa queda al día
     para la próxima iteración. Si la iteración deja algo obsoleto, aplica
     U-06.
  6. **PRD antiguo sin sección 10:** se le pide al usuario el PR o commit de
     la implementación. Si no lo tiene, se hace un Discovery acotado al área.
  7. **La calidad no baja; baja la ceremonia.** Lo que se mantiene siempre:
     - tests del delta (y, si es un bug, el test que falla antes del arreglo);
     - **regresión del feature original:** se ejecutan los tests existentes
       que la sección 10 lista para ese PRD, no solo los nuevos. El riesgo
       principal de iterar es romper lo que ya funcionaba;
     - lint, tipos y estándares del proyecto sobre los archivos tocados;
     - escalada: si el delta toca un `criticalConcern`, pasa a N3 con todos
       sus gates;
     - en N2, QA enfocada en el delta (IA-10), con el modelo que corresponda
       según D-05a.

     Lo que se elimina: Discovery de código que no cambió, revalidar uno por
     uno los criterios de aceptación que no se tocaron, QA completa de todo el
     feature y el tracker en N1.
- Decisión del usuario: aprobada (2026-11-10), con el punto 7 agregado.

### D-10 · Orquestador cargado por nivel (IA-02, Lote 2)

- Estado: **Decidida** (2026-11-10)
- Contexto: `implement-prd/SKILL.md` tiene 301 líneas y siempre carga las
  reglas de todos los modos, además de 6 referencias (orchestration-flow,
  delegate-skill-matrix, handoff-schemas, subagent-prompts,
  task-tracker-template, validation-and-stop-conditions). Un cambio N1 paga
  el contexto de migraciones, UI y modo standard.
- Propuesta de la IA (mismo patrón que D-06):

  | Archivo | Contenido | Cuándo se lee |
  | --- | --- | --- |
  | `SKILL.md` núcleo (≤200 líneas) | detección del tipo de entrada, confirmación del nivel, **invariantes**, punteros | siempre |
  | `reference/level-n1.md` | flujo inline: archivos objetivo, test, check, cierre corto | solo en N1 |
  | `reference/level-n2.md` | preflight compacto, como máximo un delegado por slice, QA enfocada | solo en N2 |
  | `reference/level-n3.md` | flujo delegado completo, regla de hazards, matcher bloqueante, QA en contexto nuevo | solo en N3 |
  | `reference/input-types.md` | evidencia por tipo: PRD, bug, ticket, iteración (D-08, D-09) | según el tipo |
  | `reference/modifiers.md` | `autonomous-safe` y `resume` | solo si aplican |
  | referencias actuales (matriz de delegados, handoffs, tracker, prompts) | sin cambios de contenido en este lote | solo en N2 y N3, cuando se usan |

  - **Invariantes en el núcleo**, para que ningún nivel los salte:
    autorización, escalada por `criticalConcern`, tests del delta y
    regresión, condiciones de parada, y ningún cierre sin evidencia.
  - **Contrato de cierre por nivel.** Hoy los 12 puntos aplican a todo:

    | Nivel | Cierre |
    | --- | --- |
    | N1 | tests del delta, regresión, checks, evidencia corta en el PRD o en la respuesta |
    | N2 | lo de N1 + cobertura de los criterios de aceptación tocados + QA enfocada |
    | N3 | los 12 puntos actuales |

    Esto también ataca U-17: el contrato completo en cambios chicos es parte
    del ciclo perfeccionista.

    > Corrección tras el diagnóstico del Lote 3: en ooh-backoffice los PRDs
    > chicos no mostraron cierres pesados; el peso vino de unidades grandes y
    > autónomas. D-10 sigue siendo válida por ahorro de contexto, pero **no es
    > la causa principal de U-17**. Esa se trata en D-11.
- Decisión del usuario: aprobada (2026-11-10).

### Diagnóstico para el Lote 3 (ooh-backoffice, 2026-11-10)

Revisión de solo lectura de los 10 `_meta/` que siguen en
`ooh-repos/ooh-backoffice/docs/prd/**` y de `log/ds04-s5-history/`. La
mayor parte de `_meta/` está en `.gitignore`, así que las duraciones salen de
mtimes y fechas internas: son un techo, no tiempo activo.

| PRD | Estado | `_meta` | Sección 10 / tracker (líneas) | Señales |
| --- | --- | --- | --- | --- |
| ds-04 anunciantes | cerrado, `_meta` sin borrar | 23 archivos, 256 KB, 22 locks | 985 / 1059 | 36 delegation envelopes, 17 de 48 handoffs BLOCKED, ledger con 25 de 27 hallazgos reparados; `log/ds04-s5-history` = 352 archivos (11 MB), 3 rondas de runtime + 1 recovery para **una** slice, 28 scripts de diagnóstico ad hoc |
| ds-14 campañas edición | abierto (`ready_to_close: no`) | 32 archivos, 952 KB, 29 handoffs | 220 / — | 6 rondas de QA o reparación; cada corrida E2E completa tarda ~13,6 min por siembra y purga; la misma suite se reejecuta muchas veces |
| ds-11 cotizaciones | cerrado, `_meta` sin borrar | 13 archivos, 268 KB | 217 / — | — |
| ds-07, ds-08 soportes | cerrados con reentradas | `locks/` vacíos | 310 y 473 / — | 14 y 24 menciones de reentrada |
| ds-05, ds-06, ds-runtime-lifecycle | cerrados | 4–20 KB | 13–77 de tracker | sin loops; ds-runtime-lifecycle canceló un carril E2E por decisión del usuario |
| item-description | **bloqueado** | 11 archivos | 277 / 164 | `independent_qa: BLOCKED_MODEL`: no se pudo lanzar el modelo de QA |
| informe-anunciante | abierto | 6 archivos | 18 / 177 | espera datos reales y CI |

Hallazgos:

1. **`_meta/` casi nunca se borra**, ni siquiera en PRDs cerrados (4 casos).
   El punto 12 del contrato de cierre no se cumple en la práctica.
2. **La sección 10 y el tracker se vuelven bitácoras.** Se agregan bloques por
   cada writer, reentrada o reparación en vez de actualizar el estado (hasta
   985 y 1059 líneas). Confirma IA-11 y U-16.
3. **Un gate por cada cosa, sin tope de rondas.** Hay reparaciones,
   reentradas y QA repetidas sin un límite visible. Confirma U-17.
4. **El entorno pesa más que el código.** Suites E2E caras se reejecutan
   enteras por slice, y el entorno se repara como parte del trabajo.
5. **Bloqueos por infraestructura.** Un modelo que no se puede lanzar deja la
   tarea BLOCKED indefinidamente. **Afecta al Lote 1b:** al fijar modelos
   (D-07) hace falta una regla de fallback (D-12).

Matices respecto a las hipótesis:

- Los PRDs **chicos** no mostraron cierres pesados. El peso viene de
  unidades **grandes y autónomas** (ds-04 y ds-14 con `autonomous-safe` y
  `premium`). Por eso el tamaño del PRD también es parte del problema.
- No hay un loop puro de reintentos sobre la misma falla. Hay muchas rondas
  distintas sin tope y reparación del entorno dentro del alcance.

### D-11 · Freno a rondas y tests excesivos (U-17, Lote 3)

- Estado: **Decidida** (2026-11-10)
- Base: hallazgos 3 y 4 del diagnóstico del Lote 3.
- Propuesta de la IA:
  1. **Tope de rondas por slice: 2 rondas de reparación** (test, QA o
     reentrada). Al llegar a la tercera, la IA se detiene y le presenta al
     usuario qué falla, su hipótesis y opciones: seguir, aceptar el riesgo,
     reducir el alcance o dividir. **`autonomous-safe` no levanta el tope**:
     la autonomía quita las pausas de rutina, no los frenos.
  2. **Separar fallas de producto y de entorno.** Son de entorno: base de
     datos, puertos, siembra o purga, timeouts de infraestructura, modelo que
     no se puede lanzar, y un flaky sin cambio de código.
     - Falla de entorno: **un** intento de recuperación. Si sigue fallando,
       se detiene y se reporta. Reparar el entorno queda fuera del alcance del
       slice, salvo que el usuario lo pida.
     - Flaky: se reejecuta **una** vez. Si pasa, se registra como flaky y no
       se investiga dentro del slice.
  3. **Suites caras (E2E completa):** por slice corren solo los specs del
     slice. La suite completa corre **una vez**, en el cierre o en CI. Un
     resultado vigente (mismo comando, alcance y contenido) se reutiliza (se
     adelanta parte de IA-09).
  4. **Tests proporcionales.** Se escriben los tests de los criterios de
     aceptación y de los casos borde de la estrategia del PRD. No se agregan
     tests fuera de esa estrategia sin un hallazgo concreto que los
     justifique.
  5. **Diagnóstico acotado.** Los scripts de diagnóstico ad hoc y las
     corridas de "runtime N" para entender un fallo cuentan como rondas
     (punto 1). En ds-04 hubo 28 scripts y 3 rondas de runtime para una sola
     slice.
- Decisión del usuario: aprobada (2026-11-10).

### D-12 · Fallback cuando el modelo fijado no se puede lanzar (Lote 1b)

- Estado: **Decidida** (2026-11-10)
- Base: hallazgo 5 del diagnóstico del Lote 3. En item-description,
  `independent_qa: BLOCKED_MODEL` dejó la tarea bloqueada sin salida. Con
  D-07 cada agente tendrá un modelo fijado, así que este caso va a ser más
  frecuente si no hay regla.
- Propuesta de la IA:
  1. **Primero, otro candidato del mismo tier.** Si el modelo fijado es
     rechazado antes de ejecutar, se prueba **una vez** el siguiente de la
     lista del mismo tier y del mismo perfil (D-05a).
  2. **Después, el modelo del orquestador, pero solo si no es de un tier
     menor.** Si el orquestador es Opus y el rol pedía Grande, se usa el
     orquestador y queda registrado en `resolved_model`, con el motivo.
  3. **Nunca bajar de tier en silencio.** Si la única opción es un tier menor
     (por ejemplo, el orquestador es Sonnet y el rol es Grande), la IA se
     detiene y pregunta: seguir con el tier menor (queda registrado como
     `waived_by_user`) o esperar. Es la misma regla que ya fijó U-02 (AC-02).
  4. **Nunca subir de tier en silencio en el perfil `costo`.** Usar Opus en
     Copilot o API sin avisar sería una sorpresa en la cuenta.
  5. **QA independiente sin delegado posible:** el orquestador puede hacer la
     QA inline solo si su tier alcanza. Queda registrada como
     "independencia reducida", y el usuario decide si la acepta para el
     cierre.
  6. **Nunca BLOCKED indefinido.** Un modelo que no se puede lanzar es una
     falla de entorno (D-11): un intento de recuperación, y después parada con
     opciones para el usuario.
- Decisión del usuario: aprobada (2026-11-10).

### D-13 · Tracker y sección 10 compactos (IA-11, U-16, Lote 3)

- Estado: **Decidida** (2026-11-10)
- Base: hallazgo 2 del diagnóstico. En ds-04 el tracker llegó a 1059 líneas
  y la sección 10 a 985, porque cada writer, reentrada o reparación **agrega**
  un bloque en vez de **actualizar** el estado. Además, el punto 11 del
  contrato de cierre exige listar cada fila del ledger de hallazgos en el PRD.
- Propuesta de la IA:
  1. **El tracker es una foto del estado actual y se sobrescribe.** Lleva una
     fila por slice (id, estado, ronda n/2 de D-11, último comando y su
     resultado, bloqueo si lo hay) y el writer activo. Los bloques
     `previous_writer` y similares no se acumulan: se reemplazan. Meta:
     alrededor de 100 líneas incluso en N3.
  2. **El historial va aparte**, en un log de una línea por evento. Solo se
     lee al reanudar o auditar (IA-11) y se borra junto con `_meta/`.
  3. **La sección 10 es un resumen durable, no una bitácora.** Contiene qué se
     entregó, estado de los criterios de aceptación, validaciones ejecutadas
     (comando y resultado), resultado de QA, referencia del cambio y riesgos o
     waivers. La historia de reparaciones ya queda en el PR y los commits.
     - Hallazgos: los `critical` y `high` se listan uno por uno; los demás se
       resumen en conteos por estado. Esto cambia el punto 11 del contrato.
     - Tope orientativo: unas 60 líneas en N3 y 15 en N1 y N2. Cada
       "Iteración N" de D-09 también tiene un tope de unas 15 líneas.
  4. **Un check de cierre** avisa si la sección 10 pasa el tope o si el
     tracker tiene bloques repetidos. Es un aviso, no un bloqueo: un PRD
     excepcional puede justificar más.
- Decisión del usuario: aprobada (2026-11-10).

### D-14 · Limpieza garantizada de `_meta/` (U-16, Lote 3)

- Estado: **Decidida** (2026-11-10): opción **B**
- Base: hallazgo 1 del diagnóstico. 4 PRDs cerrados siguen con `_meta/`.
  Parte está ignorada por git y parte versionada (ds-14 con 32 archivos y
  ds-11 con 13 dentro del repo). El cierre se declara "local", antes del
  merge, y el borrado se olvida. `log/ds04-s5-history` (11 MB) está fuera de
  `_meta/` y no lo cubre ninguna regla.
- Opciones:
  - A. Mantener `_meta/` dentro de la carpeta del PRD y agregar un check que
    falle si la sección 10 está completa y `_meta/` sigue existiendo.
  - B. Mover **todo** el trabajo temporal de la IA a un solo directorio
    ignorado por git, por ejemplo `.ai-work/<prd>/` en la raíz del repo, que
    incluye tracker, locks, handoffs y logs de evidencia como los de
    `log/ds04-s5-history`.
- Recomendación de la IA: **B**, con estas reglas:
  1. El PRD solo guarda lo durable (la sección 10). Nada temporal entra en
     `docs/` ni en un PR. Es lo que buscaba #41 ("artefactos efímeros"), pero
     con una sola ubicación en vez de una carpeta por PRD.
  2. Al cerrar, el orquestador borra `.ai-work/<prd>/` después de completar la
     sección 10. Si el cierre se interrumpe, no se ensucia el repo porque el
     directorio está ignorado.
  3. `workflow-kit doctor` lista los espacios de trabajo que sobran: un PRD
     cerrado con `.ai-work/` vivo → ofrece borrarlo; un PRD abierto sin
     actividad hace más de 14 días → avisa para cerrarlo, dividirlo o
     archivarlo.
  4. Un PRD abierto o bloqueado conserva su espacio de trabajo. Eso es
     legítimo, y el doctor solo lo hace visible.
  5. La limpieza de lo que ya quedó en ooh-backoffice es una tarea aparte en
     ese proyecto, no parte de este lote.
- Decisión del usuario: aprobada (2026-11-10), opción B.

### D-15 · Entregas de subagentes y logs compactos (IA-07, IA-08, Lote 3)

- Estado: **Decidida** (2026-11-10)
- Contexto (`implement-prd/reference/handoff-schemas.md`, 325 líneas):
  - Cada handoff empieza con un `delegation-envelope/v1` de **~25 campos**.
    La mayoría son datos que el orquestador **ya le entregó** al delegado
    (objetivo, criterios de aceptación, archivos propios y prohibidos,
    lecturas, predecesores, contrato) y que ya están en el lock del slice.
  - Regla general: "cualquier campo requerido faltante = `blocked` y el
    orquestador se detiene". En ds-04 hubo 17 handoffs BLOCKED de 48. Un
    campo de contabilidad faltante bloquea igual que la falta de evidencia
    real.
  - Los handoffs no tienen un formato para logs. Los resultados de
    validación viajan como texto libre y los logs completos terminan en el
    contexto o en `log/` (11 MB en ds-04).
- Propuesta de la IA:
  1. **El delegado devuelve solo lo nuevo.** El handoff referencia el
     `execution_lock_id` y el `slice_id`, e informa `resolved_model` con su
     evidencia. No repite los datos de entrada que ya están en el lock. El
     envelope de vuelta pasa de ~25 campos a ~5.
  2. **Campos con contenido.** Estado, resultado, evidencia (comando,
     resultado, ruta del log) y, con detalle, solo los hallazgos y bloqueos.
     Las listas vacías se omiten en vez de escribir `| none`.
  3. **Distinguir faltas.** Si falta un campo que se deduce del lock (run,
     slice, rol), el orquestador lo completa. Solo bloquea la falta de
     **evidencia**: comando, resultado o contenido validado. Se mantiene todo
     el rigor de `VERIFIED` (lock válido y evidencia fresca).
  4. **Logs (IA-08).** El log completo se guarda en
     `.ai-work/<prd>/logs/` (D-14). El handoff lleva comando, código de
     salida, duración, conteos (pasaron y fallaron) y como máximo ~30 líneas
     relevantes por falla (el primer error y su stack). Nunca el log entero.
  5. El orquestador abre el log completo solo si el extracto no alcanza, y
     con lectura acotada (grep o tail), no completa.
- Decisión del usuario: aprobada (2026-11-10).

### D-16 · Base de conocimiento fija del proyecto (U-12, Lote 5)

- Estado: **Decidida** (2026-11-10)
- Contexto (`codebase-discovery/SKILL.md`):
  - Cada Discovery arranca de cero con `rg` y hasta 5 archivos
    exploratorios.
  - La calibración y el "Pattern Lock" de cada implementación viven en
    `_meta/orchestration.md`, que se borra al cerrar (y con D-14 pasa a
    `.ai-work/`). Lo aprendido sobre el proyecto **se pierde en cada cierre**.
  - Los proyectos ya tienen documentación útil que se puede referenciar
    (ooh-backoffice: `docs/foundations/ARCHITECTURE.md`, `DOMAIN_MODEL.md`,
    `docs/patterns/**`).
  - Las peculiaridades del entorno (siembra lenta, puerto 3114, E2E de ~13
    min, marcador de BD de test) se redescubrieron en ds-04 y ds-14.
- Propuesta de la IA:
  1. **Un solo archivo persistente por proyecto**, `.agents/project-context.md`,
     versionado y revisable por humanos, con un máximo de 200 líneas. Lleva:
     - mapa de estructura: carpeta → responsabilidad;
     - **comandos de validación** por capa, con su costo (por ejemplo, "E2E
       completa ~13 min: solo al cierre o en CI"), que alimentan D-11;
     - convenciones de tests: dónde viven, fixtures, factories;
     - **peculiaridades conocidas del entorno** y cómo se resuelven;
     - punteros a `ARCHITECTURE.md`, `DOMAIN_MODEL.md` y `docs/patterns/`,
       con una línea de "cuándo leerlo", sin duplicar su contenido.
  2. **Discovery lo lee primero** y explora solo lo específico del cambio. Su
     resultado es un delta, no un mapa completo.
  3. **Cuándo se actualiza:**
     - al cierre, si la implementación cambió patrones, comandos o estructura,
       el orquestador propone un diff chico al archivo, que entra en el mismo
       PR;
     - si Discovery encuentra una contradicción, la anota y el cierre propone
       la corrección;
     - `workflow-kit doctor` verifica que las rutas y comandos del archivo
       existan, y avisa si quedó desfasado.
  4. **Solo el orquestador lo actualiza, y al cierre.** Los delegados no lo
     tocan durante la ejecución, para evitar cambios a medio camino.
  5. **Primera vez:** se genera con un Discovery inicial del proyecto (tarea
     N2) y el usuario lo revisa antes de usarlo.
  6. **Engram como captura, no como fuente de verdad.** Engram es una
     capability opcional (`attach-only`): solo existe si el runtime expone
     sus herramientas, y su memoria es por usuario o máquina, no del repo.
     Por eso no puede reemplazar a `project-context.md`, que debe funcionar en
     todos los runtimes, ser compartido por el equipo y revisarse en un PR.
     Su rol:
     - durante la ejecución, el orquestador guarda en Engram lo que descubre
       (comandos, peculiaridades del entorno, patrones, contradicciones);
     - al cierre, consulta Engram por lo de ese PRD y lo condensa en el diff
       propuesto a `project-context.md`;
     - sin Engram, la fuente de candidatos es el log de historial de D-13.

     Esto respeta los scopes de `.agents/memory/README.md`: Engram es
     `local-user` y `project-context.md` es `project-shared`.
- Decisión del usuario: aprobada (2026-11-10), con prioridad explícita:
  **`project-context.md` (puntos 1–5) es lo principal y obligatorio**. Engram
  (punto 6) es secundario y opcional, y el flujo debe funcionar completo sin
  él.

### D-17 · Preparación combinada e índice del PRD (IA-05, IA-04, Lote 5)

- Estado: **Decidida** (2026-11-10)
- Contexto: antes de escribir código hay tres etapas, readiness
  (`capitana-alcance`), Discovery (`sherlock-estructura`) y slicing
  (`arquitecta-fases`), y cada una lee el PRD completo. El orquestador también
  lo lee y lo mantiene entero en contexto. Cuando el PRD ya es explícito, son
  tres o cuatro lecturas del mismo documento.
- Propuesta de la IA, según el nivel (D-01, D-10):

  | Nivel | Preparación |
  | --- | --- |
  | N1 | ninguna: archivos objetivo, test y check |
  | N2 | **una sola pasada inline** del orquestador con tres veredictos separados: ¿está listo?, delta de Discovery sobre `project-context.md` (D-16) y slices. Se delega una etapa solo si aparece incertidumbre concreta |
  | N3 | `capitana-alcance` lee el PRD completo **una vez** y entrega un **índice**: IDs de criterios de aceptación, casos borde, decisiones y restricciones, cada uno con la sección del PRD de donde sale. Discovery y slicing reciben el índice y solo las secciones que necesitan |

  - El orquestador retiene el índice, no el PRD entero. Si necesita
    detalle, lee la sección referenciada.
  - Cualquier delegado puede pedir una sección del PRD por su referencia.
  - **Control de pérdida:** la QA final contrasta el índice contra el PRD
    original. Un criterio, caso borde o decisión del PRD que no esté en el
    índice es un hallazgo `high`.
- Mejoras propuestas por la IA (autocrítica, v2):
  1. **Verificar el índice al crearlo, no solo al final.** Los PRDs tienen
     IDs (AC-N, UC-N, filas de la matriz de casos borde). Un check
     determinístico compara los IDs del PRD con los del índice apenas
     `capitana-alcance` lo entrega. Detectar la falta al final obliga a
     rehacer trabajo; al principio es gratis. La QA final se mantiene como
     segunda barrera.
  2. **El índice apunta, no parafrasea.** Los criterios de aceptación se
     copian textuales (son cortos). Las secciones con matices (reglas de
     negocio en prosa, Contrato Visual) no se resumen: el índice las marca
     como "leer completa" para el rol que las necesite. Parafrasear es donde
     se pierden los matices.
  3. **Índice con huella del PRD.** El índice guarda un hash del PRD y vive en
     `.ai-work/<prd>/` (D-14), así sobrevive a un `resume`. Si el PRD cambia
     durante la implementación, el índice queda vencido y se regenera.
  4. **Definir "incertidumbre concreta" en N2** para que no quede a criterio:
     hacen falta más de 5 archivos exploratorios, el área no aparece en
     `project-context.md`, o el PRD contradice el código.
  5. **Readiness en N2 sin sesgo propio.** Como el orquestador revisa el PRD
     que él mismo va a implementar, el veredicto de readiness debe listar
     explícitamente las preguntas abiertas, y estas se le hacen al usuario
     antes de cortar slices, sin asumir respuestas.
- Decisión del usuario: aprobada (2026-11-10), con las 5 mejoras.

### D-18 · Arranque mínimo de delegados y matcher proporcional (IA-01, IA-06, Lote 5)

- Estado: **Decidida** (2026-11-10)
- Contexto:
  - Los adapters de agentes (por ejemplo `.claude/agents/turbo-backend.md`)
    dicen "lee tu `SKILL.md` y las instrucciones aplicables del repositorio".
    El `SKILL.md` del implementador, en su "Must Read", incluye
    `.agents/instructions.md` (~300 líneas de contrato de **ruteo**), aunque
    ese mismo archivo dice que un delegado no debe volver a rutear. Cada
    delegado paga el contrato completo del orquestador.
  - Cada adapter termina con la línea "subagent model pinning=false", que
    queda desactualizada con D-07.
  - El matcher (`implementation-skill-matcher`, 166 líneas) puede correr como
    delegado aunque no exista ningún pattern candidato para el slice.
- Propuesta de la IA:
  1. **Los delegados no leen `instructions.md` ni el router.** Leen solo:
     - el `SKILL.md` de su rol;
     - el lock de su slice: archivos propios y prohibidos, criterios
       (desde el índice de D-17) y lecturas requeridas;
     - instrucciones por capa (backend o frontend) solo si el slice la toca;
     - el quality gate, solo los roles que escriben código;
     - la sección relevante de `project-context.md` (D-16).
  2. **Un contrato de delegado corto (~15 líneas) generado en cada adapter**:
     límites de archivos, condiciones de parada (D-11), formato de entrega
     (D-15) y "no rutear". Reemplaza el texto vago "instrucciones
     aplicables".
  3. **La línea de capacidades de modelo** la regenera el Lote 1b con el
     valor correcto, o se elimina del adapter.
  4. **Matcher inline cuando no hay candidatos.** Una búsqueda determinística
     en el registro de patterns (por superficie y hazards del slice) decide:
     - 0 candidatos → se registra en el lock "matching: sin candidatos para
       <superficie>", sin delegar;
     - 1 o más candidatos, o ambigüedad → se aplica el matcher completo,
       inline o delegado según el nivel.
  5. **Ningún pattern obligatorio se omite.** Si un hazard exige un pattern, la
     regla de elegibilidad actual se mantiene sin cambios.
  6. **Garantía de cobertura (pedida por el usuario).** Sacar `instructions.md`
     del arranque no puede hacer que un delegado se salte reglas que sí le
     aplican. Revisando `instructions.md`, hoy le aplican a un delegado:
     - toda la sección "Delegated context contract": leer el skill completo,
       no dar por recibido contenido sin procedencia observable, revalidar
       el delta al reanudar, input = subconjunto del rol, `unknown` no es
       permiso para asumir;
     - prevención de picos de tokens: salidas acotadas, nada de volcados
       crudos ni búsquedas amplias como primer paso;
     - nunca instalar ni adjuntar capacidades sin confirmación;
     - nunca afirmar un cambio de modelo que el runtime no confirme;
     - no usar salida comprimida en advertencias de seguridad o riesgos;
     - el contrato neutral gana sobre el adapter si se contradicen.

     Mecanismo:
     - **Inventario de reglas:** cada regla de `instructions.md` se clasifica
       como orquestador, delegado o ambos. El inventario queda en el PR del
       lote.
     - **Fuente única:** las reglas "delegado" y "ambos" se mueven a
       `.agents/delegation/delegate-contract.md` (~40 líneas).
       `instructions.md` lo referencia en vez de duplicarlo, y su regla
       "cargar este archivo primero desde todo entrypoint" agrega la
       excepción explícita para delegados.
     - **El `SKILL.md` lo garantiza:** el "Must Read" de cada skill de rol
       delegado reemplaza `instructions.md` por `delegate-contract.md` como
       primera lectura, más sus reglas propias del rol. El resumen de ~15
       líneas del adapter (punto 2) se genera desde ese archivo; no es una
       segunda fuente.
     - **Chequeo automático:** `check:workflow` falla si un skill de rol
       delegado no referencia el contrato, si sigue pidiendo
       `instructions.md`, o si una regla marcada "delegado/ambos" en el
       inventario no aparece en el contrato.
     - **Regla de escape:** si el delegado enfrenta algo que el contrato y su
       skill no cubren (cambiar alcance, decidir ruta, instalar algo, falta
       información), se detiene y devuelve al orquestador con el formato de
       D-15. Nunca "consulta `instructions.md` y decide".
     - **Validación real:** en la primera corrida N3 después del lote se
       revisa que ningún delegado haya violado una regla del inventario; si
       aparece una omisión, se agrega al contrato.
- Decisión del usuario: aprobada (2026-11-10), con el punto 6 (garantía de
  cobertura) agregado a pedido del usuario.

### D-19 · Método para demostrar redundancia de validación (U-13, Lote 4)

- Estado: **Decidida** (2026-11-10)
- Contexto:
  - U-13 pide investigar antes de recortar: "existe una matriz de cobertura
    por etapa; solo se eliminan duplicaciones demostradas".
  - Las etapas que validan hoy son: implementador, testinator-5000,
    guardia-contrato, lint-ranger, validation-runner, qa-relampago y el
    cierre de `implement-prd`.
  - Hay datos reales en ooh-backoffice: ds-04 (tracker de 1059 líneas,
    sección 10 de 985 líneas, 352 archivos de historial), ds-14 (6 rondas
    de QA) y PRDs chicos. Muchos `_meta/` se borraron, así que la evidencia
    es parcial.
  - El Lote 3 (D-11) ya resuelve parte del problema: E2E completa una sola
    vez, reutilizar un resultado vigente y límites de rondas.
- Propuesta de la IA:
  1. **Matriz declarada.** Desde los `SKILL.md` de cada etapa se registra qué
     dice verificar: tipo de check (tests unitarios, contrato, lint, tipos,
     E2E, criterios de aceptación, revisión de diff), comando y alcance.
  2. **Matriz observada.** Sobre 3 PRDs de ooh-backoffice (ds-04 grande,
     ds-14 con muchas rondas de QA y uno chico o mediano) se extrae cada
     check que realmente corrió: etapa, comando, alcance, versión del código
     y resultado. La versión del código sale del commit o del orden de
     ediciones: si entre dos corridas no se editó ningún archivo del
     alcance, se trata como el mismo contenido.
  3. **Clasificación de cada repetición:**
     - **duplicado exacto:** mismo comando, alcance y contenido. Se elimina
       (lo cubre IA-09);
     - **re-ejecución tras un cambio:** legítima, se mantiene;
     - **solapamiento con otro propósito:** por ejemplo, lint dentro del
       implementador y de nuevo en lint-ranger. Se asigna un único dueño por
       tipo de check;
     - **complementario:** mismo tipo, distinto alcance o distinto riesgo. Se
       mantiene.
  4. **Regla para eliminar algo:** solo duplicados exactos o solapamientos que
     aparezcan al menos en 2 de los 3 PRDs. Nunca se elimina el único check
     que cubre un criterio de aceptación o un hazard.
  5. **Se descuenta lo que ya resolvió el Lote 3.** Una repetición que D-11
     ya evita no cuenta como hallazgo nuevo de U-13.
  6. **Entregable:** `docs/plans/<fecha>-u13-validation-coverage-matrix.md`
     con ambas matrices, la clasificación y la lista de cambios a skills.
     Los cambios se aplican en el mismo Lote 4, junto con IA-09 e IA-10.
  7. **Quién y cuándo:** la investigación es de solo lectura, así que puede
     correr antes, en paralelo con otros lotes, en un subagente Mediano
     (perfil calidad, D-05a). Los cambios a skills esperan a que el Lote 3
     esté implementado.
  8. **Si la evidencia no alcanza** (por ejemplo, faltan los `_meta/`), la
     etapa queda marcada "sin evidencia" y no se toca. Para tener mejores
     datos a futuro, los logs acotados de IA-08 (Lote 3) registran comando,
     alcance y una huella del contenido, que es lo mismo que IA-09 necesita.
  9. **Salvaguardas contra degradación (agregadas a pedido del usuario).**
     - **Solo checks mecánicos son candidatos:** lint, tipos, tests
       unitarios y build. Las revisiones de juicio (QA, guardia-contrato,
       suficiencia de tests) nunca se eliminan en U-13; como máximo se
       enfocan en el delta (IA-10).
     - **Regla "ya sirvió":** si una repetición detectó una falla en
       cualquiera de los PRDs analizados, se mantiene.
     - **Reutilizar en vez de borrar:** el check sigue existiendo; solo se
       reutiliza su resultado cuando la huella coincide. La huella incluye
       archivos del alcance, lockfile, configuración y migraciones. Si
       difiere o es `unknown`, el check corre.
     - **Red final intacta:** el cierre corre siempre la suite completa una
       vez (D-11).
     - **Slices críticos excluidos:** si el slice toca un `criticalConcern`
       (seguridad, pagos, migraciones, contratos públicos), no se reutiliza
       ni se deduplica nada.
     - **"Sin cambios" es un resultado válido:** si no hay duplicados claros,
       U-13 cierra sin tocar skills.
  10. **Prueba contra defectos reales.**
      - Del historial de ds-04 y ds-14 se extraen las fallas que detectó cada
        etapa (qué check, en qué ronda). Ningún cambio se aplica si alguna
        de esas fallas dejaría de ser detectada por la matriz nueva.
      - Se buscan commits de arreglo posteriores al merge de esos PRDs. Un
        bug que se escapó marca un hueco de cobertura: U-13 puede **agregar**
        checks, no solo quitarlos.
  11. **Modo sombra y período de prueba reversible.**
      - En las 2 o 3 primeras implementaciones reales, el check reutilizado
        se ejecuta igual y solo se registra si su resultado habría diferido.
        El ahorro se activa cuando el modo sombra sale limpio.
      - Cada cambio va como un ítem separado en el PR. Si después se escapa
        un defecto que un check retirado habría detectado, ese check se
        restaura.
  12. **Transparencia y aprobación.**
      - La sección 10 anota cada check reutilizado como "reutilizado de
        <etapa>, huella <x>".
      - La matriz y sus hallazgos se presentan al usuario y se aprueban uno a
        uno antes de modificar cualquier skill.
- Decisión del usuario: aprobada (2026-11-10), con los puntos 9–12
  (salvaguardas, prueba contra defectos reales, modo sombra y aprobación por
  hallazgo) agregados a pedido del usuario.

### D-20 · Reutilizar checks vigentes y QA incremental (IA-09, IA-10, Lote 4)

- Estado: **Decidida** (2026-11-10)
- Contexto:
  - `qa-handoff-review` exige "evidencia fresca" para cada slice `VERIFIED`,
    pero no define qué es fresca. Cada etapa decide por su cuenta y vuelve a
    correr.
  - Tras cada reparación, el skill pide "una revisión QA fresca" completa
    (línea 63). En ds-14 eso fueron 6 revisiones completas.
  - D-19 (punto 9) ya fija las salvaguardas: reutilizar en vez de borrar,
    huella, slices críticos excluidos y modo sombra. D-20 define el
    mecanismo concreto.
- Propuesta de la IA:
  - **IA-09 · Reutilizar checks vigentes**
    1. **Registro de evidencia.** Cada check deja una línea en el registro
       compacto de validación (IA-08): comando exacto, alcance, huella,
       resultado, etapa y hora.
    2. **Huella** = hash de los archivos del alcance, el lockfile, la
       configuración relevante (lint, tsconfig, test) y las migraciones.
    3. **Antes de correr un check**, la etapa busca en el registro:
       - mismo comando, alcance y huella con PASS → se reutiliza y se anota
         "reutilizado de <etapa>";
       - mismo comando, alcance y huella con FAIL → no se vuelve a correr
         para "ver si pasa" (salvo un flaky, D-11);
       - un PASS sobre un alcance mayor cubre uno menor con la misma huella
         (por ejemplo, typecheck de todo el paquete cubre un archivo); un
         alcance menor nunca cubre uno mayor;
       - huella distinta o `unknown` → se corre.
    4. **Excepciones fijas:** slices con `criticalConcern` y la suite
       completa del cierre (D-11) siempre corren.
    5. **Arranque en modo sombra** (D-19, punto 11): las primeras 2 o 3
       implementaciones corren igual y solo registran si habrían diferido.
  - **IA-10 · QA incremental**
    1. **Primera QA: completa**, sin cambios respecto a hoy: todas las
       compuertas y las 6 categorías obligatorias.
    2. **Reentrada tras una reparación: enfocada.** Revisa los hallazgos
       reparados, el diff de la reparación y su radio de impacto (archivos y
       consumidores que toca). Las compuertas que no se tocaron conservan el
       veredicto anterior, citando la revisión de origen.
    3. **Escala a revisión completa** cuando la reparación:
       - toca un `criticalConcern`, un contrato o API pública, o una
         migración;
       - toca archivos fuera del alcance de los hallazgos originales;
       - o la revisión enfocada encuentra un hallazgo nuevo `high` o
         `critical`.
    4. **Cobertura acumulada antes de cerrar.** Cada archivo del diff final
       debe haber sido revisado por alguna QA en su versión actual (según la
       huella). Si queda alguno sin revisar, se revisa antes de
       `ready_to_close`. Así se cumple "sin regresiones sin revisar".
    5. **Se mantiene todo lo demás:** revisor independiente con contexto
       fresco; el ledger de hallazgos (lo que no está en el ledger sigue
       abierto); el tope de 2 rondas de D-11, que corta antes de cualquier
       revisión completa adicional.
  - **Ajustes tras la revisión crítica (aprobados por el usuario).** Donde
    contradicen los puntos anteriores, prevalecen estos:
    1. **Huella calculada por script, no por la IA.** Un script
       determinístico del kit (por ejemplo
       `scripts/validation-fingerprint.mjs`) calcula la huella y el agente
       solo lo invoca. Si el runtime no puede ejecutarlo, la huella es
       `unknown` y el check corre.
    2. **Reutilizar solo checks caros y determinísticos:** typecheck del
       paquete, suites unitarias y build. Los checks baratos (por ejemplo,
       lint de pocos archivos) simplemente corren. Integración y E2E no se
       reutilizan entre etapas porque dependen de estado que la huella no ve
       (base de datos, seeds, variables de entorno, servicios externos); para
       E2E rige solo la regla de D-11 (suite completa una vez en el cierre).
    3. **La huella incluye además** la versión del runtime y de las
       herramientas (por ejemplo, Node) y el código generado (clientes de
       Prisma, tipos generados, codegen).
    4. **"Alcance mayor cubre menor" solo para lint y tipos.** En tests no
       aplica: la misma suite con otros flags u otro entorno no es el mismo
       check.
    5. **Radio de impacto determinístico.** En la QA enfocada, el radio de
       impacto se calcula buscando los usos de los símbolos modificados por
       la reparación y queda registrado. El revisor parte de esa lista, no de
       su juicio.
    6. **Gatillo de revisión completa corregido:** "toca archivos fuera del
       slice reparado" reemplaza a "toca archivos fuera del alcance de los
       hallazgos originales".
    7. **Calibración única de IA-10.** En la primera implementación real con
       una reentrada de QA se corren la revisión enfocada y la completa, y se
       comparan los hallazgos. Si la completa encuentra algo que la enfocada
       no vio, se ajustan los gatillos antes de confiar en el esquema.
- Decisión del usuario: aprobada (2026-11-10), con los 7 ajustes.

### D-21 · PRD con más y mejores preguntas (U-07, Lote 6)

- Estado: **Decidida** (2026-11-10)
- Contexto (`create-prd`):
  - La detección de ambigüedad (fase 2) pregunta **solo lo bloqueante**: lo
    que produciría implementaciones materialmente distintas.
  - La matriz de edge cases (6 categorías obligatorias) se llena en el
    borrador (fase 4), en general con supuestos de la IA o "No aplica"
    justificado. Al usuario casi nunca se le pregunta por casos borde.
  - No hay un paso para dependencias poco conocidas (APIs externas, forma y
    volumen de datos reales, límites de terceros). No se distingue un
    supuesto verificado de uno asumido.
- Propuesta de la IA:
  1. **Ronda de casos borde por confirmación, no por preguntas abiertas.**
     Después de las dudas bloqueantes, la IA presenta las 6 categorías ya
     prellenadas desde el código, cada una con su propuesta. Pregunta
     explícitamente solo las filas que son decisión de negocio (no se
     deducen del código). El usuario puede responder "ok" en bloque o
     corregir filas puntuales.
  2. **Inventario de incógnitas en la calibración (fase 1).** Cada
     dependencia externa o poco conocida (API externa, datos reales, límites
     de un tercero, calidad de datos legados) se clasifica como
     **verificada** (con evidencia en código, contrato o documentación),
     **asumida** o **desconocida**.
  3. **Qué se hace con lo asumido o desconocido que afecta un criterio de
     aceptación**, en este orden:
     - preguntarle al usuario si él lo sabe;
     - proponer una **prueba exploratoria** acotada y de solo lectura
       (llamar al sandbox de la API, contar o muestrear datos reales, leer la
       documentación del tercero). Requiere aprobación explícita del
       usuario, nunca usa credenciales de producción sin que el usuario lo
       indique, y el resultado queda como "supuesto verificado" con su
       evidencia;
     - si no se puede verificar antes: se registra como riesgo y el
       **primer slice** de la implementación lo verifica, con una condición
       de parada si resulta falso.
  4. **Nueva sección del PRD: "Supuestos e integraciones"**, con la tabla
     `Supuesto | Fuente | Estado (verificado/asumido/bloqueante) | Evidencia |
     Qué pasa si es falso`.
  5. **Límite de preguntas (tema abierto del Lote 6):**
     - hasta ~10 preguntas por ronda, agrupadas por categoría, cada una con
       la respuesta que la IA propone, para que el usuario solo confirme o
       corrija;
     - máximo 3 rondas. Si después de 3 rondas siguen apareciendo dudas
       bloqueantes, es señal de que el PRD es demasiado grande y se propone
       dividirlo (se conecta con la decisión de tamaño máximo de PRD);
     - lo no bloqueante no se pregunta: se registra como supuesto con su
       valor por defecto, y el usuario puede cambiarlo.
  6. **Autoauditoría (fase 5), dos preguntas nuevas:**
     - "¿`implement-prd` descubriría en ejecución el comportamiento de una
       dependencia externa?";
     - "¿algún supuesto asumido afecta un criterio de aceptación sin
       verificación ni slice de verificación temprana?".
  7. **Medir si funciona.** Cuando una implementación itera (reentrada de QA,
     ronda de reparación o iteración posterior de D-09), la sección 10
     registra la causa en un campo corto: `hueco del PRD`, `error de
     implementación`, `entorno` o `cambio de requisito`. Así se puede
     comprobar el criterio de U-07: "bajan las iteraciones causadas por
     comportamientos no previstos".
  8. **Proporcional al nivel.** En la vía compacta, la ronda de casos borde
     cubre solo las categorías que el cambio toca. El inventario de
     incógnitas corre siempre que haya una integración externa.
- Decisión del usuario: aprobada (2026-11-10).

### D-22 · Detectar y retirar lo que queda obsoleto (U-06, Lote 6)

- Estado: **Decidida** (2026-11-10)
- Contexto:
  - Hoy el kit solo trata lo antiguo como "legacy cleanup" en rollouts:
    `create-prd` e `implementation-slicing` exigen que la limpieza vaya en un
    slice separado cuando puede fallar sola.
  - No existe un paso que **detecte** qué deja obsoleto el nuevo desarrollo:
    ni una sección en el PRD, ni una búsqueda en Discovery, ni una
    verificación en QA. El ejemplo de U-06 (un parámetro fijo que pasa a ser
    dinámico) hoy puede terminar con dos fuentes de verdad.
- Propuesta de la IA:
  1. **Nueva sección del PRD: "Qué queda obsoleto"**, parte del alcance, con
     la tabla `Elemento | Tipo | Ubicación | Reemplazado por | Acción |
     Consumidores | Slice | Búsqueda de verificación`.
     - Tipos: código, constante o parámetro, configuración, flag, endpoint o
       campo, test, fixture o seed, traducción, documentación, datos.
     - Acción: eliminar, adaptar o deprecar en etapas.
     - "Ninguno" solo con una línea de justificación, igual que un "No
       aplica" de la matriz de edge cases.
  2. **Cómo se detecta en `create-prd`.** Por cada concepto que el PRD cambia
     (un valor que pasa a dinámico, una entidad reemplazada, un endpoint
     renombrado) se buscan usos del símbolo, el valor literal, el nombre del
     flag, las claves de traducción, los tests, los fixtures y la
     documentación. Pregunta de control: "después del cambio, ¿existen dos
     fuentes de verdad para X?".
  3. **Estrategia según quién lo usa:**
     - todos los consumidores están en el repo → se elimina o adapta en este
       PRD;
     - hay consumidores externos (API pública, apps móviles, reportes, otros
       servicios) o datos persistidos → se depreca en etapas (agregar lo
       nuevo, migrar, retirar lo viejo). El retiro final puede ir en un slice
       posterior o en alcance futuro con ticket explícito, pero nunca queda
       implícito. Esto se le pregunta al usuario, porque es decisión de
       negocio.
  4. **Discovery en `implement-prd`.** Verifica la lista del PRD contra el
     código actual, que pudo cambiar desde que se escribió. Lo nuevo que
     encuentre:
     - si está en los mismos archivos del slice y es trivial, se agrega;
     - si no, se reporta y se pregunta o se registra; no se agrega alcance en
       silencio.
  5. **Slicing.** Cada fila de "Qué queda obsoleto" pertenece a un slice,
     con la misma regla de trazabilidad que los criterios de aceptación. El
     retiro va en slice propio cuando puede fallar solo (regla actual). Un
     test o check demuestra que lo viejo ya no está o fue adaptado.
  6. **QA.** `qa-handoff-review` corre la "búsqueda de verificación" de cada
     fila: cero usos restantes, o los que queden justificados. Como la
     búsqueda viene escrita en el PRD, el check es determinístico y barato.
  7. **Límite de alcance.** Solo cuenta lo que **este** desarrollo deja
     obsoleto. El código muerto no relacionado que aparezca se anota como
     sugerencia, no como alcance.
  8. **Aplica también a iteraciones y a la vía compacta** (D-09). El ejemplo
     del parámetro fijo es justamente un cambio chico.
- Decisión del usuario: aprobada (2026-11-10).

### D-23 · Sketch de UI con impeccable y crítica de vistas (U-01, Lote 6)

- Estado: **Decidida** (2026-11-10)
- Contexto:
  - `solution-sketch` (89 líneas) está pensado para arquitectura: compara 2 o
    3 formas con diagramas Mermaid de pizarra. Para una pantalla, comparar
    cajas abstractas no dice nada de jerarquía, densidad ni estados.
  - `impeccable` ya trae lo necesario:
    - `shape` produce un brief de diseño mediante una entrevista corta (2 o
      3 preguntas por ronda), sin escribir código;
    - `critique` hace dos evaluaciones independientes (revisión de diseño y
      detector o navegador) sobre una vista concreta.

    Exige `PRODUCT.md`; si falta, corre `teach`, que es otra entrevista.
  - `create-prd` ya tiene el Contrato Visual con campos fijos: superficie,
    densidad, acción principal, estados, tesis visual, primitivas del design
    system y `UI lock`.
- Propuesta de la IA:
  1. **Opcional y ofrecido al entrar al sketch (ajuste del usuario).** Los
     equipos trabajan distinto y muchos tienen sus propios diseñadores, así
     que el camino con impeccable nunca se activa solo. Al entrar a
     `solution-sketch`, si hay UI involucrada (calibración `visible_ui: yes`
     o el usuario habla de una pantalla), se le ofrece al usuario:
     - **a) diseñar una vista nueva** con impeccable;
     - **b) criticar una vista existente** que elige el usuario, con
       impeccable;
     - **c) usar el diseño del equipo** (Figma, mockup o indicaciones del
       diseñador): no se carga impeccable; el sketch solo traduce ese diseño
       a los campos del Contrato Visual y cita la fuente;
     - **d) seguir sin parte visual:** sketch clásico de arquitectura.

     La elección queda registrada en el sketch (`ui-path: shape | critique |
     team-design | skipped`). Si el problema mezcla arquitectura y UI,
     primero se fija la arquitectura y la parte visual va en una sección
     propia del mismo sketch.
     - **Preferencia por proyecto:** un equipo con diseñadores puede fijar en
       la configuración del proyecto que la opción por defecto sea c), o que
       no se ofrezca impeccable. Se cambia cuando quiera, igual que el
       perfil de modelos (D-07). Sin configuración, se ofrecen las cuatro
       opciones sin preseleccionar ninguna.
  2. **Camino "vista nueva"**: se carga `impeccable shape`. Su entrevista
     reemplaza el turno 1 del sketch, con una sola ronda salvo huecos reales.
  3. **Camino "criticar vista existente"**:
     - se resuelve la vista a un archivo o URL concreto;
     - corre `impeccable critique`; la navegación es opcional: si no hay
       servidor disponible, la crítica es solo sobre el código y se marca
       como "degradada";
     - entrega **problemas concretos** con evidencia (archivo, elemento,
       heurística).
  4. **Formato de las propuestas (caminos a y b).** 2 o 3 propuestas
     comparables en una tabla con las mismas columnas que el Contrato Visual
     (jerarquía, densidad, acción principal, estados y accesibilidad).
  4b. **Mockups y prototipos para evaluar e iterar visualmente (ajuste del
      usuario).** Que una persona (el usuario, un diseñador, un PM) pueda
      abrir, mirar y comentar el sketch sin leer markdown. Se ofrece en los
      caminos a y b (recomendado); el usuario puede rechazarlo y quedarse con
      la tabla y un wireframe ASCII. En dos etapas, para no pagar alta
      fidelidad por opciones que se descartan:
      - **Etapa 1, comparar:** cada propuesta es un **mockup HTML de baja
        fidelidad** (grises, sin estilo de marca), en un solo archivo sin
        build, más un `index.html` que muestra las opciones lado a lado.
      - **Etapa 2, iterar la elegida:** la opción ganadora pasa a un
        **prototipo navegable de fidelidad media**: usa los tokens de
        `DESIGN.md` o las primitivas del design system si existen, y permite
        alternar entre los estados obligatorios del Contrato Visual (vacío,
        cargando, error, sin permisos, éxito).
      - **Dónde viven:** `docs/design/<slug>-mockups/`, versionados en el
        repo (`opcion-a.html`, `prototipo-v1.html`, `prototipo-v2.html`…),
        para que cualquier persona del equipo los abra en el navegador.
      - **Ciclo de iteración:** la persona comenta, se genera una versión
        nueva conservando la anterior, y cada ronda queda en un "registro de
        feedback" dentro del sketch. Las rondas visuales se cuentan aparte de
        los 3 turnos del sketch, con un **máximo de 3 rondas**. Si después de
        3 rondas no hay acuerdo, se acepta la versión actual o se deriva a un
        diseñador.
      - **Datos ficticios siempre.** Nunca datos reales de clientes.
      - **No es código de producto:** la aplicación nunca importa los
        mockups. `implement-prd` los usa como referencia visual junto al
        Contrato Visual, que sigue siendo el contrato.
      - **Camino c (diseño del equipo):** no se generan mockups; se citan
        los del diseñador.
      - **Neutral al runtime:** son archivos HTML locales. Si el runtime
        tiene vista previa de navegador, se abren ahí; si no, el usuario los
        abre manualmente.
  5. **Puente al PRD.** La propuesta elegida, o el diseño del equipo en el
     camino c), se escribe con los campos del Contrato Visual ya llenos. `create-prd` la hereda como ancla, igual que
     hoy hereda los nombres de clases: invertirla exige un desafío explícito
     de critical-stance.
  6. **Se mantienen los límites del sketch:**
     - máximo 3 turnos;
     - nunca arranca sin autorización;
     - sin código de producto: se excluyen `craft`, `live` y cualquier
       comando de impeccable que edite archivos;
     - sin criterios de aceptación ni slices.
  7. **Si falta `PRODUCT.md`:** se ofrece `teach` una vez. Si el usuario no
     quiere, el sketch sigue sin él y lo deja anotado. No bloquea. A futuro,
     `PRODUCT.md` puede formar parte de la base de conocimiento del proyecto
     (D-16).
  8. **Costo y modelos.** Las dos evaluaciones de `critique` corren como
     subagentes con el tier que fije D-05a para revisión. En el perfil
     costo, si los subagentes no están disponibles, corren en secuencia y
     se marca "independencia degradada", como ya hace impeccable.
- Decisión del usuario: aprobada (2026-11-10), con dos ajustes del usuario:
  el camino con impeccable es opcional y se ofrece al entrar al sketch (con
  la opción de usar el diseño del equipo), y se agregan mockups y prototipos
  para evaluar e iterar visualmente (punto 4b).

### D-24 · Comentarios de PR siempre evaluados críticamente (U-05, Lote 6)

- Estado: **Decidida** (2026-11-10)
- Contexto (responde el tema abierto "qué cubre ya critical-stance"):
  - `critical-stance` (37 líneas, #44) aplica solo a los skills de producto
    (`create-prd`, `create-epic`, `project-formation`, `generate-pm-ticket`,
    `solution-sketch`). Sirve para desafiar **decisiones**, no para evaluar
    una **afirmación técnica ajena**. **Hoy no cubre U-05.**
  - `pr-comments-resolution` (187 líneas) da el comentario por correcto. El
    paso 2.1 pide explicar "qué está mal y por qué importa", y todas las
    opciones del paso 2.2 son cambios de código. No existe "responder con
    evidencia sin cambiar código", y un hilo solo se cierra después de un
    arreglo.
  - Copilot, Sentry y los linters reciben el mismo trato que un revisor
    humano: tomar su sugerencia como insumo, pero sin evaluar si es válida.
- Propuesta de la IA:
  1. **Paso obligatorio 2.0, "Evaluar antes de explicar".** Para cada
     comentario:
     - interpretar la afirmación técnica concreta;
     - contrastarla con el código **actual** (el comentario puede referirse a
       un diff viejo), el hilo completo, el PRD o contrato y los tests;
     - clasificarla como **válido**, **parcialmente válido**, **obsoleto** (ya
       resuelto o la línea cambió), **no aplica** (fuera de alcance o
       contradice una decisión del PRD) o **incorrecto**;
     - asignar severidad y citar la evidencia (archivo y línea, test,
       documento).

     Aplica igual a humanos y a bots: ningún comentario se acepta por
     defecto.
  2. **El paso 2.1 cambia de enfoque:** pasa de "qué está mal" a "qué afirma
     el comentario, veredicto y evidencia".
  3. **Las opciones dependen de la clasificación:**
     - válido → corregir, y opcionalmente responder;
     - parcialmente válido → corregir la parte válida y responder el resto;
     - obsoleto → responder citando el commit o el cambio que lo resolvió;
     - no aplica → responder con el fundamento (por ejemplo, la decisión del
       PRD) y, si vale la pena, proponerlo como alcance futuro;
     - incorrecto → responder con evidencia, sin cambiar código.

     Se mantienen la opción conservadora, la recomendada y la elección del
     usuario antes de actuar.
  4. **Respuestas y cierre de hilos:**
     - plantillas nuevas de "respuesta con fundamento" en
       `comment-response-templates.md`: tono respetuoso y basado en
       evidencia;
     - **publicar una respuesta es una acción hacia afuera**: el usuario
       aprueba el texto de cada una antes de enviarla;
     - si se discrepa con un **revisor humano**, se responde pero no se
       cierra su hilo: lo resuelve el revisor. Los hilos de bots se pueden
       cerrar después de responder.
  5. **critical-stance se extiende a este flujo**, con una sección corta,
     "Evaluar afirmaciones externas". Incluye una regla de **simetría**:
     clasificar un comentario como "incorrecto" exige evidencia tan sólida
     como la que exige un arreglo. Así se evita el sesgo contrario: rechazar
     comentarios para ahorrarse trabajo.
  6. **Triage previo para PRs con muchos comentarios:**
     - primero se clasifican todos y se muestra una tabla con veredicto y
       evidencia;
     - los válidos, los parciales y los dudosos siguen el flujo uno a uno;
     - los obsoletos o incorrectos de bots se pueden responder en lote, con
       aprobación del usuario.
  7. **El resumen final incluye la clasificación de cada comentario.** Con
     el tiempo, eso muestra qué tan seguido acierta cada bot.
- Decisión del usuario: aprobada (2026-11-10).

### D-25 · Tamaño máximo de un PRD (Lote 6)

- Estado: **Decidida** (2026-11-10)
- Contexto:
  - Hoy `create-prd` divide slices por frontera de falla, rollback, contrato
    u ownership, "no por cuota de slices". **No existe un límite para el PRD
    completo**: nada obliga a convertir un PRD grande en épica con PRDs
    hijos.
  - Medición aproximada en ooh-backoffice (conteo con regex sobre los PRDs;
    son órdenes de magnitud, no cifras exactas):

    | PRD | Líneas | Criterios | Slices aprox. | Fases | Resultado |
    | --- | --- | --- | --- | --- | --- |
    | ds-05 contactos | 366 | 12 | ~4 | 3 | sin loops |
    | ds-06 medios | 404 | 18 | ~14 | 3 | sin loops |
    | ds-07 soportes consulta | 660 | 23 | ~15 | 3 | 14 reentradas |
    | ds-08 soportes edición | 893 | 27 | ~8 | 3 | 24 reentradas |
    | ds-14 campañas edición | 530 | 15 | ~7–20 | 3 | 6 rondas de QA, abierto |
    | ds-04 anunciantes | 1266 | 14 | ~10 | 3 | 3 rondas de runtime, 17 handoffs BLOCKED |

  - Lectura: los PRDs con más de ~20 criterios o más de ~600 líneas
    concentran las reentradas. ds-04 muestra además que un PRD con pocos
    criterios igual se vuelve pesado cuando concentra riesgos (entorno,
    runtime) y corre en `autonomous-safe`. El tamaño es un factor, no el
    único.
- Propuesta de la IA:
  1. **Señales de tamaño, no un límite único.** Se miden en la
     autoauditoría (fase 5) de `create-prd`:
     - más de **8 slices** de implementación;
     - más de **20 criterios de aceptación**;
     - más de **3 fases**;
     - **4 o más tipos de riesgo distintos** (migración, contrato público,
       tenancy, ejecución en segundo plano, integración externa, UI
       visible);
     - más de **~600 líneas** (señal secundaria, nunca cuenta sola).
  2. **Qué pasa según cuántas señales se cumplen:**
     - **1 señal:** advertencia registrada en la autoauditoría, sin bloqueo;
     - **2 o más:** `create-prd` debe **proponer dividir** antes de declarar
       `ready for implement-prd`. Lo natural es por las fronteras de fase
       que el PRD ya tiene: una épica con PRDs hijos, usando
       `create-epic` y su "Contrato entre Fases". El usuario decide.
  3. **Si el usuario decide no dividir:** se registra el motivo, y el PRD se
     ejecuta **fase por fase**, con una pausa de revisión y un cierre
     parcial de la sección 10 al terminar cada fase (**ajustado por D-26:**
     pasa a ser la opción recomendada; el usuario puede elegir autónomo).
     `autonomous-safe` no
     puede atravesar todas las fases de un PRD grande sin esas pausas; es la
     misma idea de D-11: la autonomía quita pausas de rutina, no frenos.
  4. **PRDs antiguos o que ya llegan grandes a `implement-prd`:** no se
     reescriben. La implementación propone la misma ejecución fase por fase
     del punto 3.
  5. **Conexión con D-21:** si después de 3 rondas de preguntas siguen
     apareciendo dudas bloqueantes, cuenta como una señal adicional.
  6. **Umbrales calibrables.** Los valores iniciales salen de esta medición.
     Se revisan después de unos 5 PRDs nuevos, usando el campo de "causa de
     iteración" de D-21 (punto 7). Un proyecto puede ajustarlos en su
     configuración, igual que el perfil de modelos (D-07).
- Decisión del usuario: aprobada (2026-11-10).

### D-26 · Modo autónomo como opción explícita del usuario (Lotes 2 y 6; ajusta D-25)

- Estado: **Decidida** (2026-11-10)
- Origen: pedido del usuario al aprobar D-25: el modo autónomo debe
  ofrecerse como opción y el usuario decide cuándo usarlo.
- Contexto:
  - Hoy `autonomous-safe` se activa solo "cuando el usuario pide ejecución
    autónoma" (`implement-prd`, línea 43). Nunca se ofrece, así que quien no
    sabe que existe no lo usa, y quien lo pide una vez no ve qué implica.
  - D-08 lo convirtió en un **modificador** aplicable sobre cualquier nivel.
  - D-25 (punto 3) impedía que el modo autónomo cruzara todas las fases de
    un PRD grande sin pausas. Ese punto choca con dejar la elección al
    usuario.
- Propuesta de la IA:
  1. **Se ofrece siempre al autorizar una implementación N2 o N3**, junto
     con el trace de ruta:
     - **Supervisado** (opción por defecto): pausa de revisión entre fases;
     - **Autónomo**: sin pausas de rutina; sigue hasta terminar o hasta una
       condición de parada.

     En N1 no se ofrece, porque ya no tiene pausas que quitar. Al reanudar
     (`resume`) se vuelve a ofrecer.
  2. **Se puede cambiar en cualquier momento.** "Pausa" o "sigue supervisado"
     detiene la autonomía al final del paso en curso; "sigue autónomo" la
     activa desde ahí. La elección vale para esa ejecución; no queda como
     preferencia permanente del proyecto.
  3. **Lo que nunca se quita, aunque el usuario elija autónomo:** las
     condiciones de parada, el tope de 2 rondas de reparación (D-11), las
     fallas de entorno (D-11), el fallback de modelo (D-12), las confirmaciones
     de instalación y las acciones irreversibles o hacia afuera (push,
     deploy, publicar, borrar). La autonomía quita pausas, no frenos.
  4. **Ajuste a D-25, punto 3.** En un PRD grande que el usuario decidió no
     dividir, la ejecución fase por fase con pausas pasa a ser la opción
     **recomendada**, no una obligación. Si el usuario elige autónomo:
     - la IA muestra antes, en una línea, las señales de tamaño que se
       cumplen y el riesgo (los casos ds-04 y ds-14);
     - al terminar cada fase se escribe igual un **resumen de checkpoint** en
       la sección 10, sin detenerse, para que el usuario pueda revisarlo
       cuando quiera;
     - si una fase agota su tope de rondas, la ejecución se detiene en ese
       punto (D-11), sin seguir con la fase siguiente.
  5. **Visibilidad:** el trace muestra el modo activo (`· autónomo` o
     `· supervisado`), y el cierre registra qué modo se usó, para
     relacionarlo después con la "causa de iteración" de D-21.
- Decisión del usuario: aprobada (2026-11-10). Supervisado queda como
  opción por defecto y la elección no se guarda como preferencia
  permanente.

### D-27 · Cómo verificar U-02 en una ejecución real (Lote 7 → se adelanta)

- Estado: **Decidida** (2026-11-10)
- Contexto:
  - El plan `2026-10-06-u02-copilot-tier-routing` (PR #55) cerró con
    evidencia real: 7 requests de 3 agentes, cada uno con el modelo de su
    tier, verificados con `verify-copilot-model-evidence.mjs`.
  - Esa evidencia cubre solo la **invocación explícita**: el orquestador
    pasa `agentName` y `model`. El propio plan aclara que el fallback nativo
    (cuando el orquestador **no** pasa el modelo) "se comprobó como
    configuración, no en ejecución". El diagnóstico inicial mostró que, sin
    override, el subagente hereda el modelo del orquestador.
  - Hipótesis más probable de por qué "aún falla": en un flujo real largo, el
    orquestador (un LLM) **no siempre pasa `model`** en cada invocación, y
    ese subagente hereda el modelo. La prueba aislada pasa; la ejecución real
    no.
  - Con D-05a, el perfil costo de Copilot depende por completo de que esto
    funcione. Si los subagentes heredan el modelo del orquestador, el ahorro
    del perfil no existe.
- Propuesta de la IA:
  1. **Adelantar la verificación al Lote 1b.** No esperar al Lote 7: el
     perfil costo (D-05a) y el fallback de modelo (D-12) se construyen sobre
     este mecanismo. U-02 se queda en el Lote 7 solo si hay que corregir
     algo grande.
  2. **Dos pruebas, ambas corridas por el usuario en VS Code con Copilot**
     (la IA no puede ejecutar Copilot):
     - **A · Smoke controlado:** el mismo smoke del plan U-02 (sondas de solo
       lectura, una por tier), corrido de nuevo con la versión actual de VS
       Code y Copilot. Confirma que la invocación explícita sigue
       funcionando.
     - **B · Ejecución real:** la próxima implementación N2 o N3 en
       ooh-backoffice con Copilot. Al cerrar, el verificador cruza **cada**
       delegación con el log de Copilot y produce una tabla `rol | modelo
       esperado | modelo ejecutado | veredicto`.
  3. **La tabla de modelos ejecutados pasa a ser parte del cierre en
     Copilot.** Es una tabla corta en la sección 10 (compatible con D-13). Una
     fila `NOT_VERIFIED` o con el modelo equivocado se reporta como hallazgo;
     no bloquea el cierre salvo en slices críticos.
  4. **Qué se hace según el resultado:**
     - **A y B pasan:** U-02 queda **Hecho (#55)**, con evidencia real.
     - **A pasa y B falla porque el orquestador omitió `model`:** se refuerza
       el protocolo de invocación. Cada rol tiene un snippet de invocación
       generado con su modelo, y el orquestador verifica antes de cada
       delegación que el parámetro esté presente.
     - **A falla (VS Code o Copilot ignora el modelo explícito):** se
       documenta el límite exacto (versión, mensaje, log) con una alternativa
       operativa, como pide el criterio de U-02. Por ejemplo: correr los
       roles críticos en la sesión principal con el modelo elegido a mano, o
       elegir el modelo del orquestador según el perfil.
  5. **Instrucciones para el usuario:** una guía corta en
     `docs/workflow/copilot-subagent-model-routing.md` (ya existe) con
     dónde encontrar el log de Copilot Chat y el comando del verificador.
- Decisión del usuario: aprobada (2026-11-10).

### D-28 · Alcance de U-15: funcionamiento completo en Codex (Lote 7)

- Estado: **Decidida** (2026-11-10)
- Contexto:
  - Codex tiene 13 agentes generados en `.codex/agents/*.toml` con
    `name`, `description`, `sandbox_mode` y `developer_instructions`. **Ninguno
    declara modelo ni esfuerzo de razonamiento**, y el catálogo marca
    `codex.pinSubagentModel: false`. Todos los subagentes heredan el modelo
    de la sesión.
  - `implement-prd` menciona `wait_agent` para Codex, pero **no menciona
    `spawn_agent` ni el permiso que Codex exige** para lanzar subagentes. El
    skill `impeccable` sí lo documenta: Codex lanza subagentes solo si el
    usuario los autorizó explícitamente. Sin ese permiso, el flujo cae a
    ejecución inline en silencio, y todo el trabajo se acumula en la ventana
    de contexto del orquestador. Es exactamente la queja de U-15.
  - Para Claude Code, el modelo por agente ya lo cubre el Lote 1b (D-07,
    `model:` en el frontmatter) y la integración nativa la cubre U-19.
- Propuesta de la IA:
  1. **Alcance: Codex primero.** Claude queda cubierto por el Lote 1b y
     U-19; en U-15 solo se verifica su paridad.
  2. **Permiso de subagentes explícito en Codex.** Al autorizar una
     implementación N2 o N3 en Codex, en la misma pregunta de modo
     (supervisado o autónomo, D-26) se pide una vez el permiso para usar
     subagentes. Si el usuario lo niega o `spawn_agent` no está disponible,
     el trace lo dice ("ejecución inline: subagentes no autorizados") y se
     aplica la carga mínima por nivel (D-10). Nunca se cae a inline en
     silencio.
  3. **Modelo y esfuerzo por agente en Codex.** Primero se verifica en la
     documentación oficial de Codex si el TOML de un agente acepta `model` y
     `model_reasoning_effort`:
     - **si los acepta:** el generador los escribe desde el catálogo según
       el perfil del proyecto (D-05a: en suscripción, Mediano por defecto y
       Grande con razonamiento alto o máximo para implementadores,
       arquitecta-fases y qa-relampago), y el catálogo pasa a
       `pinSubagentModel: true`;
     - **si no los acepta:** se documenta el límite exacto y la alternativa
       (por ejemplo, el modelo de la sesión se elige según el nivel), igual
       que D-27 para Copilot.
  4. **Contexto distribuido.** La ventana del orquestador se protege con lo
     ya decidido: arranque mínimo de delegados (D-18), entregas compactas
     (D-15), lectura delegada del PRD e índice (D-17) y carga por nivel
     (D-10). U-15 verifica que todo eso funcione igual en Codex; no agrega
     mecanismos nuevos.
  5. **Verificación con evidencia, mismo patrón que D-27:**
     - **smoke controlado:** sondas de solo lectura a 3 agentes de distinto
       tier, comprobando el modelo ejecutado en el registro de sesión de
       Codex;
     - **ejecución real:** una implementación N2 o N3 en ooh-backoffice con
       Codex. Al cerrar se registran qué delegaciones corrieron como
       subagente y cuáles inline, y con qué modelo.
  6. **Paridad de flujos:** los ~10 prompts de prueba de D-01 (punto 7) se
     corren también en Codex y deben dar el mismo nivel y ruta que en Claude
     Code y Copilot.
- Decisión del usuario: aprobada (2026-11-10).

### D-29 · Referencias neutrales a la plataforma (U-20, Lote 7)

- Estado: **Decidida** (2026-11-10)
- Contexto:
  - 34 archivos de `.agents/` mencionan rutas de `.github/` y 25 mencionan
    `.claude/` o `.codex/`. Muchas son legítimas (matrices de adapters,
    checklist de paridad), pero otras están en el **flujo canónico**:
    - `implement-prd` exige el quality gate en
      `.github/instructions/quality-gate.instructions.md` y lee
      `.github/instructions/backend.instructions.md` si el slice toca
      backend;
    - los cavecrew leen `.github/copilot-instructions.md`.
  - Esos archivos de instrucciones (quality gate, backend, frontend) son del
    **proyecto**, no del kit, y hoy viven en una carpeta de Copilot. En un
    proyecto instalado solo para Claude Code o Codex no existen, y la regla
    "exists-or-skip" hace que **el quality gate se salte en silencio**.
  - El CLI soporta hoy 4 runtimes (codex, copilot, claude, antigravity).
    OpenCode, que la tabla menciona, no tiene adapter.
- Propuesta de la IA:
  1. **Ubicación neutral para las instrucciones del proyecto:**
     `.agents/project/quality-gate.md`, `backend.md` y `frontend.md`, junto a
     `.agents/project-context.md` (D-16). Los patterns siguen en
     `.agents/skills/06-patterns/`.
  2. **Los adapters se generan desde la fuente neutral.** Para Copilot, los
     `.github/instructions/*.instructions.md` se generan como copias (marcadas
     "generado, no editar") y conservan su `applyTo`, para no perder la
     carga automática por glob que hace Copilot. Cada runtime recibe lo
     equivalente en su formato.
  3. **Los skills solo nombran rutas neutrales.** Un check en
     `check:workflow` falla si un skill de `.agents/skills/` menciona una
     ruta de runtime fuera de una lista permitida (matrices de adapters,
     guías por runtime).
  4. **Nombres lógicos con mapa de rutas.** Un archivo de rutas (por ejemplo
     en `.agents/workflow-kit/`) traduce nombres lógicos (`quality-gate`,
     `backend-instructions`) a rutas reales. Un proyecto con otra estructura
     lo ajusta sin tocar skills.
  5. **Sin saltos silenciosos.** Si el quality gate no está configurado, el
     trace lo dice ("quality gate: no configurado") en vez de omitirlo. En
     slices de N3 eso se trata como parada.
  6. **Migración segura de proyectos existentes** (ooh-backoffice tiene sus
     instrucciones en `.github/instructions/`): `workflow-kit update` propone
     mover el contenido a la ubicación neutral y regenerar los wrappers,
     mostrando el diff y pidiendo confirmación. Nunca sobrescribe contenido
     propio del proyecto sin preguntar. `doctor` detecta proyectos sin
     migrar.
  7. **Runtimes nuevos (OpenCode y otros):** U-20 deja el núcleo neutral y
     agrega una guía de "cómo sumar un runtime" (adapter, entrypoint,
     capacidades de modelo). OpenCode entra con un adapter mínimo, porque ya
     lee `AGENTS.md`; el soporte completo de sus agentes y modelos se
     verifica en su documentación y, si vale la pena, va como ítem aparte.
- Decisión del usuario: aprobada (2026-11-10). El punto 5 (no saltar el
  quality gate en silencio) queda en el Lote 7 junto con el resto; se puede
  adelantar si el usuario lo pide.

### D-30 · Alcance de U-14: sacar reglas de frameworks del workflow (Lote 7)

- Estado: **Decidida** (2026-11-10)
- Contexto: los skills núcleo tienen el stack Rails + React escrito como
  regla, no como ejemplo:
  - `backend-phase-implementer`: "Rails API", "usa Minitest, no RSpec";
  - `acceptance-test-engineer`: Minitest, `Bullet` obligatorio, Vitest,
    Testing Library, MSW obligatorio;
  - `frontend-phase-implementer`: "React", TanStack Query v5, Vitest;
  - `create-prd`: Minitest, `enumerate_it`, variables Ruby,
    `BACKEND_STANDARDS.md`, "no usar RSpec";
  - `qa-handoff-review`: CanCanCan, Minitest;
  - `validation-and-stop-conditions`: comandos `make` en `backend/` y
    `bun run …` (12 menciones);
  - el router ya detecta la superficie React para decidir si carga
    `react-doctor`.

  En un proyecto con otro stack, estas reglas son incorrectas y obligan al
  delegado a "traducirlas" o a ignorarlas.
- Propuesta de la IA:
  1. **Alcance.** Entran los skills núcleo del workflow (`00-router`,
     `01-product`, `02-implement`, `03-quality`). Quedan fuera:
     - los skills de terceros (`impeccable`, `frontend-design`, caveman);
     - `06-patterns`, que ya es del proyecto;
     - las herramientas de stack (`react-doctor`, `playwright-testing`): se
       mantienen como capacidades que se cargan solo si se detecta ese
       stack, como ya hace el router con React.
  2. **Inventario y clasificación**, en el PR del lote. Cada regla se
     clasifica como:
     - **neutral del workflow:** se queda en el skill. Por ejemplo: "cada
       test se mapea a un criterio de aceptación", "las llamadas de red se
       mockean", "usar fixtures existentes";
     - **instrucción del proyecto:** pasa a `.agents/project/backend.md`,
       `frontend.md` o `quality-gate.md` (D-29). Por ejemplo: Minitest y no
       RSpec, Bullet, CanCanCan, `enumerate_it`, TanStack Query, MSW;
     - **comando del proyecto:** pasa a "comandos de validación" de
       `project-context.md` (D-16). Por ejemplo, los `make` y `bun run`;
     - **pattern:** un procedimiento repetitivo pasa a `06-patterns`.
  3. **Los skills quedan genéricos:** "usa el framework de tests y los
     comandos que declara el proyecto". Un nombre de framework solo aparece
     marcado como ejemplo ("p. ej.: Minitest").
  4. **Stack pack "rails-react" para no perder nada.** Las reglas que salen
     del núcleo se empaquetan en un template de stack que `init` y `update`
     ofrecen instalar, con confirmación. Los proyectos FHH (como
     ooh-backoffice) lo instalan y quedan con **exactamente las mismas
     reglas** que hoy. Otros stacks parten de instrucciones neutrales.
  5. **Garantía de que no se pierde ninguna regla**, mismo mecanismo que
     D-18: cada regla del inventario clasificada como "proyecto" o
     "comando" debe aparecer en el stack pack. Un check lo verifica. En
     ooh-backoffice se compara el conjunto de reglas efectivas antes y
     después de migrar.
  6. **Check automático:** `check:workflow` falla si un skill núcleo nombra
     un framework fuera de una lista permitida o sin la marca de ejemplo.
  7. **Orden:** U-14 va después de U-20 (necesita la ubicación neutral
     `.agents/project/`) y antes de U-10.
- Decisión del usuario: aprobada (2026-11-10).

### D-31 · Alcance del límite de 200 líneas (U-10, Lote 7)

- Estado: **Decidida** (2026-11-10)
- Contexto: de 86 archivos `.md` propios del kit (sin contar impeccable,
  frontend-design ni caveman), **12 superan 200 líneas**:

  | Tipo | Archivos (líneas) |
  | --- | --- |
  | `SKILL.md` | workflow-router (646, ya se divide en el Lote 1 por D-06), create-prd (373), implement-prd (301), document-development (239), create-epic (234), generate-pm-ticket (229), project-formation (209) |
  | Referencias | handoff-schemas (325), orchestration-flow (271) |
  | Templates | PRD_TEMPLATE (294), epic-template (259) |
  | Generados | registry.md (204) |

  Los skills de terceros también tienen archivos largos (por ejemplo,
  `impeccable/reference/live.md`, 622 líneas).
- Propuesta de la IA:
  1. **El límite aplica a `SKILL.md` y a las referencias propias.** Las
     referencias existen justamente para "leer solo lo necesario"; si una
     referencia es larga, se pierde ese beneficio.
  2. **Templates: se dividen por condición de uso, no por conteo.** El
     template del PRD va a crecer con las secciones nuevas de D-21
     ("Supuestos e integraciones") y D-22 ("Qué queda obsoleto"). Se separa
     en un **núcleo** (secciones siempre obligatorias) y **secciones
     condicionales** (Contrato Visual solo si `visible_ui: yes`, supuestos
     solo si hay integraciones, Contrato entre Fases solo si hay épica
     padre). El núcleo cumple las 200 líneas y cada PRD carga solo lo que
     usa. Lo mismo para el template de épica.
  3. **Exentos:** skills de terceros (impeccable, frontend-design, caveman),
     porque dividirlos rompería sus actualizaciones desde el original, y los
     archivos generados (`registry.*`, adapters).
  4. **Dividir por condición de carga, no a ciegas.** Cada archivo nuevo
     declara al inicio "cuándo leerlo", y el índice (`SKILL.md`) lo repite.
     Si dos partes siempre se leen juntas, no se separan: partirlas solo
     agrega lecturas. Esos casos quedan en una lista de excepciones, cada
     una con su motivo.
  5. **Las reglas obligatorias quedan en el índice**, como pide U-10. Se
     aplica el mismo mecanismo de D-18: un inventario de reglas antes y
     después de dividir confirma que ninguna se perdió.
  6. **Check automático:** `check:workflow` falla si un archivo dentro del
     alcance supera 200 líneas sin estar en la lista de excepciones, o si
     una referencia no tiene su condición de carga.
  7. **Medir el beneficio.** Se compara cuántas líneas se cargan en un flujo
     N2 y uno N3 antes y después. Si una división aumenta las lecturas sin
     ahorrar contexto, se revierte esa división.
  8. **Orden:** se mantiene al final del Lote 7, como se decidió en D-04.
- Decisión del usuario: aprobada (2026-11-10).

### D-32 · Notas docentes selectivas (IA-12, Lote 7)

- Estado: **Decidida** (2026-11-10)
- Contexto: hay tres fuentes de notas docentes hoy:
  - `implement-prd`, "Teaching And Challenge Loop": una nota "Aprendizaje
    recomendado" **al final de cada fase relevante**; en la práctica, en
    todas;
  - los handoffs de los delegados llevan un campo `learning` (puede ser
    `none`), y el de QA un `teaching_note` **obligatorio**;
  - el router aplica "teach, challenge, improve" en las solicitudes
    sustanciales.

  Cuando no hubo decisiones relevantes, la nota repite generalidades y suma
  texto sin aportar.
- Propuesta de la IA:
  1. **La nota sale solo si hubo una decisión relevante en la fase:**
     - un trade-off con una alternativa descartada (`trade_off` distinto de
       `none`);
     - un desafío de critical-stance que cambió algo;
     - una abstracción nueva;
     - un riesgo aceptado o una escalada de nivel;
     - un hallazgo de QA `high` o `critical`.

     Sin nada de eso, no se escribe nada (ni siquiera "Aprendizaje:
     ninguno").
  2. **Al cierre, una nota consolidada** de máximo 3 puntos con lo más
     valioso de toda la implementación. Reemplaza a las notas por fase que
     no tuvieron nada destacable.
  3. **A pedido:** si el usuario dice "explícame" o pide modo docente, se
     vuelve al comportamiento actual (nota en cada fase).
  4. **Preferencia por proyecto:** `notas docentes: selectivas` (por
     defecto), `siempre` o `nunca`. Un equipo con desarrolladores junior
     puede elegir `siempre`. Se cambia cuando se quiera, igual que el perfil
     de modelos (D-07).
  5. **Delegados:** los campos `learning` y `teaching_note` pasan a ser
     opcionales y se omiten cuando no hay nada que decir (compatible con las
     entregas compactas de D-15). El orquestador reúne los aprendizajes de
     los delegados, quita duplicados y decide cuáles llegan al usuario.
  6. **Router:** "challenge" e "improve" se mantienen, porque afectan la
     calidad. "Teach" queda solo para decisiones relevantes en N2 y N3,
     nunca en N0 ni N1 (coherente con la visibilidad de D-01).
  7. **El formato no cambia** (Concepto, Por qué importa, Decisión o
     desafío). Las notas van en el chat; no se guardan en la sección 10,
     porque las decisiones ya quedan en sus propias tablas.
- Decisión del usuario: aprobada (2026-11-10).

### D-33 · Lote 8 de cierre: documentación, actualización segura y release

- Estado: **Decidida** (2026-11-10)
- Origen: pedido del usuario: cuando todo esté listo, hacer el PR y el
  commit, actualizar el README y toda la documentación relevante (guías,
  tutoriales), y actualizar el TUI para que las instalaciones existentes se
  actualicen sin romper nada.
- Contexto:
  - Ya existen `docs/quickstart.md`, `migration.md`, `troubleshooting.md`,
    `versioning.md`, `release-plan.md`, `get-started-existing-repo.md`,
    `docs/workflow/**` y `RELEASE.md`. `check:docs` exige secciones mínimas
    en el README.
  - El CLI y el TUI ya tienen planner con `overwrite_with_backup`,
    `rollback`, `upgrade` del binario, `install-state.json` con el hash de
    cada archivo instalado, y tests (`tui-*.test.mjs`, `upgrade.test.mjs`).
  - `versioning.md` ya exige subir `package.json.version` en cada merge que
    toque el núcleo, los templates, los adapters, el planner, `doctor` o el
    TUI.
  - Los lotes 1 a 7 cambian cosas que rompen instalaciones existentes si se
    actualizan sin cuidado: el renombre de `implement-prd` (D-08), las rutas
    nuevas `.agents/project/` (D-29), el stack pack (D-30), los templates
    divididos (D-31), los modelos en los adapters (D-07) y
    `project-context.md` (D-16).
- Propuesta de la IA:
  1. **Documentación en dos niveles:**
     - **en cada lote:** el PR del lote actualiza la documentación que
       cambia directamente y sube la versión, como ya exige
       `versioning.md`. Así la documentación nunca queda semanas atrasada
       respecto del código;
     - **en el Lote 8:** una pasada completa y consolidada sobre el README,
       quickstart, guías, tutoriales, runbooks, troubleshooting, la guía de
       migración y los flujos humanos de `docs/workflow/`. Si hay
       presentaciones que describen el workflow, también.
  2. **Chequeo de nombres viejos.** Antes del release, una búsqueda verifica
     que la documentación no mencione nombres o rutas obsoletas
     (`implement-prd` sin alias, `.github/instructions` como fuente,
     `model: inherit`, etc.). Es U-06 aplicado al propio kit.
  3. **Actualización segura de instalaciones (CLI y TUI):**
     - **migraciones versionadas e idempotentes:** cada cambio de
       estructura (mover, renombrar, eliminar, generar) es una migración con
       versión, que se puede correr dos veces sin efecto;
     - **plan antes de aplicar:** el TUI muestra qué se crea, actualiza,
       mueve, elimina y qué tiene conflicto, con el diff. Nada destructivo
       sin confirmación;
     - **respeto por lo editado:** con los hashes de `install-state.json` se
       detectan archivos modificados por el proyecto. Para cada uno se
       ofrece: conservar el mío, tomar el nuevo o ver el diff y combinar.
       Nunca se sobrescribe en silencio;
     - **respaldo y rollback:** cada actualización crea un punto de
       restauración y `rollback` lo deshace completo;
     - **preguntas nuevas con valores por defecto:** el TUI pregunta lo que
       introdujeron los lotes (perfil de modelos D-07, stack pack D-30,
       notas docentes D-32, preferencia de sketch de UI D-23, umbrales de
       PRD D-25). Cada pregunta tiene un valor por defecto, así `--yes`
       sigue funcionando sin interacción;
     - **`doctor` después de actualizar:** corre todos los checks nuevos
       (contrato de delegados, rutas neutrales, quality gate configurado,
       límite de líneas, frameworks en el núcleo) y lista lo que falte
       migrar.
  4. **Pruebas de actualización:**
     - tests de extremo a extremo que parten de un proyecto con la estructura
       de la versión anterior (incluido un caso como ooh-backoffice, con
       instrucciones propias en `.github/instructions/`), actualizan y
       verifican que `doctor` quede limpio y que el contenido propio se
       conserve;
     - los mismos tests para cada runtime (Claude Code, Codex, Copilot,
       Antigravity).
  5. **Piloto real antes del release:** se actualiza ooh-backoffice en una
     rama, se corre un flujo N2 completo y recién entonces se publica.
  6. **Versión y notas de release:** los cambios rompen rutas instaladas,
     así que corresponde una versión mayor (o el salto que defina
     `versioning.md` mientras siga en `0.x`). El release incluye un
     changelog con la guía de migración paso a paso.
  7. **PR y commit:** el Lote 8 cierra con un PR de release. Usa el propio
     workflow del kit, y el commit y el PR se hacen con la aprobación
     explícita del usuario, como cualquier otro lote.
  8. **Dependencias:** el Lote 8 va después del Lote 7. La parte de
     migraciones del CLI y del TUI se puede ir construyendo durante los
     lotes, cada vez que un lote introduce un cambio de estructura, para no
     acumularla toda al final.
- Decisión del usuario: aprobada (2026-11-10).

## 6. Decisiones por abrir en lotes futuros

Se registran acá para no olvidarlas. Cada una pasa a la sección 5 cuando se
discuta.

- Ninguna. Todas las decisiones quedaron tomadas el 2026-11-10 (D-00 a
  D-33). Si al implementar aparece una duda nueva, se agrega aquí.

## 7. Bitácora de implementación

| Fecha | Lote | Ítems | PR | Resultado | Validación |
| --- | --- | --- | --- | --- | --- |
| 2026-11-10 | 1 | U-03, U-18, U-09 (router), IA-03, U-19a | #61 (reemplaza a #57) | Niveles N0–N3 y pre-filtro como fuente única en `instructions.md`; copia generada en `CLAUDE.md`, `AGENTS.md`, `copilot-instructions.md` y `ANTIGRAVITY.md` (`scripts/sync-level-prefilter.mjs`, en `check:workflow`); router dividido en núcleo de 193 líneas + `route-menus.md`, `route-gates.md` y `router-evals.md` (12 prompts de prueba); N1 quirúrgico ofrecido explícitamente; heurísticas de delegación movidas a `model-routing`; referencia rota eliminada; `doctor` avisa si un adapter perdió el pre-filtro; docs actualizadas; versión `0.8.0-proportional-loading`. Sin migración: solo archivos nuevos o actualizados (verificado con smoke de update desde 0.7.40). | `node --test` 209/209; `check`, `check:workflow`, `check:templates`, `check:docs`, `check:release` y `check:legal` OK. `check:security` falla también en `main` (advisory nuevo de `dompurify`), ajeno al lote. Evals: L01 PASS en Claude Code (N0, sin trace, 3 llamadas). Pendiente: L02–L12 en Claude Code y L01–L12 en Codex y Copilot. |
| 2026-11-10 | 1b | D-05a, D-07, D-12, U-19b, U-04 (rehacer), U-02 (preparación de D-27) | #61 (reemplaza a #58) | Perfiles `calidad`/`costo` en el catálogo (`modelProfiles`) con default por runtime; módulo único `src/model-profiles.mjs` que genera los agentes de Claude (`sonnet`/`opus`, `haiku` solo en `costo`), Codex (`model_reasoning_effort`) y Copilot (listas por tier) tanto en el kit como al instalar; `init` pregunta suscripción o API para Claude Code y Codex (la API key solo preselecciona), `--profile <runtime>=<perfil>`, el perfil queda en `install-state.json` y `update` lo conserva; `doctor` muestra el perfil y falla con `model-profile/agent-mismatch`; política de perfiles y fallback D-12 en `model-routing`; `document-development` según perfil (U-04); tabla de modelos ejecutados en el cierre con Copilot y guía de verificación real (D-27); capacidades corregidas (`claude.pinSubagentModel=true`, `codex.pinSubagentTier=true`); versión `0.9.0-model-profiles`. | `node --test` 215/215; `check`, `check:workflow`, `check:templates`, `check:docs`, `check:release`, `check:legal` OK. Smoke de update desde 0.7.40: con y sin `--profile`, `doctor` ok y modelos correctos por agente. Pendiente: pruebas A y B de U-02 en Copilot (las corre el usuario). |
| 2026-11-10 | 2 | U-11, U-08, U-09 (ejecución), IA-02, D-26 | #61 (reemplaza a #60) | Nueva skill `implement-change` (núcleo de 130 líneas) con dos ejes: nivel (ceremonia) y tipo de entrada (evidencia); referencias `level-n1.md`, `level-n2.md`, `level-n3.md`, `input-types.md` y `modifiers.md` que se leen solo cuando aplican; los modos antiguos se mapean a niveles y `autonomous-safe`/`resume` pasan a modificadores; invariantes y cierre por nivel en el núcleo; iteración por delta con la sección 10 como mapa, frescura por `git diff` y regresión del feature original; bug sin reproducción se detiene; modo autónomo ofrecido por ejecución con supervisado por defecto (D-26, ajuste de D-25); `implement-prd` queda como alias permanente; router, gates y evals (L13 iteración, L14 bug) apuntan a `implement-change`; versión `0.10.0-implement-change`. | `node --test` 221/221; `check`, `check:workflow`, `check:templates`, `check:docs`, `check:release`, `check:legal` OK. Smoke de update desde 0.7.40: crea `implement-change/`, reescribe el alias, registro con ambas entradas, `doctor` ok. |
| 2026-11-10 | 3 | U-17, U-16, IA-11, IA-08, IA-07 | #62 | Frenos en todos los niveles que el modo autónomo no levanta: tope de 2 rondas de reparación por slice, un intento de recuperación ante falla de entorno, un rerun para flaky, suite cara completa una sola vez y tests proporcionales (D-11); tracker como foto del estado con `events.log` aparte y sección 10 como resumen con hallazgos `critical`/`high` listados y el resto en conteos (D-13); espacio de trabajo único `.ai-work/<prd-slug>/` ignorado por git, con `_meta/` como respaldo de solo lectura, entrada en `.gitignore` agregada por el instalador y avisos en `doctor` (D-14); entregas compactas con envelope de retorno de 6 campos, solo la falta de evidencia bloquea y logs acotados a ~30 líneas por falla (D-15); nombres de modo antiguos reemplazados por niveles en las referencias compartidas; versión `0.11.0-execution-brakes`. Sin migración que mueva archivos. | `node --test` 224/224; `check`, `check:workflow`, `check:templates`, `check:docs`, `check:release`, `check:legal`, `check:security` OK. Smoke de update desde 0.7.40: `.gitignore` con `.ai-work/`, `doctor` ok. |
| 2026-11-10 | 5 | U-12, IA-04, IA-05, IA-06, IA-01 | #62 | `.agents/project-context.md` como base de conocimiento fija (plantilla que el instalador crea una vez y nunca sobrescribe; Discovery la lee primero y entrega un delta; solo el orquestador la actualiza al cierre; `doctor` avisa si sigue siendo plantilla, supera 200 líneas o apunta a rutas inexistentes; Engram queda como captura opcional) (D-16); en N2 una sola pasada inline con tres veredictos y definición de "incertidumbre concreta"; en N3 índice del PRD con huella, verificado con `verify-prd-index.mjs` al crearse y contrastado por QA (D-17); contrato de delegados único en `.agents/delegation/delegate-contract.md`, con resumen generado en los 39 adapters, inventario de reglas y `validate-delegate-contract.mjs` en `check:workflow`; matcher proporcional (D-18); versión `0.12.0-cheaper-preparation`. | `node --test` 230/230; todos los `check:*` OK. |
| 2026-11-10 | 4 | U-13, IA-09, IA-10 | #62 | `validation-fingerprint.mjs` calcula la huella (archivos del alcance, lockfiles, configuración, código generado, migraciones, versiones) y decide reutilizar: solo typecheck, suites unitarias y build; ampliación de alcance solo en lint y tipos; nunca integración, E2E, slices críticos ni la suite del cierre; arranca en modo sombra (D-20, IA-09). QA incremental: primera completa, reentrada enfocada con radio de impacto determinístico, gatillos de revisión completa, cobertura acumulada y calibración única (IA-10). U-13: matriz declarada publicada; la matriz observada y sus hallazgos esperan aprobación uno a uno (D-19). Versión `0.13.0-validation-reuse`. | `node --test` 234/234; todos los `check:*` OK. Ningún check se eliminó. |
| 2026-11-10 | 6 | U-07, U-06, U-01, U-05, D-25 | #62 | `create-prd`: ronda de casos borde por confirmación, presupuesto de preguntas (~10 por ronda, máximo 3 rondas), inventario de incógnitas con prueba exploratoria aprobada por el usuario, secciones nuevas `2.8 Supuestos e integraciones` y `2.9 Que queda obsoleto`, causa de iteración en la sección 10 (D-21, D-22); señales de tamaño con `prd-size-signals.mjs` y propuesta de dividir con 2 o más (D-25); lo obsoleto y los supuestos se siguen en Discovery, slicing y QA con búsqueda de verificación; `solution-sketch` con caminos de UI opcionales ofrecidos al entrar (vista nueva, crítica, diseño del equipo, sin parte visual), mockups HTML en dos etapas y máximo 3 rondas visuales (D-23); `pr-comments-resolution` evalúa cada comentario antes de ofrecer opciones, con veredicto, respuestas con fundamento aprobadas por el usuario, triage y regla de simetría en critical-stance (D-24); versión `0.14.0-prd-pr-quality`. | `node --test` 239/239; todos los `check:*` OK. |
| 2026-11-10 | 7 | U-20, U-14, U-10, IA-12, U-15, U-19c | #62 | Instrucciones del proyecto en `.agents/project/` (quality gate, backend, frontend, `paths.json`), con copia generada para Copilot que conserva `applyTo`, migración de instrucciones escritas a mano con respaldo, regla de no saltar el quality gate en silencio y `validate-neutral-paths.mjs` (D-29); reglas de Rails y React fuera de las skills núcleo y dentro del stack pack `rails-react`, que las instalaciones previas reciben por defecto, con inventario de 28 reglas y `validate-stack-neutrality.mjs` (D-30); ningún archivo propio de skill supera 200 líneas, con 3 excepciones justificadas y `validate-skill-size.mjs` (D-31); notas docentes selectivas con preferencia por proyecto (D-32); reglas de delegación por runtime, sin caída silenciosa a inline, y guía de verificación para Codex (D-28); skills nativas de Claude Code con `disable-model-invocation` (U-19c); runtime `opencode` vía `AGENTS.md`; versión `0.15.0-neutral-structure`. | `node --test` 256/256; todos los `check:*` OK. Smoke de update desde 0.7.40 con instrucciones propias en `.github/instructions/`. |
| 2026-11-10 | 8 | D-33 | #62 | El plan de `init` y `update` lista las migraciones que lleva (idempotentes: desaparecen una vez aplicadas) y `--diff` muestra el diff de cada archivo que cambiaría, incluidos los editados localmente; el TUI pregunta el stack pack al instalar y corre `doctor` después de aplicar; tests de actualización de punta a punta desde la estructura antigua para Claude Code, Codex, Copilot, Antigravity y los tres juntos (contenido propio conservado, `doctor` sin errores, segundo update sin escrituras); pasada de documentación (README, guías, runbooks, plantilla de instrucciones, slides) con búsqueda de nombres y rutas obsoletas; `CHANGELOG.md`; versión `0.16.0-safe-update`. | `node --test` 264/264 en serie; todos los `check:*` OK. Vista previa en seco contra ooh-backoffice (sin escribir): 54 archivos nuevos, 73 actualizados con respaldo, 1 protegido. |
| 2026-11-10 | Cierre | Pendientes posteriores (sección 8), U-13 (C1) | PR de cierre (rama `docs/roadmap-cierre`) | Hallazgos de U-13 aprobados y C1 aplicado en la ronda de casos borde de `create-prd`; guía del piloto manual en ooh-backoffice, escrita a partir de un ensayo sobre una copia; dos correcciones encontradas en ese ensayo (un archivo protegido que ya es igual a la versión nueva queda `unchanged`; `doctor` avisa `skills/local-catalog-missing-skill`); sección "Per-project setup after installing" en el README y punteros en las guías; verificaciones de Copilot y Codex diferidas; versión `0.16.1-roadmap-closure`. | `node --test` 266/266 en serie; todos los `check:*` OK. Ensayo sobre la copia: `doctor` sin errores, reglas de proyecto idénticas, segundo update sin escrituras. El piloto real sigue sin ejecutarse. |

Proceso (2026-11-10):

- `check:security` fallaba en `main` por advisories nuevos de `dompurify`,
  `zod` y `markdown-it`, y bloqueaba la CI de todos los PRs. Se corrigió en
  #59 (mergeado) subiendo versiones; no hizo falta ningún parche local.
- Por pedido del usuario se dejó un PR único (#61) con un commit por lote, en
  vez de un PR por lote. Se cerraron #57, #58 y #60, cuyo contenido quedó
  rebasado sobre `main` en #61.
- A pedido del usuario se retiró la presentación Slidev del repositorio
  (`slides.md`, sus scripts y su paso de CI) junto con sus dependencias de
  desarrollo, los tres parches locales y los siete overrides que existían solo
  para ese árbol. Los avisos de seguridad que rompieron la CI venían de ahí.
  La presentación para equipos vive ahora fuera del repositorio. Versión
  `0.16.2-remove-slidev`.

Hallazgos del Lote 8:

- **La vista previa en ooh-backoffice encontró un caso real:** sus
  instrucciones de Copilot usan `applyTo` como lista YAML de varias líneas y
  la primera versión solo leía el formato de una línea, así que no regeneraba
  esos archivos. Ahora el frontmatter se conserva tal cual (test agregado).
- **Piloto (D-33, punto 5):** es manual y lo ejecuta el usuario con la
  [guía del piloto](2026-11-10-piloto-ooh-backoffice.md). Condiciona el
  release, no el cierre de la implementación (sección 8).
- **No se implementó** un asistente de fusión línea a línea en el TUI: para un
  archivo editado, el TUI ofrece proteger o sobrescribir con respaldo, y
  `--diff` muestra las diferencias para combinarlas a mano.
- **Versión:** se mantiene en `0.x` (`0.16.0`), como define `docs/versioning.md`
  mientras el paquete no esté aprobado para publicación.

Hallazgos del Lote 7:

- **Beneficio medido (D-31, punto 7), en líneas de política cargadas** contra
  el estado anterior al roadmap:

  | Flujo | Antes | Ahora | Cambio |
  | --- | --- | --- | --- |
  | N0 (consulta o cambio no semántico) | 1067 | 18 (pre-filtro del adapter) | −98 % |
  | N1 (cambio quirúrgico) | 1368 | ~214 | −84 % |
  | N2 | 1553 | ~1185 | −24 % |
  | N3, orquestador | 2257 | ~2070, cargadas por etapa | −8 % |
  | Arranque de cada delegado | 517 | 161 | −69 % |

  El ahorro grande está en N0, N1 y en los delegados. En N3 el orquestador
  casi no baja, porque `instructions.md` creció con los niveles; ahí la ganancia
  viene de los delegados y de leer las referencias por etapa.
- **No se dividieron** `instructions.md` (473 líneas) ni
  `model-routing/README.md` (472): no son archivos de skill y U-10 no los
  cubre. Son candidatos para una pasada posterior.
- **Plantillas:** la del PRD separó sus secciones condicionales (épica padre y
  Contrato Visual) y quedó en 261 líneas; ella y la plantilla de épica son
  excepciones justificadas porque se copian completas al redactar.
- **Skills de terceros** (impeccable, frontend-design, caveman) quedan fuera de
  los tres validadores nuevos, para no romper su inventario de integridad.
- **Tests que llenaban el disco:** cada corrida de la suite dejaba más de cien
  repos temporales de ~2 MB en la carpeta temporal del sistema y nunca los
  borraba; tras muchas corridas el disco se llenó (4001 carpetas, 6,2 GB). Los
  tests ahora borran sus temporales al terminar cada archivo. Las 4001
  carpetas viejas `workflow-kit-*` se borraron el 2026-11-10 a pedido del
  usuario.
- **U-15 (Codex):** la documentación oficial dice que Codex lanza subagentes
  tras un pedido directo o una instrucción aplicable de un skill, así que no
  hace falta un permiso aparte: `implement-change` es esa instrucción. Queda
  la verificación real (smoke y ejecución) a cargo del usuario.

Hallazgos del Lote 4:

- **U-13 no recomienda eliminar ningún check.** En ~300 ejecuciones de 3 PRDs
  de ooh-backoffice hubo ~19 duplicados exactos y ~23 solapamientos, casi
  todos re-ejecuciones de suites caras sobre contenido idéntico. Ninguna
  repetición sobre contenido idéntico detectó un defecto de producto. La
  reutilización por huella (IA-09) cubre esos casos sin borrar nada. Detalle y
  hallazgos por aprobar en `docs/plans/2026-11-10-u13-validation-coverage-matrix.md`.
- **Un defecto escapó en ds-04** (commit `5786c472b` de ooh-backoffice): un
  escenario de interacción sin test. Es un caso para la ronda de casos borde
  del PRD, no un check faltante del workflow.

Hallazgos del Lote 5:

- **Skills de terceros exentos del contrato:** los tres helpers cavecrew
  (`05-caveman`) siguen leyendo `.github/copilot-instructions.md`. Son código
  de terceros con inventario de integridad en `docs/legal/third-party/`, así
  que no se editan; sus adapters generados sí llevan el resumen del contrato.
- **Rutas de capa pendientes:** los skills delegados aún nombran
  `.github/instructions/*` para el quality gate y las instrucciones de backend
  y frontend. Eso lo resuelve U-20 (Lote 7).
- **Primera versión de `project-context.md`:** la crea una tarea N2 por
  proyecto; en ooh-backoffice queda pendiente del usuario.

Hallazgos del Lote 3:

- El aviso de `doctor` sobre un PRD cerrado con espacio de trabajo vivo solo
  informa; ofrecer el borrado desde el TUI queda para el Lote 8 (D-33).
- La limpieza de los `_meta/` que ya existen en ooh-backoffice sigue siendo una
  tarea aparte de ese proyecto; `doctor` los lista como `workspace/legacy-meta`.

Hallazgos del Lote 2:

- **Directorio conservado:** `implement-change` vive en su propio directorio y
  `implement-prd/SKILL.md` pasa a ser un alias de pocas líneas; las referencias
  compartidas (flujo de orquestación, matriz de delegados, prompts, handoffs,
  tracker, validación) siguen en `implement-prd/reference/`. Así las 73
  menciones existentes siguen siendo válidas, las instalaciones no necesitan
  una migración que mueva o borre archivos, y el registro no repite rutas.
  Unificar la ubicación queda para U-20/U-10 (Lote 7) con su migración (D-33).
- **Texto heredado:** `validation-and-stop-conditions.md` y
  `orchestration-flow.md` todavía nombran los modos antiguos. El núcleo trae la
  tabla de equivalencias; el Lote 3 reescribe esas referencias al aplicar D-11
  y D-13.

Hallazgos del Lote 1b:

- **Bug previo corregido:** `workflow-kit update` sin `--runtime` ignoraba los
  runtimes guardados y trataba el repo como `neutral`, porque el parser fijaba
  `runtime: 'neutral'` por defecto. El comando que recomienda el README nunca
  actualizaba adapters ni agentes. Ahora `update` y `doctor` reutilizan los
  runtimes de `install-state.json` (test de regresión agregado).
- **Codex sí permite fijar modelo por agente:** la documentación oficial de
  Codex confirma que `.codex/agents/*.toml` acepta `model` y
  `model_reasoning_effort`, que tienen prioridad sobre el padre; sin ellos el
  subagente hereda modelo y esfuerzo de la sesión. El kit fija solo el esfuerzo
  porque los IDs de modelo cambian entre versiones. Para D-28: la misma
  documentación dice que Codex lanza subagentes "tras un pedido directo o una
  instrucción aplicable del proyecto o de un skill", así que el punto del
  permiso se reformula al implementar el Lote 7.
- **Actualizar cambia los agentes de Claude Code** de `model: inherit` a
  `sonnet`/`opus` en proyectos sin perfil guardado. Está documentado en
  `docs/migration.md`; quien use Claude Code por API debe pasar
  `--profile claude=costo` en ese update.

Hallazgos del Lote 1:

- **Bug previo corregido:** cualquier `workflow-kit update` (incluso sin cambio
  de versión) duplicaba `add-project-pattern` e `init-legacy-attachments` en
  `registry.json` y dejaba `doctor` en error. Causa: los patterns de fábrica se
  "redescubrían" con otra `key`. El merge ahora usa la ruta del skill como
  identidad y repara instalaciones ya dañadas (test de regresión agregado).
- **Adapters personalizados:** si un proyecto editó `CLAUDE.md` u otro adapter,
  `update` lo protege (`skip_modified`) y queda sin pre-filtro. `doctor` ahora
  lo avisa (`adapter/missing-level-prefilter`). La fusión asistida queda para
  el TUI del Lote 8 (D-33).
- **Registro legal:** el inventario del overlay en
  `docs/legal/overlay-authorship.json` se renovó (131 → 134 archivos, todos
  propios del kit), conservando la clasificación y la declaración del
  mantenedor.

## 8. Cierre del roadmap y pendientes posteriores

La implementación quedó cerrada el 2026-11-10: los 8 lotes están en `main`
(#61 y #62). Nada de lo que sigue bloquea ese cierre. El usuario revisó cada
pendiente el 2026-11-10 y decidió lo siguiente.

| # | Pendiente | Decisión del usuario | Estado | Dónde seguir |
| --- | --- | --- | --- | --- |
| 1 | Piloto real en ooh-backoffice (D-33, punto 5) | Se hace a mano; basta con dejar una guía | Guía escrita; piloto sin ejecutar. Es la condición para publicar un release (`RELEASE.md`) | [Guía del piloto](2026-11-10-piloto-ooh-backoffice.md) |
| 2 | Hallazgos de U-13 (H1 a H4, C1 a C2) | Aprobadas las recomendaciones | Hecho: ningún check se elimina; C1 aplicado en `create-prd`; C2 pasa a la guía del piloto | [Matriz de validación, sección 5](2026-11-10-u13-validation-coverage-matrix.md) |
| 3 | Verificar el modelo por subagente en Copilot (U-02) y la ejecución real en Codex (U-15) | No puede hacerlo ahora; se espera | Diferido. U-02 y U-15 siguen en `Verificar` | `docs/workflow/copilot-subagent-model-routing.md` (sección 7) y `docs/workflow/codex-subagent-verification.md` |
| 4 | Prompts de nivel L01 a L14 en cada runtime | Se prueban en el uso real | Sin corrida dedicada. Evidencia observada: solo L01 en Claude Code. `check:workflow` valida la tabla y que el pre-filtro sea igual en todos los adapters, no el comportamiento del modelo | `.agents/skills/00-router/workflow-router/reference/router-evals.md`; paso 7 de la guía del piloto |
| 5 | Tareas de cada proyecto: llenar `.agents/project-context.md`, modo sombra antes de activar la reutilización de checks y calibración única de QA | Son por proyecto y no afectan el cierre; deben quedar a la vista de cualquier usuario | Documentado. `doctor` lo recuerda con `project-context/not-initialized` | README, sección "Per-project setup after installing" |

Si en el uso real un prompt se clasifica en un nivel equivocado (pendiente 4),
se anota el prompt, el runtime y la respuesta, y se corrige el pre-filtro en
`.agents/instructions.md`, que es la fuente única; `scripts/sync-level-prefilter.mjs`
regenera las copias de los adapters.

### Hallazgos del ensayo del piloto (2026-11-10)

Para escribir la guía se aplicó el update sobre una copia de los archivos de
workflow de ooh-backoffice (el repositorio real no se tocó). El resultado fue
sano: `doctor` sin errores, reglas de proyecto migradas sin cambios de texto,
`applyTo` conservado y segundo update sin escrituras. Aparecieron dos
problemas, corregidos en el PR de cierre:

- **Un archivo protegido no se podía dar por resuelto.** Si el proyecto
  copiaba a mano la versión nueva de un archivo que había editado, `update`
  lo seguía marcando `skip_modified` y `doctor` seguía avisando
  `managed/content-drift`, porque se comparaba contra el hash guardado y no
  contra el contenido nuevo. Ahora un archivo igual a lo que el kit escribiría
  queda `unchanged` y su hash se registra (test agregado).
- **Los catálogos de skills propios quedaban desactualizados sin aviso.** Un
  proyecto que mantiene su `.agents/skills/index.md` y `registry.md` (como
  ooh-backoffice, que lista una skill local) no recibe la fila de una skill
  nueva, y el router descubre skills por el índice. Sumado al
  `implement-prd/SKILL.md` protegido, "implementa este PRD" habría seguido
  cargando el orquestador antiguo. `doctor` ahora avisa con
  `skills/local-catalog-missing-skill` y nombra las skills que faltan (test
  agregado). Agregar la fila sigue siendo manual, porque el catálogo es del
  proyecto.
