---
name: workshop-facilitation
description: "Shared facilitation protocol for PM workflows. Use when a PM skill should guide the user step by step with one-question turns, progress labels, and explicit recommendations instead of dumping a generic framework."
user-invocable: false
---

Provides the interaction contract for PM workflows in this starter pack.

## Purpose

Keep PM skills easy to use under uncertainty. This file defines how to run guided sessions across strategy, discovery, JTBD, prioritization, roadmap, and user story workflows.

## Session heads-up

Start each workflow with a short heads-up that states:

1. What problem is being solved.
2. What artifact or decision the user will get.
3. Whether the flow will be guided, synthesized from a context dump, or drafted with best-guess assumptions.

Keep this to 2-3 short sentences.

## Entry modes

If the user has not already implied a working style, offer three modes:

1. Guided: ask one question at a time and build the artifact interactively.
2. Context dump: let the user paste everything they know, then structure it.
3. Best guess: infer from sparse context, draft the strongest version, and make assumptions explicit.

If the user's request already implies a mode, choose it and say why in one sentence instead of re-asking.

## Question protocol

1. Ask one question per turn.
2. Use plain language before framework jargon.
3. Prefer 3-5 numbered options when the decision is common or repetitive.
4. Include `Other (specify)` when options might be incomplete.
5. If the user gives a large context dump mid-session, absorb it and skip questions already answered.

## Progress protocol

When the workflow spans multiple turns, show a compact progress label such as:

- `Intake 2/4`
- `Context 3/6`
- `Scoring 1/4`
- `Decision 1/2`

Use the label only when it improves orientation. Do not overuse it on single-turn tasks.

## Decision protocol

At decision points:

1. Recommend the strongest next move.
2. Explain why it fits the stated goal.
3. Mention the main tradeoff or plausible alternative.

Be opinionated when the context is sufficient. Do not hide behind generic pros and cons.

## Diagnostic intake

When a router skill needs to decide which PM workflow to run, ask up to 4 adaptive questions:

1. What output is needed right now.
2. How much evidence or context already exists.
3. Who needs to align on the answer.
4. What time horizon or commitment level is involved.

After the intake:

- Route to one primary workflow.
- Suggest a predecessor or successor only when it changes outcome quality.
- Start the recommended workflow immediately unless the user chooses another route.

## Output discipline

- Separate facts from assumptions.
- Reuse the user's language for personas, problems, and outcomes when it is clear.
- Prefer decision-ready artifacts over long theory dumps.
- If the user asks for speed, switch to context-dump or best-guess mode and move forward.
- If information is missing, ask the minimum blocking question.

## Interruption handling

- If the user changes direction, state what is being paused and switch cleanly.
- If the user says "resume", continue from the last visible progress label or decision point.
- If the user asks for a final artifact immediately, produce it with explicit assumptions instead of refusing.

## Closing protocol

End each substantial workflow with:

1. The artifact or decision produced.
2. The assumptions that still matter.
3. The best next PM move.