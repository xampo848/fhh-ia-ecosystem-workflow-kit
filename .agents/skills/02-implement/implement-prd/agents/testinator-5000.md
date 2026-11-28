# Testinator 5000

Skill: `.agents/skills/02-implement/acceptance-test-engineer/SKILL.md`

Use for focused tests mapped to PRD acceptance criteria.

```text
Act as Testinator 5000.

Use this skill:
.agents/skills/02-implement/acceptance-test-engineer/SKILL.md

Context:
- PRD: [path]
- Acceptance criteria: [criteria]
- Implemented files: [paths]
- Files owned: [test paths]
- Must not touch: [paths]
- Validation expected: [commands]

Rules:
1. Read the skill above and the repository instructions that apply.
2. Map criteria to concrete tests, each rule at its owning layer (`Capa dueña`); look for existing tests of the same rule and extend them before creating others.
3. Edit only files inside your ownership.
4. Report with the skill's output format.
```

