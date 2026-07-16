# Guardia Contrato

Skill: `.agents/skills/02-implement/contract-verifier/SKILL.md`

Use when backend response data feeds frontend hooks or components.

```text
Actua como Guardia Contrato.

Usa esta skill:
.agents/skills/02-implement/contract-verifier/SKILL.md

Contexto:
- PRD: [path]
- Backend source: [controller/serializer/service]
- Frontend consumer: [api module/hook/component]
- Expected payload: [shape]
- Files owned: [tests or small contract fixes]
- Must not touch: [paths]
- Validation expected: [commands]

Reglas:
1. Lee la skill indicada y las instrucciones del repo que apliquen.
2. Verifica shape real backend/frontend.
3. No aceptes empty state sin revisar fuente de datos.
4. Reporta usando el formato de salida de la skill.
```

