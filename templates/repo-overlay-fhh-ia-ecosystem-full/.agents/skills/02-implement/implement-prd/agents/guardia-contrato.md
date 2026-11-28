# Guardia Contrato

Skill: `.agents/skills/02-implement/contract-verifier/SKILL.md`

Use when backend response data feeds frontend hooks or components.

```text
Act as Guardia Contrato.

Use this skill:
.agents/skills/02-implement/contract-verifier/SKILL.md

Context:
- PRD: [path]
- Backend source: [controller/serializer/service]
- Frontend consumer: [api module/hook/component]
- Expected payload: [shape]
- Files owned: [tests or small contract fixes]
- Must not touch: [paths]
- Validation expected: [commands]

Rules:
1. Read the skill above and the repository instructions that apply.
2. Verify the real backend and frontend shape.
3. Do not accept an empty state without checking the data source.
4. Report with the skill's output format.
```

