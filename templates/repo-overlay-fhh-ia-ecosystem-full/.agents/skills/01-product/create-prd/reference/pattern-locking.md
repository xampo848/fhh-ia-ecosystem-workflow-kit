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

## Challenge Before Locking

Apply [../shared/critical-stance.md](../shared/critical-stance.md). Before recording the pattern lock, name the runner-up pattern (or a from-scratch alternative) and state directly why it loses, even when the AI generated the candidate itself. Do not lock a pattern on convenience alone.

## Summary Visibility

Persist the artifact even when no summary is shown in chat. Show it on explicit user request or when no comparable pattern exists, candidate anchors conflict, the selected pattern requires an unexplained divergence, or the available evidence has low confidence.