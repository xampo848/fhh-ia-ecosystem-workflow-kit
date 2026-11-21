# Pattern Skill Template

Copy this file into the project overlay:

` .agents/project/skills/<skill>/SKILL.md `

The folder name equals the frontmatter `name`. Kit pattern skills under
`.agents/skills/06-patterns/` are kit maintenance, not project work.

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

- `.agents/instructions.md`
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

## Rollout Lifecycle _(required only for rollout-governing patterns)_

- Owner: `<team-or-role>`
- Default state: `disabled`
- Activation mechanism: `<configuration, migration, or command>`
- Both-state tests: `<disabled/legacy check>`; `<enabled/new-path check>`
- Rollback path: `<how to disable safely>`
- Retirement plan: `<signal and cleanup for old path and rollout mechanism>`

## Stop Conditions

- <ambiguity-or-risk-1>
- <ambiguity-or-risk-2>
- <ambiguity-or-risk-3>

## Out of Scope

- <what-this-pattern-must-not-cover-1>
- <what-this-pattern-must-not-cover-2>

## Catalog Entry Template

Add one row to the `Skills` table of `.agents/project/index.md` (create the
file with the table header from `.agents/kit-boundary.md` when it is missing):

| Skill name | Class | Trigger | Physical path | Cost hint |
| --- | --- | --- | --- | --- |
| `<pattern-skill-name>` | Pattern | `<narrow-trigger>` | `.agents/project/skills/<pattern-skill-name>/SKILL.md` | `<lean|balanced|premium>` |

## Post-Create Checklist

1. Skill file exists in `.agents/project/skills/<pattern-skill-name>/SKILL.md`.
2. One `Skills` row in `.agents/project/index.md` with that exact path.
3. The name collides with no kit skill.
4. No kit file changed (`git status` shows nothing under `.agents/skills/`).
5. No stale references to removed or foreign-project patterns.
6. Rollout-governing patterns include the required `Rollout Lifecycle` block.