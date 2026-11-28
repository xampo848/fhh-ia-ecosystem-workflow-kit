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

This skill delivers the PRD with `Estado: En revisión` in its header; only the user moves it to `Aprobado` (or tells the agent to mark it). When the user approves the delivered PRD in the conversation, set `Estado: Aprobado` right then. After the PRD is approved, the expected next step is `implement-change`.

Use this skill when:

- A user provides a ticket, user story, or raw requirement and needs a full PRD
- Planning a multi-phase feature before writing code
- Formalizing scope after a discussion
- Detecting missing requirements early to avoid rework

---

## 🎯 Philosophy

1. **Explore first, write second** — never draft requirements without reading the existing codebase. Unknown context produces bad PRDs.
2. **Ask, don't assume** — ambiguous requirements block implementation or cause rework. Surface gaps early through targeted questions.
3. **Challenge before locking** — load [../shared/critical-stance.md](../shared/critical-stance.md). Every scope, business-rule, pattern, or invariant decision must survive one direct challenge before Phase 3 records it as final, whether the user or the AI proposed it.
4. **Scope is sacred** — every PRD must have a hard line between what IS and what IS NOT in scope.
5. **Iterate until complete** — after each round of answers, update the PRD immediately. The document should converge to zero open questions.
6. **Identifiers follow the project** — code identifiers (columns, variables, classes) follow, in this order: the project's rules; the dominant convention of the existing code around the change; English for new code that has neither. Never mix languages inside one module to satisfy a default.
7. **Milestones contain executable slices** — phases express product milestones; they are not permission to group large implementation tasks. Every non-trivial phase must decompose into small, ordered slices with one observable outcome and a verification gate.
8. **DDD before implementation** — a PRD that creates or moves domain entities defines bounded context placement, ownership, namespace, and dependency direction before implementation starts: in the data section when it is persisted, otherwise next to the class diagram; table strategy applies only when data is persisted.
9. **Standards-aware PRDs** — PRDs follow the project's standards documents and stack rules (`.agents/project/backend.md`, `.agents/project/frontend.md`, and `.agents/project/stack.md` when a stack pack was installed), including its test framework and enumeration conventions.
10. **Evidence before completion** — every deliverable must name how it will be tested, validated, and verified. “Tests later” and phase-end-only validation are not acceptable.
11. **Activation is part of scope** — when a PRD replaces a read path, materialization model, cache, projection, or persisted contract, it must define how existing data becomes visible after cutover (bootstrap, backfill, repair, smoke verification, and rollback if activation fails).
12. **No phase skipping** — the default workflow is five sequential phases. Compact mode may fold drafting into a shorter path, but it may not skip calibration, ambiguity resolution, pattern lock, or self-audit.

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
- no new persistence, public contract (an interface consumed outside the repository or across a deployment boundary; `.agents/instructions.md`, "Level rules"), authorization/tenancy rule, or rollout/activation path;
- comparable local pattern is already obvious from calibration.

In compact mode:

- record `Modo: compacto` in the PRD header (the full path records `Modo: completo`), so a reader knows which form it is;
- keep the four `.ai-work/<prd-slug>/orchestration.md` sections;
- fold Phase 2 and Phase 3 into one short pass when there are no blocking questions;
- draft and self-audit in one pass only after calibration and pattern lock exist;
- do not omit acceptance criteria, use cases, test strategy, or the edge-case matrix;
- keep it proportional: a section that does not apply is one line (`No aplica: <reason>`), never a filled placeholder; a single phase with at most three slices lists one line per slice with the same ten fields as the slice table, instead of the table; omit section 9 (the traceability matrix), since each slice line already names its AC, use cases, and tests; section 8 keeps only the items that apply and section 10 keeps every row of its table (`implement-change` fills them at closure), without its explanatory paragraph; section numbers do not shift (10 stays 10) and each phase's Definition of Done keeps only the lines that apply; it carries no `---` separators, none of the template's notes in italics, no section 9, no second phase and no future phase, and it never pads to match the template. Its length is whatever those rules leave;
- the class diagram follows its gate below;
- do not mention `solution-sketch`.

### Hard Gate: Use Cases, Test Strategy, and Edge Cases Are Non-Optional

A PRD is never "ready to implement" on AC alone. Before delivering the final PRD:

- Every PRD must contain a **Casos de Uso** table, a **Estrategia de Tests** table, and a **Matriz de Edge Cases** table (see Phase 3 and the canonical template).
- Every acceptance criterion must link to at least one use case; every use case must link to at least one AC.
- Every use case must link to at least one test in the test-strategy table.
- The edge-case matrix must cover all six mandatory categories (datos vacíos, límites, errores, permisos/tenancy, concurrencia/orden, rollout/rollback), and every row names its `Capa dueña` (the one layer where it is tested). A category may be marked `No aplica` only with a one-line justification tied to the actual scope.
- If any AC, use case, or edge-case category has no mapped row, stop drafting and either fill the gap or ask the user a targeted question. Do not deliver a PRD with an unmapped row and no justification.
- This gate is verified again in the Quality Checklist and Final Self-Review before delivery.
- When `visible_ui: yes`, every required UI state in the Contrato Visual must map to at least one use case or edge-case row. An unlocked screen is an unmapped row.

### Hard Gate: Class Diagram Is Non-Optional

- Every PRD that introduces or changes classes, entities, value objects, services, or interfaces must include a Mermaid `classDiagram` in `## 3. Diseño Técnico`, showing them with named relationships and cardinalities where relevant.
- A PRD that only adds or changes functions (no class, entity, or service is introduced or changed) replaces the diagram with a signature list: name, inputs, output, and module of each function.
- A PRD with no persisted data change that changes runtime classes still diagrams them. Do not substitute a flowchart for this requirement.
- The diagram uses confirmed names and relationships from the pattern lock; placeholders are not acceptable in a PRD ready for `implement-change`.

### Hard Gate: Visible UI Requires A Visual Contract

When calibration records `visible_ui: yes`, a PRD is never ready to implement on behavior alone.

- Persist a **Contrato Visual (UI lock)** in the PRD before Phase 5 can declare `ready for implement-change`.
- Required fields: surface (new vs existing), density/composition, primary action, required UI states, visual thesis in one sentence, Design System primitives or sibling screen to reuse, and `UI lock: locked`.
- Optional evidence, in this preference order: existing sibling screen in the repo; Figma or digital mockup; photo of a paper/whiteboard sketch; competitor screenshot. Cite the path or attachment when present.
- A mockup, screenshot, or photo is an input to the lock, not the lock. High-fidelity mockups are never a universal requirement.
- Do not lock hex colors, new typefaces, or animation unless the user already has a product design system decision for them or explicitly asks for a `pixel` lock.
- When the request brings a prototype (HTML or image), read [reference/visual-lock.md](reference/visual-lock.md) in Phase 2: the prototype locks structure and content, the project patterns own the visual language; list every clash, ask once, and record each decision and component in the `Lock visual` table. The implementer never resolves a clash.
- If `visible_ui: no`, record `UI lock: not-applicable` plus a one-line reason. Do not invent a visual section for a PRD with no user-facing screen.
- If `implement-change` would still have to invent the screen, stop: the visual contract is blocking ambiguity, same bar as an unlocked API contract.

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

`.ai-work/<prd-slug>/` is the single workspace for temporary AI coordination state, ignored by Git. Nothing temporary is written under `docs/` or enters a PR. It does not replace the final PRD and is removed by `implement-change` at closure. Execution locks, the implementation tracker, handoffs, and validation logs also live in this directory and remain owned by `implement-change`. A PRD created before this layout may still have `<prd-directory>/_meta/`; read it when the `.ai-work/` copy is missing, and do not write new files there.

This requirement applies only to PRDs created after this workflow change. Historical PRDs remain valid and do not require a retrofit of `.ai-work/<prd-slug>/orchestration.md` or the five-phase model.

Additional required sections:

- Contrato Visual (UI lock) when `visible_ui: yes`, or an explicit `UI lock: not-applicable` when it is not
- Parent epic context and inherited-invariant mapping when a parent epic exists
- Contrato entre Fases (precondiciones/postcondiciones) when a parent epic exists
- When the PRD creates or changes persisted data: the data section from `template-sections/data-model.md`, whose blocks hold them: "Ubicación en el dominio" (DDD placement and cross-context dependency rules), "Enumeraciones" (enumeration strategy), "Ciclo de vida" (lifecycle rules), and "Aislamiento entre tenants" (tenant integrity rules, when the project is multi-tenant); otherwise `Persistencia: no aplica` with a one-line reason
- Mermaid class diagram, or the signature list its hard gate allows (see above)
- Casos de Uso table (mandatory, see below)
- Estrategia de Tests table (mandatory, see below)
- Matriz de Edge Cases table (mandatory, see below)
- Supuestos e integraciones table, from the Unknowns Inventory in `reference/calibration.md` (`Ninguno` with a one-line reason when there is no external or poorly known dependency)
- Qué queda obsoleto table, from the Obsolescence Scan in `reference/calibration.md` (`Ninguno` with a one-line reason when nothing becomes obsolete)
- Evidencia de Implementación section (initialized in the PRD template and completed only at `implement-change` closure)

---

### Phase 5: Self-Audit and Hardening

Load and execute [reference/self-audit.md](reference/self-audit.md). This is a hard gate; persist its required artifact and final readiness declaration before delivering the PRD.

## References

Load a reference only when its condition holds:

- [reference/execution-granularity.md](reference/execution-granularity.md) — read it in Phase 4, when writing phases and execution slices
- [reference/architecture-rules.md](reference/architecture-rules.md) — read it in Phase 4, when the PRD has a parent epic, creates or changes persisted entities, or defines enumerations
- [reference/traceability-tables.md](reference/traceability-tables.md) — read it in Phase 4, when filling the three mandatory traceability tables
- [reference/quality-bar.md](reference/quality-bar.md) — read it after each round of answers and before delivering the PRD
- [reference/visual-lock.md](reference/visual-lock.md) — read it in Phase 2 and Phase 4 when the request brings a prototype (HTML or image)

## 📄 PRD Structure Template

Use the canonical template at:

`.agents/skills/01-product/create-prd/PRD_TEMPLATE.md`

The template holds the sections every PRD needs. Conditional sections live in
`template-sections/` and are inserted only when they apply:
`epic-context.md` (the PRD has a parent epic), `visual-contract.md` (the
PRD changes visible UI), and `data-model.md` (the PRD creates or changes persisted data).
