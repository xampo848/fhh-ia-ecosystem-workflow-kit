---
name: solution-sketch
description: "Optional short design workshop before writing a PRD or epic. Compares 2-3 solution shapes with simple diagrams, locks one, and writes a commitable sketch so humans and later workflows share the same design decisions."
argument-hint: "Describe the problem and the design uncertainty to resolve"
user-invocable: true
metadata:
  author: fhh-ia-ecosystem
  tags:
    - design
    - architecture
    - sketch
    - product
---

# Solution Sketch

Use this skill for a short design workshop *before* `create-prd` drafting or an epic PRD queue.

This is not a PRD, not an epic, and not a brainstorm without a close. It produces one commitable sketch and stops.

Human flow map: `docs/workflow/decisions/2026-08-24-solution-sketch-flow.md`.

## When to use

- The user asks to sketch classes, compare architectures, or brainstorm the solution before a spec.
- `create-prd` pattern lock would have to invent classes or relationships instead of reusing a local anchor.
- `create-epic` is about to lock a model shared by several child PRDs.
- `project-formation` shaping picked a shape and the model is still open.

## When not to use

- Compact `create-prd`, `generate-pm-ticket`, or an obvious local pattern.
- A `docs/design/<slug>-sketch.md` already exists for the same slug — reuse it.
- The user is choosing *what* to build, not *how* to design it.
- The user wants production code — route to `implement-prd` or its predecessor.

## Never auto-start

This skill starts only after explicit authorization (`usa solution-sketch`, `hacé el sketch`, or choosing it from an offer). An offer is not execution. If the user declines, record `sketch: skipped` in the parent artifact and resume the parent workflow.

## Core rules

1. Load [../shared/critical-stance.md](../shared/critical-stance.md). The winning option must survive one direct challenge.
2. Compare 2 or 3 options. One option is not a workshop.
3. Use whiteboard language. Prefer simple Mermaid flow or box diagrams. Use `classDiagram` only when class names are the decision.
4. Stop after three turns without a locked winner. Return to the parent workflow.
5. Do not write acceptance criteria, edge-case matrices, or implementation slices. If those appear, stop — this is becoming a second PRD.
6. Do not edit product code.

## Artifact

Write `docs/design/<slug>-sketch.md` using [references/sketch-template.md](references/sketch-template.md).

Required sections:

1. Problem in 3 lines
2. 2-3 options, each with a Mermaid diagram
3. Winner + discarded option + why
4. Names that exist: classes, owners, relationships
5. What is not created now
6. Questions that still block the PRD

If that path already exists, ask whether to reuse, version, or overwrite. Default is reuse.

## Protocol

### Turn 1 — options

State the problem in 3 lines. Draw 2-3 options. Do not lock yet.

### Turn 2 — challenge

Apply critical-stance to the likely winner. Name the discarded alternative and the concrete cost of picking the wrong one.

### Turn 3 — lock or stop

Either persist the sketch with a winner or stop: `no decision after three turns`. Do not take a fourth workshop turn.

## Resume

After a locked sketch, tell the user the next parent step: usually `create-prd` or, for a shared epic model, finish the epic cut and PRD queue. Child workflows must inherit this file and must not invert it without an explicit critical-stance challenge.

## Stop conditions

- Three turns with no winner.
- User declines the offer (`sketch: skipped`).
- The write-up starts to include AC, slices, or an edge-case matrix.
- The user asks to implement code.
- A sketch for the slug already exists and the user did not authorize overwrite.
