# Compact pattern index

This file is a generated matcher-first catalog of repo-owned pattern skills.
It exists so `implementation-skill-matcher` can identify candidates without loading `.agents/skills/registry.md`.
Canonical inventory and authoring rules remain in `.agents/skills/registry.md`.
Automation artifacts remain in `.agents/skills/registry.json` and `.agents/skills/registry.cache.json`; do not load those machine files into model context.

## Pattern inventory

| Skill name | Class | Trigger | Physical path | Loading posture | Cost hint |
| --- | --- | --- | --- | --- | --- |
| `add-project-pattern` | Standards/pattern | User asks to create/register project-specific pattern skills in repo overlay | `.agents/skills/06-patterns/authoring/add-project-pattern/SKILL.md` | Explicit-only | lean |
| `init-legacy-attachments` | Standards/pattern | User asks to initialize or attach pre-existing local skills/patterns that existed before workflow installation | `.agents/skills/06-patterns/authoring/init-legacy-attachments/SKILL.md` | Explicit-only | balanced |

## Matcher usage

1. Scan this index for candidate names, triggers, and paths.
2. Open `.agents/skills/registry.md` only when at least one candidate matches or eligibility is ambiguous.
3. Read only the selected `SKILL.md` paths before returning required pattern skills.
4. If this file is missing, regenerate with `node scripts/sync-skill-registry.mjs --write`. Do not invent candidates.
