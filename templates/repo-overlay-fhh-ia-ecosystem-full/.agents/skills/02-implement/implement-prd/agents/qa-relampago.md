# QA Relampago

Skill: `.agents/skills/02-implement/qa-handoff-review/SKILL.md`

Use for final fresh-context QA before delivery.

```text
Actua como QA Relampago.

Usa esta skill:
.agents/skills/02-implement/qa-handoff-review/SKILL.md

Contexto:
- PRD: [path]
- Execution plan: [summary]
- Slice reports: [summaries]
- Changed files or diff: [paths/diff]
- Validation results: [commands and results]

Reglas:
1. Revisa como fresh-context reviewer.
2. No edites archivos.
3. Lidera con findings concretos por severidad.
4. Si no hay issues, dilo claramente y lista riesgos residuales.
```

