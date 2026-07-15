---
name: implementation-skill-matcher
description: "Delegate-only skill for implement-prd. Matches each approved implementation slice to required pattern skills, optional capabilities, fallback docs, validation hooks, and handoff metadata before coding starts."
context: fork
---

# Implementation Skill Matcher

Use after `implementation-slicing` and before any coding delegate starts.

This skill does **not** edit product code. It classifies reusable knowledge and
capability needs per slice.

## Mission

Receive already-defined slices and decide, for each slice:

- which repo-owned pattern skills are required;
- which optional capabilities may help if active/attached;
- which fallback docs apply if a skill is missing;
- which validation hooks and handoff fields must accompany the slice;
- whether matching is confident, partial, or blocked.

## Responsibility Boundary

### This skill owns

- `required_pattern_skills`
- `optional_capabilities`
- `fallback_docs`
- `validation_hooks`
- `handoff_required_fields`
- `match_confidence`
- `blocked_reason`

### This skill must not own

- re-slicing work;
- reassigning slice ownership;
- changing file ownership;
- editing production code;
- install/attach semantics for external capabilities.

If a slice is too ambiguous to match safely, return `blocked` or `partial`.
Do not silently rewrite the slice plan.

## Required Inputs

- Slice table from `implementation-slicing`.
- Relevant PRD excerpts for the slice.
- Focused discovery notes or explicit reason discovery was skipped.
- `.agents/skills/registry.md`
- `.agents/skills/06-patterns/README.md`
- Known capability availability/attach state when available.
- Optional derived cache `.agents/skills/registry.cache.json` only after
  `python3 scripts/refresh_skill_registry_cache.py --check` passes.

Use an index-first and path-first strategy. Do **not** bulk-load every
`SKILL.md`. Prefer registry metadata first, then reference exact paths only for
selected skills.

The derived cache is a preflight/index aid only. It is not a source of truth and
must never replace reading `.agents/skills/registry.md` or the exact selected
`SKILL.md` files.

## Matching Procedure

1. Read the slice outcome, scope, owner skill, files owned, acceptance criteria,
   tests, validation, and stop conditions.
2. Determine the technical surface touched by the slice: backend, frontend,
   contract, domain, validation, docs-only, or mixed.
3. Check `.agents/skills/registry.md` and `.agents/skills/06-patterns/README.md`
   to identify candidate pattern skills and boundary rules.
4. Select `required_pattern_skills` only when the slice clearly needs reusable
   procedural knowledge.
5. For each required skill, return:
   - logical name;
   - exact `SKILL.md` path;
   - concise reason;
   - `required_before` stage: `read`, `write`, `test`, or `review`.
6. Evaluate `optional_capabilities` only if they are relevant and known to be
   available/attached or worth checking. Keep them optional.
7. If no relevant pattern skill exists, return `fallback_docs` with exact paths
   and reasons.
8. Refine or confirm `validation_hooks` for the slice. Do not replace the slice
   owner's validation with vague “run everything” advice.
9. Return `handoff_required_fields` using the neutral contract from
   `.agents/skills/06-patterns/README.md`.
10. Set `match_confidence`:
    - `high` when the slice maps cleanly to known patterns;
    - `medium` when one safe fallback is needed;
    - `low` when ambiguity remains.
11. Set `blocked_reason` when:
    - the slice is too vague to match;
    - a required registry path is missing;
    - capability state is being treated as mandatory but is unknown;
    - the request would require re-slicing or ownership changes.

## Fallback And Missing-Skill Rules

- If a relevant pattern skill does not exist yet, prefer explicit `fallback_docs`
  over invention.
- If a registry entry exists but the path is missing, return `blocked`.
- If a capability is available but not attached/active, do not count it as
  active.
- If both a pattern skill and a fallback doc exist, prefer the pattern skill
  unless the slice is safer with the doc or the skill is not mature enough.

## Controlled-lite Behavior

For `controlled-lite`:

- keep output compact;
- support 1–3 slices cleanly;
- do not force delegation if the orchestrator can safely run matching inline.

## Stop And Ask When

- The slice outcome is too broad or unclear to classify safely.
- Matching would require changing ownership or dependencies.
- A required pattern skill path is missing from the filesystem.
- Capability availability materially changes implementation risk and is unknown.

## Handoff Output

Return exactly:

```text
Status: success | partial | blocked
Slice match table:
- Slice:
- Owner skill:
- Required pattern skills:
- Optional capabilities:
- Fallback docs:
- Validation hooks:
- Handoff required fields:
- Match confidence:
- Blocked reason:
Global notes:
Next: implementer-alias | orchestrator-inline | user-clarification
```

The output must be structured and compact. Do not return vague prose only.
