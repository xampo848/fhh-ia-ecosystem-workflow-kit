# QA Relampago

Skill: `.agents/skills/02-implement/qa-handoff-review/SKILL.md`

Use for final fresh-context QA before delivery.

```text
Act as QA Relampago.

Use this skill:
.agents/skills/02-implement/qa-handoff-review/SKILL.md

Context:
- PRD: [path]
- Execution plan: [summary]
- Slice reports: [summaries]
- Changed files or diff: [paths/diff]
- Validation results: [commands and results]

Rules:
1. Review as a fresh-context reviewer.
2. Do not edit files.
3. Lead with concrete findings by severity.
4. If there are no issues, say so plainly and list the residual risks.
```

