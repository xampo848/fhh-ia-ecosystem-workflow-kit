# Runbook Template

Use this template when the user asks to save a project procedure (environment
promotion, release, hotfix, rollback) as a runbook: the runbook variant of
`add-project-pattern`. Copy the fenced block below into the project overlay:

`.agents/project/skills/runbooks/<runbook-name>/SKILL.md`

The folder name equals the frontmatter `name`, and the catalog row has class
`Runbook` (contract: `.agents/kit-boundary.md`, section "Runbooks"). Replace
every placeholder. Inside the copied body, name kit skills by name, never by
path. The kit ships no runbook; this file holds placeholders only.

```markdown
---
name: <runbook-name>
description: "Project runbook for <operational-procedure>."
---

# <Runbook Title>

## Trigger

Load when the user asks to <operational-action>.

Phrases:

- <operational-phrase-1>
- <operational-phrase-2>

## Owner

- Role: <owning-team-or-role>
- last_verified: <YYYY-MM-DD>

## Preconditions

Check every precondition before the first step. If one fails, stop, name it
and how to check it, and run nothing.

- <precondition-1> — check: `<command-or-observation>`
- <precondition-2> — check: `<command-or-observation>`

## Steps

1. <reversible-step> — `<command-or-action>`
2. <irreversible-step> — `<command-or-action>`
   - confirm: required
   - risk: <concrete-consequence>
3. <code-changing-step>: this step changes code, so it goes through the kit
   route (the N1 rule or `implement-change`); the runbook resumes at the next
   step once that route closes.
4. <step-that-needs-a-secret> — `<command-or-action>` reading `<SECRET_NAME>`
   from `<secret-store-name>`

Irreversible includes push, deploy, delete, data migration, and publish: every
such step carries `confirm: required` and `risk:`. Each one names its risk and
waits for its own yes; one yes covers one step.

Secrets appear only as names (`<SECRET_NAME>`, `<secret-store-name>`), never
as values: this file is committed with the repository.

## Verification

- <observable-result-1> — check: `<command-or-observation>`
- <observable-result-2> — check: `<command-or-observation>`

## Rollback

1. <rollback-step> — `<command-or-action>`
2. <irreversible-rollback-step> — `<command-or-action>`
   - confirm: required
   - risk: <concrete-consequence>

When no rollback exists, replace the steps with `Not applicable: <reason>`.
```

## Catalog Entry Template

Add one row to the `Skills` table of `.agents/project/index.md` (create the
file with the table header from `.agents/kit-boundary.md` when it is missing):

| Skill name | Class | Trigger | Physical path | Cost hint |
| --- | --- | --- | --- | --- |
| `<runbook-name>` | Runbook | `<operational-phrases>` | `.agents/project/skills/runbooks/<runbook-name>/SKILL.md` | `<lean, balanced, or premium>` |

## Post-Create Checklist

1. The file exists at `.agents/project/skills/runbooks/<runbook-name>/SKILL.md`,
   and its folder equals the frontmatter `name`.
2. One `Runbook` row in `.agents/project/index.md` with that exact path.
3. The headings `## Trigger`, `## Owner`, `## Preconditions`, `## Steps`,
   `## Verification`, and `## Rollback` are present, and `## Owner` has
   `last_verified`.
4. Every precondition has a check; every irreversible step, including rollback
   steps, has `confirm: required` and `risk:`.
5. No secret values: only variable or secret-store names.
6. The name collides with no kit skill, and the body names kit skills by name,
   never by path.
7. No kit file changed (`git status` shows nothing under `.agents/skills/`).
