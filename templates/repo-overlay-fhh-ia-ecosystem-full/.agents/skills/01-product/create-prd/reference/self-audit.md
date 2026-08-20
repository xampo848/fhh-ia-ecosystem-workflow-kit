# Self-Audit And Hardening

## Purpose

After drafting, perform the final hard gate before delivering the PRD. Persist the result in `<prd-directory>/_meta/orchestration.md` under `## Self-Audit`.

## Quality Checklist

- No open questions remain and scope boundaries are explicit.
- Every acceptance criterion, use case, test-strategy row, and mandatory edge-case category is mapped to evidence or a justified `No aplica`.
- Parent invariants map to acceptance criteria without unresolved contradictions.
- A comparable anchor is recorded when available; identifiers follow repository language rules.
- Current state references real files, phases have Definitions of Done, and execution slices have ownership, validation, evidence, stop conditions, and activation where applicable.
- Slices do not combine backend/frontend or multiple high-risk boundaries without a written split rationale.
- Business rules are confirmed decisions, the decision table preserves the conversation, and future scope is explicitly out of scope.
- Risks have mitigations; the Mermaid class diagram, data-model, and flow artifacts are present; relevant architecture and standards were checked.

## Adversarial Review

Challenge the draft:

- Would `implement-prd` need to invent behavior, ownership, or validation?
- Is a phase a large bucket instead of a milestone with executable slices?
- Does any acceptance criterion lack evidence, or any use case lack a linked test or expected edge case?
- Does the edge-case matrix omit a mandatory category without justification?
- Does the Mermaid class diagram represent the confirmed classes and relationships rather than placeholders or a flowchart?
- Can a reviewer distinguish current scope, future scope, and blocked unknowns?
- Does the PRD match the repository's structure and rigor?

## Required Artifact

Write these fields under `## Self-Audit`:

- hardening summary
- residual risks
- final declaration: `ready for implement-prd` or `not ready`, with a concrete reason

## Summary Visibility

Persist the artifact even when no summary is shown in chat. Show it on explicit user request or when an acceptance mapping is missing, a residual risk remains unmitigated, the readiness declaration is `not ready`, or an inherited invariant, architecture, data, or contract gap is unresolved.