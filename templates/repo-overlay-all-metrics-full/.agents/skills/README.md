# Agent Skills Taxonomy

This directory describes the canonical neutral taxonomy for AI-executable
skills.

Skills are only one part of the neutral taxonomy. External capabilities such as
plugins, MCP tools, connectors, and installable packs belong to the separate
integrations layer documented under `.agents/integrations/**`.


## Neutral registry

The concrete skill inventory and just-in-time loading contract live in
`.agents/skills/registry.md`.

Use the registry to find:

- stable skill names;
- current physical `SKILL.md` paths;
- skill class;
- trigger;
- loading posture;
- future structured keys.

Do not load every `SKILL.md` at startup. Load full skill bodies only when the
registry trigger and loading posture match the current task.

## Skill classes

### Workflow skills

Workflow skills define **what to do and when**.

They own:

- sequencing;
- routing;
- gates and stop conditions;
- required artifacts;
- closure criteria.

Examples:

- `workflow-router`
- `create-prd`
- `implement-prd`
- `document-development`

### Standards/pattern skills

Standards/pattern skills define **how to execute a repeatable class of work**.

They own:

- step-by-step procedures for AI agents;
- repetitive checks;
- validation commands;
- pattern-specific stop conditions.

Examples:

- contract verification
- importer workflow
- serializer checks
- UI quality checks

## Human docs are different

Human docs in `docs/**` are for:

- rationale;
- onboarding;
- examples;
- broad policy explanation.

They are not the same as AI-executable skills.

## Integrations are different too

Integrations/plugins/tools are not workflow skills and are not
standards/pattern skills.

They own capability availability and install/attach lifecycle, not workflow
sequencing or pattern execution. See `.agents/integrations/README.md`.

Portable packaging and capability-attachment structure are defined separately in
`.agents/capabilities/README.md`.

## Physical skill ownership

The canonical taxonomy, registry, and repo-owned skill bodies live under `.agents/skills/**`. `.agents/skills/registry.md` maps logical skill identity to canonical physical paths. Runtime-specific surfaces such as `.github/skills/**` and `.codex/skills/**` may use symlinks or thin adapters, but they must not become a second source of truth.
