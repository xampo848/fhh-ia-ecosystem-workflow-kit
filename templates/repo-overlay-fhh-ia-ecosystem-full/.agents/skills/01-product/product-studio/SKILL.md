---
name: product-studio
description: "Use when the user has a product-level question before implementation: clarify strategy, understand customer jobs, validate problems, prioritize opportunities, sequence a roadmap, or turn a need into development-ready user stories. It is the pre-epic and pre-PRD product thinking layer: it helps decide what should exist, why it matters, what to validate, and which epics or PRDs should be created next."
argument-hint: "[command] [topic or context]"
user-invocable: true
---

Runs PM workflows from one entry point. Use this when the user has a product
problem, but is not sure which framework or artifact should come first.

`product-studio` is not an implementation workflow and not a replacement for
`create-epic` or `create-prd`. It sits before them when the product direction is
unclear, broad, disputed, or needs prioritization.

## Core promise

- One invocation can diagnose the right PM workflow.
- Once routed, go deep on the selected method instead of staying generic.
- Guide by default, do not expect the user to provide a perfect brief upfront.
- Produce concrete artifacts, not just theory.

## What users can achieve with product-studio

Use `product-studio` to answer questions like:

- What problem should we solve first?
- Which customer job, pain, or outcome matters most?
- Is this idea ready to become an epic, or does it need discovery first?
- How should several opportunities be prioritized?
- What should the roadmap sequence be?
- What user story captures this need without over-scoping it?

Typical outputs:

- Product strategy brief.
- Discovery plan or validation plan.
- Jobs-to-be-done map.
- Prioritization recommendation.
- Roadmap or initiative sequence.
- Development-ready user story.
- Recommendation for one or more `create-epic` or `create-prd` follow-ups.

Use `create-epic` instead when the objective is already clear enough to become a
formal initiative with research, scope boundaries, architecture implications, and
a PRD queue.

Use `create-prd` instead when the feature is already clear enough to specify
requirements, data rules, UX states, acceptance criteria, and implementation
phases.

## Load order

Before recommending a framework or drafting an artifact:

1. Load [workshop-facilitation/SKILL.md](workshop-facilitation/SKILL.md).
2. Inspect the first word of the invocation.
3. If it matches a command below, load the mapped skill and follow it.
4. If it does not match, run the diagnostic intake and route to the best command.

## Commands

| Command | Outcome | Use when | Skill |
|---|---|---|---|
| `strategy [topic]` | End-to-end strategy session | New initiative, repositioning, unclear direction, stakeholder alignment | [product-strategy-session/SKILL.md](product-strategy-session/SKILL.md) |
| `discovery [topic]` | Structured discovery cycle | Need to validate a problem, run research, or test assumptions | [discovery-process/SKILL.md](discovery-process/SKILL.md) |
| `jtbd [segment or problem]` | Jobs, pains, gains map | Need customer motivation, unmet needs, or sharper messaging inputs | [jobs-to-be-done/SKILL.md](jobs-to-be-done/SKILL.md) |
| `prioritize [options]` | Recommended prioritization framework | Need to choose how to rank ideas, bets, or backlog items | [prioritization-advisor/SKILL.md](prioritization-advisor/SKILL.md) |
| `roadmap [initiative or horizon]` | Strategic roadmap | Need sequencing across releases, quarters, or themes | [roadmap-planning/SKILL.md](roadmap-planning/SKILL.md) |
| `story [feature or need]` | Development-ready user story | Need a concise story with acceptance criteria | [user-story/SKILL.md](user-story/SKILL.md) |
| `help` | Menu + routing help | The user wants the available PM workflows explained | This file |

## Default behavior

### 1. No argument or `help`

Render a short command menu grouped by job to be done:

- Explore: `strategy`, `discovery`, `jtbd`
- Decide: `prioritize`, `roadmap`
- Specify: `story`

Then ask one concise question: what outcome the user needs right now.

### 2. Command provided

Load the mapped skill and run it using the facilitation protocol. Do not force a generic intake if the user's command is already specific enough.

### 3. Freeform request

Run a short diagnostic intake, then route immediately:

1. Ask what output the user needs now.
2. Ask how much evidence or context already exists.
3. Ask who needs to align on the result.
4. Ask the time horizon or level of commitment.

After the intake:

- Recommend one primary command.
- Explain the recommendation in plain language.
- Mention one adjacent command only if it materially improves the sequence.
- Begin the selected workflow immediately unless the user redirects.

## Routing heuristics

Use these signals when the user is vague:

- "What should we build?", "where should we go?", "we need alignment" -> `strategy`
- "We need to validate the problem", "I need interviews or experiments" -> `discovery`
- "I need the real customer need", "what are they hiring us for?" -> `jtbd`
- "How do I score or rank this?" -> `prioritize`
- "How do we sequence this across quarters or releases?" -> `roadmap`
- "Turn this into dev-ready work" -> `story`

If the user clearly needs multiple workflows, recommend the minimum sequence. Default sequence:

1. `strategy`
2. `discovery`
3. `prioritize`
4. `roadmap`
5. `story`

Do not run multiple workflows at once unless the user explicitly asks for that.

## Interaction rules

- Keep the experience guided and concrete.
- Prefer one question per turn.
- Use numbered options when that reduces friction.
- Distinguish facts, assumptions, and recommendations.
- When the user asks for speed, switch to best-guess drafting and mark assumptions.
- If a selected workflow is blocked by missing context, ask only for the minimum missing input or recommend the predecessor workflow.
