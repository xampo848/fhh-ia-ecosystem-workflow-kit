---
name: project-formation-roadmap
description: Conversational roadmap stage to convert shaped direction into phased delivery with milestones, dependencies, risk controls, and confidence per phase.
argument-hint: Shaping recommendation, appetite, and known constraints.
user-invocable: false
metadata:
  author: fhh-ia-ecosystem
  tags:
    - roadmap
    - phases
    - sequencing
    - shape-up
---

# Project Formation Roadmap

## Purpose

Turn shaped direction into an execution path that respects appetite and avoids hidden scope creep.

Roadmap output must be strategic and explainable to product, engineering, and stakeholders.

## Conversational behavior

- Ask questions that expose sequencing mistakes.
- Push for small verifiable milestones.
- Keep each phase tied to one clear outcome.
- Surface where confidence is weak.

When uncertain, ask what must be true for each phase to succeed before locking sequence.

## Required structure

For each phase capture:

- phase objective
- in-scope and out-of-scope
- dependencies
- risk and mitigation
- success signal
- confidence (high/medium/low)

Use `assets/roadmap-template.md` and `assets/dependency-map-template.md`.

## Shape Up lens

- Use appetite as a boundary, not a deadline promise.
- Prefer bets that can be judged quickly.
- Split irreversible changes from reversible ones.

Prefer Now/Next/Later framing with confidence markers over fixed-date promises unless explicitly required.

## Exit gate

Roadmap is complete when:

- critical path is explicit
- high risks have owners and triggers
- each phase has measurable done criteria
- the PM can defend phase order and scope boundaries

Run readiness checklist in `assets/roadmap-readiness-checklist.md` before moving to GTM.
