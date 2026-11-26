# Neutral integrations/plugins/tools contract

This directory defines the neutral contract for capabilities that extend the AI
system without becoming workflow skills.

## What belongs here

This layer governs:

- plugins;
- MCP tools and connectors;
- installable skill packs;
- memory/doc/research tools;
- repo-owned AI capabilities that already exist but still need to be attached
  to the neutral workflow.

This layer does **not** replace:

- workflow skills that orchestrate phases;
- standards/pattern skills that provide algorithmic procedures;
- runtime wrappers that adapt one tool surface;
- human docs that explain the system to people.

Portable capability packaging, manifest shape, attach points, and portable-core
vs repo-overlay ownership live in `.agents/capabilities/README.md`.

Memory shareability, shared-memory export/import posture, sensitivity exclusions,
and runtime parity review live in `.agents/memory/README.md`.

## Object types

| Type | Example | Install needed? | Attach needed? |
| --- | --- | --- | --- |
| Runtime capability already available | Context7, Engram, existing MCP | No | Yes |
| Installable skill package | curated or GitHub-installed skill | Usually yes | Yes |
| Plugin / connector / MCP package not yet available | future plugin/tool bundle | Yes | Yes |
| Repo-owned AI capability | Caveman-style capability | Sometimes no | Yes, if not yet wired into the neutral flow |

## Supported user intents

The workflow must understand natural-language requests like:

- `instala Context7`
- `quiero Engram en este proyecto`
- `agrega Caveman`
- `acopla X al flujo de IA`
- `este tool ya está instalado, intégralo al sistema`
- `list plugins`
- `qué recomiendas`

## Intent classification

Every request must first be classified as one of:

1. **Install + attach** — capability is not available yet.
2. **Attach-only** — capability already exists but is not attached to the
   neutral workflow.
3. **List/discover** — the user explicitly asks what exists.
4. **Recommend** — the user explicitly asks what should be used.

If the user asks for a specific tool, do **not** widen the flow into
recommendation mode unless they explicitly ask for suggestions.

## Source policy

- Default source policy is **official/curated only**.
- A non-default source is allowed only when the user explicitly asks for that
  source/repository/package.
- When a non-default source is used, the override must be recorded in the
  resulting docs/config notes.
- Trust-tier scoring, marketplace ranking, and telemetry are out of scope.

## Confirmation policy

Before any installation runs, the workflow must show a compact confirmation
summary with:

- capability name;
- source;
- requested scope;
- whether this is install + attach or attach-only;
- expected effect on the AI workflow.

No install command may run before explicit user approval.

## Scope policy

Supported scopes:

| Scope | Meaning |
| --- | --- |
| User/global | Available across projects for the runtime/user environment |
| Repo/project | Attached/configured specifically for this repository |
| Hybrid | Installed globally but attached in a repo-specific way |

The workflow must ask or infer the intended scope from explicit user wording
and document the chosen result.

## Attach-to-flow contract

Installation alone is not sufficient. A capability is only complete when it is
attached to the neutral AI workflow.

Attach actions may include:

- updating neutral taxonomy or integration registry docs under `.agents/`;
- updating runtime wrappers so they point to the same neutral policy;
- documenting when the capability should be used;
- marking the capability state as `available`, `installed`, `attached`, or
  `unattached` in docs/config notes when relevant.

## Definition of success

Successful completion means all three are true:

1. The capability is available in the intended scope.
2. The capability is attached to the neutral AI workflow.
3. The repository documents how that capability fits.


## Token-saving external capabilities

Token-saving tools are external capabilities. They may be installed later and
attached to the neutral workflow, but they are not mandatory workflow steps and
must not be hardcoded into the core instructions.

Default posture after attach:

- prefer token savings when quality, accuracy, and clarity are preserved;
- evaluate need before use instead of blindly compressing every output;
- use compressed helper/subagent output more aggressively than user-facing prose;
- fall back to normal concise prose when compression increases ambiguity;
- record the source repository in the capability manifest when a user explicitly
  requests a non-curated or vendor-specific source.

## Runtime parity rule

Codex, Copilot, and other runtime wrappers must point back to this same
neutral policy even if their command syntax differs.

Allowed runtime differences:

- installation command syntax;
- runtime-specific config file format;
- runtime-specific tool metadata.

Not allowed:

- skipping confirmation;
- changing the default official/curated source policy;
- treating attach-only as mandatory reinstall;
- enabling recommendations by default.

## Out of scope for this contract phase

- marketplace design;
- autonomous recommendations;
- trust tiers or scoring;
- telemetry or ranking;
- portable packaging rollout;
- bulk installation of many tools by default.
