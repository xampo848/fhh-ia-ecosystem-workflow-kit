# Pattern Skill Template

Copy this file into:

` .agents/skills/06-patterns/<domain>/<skill>/SKILL.md `

Then replace every placeholder.

---
name: <pattern-skill-name>
description: "Reusable <domain> pattern for <repeatable-implementation-class>."
---

# <Pattern Skill Title>

## Trigger

Load when a slice <precise-technical-trigger>.

Examples:

- <example-trigger-1>
- <example-trigger-2>

## Must Read

- `.github/copilot-instructions.md`
- `<project-specific-instructions-or-docs>`
- `docs/patterns/<domain>/` (or equivalent fallback docs)

## Procedure

1. <step-1>
2. <step-2>
3. <step-3>
4. <step-4>
5. <step-5>

## Validation Hooks

- `<command-or-check-1>`
- `<command-or-check-2>`
- `<command-or-check-3>`

## Stop Conditions

- <ambiguity-or-risk-1>
- <ambiguity-or-risk-2>
- <ambiguity-or-risk-3>

## Out of Scope

- <what-this-pattern-must-not-cover-1>
- <what-this-pattern-must-not-cover-2>

## Registry Entry Template

Add one row under standards/pattern skills in `.agents/skills/registry.md`:

| Skill name | Class | Physical path | Trigger | Loading posture | Cost hint | Future structured key | Runtime notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<pattern-skill-name>` | Standards/pattern | `.agents/skills/06-patterns/<domain>/<skill>/SKILL.md` | `<narrow-trigger>` | Just-in-time | `<lean|balanced|premium>` | `pattern-<domain>-<pattern-skill-name>` | `<short-runtime-note>` |

## Post-Create Checklist

1. Skill file exists in `.agents/skills/06-patterns/<domain>/<skill>/SKILL.md`.
2. Registry row added in `.agents/skills/registry.md`.
3. `.agents/skills/registry.json` updated.
4. `.agents/skills/registry.cache.json` updated.
5. No stale references to removed or foreign-project patterns.