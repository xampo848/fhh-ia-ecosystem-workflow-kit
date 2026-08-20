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
2.5. **Challenge before locking** — load [../shared/critical-stance.md](../shared/critical-stance.md). Every scope, business-rule, pattern, or invariant decision must survive one direct challenge before Phase 3 records it as final, whether the user or the AI proposed it.
3. **Scope is sacred** — every PRD must have a hard line between what IS and what IS NOT in scope.
4. **Iterate until complete** — after each round of answers, update the PRD immediately. The document should converge to zero open questions.
5. **English in code** — DB column names and Ruby variables must always use English identifiers, even if domain language is Spanish.
6. **Milestones contain executable slices** — phases express product milestones; they are not permission to group large implementation tasks. Every non-trivial phase must decompose into small, ordered slices with one observable outcome and a verification gate.
7. **DDD before implementation** — PRDs must define bounded context placement, ownership, namespace, table strategy, and dependency direction before implementation starts.
8. **Standards-aware PRDs** — PRDs must follow `BACKEND_STANDARDS.md`, including Minitest and `enumerate_it` conventions.
9. **Evidence before completion** — every deliverable must name how it will be tested, validated, and verified. “Tests later” and phase-end-only validation are not acceptable.
10. **Activation is part of scope** — when a PRD replaces a read path, materialization model, cache, projection, or persisted contract, it must define how existing data becomes visible after cutover (bootstrap, backfill, repair, smoke verification, and rollback if activation fails).
11. **No phase skipping** — the workflow is strictly sequential. Do not skip, merge, or reorder its five phases.

---

## 📋 Protocol

### Hard Gate: Phases Are Non-Skippable

- Execute `Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5` in order.
- Do not draft PRD content in `Phase 1`.
- Do not start `Phase 3` before receiving and processing `Phase 2` answers.
- Do not start `Phase 4` until `Phase 3` records its pattern decision.
- Do not consider the PRD delivered until `Phase 5` completes.
- If information is missing, stop and ask targeted questions; do not bypass the gate.

### Hard Gate: Use Cases, Test Strategy, and Edge Cases Are Non-Optional

A PRD is never "ready to implement" on AC alone. Before delivering the final PRD:

- Every PRD must contain a **Casos de Uso** table, a **Estrategia de Tests** table, and a **Matriz de Edge Cases** table (see Phase 3 and the canonical template).
- Every acceptance criterion must link to at least one use case; every use case must link to at least one AC.
- Every use case must link to at least one test in the test-strategy table.
- The edge-case matrix must cover all six mandatory categories (datos vacíos, límites, errores, permisos/tenancy, concurrencia/orden, rollout/rollback). A category may be marked `No aplica` only with a one-line justification tied to the actual scope.
- If any AC, use case, or edge-case category has no mapped row, stop drafting and either fill the gap or ask the user a targeted question. Do not deliver a PRD with an unmapped row and no justification.
- This gate is verified again in the Quality Checklist and Final Self-Review before delivery.

### Hard Gate: Class Diagram Is Non-Optional

- Every PRD must include a Mermaid `classDiagram` in `## 3. Modelo de Datos`.
- The diagram must show the classes, entities, value objects, services, or interfaces that are introduced or changed, including named relationships and cardinalities where relevant.
- A PRD with no persisted data change still diagrams the relevant runtime classes and dependencies. Do not substitute a flowchart for this requirement.
- The diagram uses confirmed names and relationships from the pattern lock; placeholders are not acceptable in a PRD ready for `implement-prd`.

### Phase 1: Repository and Ecosystem Calibration

Load and execute [reference/calibration.md](reference/calibration.md). This is a hard gate; persist its required artifact before starting Phase 2.

---

### Phase 2: Ambiguity Detection

Load and execute [reference/ambiguity-detection.md](reference/ambiguity-detection.md). This is a hard gate; do not start Phase 3 until it declares that no blocking ambiguity remains.

---

### Phase 3: Pattern Locking

Load and execute [reference/pattern-locking.md](reference/pattern-locking.md). This is a hard gate between ambiguity detection and drafting; do not start Phase 4 until its artifact is persisted.

---

### Phase 4: Drafting

With all ambiguities resolved, produce the PRD using the standard structure below.

Template source (mandatory): `.agents/skills/01-product/create-prd/PRD_TEMPLATE.md`

- The PRD template must be loaded from that file.
- Do not duplicate, inline, or maintain a second template copy inside this `SKILL.md`.

**File location:** `docs/prd/<feature-or-project>/<YYYY-MM-DD>-<feature-name>/<feature-name>.md`

For every PRD created with this workflow, create `_meta/orchestration.md` in the same PRD directory. Persist the phase artifact as each applicable phase completes. The file must contain these four sections:

- `## Calibration`
- `## Ambiguity Log`
- `## Pattern Lock`
- `## Self-Audit`

`_meta/` is temporary AI coordination state, ignored by Git. It does not replace the final PRD and is removed by `implement-prd` at closure. `execution-lock.toon` and the implementation tracker also live in this directory and remain owned by `implement-prd`.

This requirement applies only to PRDs created after this workflow change. Historical PRDs remain valid and do not require a retrofit of `_meta/orchestration.md` or the five-phase model.

Additional required sections:

- Parent epic context and inherited-invariant mapping when a parent epic exists
- Contrato entre Fases (precondiciones/postcondiciones) when a parent epic exists
- DDD placement decisions
- Enumeration strategy
- Lifecycle rules
- Tenant integrity rules
- Cross-context dependency rules
- Mermaid class diagram (mandatory, see below)
- Casos de Uso table (mandatory, see below)
- Estrategia de Tests table (mandatory, see below)
- Matriz de Edge Cases table (mandatory, see below)
- Evidencia de Implementacion section (initialized in the PRD template and completed only at `implement-prd` closure)

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
- read the companion ledger (`<slug>-ledger.md`) and, when this is not the first PRD in the queue, the immediately preceding sibling PRD's `Contrato entre Fases` postcondiciones, before drafting scope;
- declare a `Contrato entre Fases` section listing this PRD's preconditions (what it assumes from prior phases, verified against real code during calibration, not assumed from the epic's original plan) and postconditions (what it guarantees for later phases);
- treat an unverifiable precondition as a blocking ambiguity, not a silent assumption.

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

### Phase 5: Self-Audit and Hardening

Load and execute [reference/self-audit.md](reference/self-audit.md). This is a hard gate; persist its required artifact and final readiness declaration before delivering the PRD.


---

## Future Scope

This is explicitly out of scope for the current change. After evidence from at least several new PRDs shows that the five-phase model works in isolation:

- `implement-prd` could read `## Pattern Lock` and require an explicit justification for implementation divergence.
- `implementation-slicing` could use `touched_surfaces` from `## Calibration` to detect scope expansion.
- `qa-handoff-review` could reconcile `## Self-Audit` residual risks before allowing `ready_to_close: yes`.

Do not implement this coupling before that evidence exists; premature propagation would couple workflows without proving this model's value.

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
- Omitting the Mermaid class diagram or replacing it with a flowchart.
```
