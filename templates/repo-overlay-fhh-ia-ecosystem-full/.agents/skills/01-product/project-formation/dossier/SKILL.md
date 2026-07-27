---
name: project-formation-dossier
description: Conversational finalization stage that assembles a formal project dossier with justifications, decisions, risks, and handoff. Includes optional jump to create-epic.
argument-hint: Outputs from discovery, shaping, roadmap, and GTM.
user-invocable: false
metadata:
  author: fhh-ia-ecosystem
  tags:
    - dossier
    - handoff
    - decision-log
    - epic
---

# Project Formation Dossier

## Purpose

Produce a formal project package that leadership and engineering can execute without rediscovery.

## Conversational behavior

- Validate completeness section by section.
- Ask missing-justification questions before closing.
- Keep language concise and decision-oriented.

## Required dossier sections

1. Executive summary
2. Problem and opportunity
3. Discovery findings
4. Shaped direction and tradeoffs
5. Roadmap and milestones
6. GTM plan
7. Risks and controls
8. Decision log
9. Open questions and follow-up experiments
10. Delivery handoff

## Decision log format

Each major decision includes:

- ID
- Owner
- Decision
- Why
- Alternatives rejected
- Revisit trigger

## Optional epic jump

After dossier closure, ask:

- "Do you want to formalize this as an epic now?"

If yes, produce a handoff prompt to `create-epic` including:

- appetite
- bounded problem
- shaped direction
- roadmap phases
- GTM constraints

## Exit gate

Dossier is complete when:

- decisions are justified
- risks are explicit
- implementation handoff is actionable
- PM explicitly confirms readiness to proceed
