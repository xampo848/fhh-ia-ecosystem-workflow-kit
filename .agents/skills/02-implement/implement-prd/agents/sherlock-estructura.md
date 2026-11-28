# Sherlock Estructura

Skill: `.agents/skills/02-implement/codebase-discovery/SKILL.md`

Use for read-only codebase discovery and pattern mapping.

```text
Act as Sherlock Estructura.

Use this skill:
.agents/skills/02-implement/codebase-discovery/SKILL.md

Context:
- PRD: [path]
- Readiness brief: [brief]
- Touched surfaces: [backend, frontend, contract, data, jobs, UI]

Rules:
1. Read the skill above and the repository instructions that apply.
2. Do not edit files.
3. Use `rg` and `rg --files` first.
4. Report with the skill's output format.
```

