---
name: project-formation-shaping
description: Conversational shaping stage that explores alternatives, reduces risk, and proposes a coherent project approach at a defined appetite.
argument-hint: Discovery output including bounded problem, appetite, and risks.
user-invocable: false
metadata:
  author: fhh-ia-ecosystem
  tags:
    - shaping
    - alternatives
    - tradeoffs
    - shape-up
---

# Project Formation Shaping

## Purpose

Shape the solution enough to make a responsible bet without over-specifying implementation.

Target output is a clear pitch candidate, not a full implementation spec.

## Conversational behavior

- Challenge weak assumptions with direct questions.
- Keep the PM in decision mode, not brainstorming forever.
- Present tradeoffs in simple language.
- Name rabbit holes and how to avoid them.

When a PM proposes a broad redesign, ask for a narrower user pain baseline before continuing.

Before recommending a shape, remove one ambiguity with a direct question:

- "What makes option A clearly better than B for this appetite?"
- "What is explicitly out of scope in the recommended shape?"
- "Which tradeoff are we accepting knowingly?"

## Shape Up artifacts

Produce these artifacts:

- appetite-aligned approach
- no-go areas (what we intentionally do not build now)
- risk reduction plan
- confidence level for betting

Use `assets/pitch-template.md` as the canonical structure for the shaped output.

## Flow

1. Reconfirm appetite and success signal.
2. Generate 3 options:
   - safe incremental
   - balanced
   - high-upside/high-risk
3. Compare options on user impact, complexity, reversibility, and time to value.
4. Select recommended shape with rationale.
5. Capture unresolved risks and validation tests.

Use option scoring matrix in `assets/option-tradeoff-matrix.md`.

## Internet research mode

If external benchmarks are needed:

- use official docs and primary sources first
- record source URL and date
- explicitly state relevance to the decision

Research capture format: `assets/source-evidence-table.md`.

## Exit gate

Shaping is complete when:

- one recommended shape exists
- tradeoffs are explicit
- top rabbit holes have containment strategy
- the PM can justify why this is the right bet now

If the recommended shape is chosen and the model or classes are still open, offer `solution-sketch` once. Do not auto-start it. If the user declines, record `sketch: skipped` in the stage log and continue. Do not turn formation into endless brainstorming.

If confidence remains `medium` or lower, require one additional de-risking loop before roadmap.
