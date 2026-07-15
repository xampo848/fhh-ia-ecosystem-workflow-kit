---
name: create-prd
description: "Step-by-step process to produce a high-quality PRD in All Metrics. Explores the codebase first, detects ambiguities, asks targeted clarifying questions, and iterates until the document is complete and unambiguous. Use when creating a new feature PRD, planning a ticket, or formalizing requirements before implementation."
argument-hint: "Describe the feature, ticket, requirement, or project slice to formalize"
user-invocable: true
metadata:
  author: all-metrics
  tags:
    - prd
    - planning
    - requirements
    - architecture
    - phases
    - scope
    - ddd
---

# Create PRD — Product Requirements Document

Después de aprobar el PRD, el siguiente paso esperado es `implement-prd`.

Use this skill when:

- A user provides a ticket, user story, or raw requirement and needs a full PRD
- Planning a multi-phase feature before writing code
- Formalizing scope after a discussion
- Detecting missing requirements early to avoid rework

---

## 🎯 Philosophy

1. **Explore first, write second** — never draft requirements without reading the existing codebase. Unknown context produces bad PRDs.
2. **Ask, don't assume** — ambiguous requirements block implementation or cause rework. Surface gaps early through targeted questions.
3. **Scope is sacred** — every PRD must have a hard line between what IS and what IS NOT in scope.
4. **Iterate until complete** — after each round of answers, update the PRD immediately. The document should converge to zero open questions.
5. **English in code** — DB column names and Ruby variables must always use English identifiers, even if domain language is Spanish.
6. **Milestones contain executable slices** — phases express product milestones; they are not permission to group large implementation tasks. Every non-trivial phase must decompose into small, ordered slices with one observable outcome and a verification gate.
7. **DDD before implementation** — PRDs must define bounded context placement, ownership, namespace, table strategy, and dependency direction before implementation starts.
8. **Standards-aware PRDs** — PRDs must follow `BACKEND_STANDARDS.md`, including Minitest and `enumerate_it` conventions.
9. **Evidence before completion** — every deliverable must name how it will be tested, validated, and verified. “Tests later” and phase-end-only validation are not acceptable.
10. **Activation is part of scope** — when a PRD replaces a read path, materialization model, cache, projection, or persisted contract, it must define how existing data becomes visible after cutover (bootstrap, backfill, repair, smoke verification, and rollback if activation fails).

---

## 📋 Protocol

### Phase 1: Codebase Exploration

Before writing a single line of PRD, explore the relevant parts of the codebase:

**Mandatory documents to read:**

- `docs/foundations/ARCHITECTURE.md`
- `docs/foundations/DOMAIN_MODEL.md` when the feature changes domain ownership or entities
- `docs/standards/BACKEND_STANDARDS.md` and/or `docs/standards/FRONTEND_STANDARDS.md` for touched surfaces
- `docs/standards/CODE_QUALITY.md`

**What to read:**

- Existing models involved in the feature (`app/models/`)
- Related services (`app/services/`)
- Queries that will be affected (`app/queries/`)
- Controllers involved (`app/controllers/`)
- Existing DB schema columns for affected tables (`db/schema.rb`)
- Related tests to understand expected behaviors (`test/`)

**Key questions to answer from code:**

- What columns already exist vs. need to be added?
- What services already implement related logic?
- Is there a naming convention already established?
- Are there existing base classes, concerns, or patterns to reuse?
- Which bounded context owns the new concept?
- Does the repo already use namespaced models for similar concepts?
- Does the repo already use prefixed tables for the domain?

**Tools to use:**

- `semantic_search` for domain concepts
- `grep_search` for specific column/method names
- `read_file` for implementation details on key files
- `file_search` for locating relevant files by pattern

---

### Phase 2: Gap Analysis — Ask Targeted Questions

After exploring the codebase, identify ambiguities. Group them into categories and ask the user **all at once** in a single structured message. Do NOT proceed to draft before receiving answers.

**Mandatory question categories:**

| Category                | Examples                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| **Scope boundary**      | Is this only in the importer, or also in views/reports?                      |
| **Business rules**      | How exactly is X calculated? What are the edge cases?                        |
| **Data decisions**      | Store raw, computed, or both?                                                |
| **Division/allocation** | When does the split apply? Which columns are affected?                       |
| **Identifiers**         | Which fields uniquely identify the entity (eg. `(id_elemento, month)`)?      |
| **Feature flags**       | Should this be behind a feature flag for gradual rollout?                    |
| **Language**            | Should column/variable names follow existing English naming?                 |
| **Future scope**        | Are there related features (eg. UI, reports) that should NOT be in this PRD? |
| **DDD placement**       | Which bounded context owns this concept?                                     |
| **Tenancy**             | Is this tenant-scoped? Which relationships must validate same organization?  |
| **Lifecycle**           | Is the entity mutable, append-only, or stateful?                             |
| **Enumerations**        | Which values require `enumerate_it`?                                         |
| **Traceability**        | Should entities maintain references for explainability or lineage?           |
| **Verification**        | What focused test, contract check, lint, smoke check, or observable proves each outcome? |
| **Rollout/recovery**    | How is partial failure detected, retried, rolled back, or safely resumed?     |
| **Activation/adoption** | If old data already exists, what bootstrap/backfill/repair step makes the new path show data on day 1? |

**Format for questions:**

```
🔍 Antes de continuar, necesito resolver estas dudas:

**[Categoría]**
1. [Pregunta concreta]
2. [Pregunta concreta]

**[Categoría]**
3. [Pregunta concreta]
```

Only ask about things that **block the design** or would cause **different implementations** depending on the answer. Do not ask for information you can safely infer from the code.

---

### Phase 3: Draft the PRD

With all ambiguities resolved, produce the PRD using the standard structure below.

**File location:** `docs/prd/<feature-or-project>/<YYYY-MM-DD>-<feature-name>/<feature-name>.md`

Additional required sections:

- DDD placement decisions
- Enumeration strategy
- Lifecycle rules
- Tenant integrity rules
- Cross-context dependency rules

### Required architectural rules

PRDs that introduce backend entities must explicitly define:

- bounded context;
- namespace strategy;
- table naming strategy;
- append-only vs mutable lifecycle;
- multi-tenancy rules;
- Minitest strategy;
- `enumerate_it` enumerations.

### Enumeration rules

Do not leave constrained values as anonymous string arrays only.

PRDs must define explicit enumeration classes when applicable, for example:

```ruby
Analytics::SeverityEnumeration
Analytics::DetectionStatusEnumeration
```

### Testing rules

PRDs must align to the repository backend testing standard:

- backend tests use Minitest;
- tenant boundaries must be tested;
- append-only models must test immutability;
- lifecycle consistency rules must be tested.

---

## Execution Granularity Contract

The PRD must be detailed enough that `implementation-slicing` does not need to invent behavior. Do not inflate the number of phases arbitrarily: use phases for meaningful milestones and **execution slices** for small, verifiable work.

### Required decomposition

- Every non-trivial phase contains **at least two execution slices**. A single-slice phase is allowed only when the PRD records why the work is genuinely atomic.
- A slice delivers one observable outcome, stays within one contract boundary, and has one clear owner.
- A slice normally changes one primary production responsibility and 1–3 production files. Inseparable support files such as tests, styles, locales, factories, or fixtures may accompany it.
- Backend and frontend implementation belong in separate slices. A changed API contract requires its own contract-verification gate between them.
- Migrations, backfills, behavior activation, and cleanup must be separate slices when each can fail or be rolled back independently.
- A slice that combines more than one of these risks must be split: data migration, public contract, authorization/tenancy, background execution, external integration, or visible UI behavior.
- Existing-data activation, bootstrap, backfill, rollout command, and legacy cleanup must be separate slices when each can fail or be verified independently.
- No dependent slice starts until its predecessor is `VERIFIED`, unless the plan explicitly proves that the write sets and contracts are independent.

### Required task fields

Each execution slice must state:

| Field | Requirement |
| --- | --- |
| ID | Stable identifier such as `P2-S3` |
| Outcome | One externally observable or technically falsifiable result |
| Depends on | Prior slice IDs or `none` |
| Scope | Exact responsibility and likely files/components |
| Out of scope | Adjacent work this slice must not absorb |
| Acceptance criteria | PRD criterion IDs covered |
| Tests | Focused automated tests to add or update |
| Validation | Exact narrow command or check |
| Quality checks | Relevant tenancy, auth, i18n, contract, performance, SOLID/DRY/KISS checks |
| Evidence | Artifact/output needed to mark the slice verified |
| Stop conditions | Ambiguities or failures that prohibit continuing |
| Activation | Existing-data bootstrap/backfill/repair step, deploy command, smoke target, rollback note |

### Slice completion state

A slice advances only through this sequence:

`NOT_STARTED → IMPLEMENTED → TESTED → VALIDATED → VERIFIED`

- `IMPLEMENTED`: scoped code exists and ownership was respected.
- `TESTED`: focused automated coverage passes, or a justified non-automated check is recorded.
- `VALIDATED`: lint/static/contract/smoke checks relevant to the slice pass.
- `VERIFIED`: acceptance criteria and quality checks are linked to concrete evidence.

“Code complete” is not equivalent to complete.

---

## 📄 PRD Structure Template

````markdown
# PRD: [Feature Name]

**Ticket**: [User story or ticket reference]
**Autor**: [Team or person]
**Fecha**: [Date]
**Estado**: Borrador | En revisión | Aprobado

---

## 1. Contexto y Objetivo

[2-3 sentences: what problem this solves, what the user wants to achieve]

> **Alcance estricto**: [Clear statement of what IS and is NOT in scope for this PRD]

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

| Campo origen | Campo BD | Tipo | Nullable | Descripción |
| ------------ | -------- | ---- | -------- | ----------- |
| ...          | ...      | ...  | ...      | ...         |

### 2.2 Regla de Negocio: [Name]

> **Decisión confirmada**: [Exact business rule, in one clear paragraph]

**Condición de aplicación**: [When does the rule trigger?]
**Entidad de agrupación**: [What identifies a group? e.g. (id_elemento, month)]
**Campos afectados**: [Exhaustive list]
**Campos NO afectados**: [Exhaustive list with reason]
**Almacenamiento**: [What gets persisted — raw, computed, or both]

### 2.3 Criterios de Aceptación

| ID | Given | When | Then | Evidence expected |
| --- | --- | --- | --- | --- |
| AC-1 | [Precondition] | [Action/event] | [Observable result] | [Test/contract/smoke evidence] |

---

## 3. Modelo de Datos

### 3.1 Migración Requerida

```ruby
# Pseudo-code of migration
add_column :table_name, :column_name, :type, default: nil
```

### 3.2 Diagrama de Flujo

```
[ASCII or Mermaid diagram of data flow: CSV → RowProcessor → DB → Service]
```

---

## 4. Plan de Implementación por Fases

### Fase 1 — [Name]

**Objetivo**: [One-sentence goal]

**Slices ejecutables**:

| ID | Outcome | Depends on | Scope / likely files | Acceptance criteria | Tests | Validation | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1-S1 | [One small result] | none | [One responsibility] | AC-1 | [Focused test] | `[exact command]` | [Passing output/diff/check] |
| P1-S2 | [Next small result] | P1-S1 | [One responsibility] | AC-2 | [Focused test] | `[exact command]` | [Passing output/diff/check] |

**Slice stop conditions**:

- [Condition that requires clarification or replanning]

**Definition of Done**:

- Every slice is `VERIFIED`, not merely implemented
- Acceptance criteria assigned to this phase have evidence
- Focused tests and validations pass
- Relevant quality checks (contract, tenancy/auth, i18n, performance, rollback) are satisfied or explicitly not applicable
- No deferred cleanup or unexplained failure is hidden inside the next phase

---

### Fase 2 — [Name]

Repeat the complete phase structure above. Do not replace executable slices with a broad deliverables list.

---

### Fase Futura — [Name] _(fuera de alcance de este PRD)_

> Será abordada en PRD separado.

- [Brief description of what will come later]

---

## 5. Decisiones Tomadas

| #   | Pregunta                                | Respuesta     | Impacto en diseño              |
| --- | --------------------------------------- | ------------- | ------------------------------ |
| 1   | ¿Solo para tipo X o todos los soportes? | Todos         | División aplica genéricamente  |
| 2   | ¿Almacenar cruda o dividida?            | Solo dividida | No se persisten valores crudos |
| 3   | ¿Feature flag?                          | No            | Implementación directa         |

---

## 6. Preguntas Abiertas

| #   | Pregunta           | Bloquea | Área   |
| --- | ------------------ | ------- | ------ |
| 1   | [Pending question] | Sí/No   | fase X |

_(Vacío = PRD listo para implementar)_

---

## 7. Riesgos y Mitigaciones

| Riesgo                                        | Probabilidad | Impacto | Mitigación                                                    |
| --------------------------------------------- | ------------ | ------- | ------------------------------------------------------------- |
| [e.g. División por cero si unique_people = 0] | Media        | Alto    | Guard in service: skip calculation if denominator is 0 or nil |

---

## 8. Definition of Done Global

- [ ] Todas las fases completadas
- [ ] `bundle exec rails test` en verde
- [ ] `bundle exec rubocop` sin offenses
- [ ] Retrocompatibilidad: archivos sin columnas nuevas siguen importando
- [ ] Columnas BD en inglés
- [ ] Sin queries N+1
- [ ] Errores capturados con `Errors::CaptureExceptionService`

---

## 9. Matriz de Trazabilidad

| Acceptance criterion | Phase / slice | Test evidence | Validation evidence | Status |
| --- | --- | --- | --- | --- |
| AC-1 | P1-S1 | [test path/name] | [command/check] | Pending |

````

---

## 🔄 Iteration Rules

After the user answers any round of questions:

1. **Immediately update** the PRD sections affected by the answer.
2. **Mark answered questions** as resolved in the "Decisiones Tomadas" table.
3. **Remove** any content in "Preguntas Abiertas" that is now resolved.
4. **Check** if the answer revealed new ambiguities — if so, ask a second round.
5. **Confirm** when the document reaches zero open questions.

---

## ✅ Quality Checklist Before Delivering

Before considering a PRD complete, verify:

- [ ] No open questions remain
- [ ] Scope is unambiguous (what IS and IS NOT included is explicit)
- [ ] All DB columns and Ruby identifiers are in English
- [ ] Each phase has its own Definition of Done
- [ ] Every non-trivial phase is decomposed into small executable slices, or its atomic exception is justified
- [ ] Every slice has outcome, dependency, scope boundary, tests, exact validation, evidence, and stop conditions
- [ ] No slice crosses backend/frontend or combines multiple high-risk boundaries without a written split rationale
- [ ] Acceptance criteria map to slices and verification evidence in the traceability matrix
- [ ] Slice completion uses `IMPLEMENTED → TESTED → VALIDATED → VERIFIED`; code completion alone is never enough
- [ ] Business rules are expressed as decisions (not "it should" — use "confirmed: X applies when Y")
- [ ] The "Decisiones Tomadas" table captures the full conversation history
- [ ] Future scope is explicitly labeled as out-of-scope
- [ ] Risks are listed with mitigations
- [ ] Data model section shows the migration pseudo-code
- [ ] The flow diagram shows how data moves end-to-end
- [ ] Verify against docs/architecture for any relevant patterns and standards to follow


---

## ⚠️ Anti-Patterns

- Writing the full PRD before asking questions — **always explore + ask first**
- Mixing implementation phases with future scope in the same section
- Leaving "TBD" or "to confirm" inline in requirement tables
- Using Spanish names for DB columns or Ruby variables
- Describing UI changes in an importer-only PRD (they belong in a separate PRD)
- Assuming a feature flag is not needed — **always ask**
- Vague business rules like "divide as needed" — rules must be deterministic and complete
- Forgetting backward compatibility requirements (files without new columns must still import)
- Ignoring bounded contexts or DDD ownership.
- Creating root-level models for bounded-context concepts.
- Omitting multi-tenancy rules.
- Omitting lifecycle rules for stateful entities.
- Recreating deleted legacy models accidentally.
- Using RSpec instructions in new PRDs.
- Using ad-hoc enums instead of `enumerate_it`.
- Using inconsistent table naming strategies.
- Treating “phase” and “execution slice” as synonyms.
- Creating only two or three large phases whose tasks still span multiple contracts or risks.
- Adding arbitrary phases instead of splitting work at failure, ownership, contract, or validation boundaries.
- Deferring tests, lint, contract checks, or quality review until the end of the PRD.
- Writing vague tasks such as “implement backend”, “add UI”, or “test everything”.
```
