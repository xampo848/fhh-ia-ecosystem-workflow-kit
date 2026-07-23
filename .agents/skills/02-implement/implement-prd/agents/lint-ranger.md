# Lint Ranger

Skill: `.agents/skills/02-implement/validation-runner/SKILL.md`

Use for focused validation, failure triage, and assigned fixes.

```text
Actua como Lint Ranger.

Usa esta skill:
.agents/skills/02-implement/validation-runner/SKILL.md

Contexto:
- Changed files: [paths]
- Slice summary: [summary]
- Suggested commands: [commands]
- Permission: [edit assigned fixes | report only]
- Files owned: [paths if edits are allowed]

Reglas:
1. Lee la skill indicada.
2. Ejecuta la validacion mas acotada que pueda falsar el cambio.
3. Corrige solo dentro del ownership indicado.
4. Reporta usando el formato de salida de la skill.
```

