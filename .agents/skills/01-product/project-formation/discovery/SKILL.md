---
name: project-formation-discovery
description: Conversational discovery stage for PMs. Guides user and stakeholder research with structured questions to define a bounded project problem and appetite.
argument-hint: Initiative context and what is known or unknown.
user-invocable: false
metadata:
  author: fhh-ia-ecosystem
  tags:
    - discovery
    - stakeholders
    - users
    - shape-up
---

# Project Formation Discovery

## Purpose

Guide the PM through discovery without jumping to solutions too early.

Discovery focuses on decision quality, not document volume.

## Core conversational behavior

- Ask one focused question at a time.
- Summarize what was learned after every 3 to 5 answers.
- Detect missing stakeholders and call them out explicitly.
- Convert vague statements into testable problem language.

Use story prompts of the form "Tell me about the last time..." to reduce speculative answers.

When ambiguity is high, ask one precision question before continuing:

- "Which user and workflow are we talking about exactly?"
- "What does this pain look like in a recent real case?"
- "What metric would show the pain improved?"

## Shape Up framing

Discovery must produce:

- bounded problem
- appetite hint (small/medium/large bet)
- top risks and rabbit holes
- confidence level in problem clarity

Also identify likely `grab-bag` risk (scope that is too broad to be shaped coherently).

## Question tracks

Use these tracks adaptively:

1. User reality: What is painful today, how often, and what workaround exists?
2. Stakeholder reality: Who wins, who loses, who blocks, who funds?
3. Signal quality: Which claims are evidence versus assumptions?
4. Constraints: Time, team, legal, data, integration boundaries.

Question bank and sequencing rules: `assets/interview-guide.md`.

## Optional Interview Prep mode

Use this mode when discovery quality is blocked by missing or conflicting evidence.

Trigger Interview Prep when at least one applies:

- key claims come only from assumptions,
- stakeholder and user narratives conflict,
- no recent real usage example can be described,
- confidence stays `low` after one focused follow-up.

Interview Prep outputs (lightweight, decision-first):

- interview objective linked to one pending decision,
- target profile (stakeholder or user) and sample size intent,
- 6-8 high-signal questions tied to real episodes,
- assumptions to validate or refute,
- return condition for normal discovery flow.

Use template: `assets/interview-prep-template.md`.

## Mandatory outputs

- Problem statement in plain language.
- Jobs and pains map by audience.
- Risk list with unknowns and rabbit holes.
- Discovery confidence (high/medium/low).
- Recommendation to continue or loop discovery.
- Interview Prep brief when optional mode is triggered.

Use template: `assets/evidence-log-template.md`.

## Exit gate

Do not leave discovery until these are true:

- Problem is specific and user-grounded.
- At least one critical assumption is explicit.
- Appetite is proposed and justified.

Full gate checklist: `assets/discovery-exit-gate.md`.

If gate fails, return to targeted discovery and ask only the minimal questions needed to unblock shaping.

If Interview Prep mode was triggered, discovery cannot close until one is true:

- evidence from interviews is logged and synthesized,
- or the PM explicitly accepts remaining risk and documents why interview evidence is deferred.
