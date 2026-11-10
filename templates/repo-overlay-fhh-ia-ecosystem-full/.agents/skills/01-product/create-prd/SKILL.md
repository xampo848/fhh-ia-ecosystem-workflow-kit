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
5. **English in code** — code identifiers (columns, variables, classes) use English, even if the domain language is Spanish, unless the project's rules say otherwise.
6. **Milestones contain executable slices** — phases express product milestones; they are not permission to group large implementation tasks. Every non-trivial phase must decompose into small, ordered slices with one observable outcome and a verification gate.
7. **DDD before implementation** — PRDs must define bounded context placement, ownership, namespace, table strategy, and dependency direction before implementation starts.
8. **Standards-aware PRDs** — PRDs follow the project's standards documents and stack rules (`.agents/project/backend.md`, `.agents/project/frontend.md`, `.agents/project/stack.md`), including its test framework and enumeration conventions.
9. **Evidence before completion** — every deliverable must name how it will be tested, validated, and verified. “Tests later” and phase-end-only validation are not acceptable.
10. **Activation is part of scope** — when a PRD replaces a read path, materialization model, cache, projection, or persisted contract, it must define how existing data becomes visible after cutover (bootstrap, backfill, repair, smoke verification, and rollback if activation fails).
11. **No phase skipping** — the default workflow is five sequential phases. Compact mode may fold drafting into a shorter path, but it may not skip calibration, ambiguity resolution, pattern lock, or self-audit.

---

## 📋 Protocol

### Hard Gate: Phases Are Non-Skippable

- Default path: execute `Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5` in order.
- Compact path: when the Compact Path Gate below applies, execute `Phase 1 -> Phase 2/3 -> Phase 4/5`. Calibration, ambiguity resolution, pattern lock, drafting, and self-audit still happen; only ceremony may fold.
- Do not draft PRD content in `Phase 1`.
- Do not start `Phase 3` before receiving and processing `Phase 2` answers, unless compact mode recorded that no blocking ambiguity remains.
- Do not start `Phase 4` until `Phase 3` records its pattern decision.
- Do not consider the PRD delivered until `Phase 5` completes, or until compact mode persists the same self-audit declaration.
- If information is missing, stop and ask targeted questions; do not bypass the gate.
- Load each phase reference only when entering that phase. On a continuation turn, reuse unchanged router, policy, and skill context rather than reloading it.

### Compact Path Gate

Use compact mode only when all of these are true:

- single primary surface;
- no parent epic, or the parent epic already locked live path, phase cut, and inherited invariants;
- no new persistence, public contract, authorization/tenancy rule, or rollout/activation path;
- comparable local pattern is already obvious from calibration.

In compact mode:

- keep the four `.ai-work/<prd-slug>/orchestration.md` sections;
- fold Phase 2 and Phase 3 into one short pass when there are no blocking questions;
- draft and self-audit in one pass only after calibration and pattern lock exist;
- do not omit use cases, test strategy, edge-case matrix, class diagram, or slice ownership;
- do not mention `solution-sketch`.

### Hard Gate: Use Cases, Test Strategy, and Edge Cases Are Non-Optional

A PRD is never "ready to implement" on AC alone. Before delivering the final PRD:

- Every PRD must contain a **Casos de Uso** table, a **Estrategia de Tests** table, and a **Matriz de Edge Cases** table (see Phase 3 and the canonical template).
- Every acceptance criterion must link to at least one use case; every use case must link to at least one AC.
- Every use case must link to at least one test in the test-strategy table.
- The edge-case matrix must cover all six mandatory categories (datos vacíos, límites, errores, permisos/tenancy, concurrencia/orden, rollout/rollback). A category may be marked `No aplica` only with a one-line justification tied to the actual scope.
- If any AC, use case, or edge-case category has no mapped row, stop drafting and either fill the gap or ask the user a targeted question. Do not deliver a PRD with an unmapped row and no justification.
- This gate is verified again in the Quality Checklist and Final Self-Review before delivery.
- When `visible_ui: yes`, every required UI state in the Contrato Visual must map to at least one use case or edge-case row. An unlocked screen is an unmapped row.

### Hard Gate: Class Diagram Is Non-Optional

- Every PRD must include a Mermaid `classDiagram` in `## 3. Modelo de Datos`.
- The diagram must show the classes, entities, value objects, services, or interfaces that are introduced or changed, including named relationships and cardinalities where relevant.
- A PRD with no persisted data change still diagrams the relevant runtime classes and dependencies. Do not substitute a flowchart for this requirement.
- The diagram uses confirmed names and relationships from the pattern lock; placeholders are not acceptable in a PRD ready for `implement-prd`.

### Hard Gate: Visible UI Requires A Visual Contract

When calibration records `visible_ui: yes`, a PRD is never ready to implement on behavior alone.

- Persist a **Contrato Visual (UI lock)** in the PRD before Phase 5 can declare `ready for implement-prd`.
- Required fields: surface (new vs existing), density/composition, primary action, required UI states, visual thesis in one sentence, Design System primitives or sibling screen to reuse, and `UI lock: locked`.
- Optional evidence, in this preference order: existing sibling screen in the repo; Figma or digital mockup; photo of a paper/whiteboard sketch; competitor screenshot. Cite the path or attachment when present.
- A mockup, screenshot, or photo is an input to the lock, not the lock. High-fidelity mockups are never a universal requirement.
- Do not lock hex colors, new typefaces, or animation unless the user already has a product design system decision for them.
- If `visible_ui: no`, record `UI lock: not-applicable` plus a one-line reason. Do not invent a visual section for importer-only or backend-only PRDs.
- If `implement-prd` would still have to invent the screen, stop: the visual contract is blocking ambiguity, same bar as an unlocked API contract.

### Phase 1: Repository and Ecosystem Calibration

Load and execute [reference/calibration.md](reference/calibration.md). This is a hard gate; persist its required artifact before starting Phase 2.

---

### Phase 2: Ambiguity Detection

Load and execute [reference/ambiguity-detection.md](reference/ambiguity-detection.md). This is a hard gate; do not start Phase 3 until it declares that no blocking ambiguity remains.

---

### Phase 3: Pattern Locking

Load and execute [reference/pattern-locking.md](reference/pattern-locking.md). This is a hard gate between ambiguity detection and drafting; do not start Phase 4 until its artifact is persisted.

If `docs/design/<slug>-sketch.md` exists for this slug, inherit it as an anchor. The class diagram must use those names. Inverting a locked sketch without an explicit critical-stance challenge is forbidden, same bar as `INV-CUT`. If the user declined a sketch offer, persist `sketch: skipped` in `## Pattern Lock`.

---

### Phase 4: Drafting

With all ambiguities resolved, produce the PRD using the standard structure below.

Prefer tables, IDs, and falsifiable statements over explanatory narrative. Keep every required mapping and quality gate, but omit generic process prose.

Template source (mandatory): `.agents/skills/01-product/create-prd/PRD_TEMPLATE.md`

- The PRD template must be loaded from that file.
- Do not duplicate, inline, or maintain a second template copy inside this `SKILL.md`.

**File location:** `docs/prd/<feature-or-project>/<YYYY-MM-DD>-<feature-name>/<feature-name>.md`

For every PRD created with this workflow, create `.ai-work/<prd-slug>/orchestration.md` at the repository root, where `<prd-slug>` is the PRD directory name (`<YYYY-MM-DD>-<feature-name>`). Persist the phase artifact as each applicable phase completes. The file must contain these four sections:

- `## Calibration`
- `## Ambiguity Log`
- `## Pattern Lock`
- `## Self-Audit`

`.ai-work/<prd-slug>/` is the single workspace for temporary AI coordination state, ignored by Git. Nothing temporary is written under `docs/` or enters a PR. It does not replace the final PRD and is removed by `implement-change` (alias `implement-prd`) at closure. Execution locks, the implementation tracker, handoffs, and validation logs also live in this directory and remain owned by `implement-change`. A PRD created before this layout may still have `<prd-directory>/_meta/`; read it when the `.ai-work/` copy is missing, and do not write new files there.

This requirement applies only to PRDs created after this workflow change. Historical PRDs remain valid and do not require a retrofit of `.ai-work/<prd-slug>/orchestration.md` or the five-phase model.

Additional required sections:

- Contrato Visual (UI lock) when `visible_ui: yes`, or an explicit `UI lock: not-applicable` when it is not
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
- Supuestos e integraciones table, from the Unknowns Inventory in `reference/calibration.md` (`Ninguno` with a one-line reason when there is no external or poorly known dependency)
- Que queda obsoleto table, from the Obsolescence Scan in `reference/calibration.md` (`Ninguno` with a one-line reason when nothing becomes obsolete)
- Evidencia de Implementacion section (initialized in the PRD template and completed only at `implement-prd` closure)

## References

Load a reference only when its condition holds:

- [reference/execution-granularity.md](reference/execution-granularity.md) — read it in Phase 4, when writing phases and execution slices
- [reference/architecture-rules.md](reference/architecture-rules.md) — read it in Phase 4, when the PRD touches the data model, domain placement, enumerations, or tests
- [reference/traceability-tables.md](reference/traceability-tables.md) — read it in Phase 4, when filling the three mandatory traceability tables
- [reference/quality-bar.md](reference/quality-bar.md) — read it after each round of answers and before delivering the PRD

## 📄 PRD Structure Template

Use the canonical template at:

`.agents/skills/01-product/create-prd/PRD_TEMPLATE.md`

The template holds the sections every PRD needs. Conditional sections live in
`template-sections/` and are inserted only when they apply:
`epic-context.md` (the PRD has a parent epic) and `visual-contract.md` (the
PRD changes visible UI).
