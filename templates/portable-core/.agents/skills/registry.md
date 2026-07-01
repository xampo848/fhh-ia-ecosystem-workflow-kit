# Skill Registry

This starter registry is intentionally minimal. Add project-specific workflow, pattern, and quality skills here as your repo overlay matures.

| Skill name | Class | Path | Trigger | Loading posture |
| --- | --- | --- | --- | --- |
| workflow-router | Workflow | `.agents/skills/00-router/workflow-router/SKILL.md` | Freeform non-trivial request | Startup-minimal |
| create-prd | Workflow | `.agents/skills/01-product/create-prd/SKILL.md` | Formalize implementation requirements | Explicit-only |
| implement-prd | Workflow | `.agents/skills/02-implement/implement-prd/SKILL.md` | Approved PRD needs implementation | Explicit-only |

## Overlay extension points

- Add project pattern skills under `.agents/skills/06-patterns/**`.
- Add local quality skills under `.agents/skills/03-quality/**`.
- Keep runtime adapters thin; do not duplicate workflow logic in adapter files.
