# Compact skill index

This file is a generated startup-minimal discovery index for AI runtimes.
It includes only directly routable skills and intentionally omits delegated and just-in-time internals.
Canonical inventory, taxonomy, and authoring rules remain in `.agents/skills/registry.md`.
Automation artifacts remain in `.agents/skills/registry.json` and `.agents/skills/registry.cache.json`; do not load those machine files into model context.

## Direct routing inventory

| Skill name | Trigger | Physical path | Cost hint |
| --- | --- | --- | --- |
| `add-project-pattern` | User asks to create/register project-specific pattern skills in repo overlay | `.agents/skills/06-patterns/authoring/add-project-pattern/SKILL.md` | lean |
| `cavecrew` | User asks to delegate to cavecrew or use caveman-compressed subagents | `.agents/skills/05-caveman/cavecrew/SKILL.md` | lean |
| `create-epic` | Large initiative needing research, appetite, phases, or multiple PRDs | `.agents/skills/01-product/create-epic/SKILL.md` | balanced |
| `create-prd` | Feature/ticket/spec needs formal PRD before implementation | `.agents/skills/01-product/create-prd/SKILL.md` | balanced |
| `document-development` | Feature/system is complete and needs durable internal documentation | `.agents/skills/03-quality/document-development/SKILL.md` | lean |
| `engineering-mentor` | Task benefits from teaching, challenge, and better engineering judgment | `.agents/skills/04-crosscutting/engineering-mentor/SKILL.md` | balanced |
| `frontend-design` | Need early visual direction or aesthetic shaping | `.agents/skills/04-crosscutting/frontend-design/SKILL.md` | lean |
| `generate-pm-ticket` | User needs a backlog/Jira-style ticket rather than full PRD | `.agents/skills/01-product/generate-pm-ticket/SKILL.md` | lean |
| `impeccable` | UI/design craft, audit, polish, redesign, live visual iteration | `.agents/skills/04-crosscutting/impeccable/SKILL.md` | balanced |
| `implement-prd` | Approved PRD needs implementation | `.agents/skills/02-implement/implement-prd/SKILL.md` | balanced |
| `playwright-testing` | User asks for Playwright tests or E2E validation is required | `.agents/skills/03-quality/playwright-testing/SKILL.md` | balanced |
| `pr-comments-resolution` | Resolve or review PR comments in an orderly way | `.agents/skills/04-crosscutting/pr-comments-resolution/SKILL.md` | balanced |
| `react-doctor` | Meaningful React changes need post-change audit | `.agents/skills/03-quality/react-doctor/SKILL.md` | balanced |
| `workflow-router` | Per-turn intake selects non-trivial, iterative, implementation-adjacent, or multi-step freeform work without an explicit skill | `.agents/skills/00-router/workflow-router/SKILL.md` | lean |
