# Pattern Locking

## Purpose

Before drafting, lock the implementation approach to one comparable local pattern or explicitly record its absence. Persist the result in `<prd-directory>/_meta/orchestration.md` under `## Pattern Lock`.

## Procedure

Find the nearest local pattern that shares the relevant boundary, failure mode, artifact shape, or validation style. Examples in this repository include:

- hard gates and phase sequencing in workflow `SKILL.md` files
- PRD-local TOON execution locks in `implement-prd`
- explicit `route-options` in `workflow-router`

Record:

- the adopted pattern name, or `none`
- anchor file or files
- reused parts
- intentionally different parts
- justification for the decision

When no comparable local pattern exists, state exactly: `no local comparable pattern found`. This is an explicit outcome, never a silently omitted section.

## Solution Sketch Offer

Offer `solution-sketch` and stop before locking when this Phase 3 pass would have to invent classes or relationships instead of reusing a local anchor, or when the class diagram would be placeholders.

Do not auto-start the skill. Wait for explicit authorization.

If the user declines, record `sketch: skipped` under `## Pattern Lock` and continue with the local pattern or `no local comparable pattern found`.

If `docs/design/<slug>-sketch.md` already exists, inherit it as an anchor: reuse this sketch plus the local pattern. Do not invert a locked sketch without an explicit [critical-stance](../../shared/critical-stance.md) challenge, same bar as `INV-CUT`.

Do not mention `solution-sketch` when compact mode applies or a comparable local pattern is already obvious.

## Challenge Before Locking

Apply [../shared/critical-stance.md](../shared/critical-stance.md). Before recording the pattern lock, name the runner-up pattern (or a from-scratch alternative) and state directly why it loses, even when the AI generated the candidate itself. Do not lock a pattern on convenience alone.

## Summary Visibility

Persist the artifact even when no summary is shown in chat. Show it on explicit user request or when no comparable pattern exists, candidate anchors conflict, the selected pattern requires an unexplained divergence, or the available evidence has low confidence.