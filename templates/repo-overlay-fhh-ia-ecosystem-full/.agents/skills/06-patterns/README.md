# Pattern Skills Contract

This directory is the neutral home for repo-owned implementation pattern skills.

Initial physical convention for new pattern skills:

```text
.agents/skills/06-patterns/<domain>/<skill>/SKILL.md
```

Examples:

- `.agents/skills/06-patterns/authoring/add-project-pattern/SKILL.md`
- `.agents/skills/06-patterns/backend/project-specific-importer/SKILL.md`
- `.agents/skills/06-patterns/frontend/project-specific-form-validation/SKILL.md`

This overlay is intentionally project-extensible. It ships only a neutral
authoring helper and does not ship domain-specific default patterns.

## Purpose

Pattern skills are AI-executable reusable procedures for recurring technical
implementation work. They are **not** workflow orchestrators and they are
**not** external capability install/attach manifests.

Pattern skills exist so implementation slices can declare:

- which reusable skill must be read before work starts;
- why that skill applies;
- whether it is required before reading, writing, testing, or review;
- which fallback docs remain valid if the skill does not exist yet;
- which validation hooks and handoff evidence prove the slice used the pattern.

## Slice Contract

Use this minimum contract shape when a PRD, slicer, matcher, or implementer
needs to declare required pattern skills for a slice:

```yaml
slice_skill_contract:
  slice_id:
  owner_skill:
  required_pattern_skills:
    - name:
      path:
      reason:
      required_before: read | write | test | review
  optional_capabilities:
    - name:
      attach_point:
      reason:
      active_state_required:
  fallback_docs:
    - path:
      reason:
  validation_hooks:
    - type:
      command_or_check:
      reason:
  handoff_required_fields:
    - slice_id
    - owner_skill
    - skills_read
    - capabilities_used
    - fallback_docs_used
    - validation_run
    - quality_gate_result
    - open_risks
```

## Boundary Rules

### Required pattern skills

- Must point to an exact `SKILL.md` path.
- Are repo-owned or otherwise explicitly governed as reusable implementation
  procedures.
- Must say **why** the skill applies to the slice.
- Must say **when** the skill must be read: `read`, `write`, `test`, or
  `review`.

### Optional capabilities

- Are not pattern skills.
- Remain governed by `.agents/integrations/README.md` and
  `.agents/capabilities/**`.
- Must never be treated as silently mandatory just because they are available.
- May be referenced only by attach-point intent and active-state requirement.

### Fallback docs

- Are allowed when the pattern skill does not exist yet or is intentionally not
  loaded.
- Should normally point to `docs/patterns/**`, architecture docs, standards,
  or another approved neutral contract.
- Must include a reason, not just a path.

## Authoring Rules

Every new pattern skill should define:

1. **Stable logical name** — short, searchable, trigger-specific.
2. **Exact physical path** — `.agents/skills/06-patterns/<domain>/<skill>/SKILL.md`.
3. **Narrow trigger** — concrete implementation surface, not a vague category.
4. **Required-before stage** — whether it must be loaded before read, write,
   test, or review.
5. **Fallback docs** — valid non-skill sources if the skill is absent.
6. **Validation hooks** — tests, contract checks, lint, smoke verification, or
   review checks that prove correct use.
7. **Stop conditions** — ambiguities or risk boundaries that prohibit guessing.
8. **Out-of-scope notes** — adjacent work that the pattern skill must not
   absorb.

## Recommended Bootstrap Flow

When a repository starts from this overlay:

1. Use `.agents/skills/06-patterns/authoring/add-project-pattern/SKILL.md`.
2. Create 1-3 local project patterns under
  `.agents/skills/06-patterns/<domain>/<skill>/SKILL.md`.
3. Register each new skill in `.agents/skills/registry.md`.
4. Regenerate derived artifacts:
  `.agents/skills/registry.json` and `.agents/skills/registry.cache.json`.
5. Keep fallback docs in `docs/patterns/**` until enough local pattern skills
  exist.

## Handoff Evidence Contract

When a delegate or orchestrator claims a slice used pattern skills, the handoff
should report at minimum:

- `slice_id`
- `owner_skill`
- `skills_read`
- `capabilities_used`
- `fallback_docs_used`
- `validation_run`
- `quality_gate_result`
- `open_risks`

This README defines the contract only. Future PRDs may add:

- a matcher that selects pattern skills automatically;
- delegate enforcement of the handoff fields;
- the initial library of repo-owned pattern skills;
- YAML/JSON automation or cache/refresh workflows.

## Out of Scope Here

This contract does **not**:

- create the `implementation-skill-matcher`;
- install external capabilities;
- rewrite delegates to consume the contract automatically;
- define the full pattern-skill library;
- replace `docs/patterns/**` as human-readable references.
