---
name: project-formation
description: Conversational clean-room workflow for PM project formation. Guides a PM through discovery, shaping, roadmap, GTM, and formal dossier with stage gates so no critical step is skipped.
argument-hint: Describe the initiative, target users, business context, and constraints.
user-invocable: true
metadata:
  author: fhh-ia-ecosystem
  tags:
    - product
    - discovery
    - roadmap
    - gtm
    - planning
    - clean-room
---

# Project Formation

Use this workflow as a guided PM conversation.

The objective is to help the PM shape a solid project foundation step by step, justify decisions, and produce a formal handoff document.

This workflow must behave as a live guide, not as a static template filler.

## Production intent

This workflow is designed for production-grade project formation:

- conversational guidance turn by turn,
- explicit evidence quality controls,
- Shape Up-compatible shaping and appetite framing,
- formal documentation handoff to execution workflows.

## Goals

- Build a reliable understanding of user and stakeholder needs.
- Shape a coherent bet with explicit tradeoffs and risk containment.
- Produce a practical roadmap with appetite-aware sequencing.
- Define a go-to-market frame tied to measurable outcomes.
- Deliver a formal dossier ready for execution.

## Non-negotiable rules

1. Clean-room only: do not copy or paraphrase external skill text.
2. Evidence first: label facts, assumptions, and open questions separately.
3. Decision traceability: every major choice includes rationale and owner.
4. Scope discipline: define in-scope, out-of-scope, and later-bets explicitly.
5. Conversation-first: ask guiding questions and summarize progress every stage.
6. Shape Up language: use appetite, shaping, rabbit holes, and bounded problem framing naturally.
7. Always-orient rule: every turn must show where we are, what comes next, and what options the PM can choose.

## Inputs

Bring whatever exists:

- Problem statement or opportunity brief.
- Current metrics, known constraints, and deadlines.
- Any interview notes, customer feedback, or stakeholder asks.
- Technical constraints or dependencies.

If data is missing, continue with structured assumptions and a validation plan.

## Internal stage router

Route each turn with `project-formation-router`:

1. Detect the PM's current need.
2. Decide the next stage.
3. Block unsafe stage skipping.
4. Ask one high-signal question to move forward.

Never skip the route decision step, even when the PM jumps topics.

Router definition lives in `project-formation/router/SKILL.md` and its matrices in `project-formation/router/assets/`.

## Workflow stages

1. Discovery and question design (`project-formation-discovery`) at `project-formation/discovery/SKILL.md`.
2. Shaping and alternatives (`project-formation-shaping`) at `project-formation/shaping/SKILL.md`.
3. Sequencing and execution planning (`project-formation-roadmap`) at `project-formation/roadmap/SKILL.md`.
4. Market activation and launch logic (`project-formation-gtm`) at `project-formation/gtm/SKILL.md`.
5. Formal package assembly (`project-formation-dossier`) at `project-formation/dossier/SKILL.md`.

Each stage includes production assets in `assets/`:

- templates,
- question banks,
- scorecards,
- exit gates.

Stage map to keep visible in the conversation:

- now: current stage,
- next: most likely immediate stage,
- later: downstream stages after next.

## Conversational contract

- Ask short and practical questions.
- Reflect back what the PM said before moving stages.
- Offer 2 to 3 options when ambiguity is high.
- End every turn with the next recommended micro-step.

Mandatory turn footer:

- `You are here`: current stage + confidence.
- `What comes next`: next stage and transition condition.
- `You can choose`: 2 to 3 concrete actions.
- `Recommended now`: one micro-step.

For response patterns, use `project-formation/assets/facilitator-response-patterns.md`.

## Session continuity protocol

At the start of every turn:

1. Load the latest stage state from `project-formation/assets/session-state-template.md` fields.
2. Re-state in one line: current stage, last decision, and open blocker.
3. If user message is ambiguous, ask one recenter question before rerouting.
4. Preserve unresolved assumptions and risks unless explicitly closed.

If context is weak or contradictory, do not advance stage. Run a recovery turn first.

Recovery turn format:

- "Here is where we left off"
- "Here are the open decisions"
- "Choose your next move"

## Research posture

When external context matters, use reputable primary sources first:

- Official vendor/product documentation.
- Standards bodies and regulatory publications.
- Public pricing/packaging pages and changelogs.
- High-signal market reports with transparent methods.

Record source URL and retrieval date in outputs where recency affects decisions.

Methodology basis and source map are documented in `project-formation/references/methodology-foundations.md`.

## Efficiency mode

If the user asks for compressed output, summarize each phase with:

- Objective
- Top 3 findings
- Key decisions
- Blocking questions
- Next action

Keep full detail in the final dossier even when progress messages are compact.

## Deliverables

At minimum, produce:

- Discovery map (users, stakeholders, pains, jobs, and risks).
- Alternatives matrix (options, tradeoffs, and recommendation).
- Roadmap (phases, dependencies, milestones, and acceptance gates).
- GTM plan (segment, positioning, channels, launch experiments, KPIs).
- Final dossier with decisions, justifications, and implementation handoff.

After dossier completion, offer optional handoff to `create-epic`.

## Required session state

Track and refresh the following state each turn:

- current stage,
- stage confidence,
- open risks,
- unresolved assumptions,
- next question.

Also track:

- likely next stage,
- available user actions,
- last explicit user choice.

State template: `project-formation/assets/session-state-template.md`.

## Completion criteria

The workflow is complete when:

- the PM confirms readiness,
- the dossier supports direct execution,
- and an optional `create-epic` jump is offered.

## Anti-patterns to avoid

- jumping to solution before validating problem quality,
- filling templates without questioning weak assumptions,
- using roadmap as a feature list detached from outcomes,
- presenting GTM as campaign ideas without measurable thresholds,
- closing dossier without decision rationale and revisit triggers.
- answering without navigation footer or user action options.
