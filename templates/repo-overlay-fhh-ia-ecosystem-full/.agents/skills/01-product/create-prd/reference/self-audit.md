# Self-Audit And Hardening

## Purpose

After drafting, perform the final hard gate before delivering the PRD. Persist the result in `.ai-work/<prd-slug>/orchestration.md` under `## Self-Audit`.

## Quality Checklist

- No open questions remain and scope boundaries are explicit.
- Every acceptance criterion, use case, test-strategy row, and mandatory edge-case category is mapped to evidence or a justified `No aplica`.
- Parent invariants map to acceptance criteria without unresolved contradictions.
- If the parent epic locked a live path and phase cut, this PRD does not invert that sequence.
- A comparable anchor is recorded when available; identifiers follow repository language rules.
- Current state references real files, phases have Definitions of Done, and execution slices have ownership, validation, evidence, stop conditions, and activation where applicable.
- Slices do not combine backend/frontend or multiple high-risk boundaries without a written split rationale.
- Business rules are confirmed decisions, the decision table preserves the conversation, and product future scope is explicitly out of the current PRD.
- Risks have mitigations; the Mermaid class diagram, data-model, and flow artifacts are present; relevant architecture and standards were checked.
- If `visible_ui: yes`, the Contrato Visual (UI lock) is complete; a mockup or photo may be cited but does not replace the lock. If `visible_ui: no`, `UI lock: not-applicable` is recorded with a one-line reason.

## Adversarial Review

Challenge the draft:

- Would `implement-prd` need to invent behavior, ownership, or validation?
- Is a phase a large bucket instead of a milestone with executable slices?
- Does any acceptance criterion lack evidence, or any use case lack a linked test or expected edge case?
- Does the edge-case matrix omit a mandatory category without justification?
- Does the Mermaid class diagram represent the confirmed classes and relationships rather than placeholders or a flowchart?
- Can a reviewer distinguish current scope, future scope, and blocked unknowns?
- If `visible_ui: yes`, would `implement-prd` still have to invent density, hierarchy, primary action, or UI states?
- Does the PRD match the repository's structure and rigor?
- Would `implement-change` discover the behavior of an external dependency at execution time?
- Does any assumed item in `Supuestos e integraciones` affect an acceptance criterion without verification or an early verification slice?
- After the change, would two sources of truth remain for anything listed (or missing) in `Que queda obsoleto`?

## Size Signals

Measure the PRD before declaring it ready. Run
`node .agents/skills/01-product/create-prd/scripts/prd-size-signals.mjs --prd <prd> [--hazards <n>] [--question-rounds <n>]`
or count by hand:

| Signal | Default threshold |
| --- | --- |
| implementation slices | more than 8 |
| acceptance criteria | more than 20 |
| phases | more than 3 |
| distinct hazard types (migration, public contract, tenancy, background execution, external integration, visible UI) | 4 or more |
| blocking questions still open after 3 rounds | counts as one signal |
| lines | more than about 600 (secondary: never counts alone) |

- **1 signal:** record a warning in the Self-Audit; it does not block.
- **2 or more:** propose splitting before declaring `ready for
  implement-prd`, normally along the PRD's own phase boundaries into an epic
  with child PRDs (`create-epic` and its `Contrato entre Fases`). The user
  decides.
- **If the user decides not to split:** record the reason. Phase-by-phase
  execution with a review pause and a partial section 10 closure per phase is
  the recommended way to implement it; the user may still choose autonomous
  execution (`implement-change/reference/modifiers.md`).
- Thresholds are defaults calibrated on real PRDs. A project may override them
  with a `prd_size_thresholds` line in `.agents/project-context.md`.

## Required Artifact

Write these fields under `## Self-Audit`:

- hardening summary
- residual risks
- final declaration: `ready for implement-prd` or `not ready`, with a concrete reason

## Summary Visibility

Persist the artifact even when no summary is shown in chat. Show it on explicit user request or when an acceptance mapping is missing, a residual risk remains unmitigated, the readiness declaration is `not ready`, or an inherited invariant, architecture, data, or contract gap is unresolved.