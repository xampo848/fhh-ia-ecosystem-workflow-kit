# PRD: [Feature Name]

**Ticket**: [User story or ticket reference]
**Autor**: [Team or person]
**Fecha**: [Date]
**Estado**: Borrador | En revision | Aprobado

---

## 1. Contexto y Objetivo

[2-3 sentences: what problem this solves, what the user wants to achieve]

> **Alcance estricto**: [Clear statement of what IS and is NOT in scope for this PRD]

**Sketch heredado**: `docs/design/<slug>-sketch.md` | No aplica | `sketch: skipped`
**UI lock**: locked | not-applicable | missing
**Visible UI**: Si | No

_Si el PRD pertenece a una epica, insertar aqui las secciones "Contexto de Epica Padre" y "Contrato entre Fases" desde `template-sections/epic-context.md`. Si no, omitirlas._

### Estado Actual

| Capa                | Componente  | Archivo           |
| ------------------- | ----------- | ----------------- |
| [Model/Service/...] | [ClassName] | [path/to/file.rb] |

### Columnas/Estado Actuales en [TableName]

[List existing columns/fields relevant to the feature]

---

## 2. Requerimientos Funcionales

### 2.1 [Requirement Group 1]

[Table of new columns, fields, or parameters]:

| Campo origen | Campo BD | Tipo | Nullable | Descripcion |
| ------------ | -------- | ---- | -------- | ----------- |
| ...          | ...      | ...  | ...      | ...         |

### 2.2 Regla de Negocio: [Name]

> **Decision confirmada**: [Exact business rule, in one clear paragraph]

**Condicion de aplicacion**: [When does the rule trigger?]
**Entidad de agrupacion**: [What identifies a group? e.g. (id_elemento, month)]
**Campos afectados**: [Exhaustive list]
**Campos NO afectados**: [Exhaustive list with reason]
**Almacenamiento**: [What gets persisted - raw, computed, or both]

### 2.3 Criterios de Aceptacion

| ID | Given | When | Then | Evidence expected |
| --- | --- | --- | --- | --- |
| AC-1 | [Precondition] | [Action/event] | [Observable result] | [Test/contract/smoke evidence] |

### 2.4 Casos de Uso

| ID | Actor | Precondiciones | Flujo principal | Resultado observable (falsable) | AC vinculado |
| --- | --- | --- | --- | --- | --- |
| UC-1 | [Actor] | [Precondition] | [Main flow steps] | [Falsifiable observable result] | AC-1 |

### 2.5 Estrategia de Tests

| Nivel | Objetivo | Caso de uso vinculado | Cobertura esperada | Comando o mecanismo de validacion |
| --- | --- | --- | --- | --- |
| Unidad/Integracion/Contrato/Smoke/E2E | [What this proves] | UC-1 | [Expected coverage] | `[exact command]` |

### 2.6 Matriz de Edge Cases

| Categoria | Descripcion | Caso de uso vinculado | Validacion | Estado |
| --- | --- | --- | --- | --- |
| Datos vacios | [Scenario] | UC-1 | [Test/contract/smoke/evidencia manual] | Pending |
| Limites | [Scenario] | UC-1 | [Test/contract/smoke/evidencia manual] | Pending |
| Errores | [Scenario] | UC-1 | [Test/contract/smoke/evidencia manual] | Pending |
| Permisos/tenancy | [Scenario] | UC-1 | [Test/contract/smoke/evidencia manual] | Pending |
| Concurrencia/orden | [Scenario] | UC-1 | [Test/contract/smoke/evidencia manual] | Pending |
| Rollout/rollback | [Scenario] | UC-1 | [Test/contract/smoke/evidencia manual] | Pending |

Una categoria sin caso aplicable se marca `No aplica` con una justificacion de una linea basada en el alcance real; nunca se omite en silencio.

### 2.7 Contrato Visual (UI lock)

**UI lock**: locked | not-applicable

Si hay UI visible, reemplazar este bloque por la seccion completa de `template-sections/visual-contract.md` y dejar `UI lock: locked`. Si no hay pantalla de usuario, dejar `UI lock: not-applicable` y una razon de una linea.

---

### 2.8 Supuestos e integraciones

Toda dependencia externa o poco conocida (API de terceros, forma y volumen de datos reales, limites, calidad de datos legados). Si no hay ninguna, escribir `Ninguno` con una razon de una linea.

| Supuesto | Fuente | Estado | Evidencia | Que pasa si es falso |
| --- | --- | --- | --- | --- |
| [Comportamiento que se da por cierto] | [Codigo / contrato / documentacion / usuario / prueba exploratoria] | verificado \| asumido \| bloqueante | [Ruta, enlace o resultado de la prueba] | [Criterios o slices afectados y plan] |

Un supuesto `asumido` que afecta un criterio de aceptacion necesita verificacion antes de cerrar el PRD o un primer slice que lo verifique, con condicion de parada si resulta falso.

### 2.9 Que queda obsoleto

Lo que este desarrollo deja obsoleto forma parte del alcance. Si no hay nada, escribir `Ninguno` con una razon de una linea. Solo cuenta lo que **este** cambio vuelve obsoleto; el codigo muerto no relacionado se anota como sugerencia, fuera del alcance.

| Elemento | Tipo | Ubicacion | Reemplazado por | Accion | Consumidores | Slice | Busqueda de verificacion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [Constante, parametro, endpoint, test, doc...] | codigo \| constante o parametro \| configuracion \| flag \| endpoint o campo \| test \| fixture o seed \| traduccion \| documentacion \| datos | [Ruta] | [Nuevo elemento] | eliminar \| adaptar \| deprecar en etapas | [En el repo / externos: cuales] | [P1-S2] | `[comando de busqueda que debe dar cero usos]` |

---

## 3. Modelo de Datos

### 3.1 Migracion Requerida

```ruby
# Pseudo-code of migration
add_column :table_name, :column_name, :type, default: nil
```

### 3.2 Diagrama de Clases

Documentar las clases, entidades, value objects, servicios o interfaces introducidos o modificados y sus relaciones confirmadas. Usar nombres reales del diseno; indicar cardinalidades cuando apliquen.

```mermaid
classDiagram
  class AggregateRoot {
    +id: UUID
    +perform(): Result
  }
  class RelatedEntity {
    +id: UUID
  }
  class ApplicationService {
    +call(input): Result
  }

  AggregateRoot "1" --> "many" RelatedEntity : owns
  ApplicationService --> AggregateRoot : coordinates
```

### 3.3 Diagrama de Flujo

```mermaid
flowchart LR
  A[CSV] --> B[RowProcessor]
  B --> C[DB]
  C --> D[Service]
```

---

## 4. Plan de Implementacion por Fases

### Fase 1 - [Name]

**Objetivo**: [One-sentence goal]

**Slices ejecutables**:

| ID | Outcome | Depends on | Scope / likely files | Acceptance criteria | Use cases | Tests | Edge cases | Validation | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-S1 | [One small result] | none | [One responsibility] | AC-1 | UC-1 | [Focused test] | [Edge case row, if any] | `[exact command]` | [Passing output/diff/check] |
| P1-S2 | [Next small result] | P1-S1 | [One responsibility] | AC-2 | UC-1 | [Focused test] | [Edge case row, if any] | `[exact command]` | [Passing output/diff/check] |

**Slice stop conditions**:

- [Condition that requires clarification or replanning]

**Definition of Done**:

- Every slice is `VERIFIED`, not merely implemented
- Acceptance criteria assigned to this phase have evidence
- Focused tests and validations pass
- Relevant quality checks (contract, tenancy/auth, i18n, performance, rollback) are satisfied or explicitly not applicable
- No deferred cleanup or unexplained failure is hidden inside the next phase

---

### Fase 2 - [Name]

Repeat the complete phase structure above. Do not replace executable slices with a broad deliverables list.

---

### Fase Futura - [Name] _(fuera de alcance de este PRD)_

> Sera abordada en PRD separado.

- [Brief description of what will come later]

---

## 5. Decisiones Tomadas

| #   | Pregunta                                | Respuesta     | Impacto en diseno              |
| --- | --------------------------------------- | ------------- | ------------------------------ |
| 1   | ¿Solo para tipo X o todos los soportes? | Todos         | Division aplica genericamente  |
| 2   | ¿Almacenar cruda o dividida?            | Solo dividida | No se persisten valores crudos |
| 3   | ¿Feature flag?                          | No            | Implementacion directa         |

---

## 6. Preguntas Abiertas

- [ ] Si hay UI visible, el Contrato Visual esta `locked` y `implement-prd` no tiene que inventar la pantalla
- [ ] Si no hay UI visible, `UI lock: not-applicable` tiene una razon de una linea
| #   | Pregunta           | Bloquea | Area   |
| --- | ------------------ | ------- | ------ |
| 1   | [Pending question] | Si/No   | fase X |

_(Vacio = PRD listo para implementar)_

---

## 7. Riesgos y Mitigaciones

| Riesgo                                        | Probabilidad | Impacto | Mitigacion                                                    |
| --------------------------------------------- | ------------ | ------- | ------------------------------------------------------------- |
| [e.g. Division por cero si unique_people = 0] | Media        | Alto    | Guard in service: skip calculation if denominator is 0 or nil |

---

## 8. Definition of Done Global

- [ ] Todas las fases completadas
- [ ] `[comando de tests del proyecto, segun .agents/project-context.md]` en verde
- [ ] `[comando de lint del proyecto]` sin hallazgos
- [ ] Retrocompatibilidad: archivos sin columnas nuevas siguen importando
- [ ] Columnas BD en ingles
- [ ] Sin queries N+1
- [ ] Errores capturados con `Errors::CaptureExceptionService`
- [ ] Todo AC tiene al menos un caso de uso vinculado y todo caso de uso tiene al menos un AC vinculado
- [ ] Todo caso de uso tiene al menos un test en la Estrategia de Tests
- [ ] La Matriz de Edge Cases cubre las seis categorias obligatorias (o declara `No aplica` con justificacion)

---

## 9. Matriz de Trazabilidad

| Acceptance criterion | Caso de uso | Phase / slice | Test evidence | Edge case(s) | Validation evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| AC-1 | UC-1 | P1-S1 | [test path/name] | [edge case row] | [command/check] | Pending |

---

## 10. Evidencia de Implementacion

Esta seccion es el registro durable de cierre: un resumen, no una bitacora. `implement-change` (alias `implement-prd`) la completa antes de eliminar los artefactos temporales de `.ai-work/<prd-slug>/`; no registrar prompts, trackers, handoffs ni estado interno de agentes. Tamano orientativo: unas 60 lineas en N3 y 15 en N1/N2; cada "Iteracion N" posterior, unas 15. Los hallazgos `critical` y `high` se listan uno por uno; el resto se resume en conteos por estado.

**Estado**: No iniciada | En progreso | Cerrada | Bloqueada

| Campo | Evidencia durable |
| --- | --- |
| Cambios entregados | [Resumen concreto y rutas relevantes] |
| Criterios de aceptacion | [AC-N: COMPLETE/BLOCKED y evidencia] |
| Validaciones ejecutadas | [`command` - PASS/FAIL y resultado relevante] |
| Calidad y QA | [Quality gate y `ready_to_close` con evidencia] |
| Referencia de cambio | [Commit, PR o diff identificable] |
| Riesgos o waivers | [Ninguno o riesgo, aprobador y motivo] |
| Checks reutilizados | [Ninguno, o `comando`: reutilizado de <etapa>, huella <x>] |
| Iteraciones y causa | [Ninguna, o por cada reentrada, ronda de reparacion o iteracion: `hueco del PRD` \| `error de implementacion` \| `entorno` \| `cambio de requisito`] |
| Modo de ejecucion | [supervisado \| autonomo] |
| Fecha de cierre | [YYYY-MM-DD] |
