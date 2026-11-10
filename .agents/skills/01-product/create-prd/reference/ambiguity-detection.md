# Ambiguity Detection

Read it in Phase 2, after calibration, when detecting ambiguities and asking the user.

## Purpose

After calibration, identify only ambiguities that block the design or produce materially different implementations. Ask them together in one structured message, then persist the result in `.ai-work/<prd-slug>/orchestration.md` under `## Ambiguity Log`.

## Coverage

Cover these classes when applicable:

- scope boundary, business rules, data/persistence, ownership/placement, and contract/interface
- division/allocation, identifiers, feature flags, language, DDD placement, tenancy, lifecycle, enumerations, and traceability
- async/background behavior, success/partial/failure states, idempotency/retries, and observability
- verification evidence, rollout/recovery, activation/adoption, parent invariants, inherited live-path/phase-cut, and future-scope exclusions
- visible UI / visual contract, when calibration records `visible_ui: yes`: new vs existing surface, density/composition, primary action, required UI states, and reference input

When `visible_ui: yes`, treat an unlocked screen as blocking ambiguity. Ask only questions that would produce a materially different layout or state set. A mockup, screenshot, Figma file, or photo is optional evidence, never a substitute for those fields. Do not demand high-fidelity mockups as a universal gate.

Use this format:

```text
Antes de continuar, necesito resolver estas dudas:

**[Category]**
1. [Concrete question]
2. [Concrete question]
```

## Question Budget

- Ask at most about 10 questions per round, grouped by category, each with the
  answer you propose, so the user only confirms or corrects.
- At most 3 rounds. If blocking questions still appear after the third round,
  the PRD is too large: count it as a size signal (see `self-audit.md`) and
  propose splitting it.
- Do not ask non-blocking questions. Record each as an assumption with its
  default value in the PRD's `Supuestos e integraciones` section; the user can
  change it.

## Edge-Case Confirmation Round

After the blocking questions, run one confirmation round for edge cases
instead of filling the matrix alone during drafting:

1. Present the six mandatory categories (datos vacíos, límites, errores,
   permisos/tenancy, concurrencia/orden, rollout/rollback) already prefilled
   from the code, each with your proposal.
2. Ask explicitly only about the rows that are business decisions (they cannot
   be deduced from the code). The user may answer "ok" for the whole block or
   correct single rows.
3. In the compact path, cover only the categories the change touches.

Do not ask for facts that the repository already establishes.
Do not reopen a resolved category or ask a serial follow-up unless an answer creates a materially different implementation.

## Challenge Before Resolving

Apply [../shared/critical-stance.md](../shared/critical-stance.md) to every answer received. Before writing a row in the resolved-decisions table, state the discarded alternative and why the chosen answer beats it. If the user's answer creates a scope, invariant, or contract risk, say so directly before recording it, even if the user already answered.

## Required Artifact

Write these fields under `## Ambiguity Log`:

- blocking questions grouped by category
- a resolved-decisions table, including the discarded alternative and challenge outcome for each high-impact row
- the explicit statement `no blocking ambiguity remains` before Phase 3 can start

## Summary Visibility

Persist the artifact even when no summary is shown in chat. Show it on explicit user request or when an inherited invariant conflicts, an architecture/data/contract ambiguity is unresolved, a decision changes ownership, or a required answer is missing.