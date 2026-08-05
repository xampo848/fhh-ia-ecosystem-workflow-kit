---
name: create-prd
description: "Step-by-step process to produce a high-quality PRD in FHH IA Ecosystem. Explores the codebase first, detects ambiguities, asks targeted clarifying questions, and iterates until the document is complete and unambiguous. Use when creating a new feature PRD, planning a ticket, or formalizing requirements before implementation."
argument-hint: "Describe the feature, ticket, requirement, or project slice to formalize"
user-invocable: true
metadata:
  author: fhh-ia-ecosystem
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
11. **No phase skipping** — the workflow is strictly sequential. Do not skip, merge, or reorder phases. `Phase 3` is blocked until `Phase 1` and `Phase 2` are fully completed.

---

## 📋 Protocol

### Hard Gate: Phases Are Non-Skippable

- Execute `Phase 1 -> Phase 2 -> Phase 3` in order.
- Do not draft PRD content in `Phase 1`.
- Do not start `Phase 3` before receiving and processing `Phase 2` answers.
- If information is missing, stop and ask targeted questions; do not bypass the gate.

### Hard Gate: Use Cases, Test Strategy, and Edge Cases Are Non-Optional

A PRD is never "ready to implement" on AC alone. Before delivering the final PRD:

- Every PRD must contain a **Casos de Uso** table, a **Estrategia de Tests** table, and a **Matriz de Edge Cases** table (see Phase 3 and the canonical template).
- Every acceptance criterion must link to at least one use case; every use case must link to at least one AC.
- Every use case must link to at least one test in the test-strategy table.
- The edge-case matrix must cover all six mandatory categories (datos vacíos, límites, errores, permisos/tenancy, concurrencia/orden, rollout/rollback). A category may be marked `No aplica` only with a one-line justification tied to the actual scope.
- If any AC, use case, or edge-case category has no mapped row, stop drafting and either fill the gap or ask the user a targeted question. Do not deliver a PRD with an unmapped row and no justification.
- This gate is verified again in the Quality Checklist and Final Self-Review before delivery.

### Phase\
 1: Codebase Exploration

Before writing a single line of PRD, explore the relevant parts of the codebase:

**Mandatory documents to read:**

- `docs/foundations/ARCHITECTURE.md`
- `docs/foundations/DOMAIN_MODEL.md` when the feature changes domain ownership or entities
- `docs/standards/BACKEND_STANDARDS.md` and/or `docs/standards/FRONTEND_STANDARDS.md` for touched surfaces
- `docs/standards/CODE_QUALITY.md`
- The parent epic when the request references one, including its `Invariantes No Negociables` table.

**What to read:**

- Existing models involved in the feature (`app/models/`)
- Related services (`app/services/`)
- Queries that will be affected (`app/queries/`)
- Controllers involved (`app/controllers/`)
- Existing DB schema columns for affected tables (`db/schema.rb`)
- Related tests to understand expected behaviors (`test/`)

**Reference artifact calibration:**

- If the repo already contains a recent PRD for a comparable scope, read exactly one as a structure anchor before drafting.
- Use that anchor to calibrate tone, section density, table depth, and acceptance evidence expectations.
- Do not copy business content from the anchor PRD. Reuse only structural patterns that improve consistency.

**Key questions to answer from code:**

- What columns already exist vs. need to be added?
- What services already implement related logic?
- Is there a naming convention already established?
- Are there existing base classes, concerns, or patterns to reuse?
- Which bounded context owns the new concept?
- Does the repo already use namespaced models for similar concepts?
- Does the repo already use prefixed tables for the domain?
- If a parent epic exists, which invariant IDs are inherited and which child acceptance criteria will prove each one?

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
| **Parent invariants** | Does this PRD map every inherited invariant to an AC? Does any requested behavior contradict one? |

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

Template source (mandatory): `.agents/skills/01-product/create-prd/PRD_TEMPLATE.md`

- The PRD template must be loaded from that file.
- Do not duplicate, inline, or maintain a second template copy inside this `SKILL.md`.

**File location:** `docs/prd/<feature-or-project>/<YYYY-MM-DD>-<feature-name>/<feature-name>.md`

Additional required sections:

- Parent epic context and inherited-invariant mapping when a parent epic exists
- DDD placement decisions
- Enumeration strategy
- Lifecycle rules
- Tenant integrity rules
- Cross-context dependency rules
- Casos de Uso table (mandatory, see below)
- Estrategia de Tests table (mandatory, see below)
- Matriz de Edge Cases table (mandatory, see below)

### Casos de Uso (mandatory)

Every PRD must declare a canonical, verifiable use-case ledger before it can be considered ready to implement.

- Format: `ID | Actor | Precondiciones | Flujo principal | Resultado observable (falsable) | AC vinculado`.
- Every use case states at least one falsifiable observable result — not a vague intention.
- Every use case links to one or more acceptance criteria; every acceptance criterion for a core behavior links to at least one use case.
- Cover every actor/flow the PRD scope introduces or changes, including secondary actors (admin, background job, external system) when they participate in the flow.

### Estrategia de Tests (mandatory)

Tests are part of the design, not a follow-up activity.

- Format: `Nivel (unidad/integración/contrato/smoke/e2e) | Objetivo | Caso de uso vinculado | Cobertura esperada | Comando o mecanismo de validación`.
- Every use case links to at least one row in this table.
- Each slice in the implementation plan must inherit its relevant rows from this table (see Section 4 slice fields).

### Matriz de Edge Cases (mandatory)

Edge cases must be classified and traceable, not merely narrated in prose.

- Mandatory categories: **datos vacíos**, **límites**, **errores**, **permisos/tenancy**, **concurrencia/orden**, **rollout/rollback**.
- Format: `Categoría | Descripción | Caso de uso vinculado | Validación (test/contrato/smoke/evidencia manual justificada) | Estado`.
- Every row maps to at least one validation mechanism. A category with no applicable case must say `No aplica` plus a one-line reason grounded in the actual scope — never a silent omission.

### Required architectural rules

When the PRD has a parent epic:

- declare the exact `parent_epic` path;
- map every inherited invariant ID to one or more child acceptance criteria;
- stop before drafting if requested scope contradicts an inherited invariant;
- continue only after an explicit user-approved change request records the invariant ID, reason, and approver.

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
| Use cases | PRD use-case IDs (`UC-N`) this slice implements or verifies |
| Tests | Focused automated tests to add or update, inherited from the PRD Estrategia de Tests rows for the linked use cases |
| Validation | Exact narrow command or check |
| Quality checks | Relevant tenancy, auth, i18n, contract, performance, SOLID/DRY/KISS checks |
| Edge cases | PRD edge-case matrix rows this slice must satisfy, if any |
| Evidence | Artifact/output needed to mark the slice verified |
| Stop conditions | Ambiguities or failures that prohibit continuing |
| Activation | Existing-data bootstrap/backfill/repair step, deploy command, smoke target, rollback note |

Every acceptance criterion, use case, test-strategy row, and edge-case row declared in the PRD must appear in at least one slice's fields above. A row with no owning slice is a traceability gap and must be resolved before the plan is considered complete.

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

Use the canonical template at:

`.agents/skills/01-product/create-prd/PRD_TEMPLATE.md`

## 🎯 Output Quality Bar

The final PRD must read like a repository-native planning artifact, not a generic requirements dump.

- The opening context should explain the real problem, why it matters now, and the strict scope boundary in concrete terms.
- Current-state tables should name actual repo artifacts, not placeholders, whenever the exploration phase found them.
- Requirement sections should state confirmed behavior, not hedged guesses.
- Phase plans should feel implementable by `implement-prd` without inventing missing behavior, validation, or ownership boundaries.
- Risks, future scope, and open questions should be specific enough that a reviewer can challenge them.
- The document should be as short as the scope allows, but never so compressed that acceptance, sequencing, or evidence become ambiguous.

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
- [ ] Casos de Uso table exists, every AC links to a use case, and every use case links back to an AC
- [ ] Estrategia de Tests table exists and every use case links to at least one test row
- [ ] Matriz de Edge Cases table covers all six mandatory categories, each mapped to a validation mechanism or an explicit `No aplica` with justification
- [ ] When a parent epic exists, every inherited invariant ID maps to an acceptance criterion and no contradiction lacks an approved change request
- [ ] If a comparable repo PRD existed, one anchor artifact was used to calibrate structure and depth
- [ ] All DB columns and Ruby identifiers are in English
- [ ] The opening context explains problem, urgency, and scope without generic filler
- [ ] Current-state tables reference real repo files or explicitly state when evidence was unavailable
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

## 🧪 Final Self-Review

Before delivering the PRD, challenge it with these checks:

- Would `implement-prd` need to invent behavior, ownership, or validation details that the PRD should already specify?
- Are any phases acting as large buckets instead of milestone boundaries with executable slices?
- Does any acceptance criterion lack a concrete evidence path?
- Does any acceptance criterion or use case lack a linked test or edge case where one would be expected?
- Does the edge-case matrix leave a mandatory category unmapped without justification?
- Could a reviewer clearly separate current scope, future scope, and blocked unknowns?
- If this PRD replaced a similar one in the repo, would it look consistent in structure and rigor?


---

## ⚠️ Anti-Patterns

- Writing the full PRD before asking questions — **always explore + ask first**
- Mixing implementation phases with future scope in the same section
- Leaving "TBD" or "to confirm" inline in requirement tables
- Silently redefining a non-negotiable invariant inherited from a parent epic
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
- Delivering a PRD with acceptance criteria but no explicit Casos de Uso, Estrategia de Tests, or Matriz de Edge Cases tables.
- Leaving an acceptance criterion, use case, or mandatory edge-case category unmapped without an explicit justification.
- Creating only two or three large phases whose tasks still span multiple contracts or risks.
- Adding arbitrary phases instead of splitting work at failure, ownership, contract, or validation boundaries.
- Deferring tests, lint, contract checks, or quality review until the end of the PRD.
- Writing vague tasks such as “implement backend”, “add UI”, or “test everything”.
```
