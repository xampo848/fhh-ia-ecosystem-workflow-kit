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

## Conversational behavior

- Challenge weak assumptions with direct questions.
- Keep the PM in decision mode, not brainstorming forever.
- Present tradeoffs in simple language.
- Name rabbit holes and how to avoid them.

## Shape Up artifacts

Produce these artifacts:

- appetite-aligned approach
- no-go areas (what we intentionally do not build now)
- risk reduction plan
- confidence level for betting

## Flow

1. Reconfirm appetite and success signal.
2. Generate 3 options:
   - safe incremental
   - balanced
   - high-upside/high-risk
3. Compare options on user impact, complexity, reversibility, and time to value.
4. Select recommended shape with rationale.
5. Capture unresolved risks and validation tests.

## Internet research mode

If external benchmarks are needed:

- use official docs and primary sources first
- record source URL and date
- explicitly state relevance to the decision

## Exit gate

Shaping is complete when:

- one recommended shape exists
- tradeoffs are explicit
- top rabbit holes have containment strategy
- the PM can justify why this is the right bet now
