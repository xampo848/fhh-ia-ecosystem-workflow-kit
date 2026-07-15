# All Metrics — Neutral AI Instructions

This file is the tool-neutral AI contract layer for the repository.

## Purpose

- Define the canonical startup contract for AI agents without coupling the source
  of truth to a single runtime or vendor.
- Separate AI-executable instructions from human-facing documentation.
- Let `.github/`, `.codex/`, `AGENTS.md`, `CLAUDE.md`, and other tool surfaces
  behave as wrappers/adapters over the same neutral rules.

## Source hierarchy

1. **Neutral AI base contract**: `.agents/instructions.md`
2. **Skill registry**: `.agents/skills/registry.md`, the neutral inventory
   and just-in-time loading contract for AI-executable skills
3. **Workflow skills**: algorithmic instructions that say what sequence to
   follow for a workflow such as `create-prd`, `implement-prd`, or
   `document-development`
4. **Standards/pattern skills**: algorithmic reusable procedures for repetitive
   work such as contracts, importers, serializers, validators, or UI checks
5. **Integrations/plugins/tools layer**: external capabilities that can be
   attached to the AI workflow, such as plugins, MCP tools, connectors,
   installable skill packs, memory tools, and doc tools
6. **Runtime adapters**: tool-specific wrappers such as `.github/**`,
   `.codex/**`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`
7. **Human docs**: `docs/**` for explanation, rationale, examples, onboarding,
   and durable documentation

If there is a contradiction between a runtime adapter and this file, the neutral
contract in `.agents/instructions.md` wins.

## Physical skill ownership

- The **canonical AI contract** lives under `.agents/`.
- The neutral skill registry lives at `.agents/skills/registry.md`.
- Shared repo-owned skill bodies live physically under `.agents/skills/**`.
- `.github/skills/**` is a compatibility adapter surface for GitHub/Copilot and legacy references.
- `.github/**` and `.codex/**` remain valid runtime wrappers, but they must point back to `.agents/` and must not redefine workflow logic.

This means canonical ownership and physical skill storage are both neutral. Runtime wrappers may keep symlinks or thin adapters for tool compatibility, but `.agents/skills/**` is the source path for active skill loading.

## Docs vs skills

Use the right artifact for the right audience:

- `docs/**` explains things to humans;
- `SKILL.md` files tell AI agents exactly how to execute repeatable work;
- runtime adapters only explain how a tool should load or invoke those rules.

Human docs are not a substitute for AI-executable skills when an agent must
follow a repeated procedure.

## Skill registry

The neutral skill registry lives in `.agents/skills/registry.md`. It records:

- stable skill names;
- primary skill class;
- current physical `SKILL.md` path;
- trigger;
- loading posture;
- lightweight cost hint when already known;
- future structured key for later YAML/JSON/TOML migration.

Use the registry for skill discovery. Do not load every `SKILL.md` at startup.

Repo-owned implementation pattern skills live under
`.agents/skills/06-patterns/<domain>/<skill>/SKILL.md`. Their slice metadata
and authoring contract lives in `.agents/skills/06-patterns/README.md`.

## Workflow skills vs standards/pattern skills

### Workflow skills

Workflow skills decide:

- what phase comes next;
- when to ask or stop;
- what artifacts must exist;
- what validation is required before closure.

Examples:

- router / intake
- PRD creation
- PRD implementation
- development documentation

### Standards/pattern skills

Standards/pattern skills decide:

- how to perform a repeatable class of work;
- exact checks, stop conditions, and validation commands for that pattern;
- the concrete AI procedure that operationalizes a human standard.

Examples:

- API contract verification
- importer implementation
- serializer validation
- UI empty-state checks

When a workflow or slice needs reusable implementation knowledge, the pattern
skill contract should distinguish:

- `required_pattern_skills` with exact `SKILL.md` paths;
- `optional_capabilities` governed by `.agents/integrations/README.md` and
  `.agents/capabilities/**`;
- `fallback_docs` for human-readable references such as `docs/patterns/**`;
- `validation_hooks` and `handoff_required_fields` for evidence.

## Integrations/plugins/tools layer

This layer exists to govern capabilities that are **not** the workflow itself
but can be attached to it.

It owns:

- discovery/install/attach policy for external AI capabilities;
- classification of installed vs unattached vs attached capabilities;
- source policy for official/curated vs user-directed overrides;
- confirmation policy before installation;
- neutral documentation of how a capability fits the AI system.

It does **not** own:

- workflow sequencing;
- runtime-specific wrapper behavior;
- human-only onboarding docs;
- the algorithmic body of workflow or standards skills.

Examples:

- Context7 / Engram / existing MCP capabilities
- installable skill packs
- plugins or connectors
- repo-owned AI capabilities that only need attachment to the neutral flow

## Loading rules

- Load this file first from every runtime entrypoint.
- Use `.agents/skills/registry.md` as the neutral skill discovery and
  just-in-time loading contract.
- For every new user prompt or question, run router intake first via
  `.agents/skills/00-router/workflow-router/SKILL.md`; do not skip this step.
- Load a workflow skill when the task enters that workflow.
- Load a standards/pattern skill only just-in-time when that repetitive
  procedure is actually needed. For repo-owned implementation patterns, use the
  contract in `.agents/skills/06-patterns/README.md` and load only the exact
  `SKILL.md` paths the slice requires.
- Load the integrations/plugins/tools contract when the user asks to install,
  attach, list, or explicitly recommend an AI capability.
- Load human docs only when explanation, rationale, or durable documentation is
  needed.

## Workflow extension requests

When the user asks how to extend the AI workflow itself (router, registry, or custom skills), support both modes:

1. Explanation mode: describe exact files, ordering, and validation steps without editing.
2. Execution mode: perform the edits when the user asks to apply them.

For extension work, keep boundaries explicit:

- router policy in `.agents/skills/00-router/workflow-router/SKILL.md`;
- startup contract in `.agents/instructions.md`;
- skill discovery metadata in `.agents/skills/registry.md`;
- skill algorithm in each skill `SKILL.md` file.

After extension edits, run relevant repository validation commands and summarize outcomes.


## Token-saving posture

All Metrics prefers saving AI tokens when quality is preserved. This is a base
posture, not permission to reduce correctness, skip validation, hide risks, or
force a specific vendor/tool into the core workflow.

Use `.agents/capabilities/registry.md` to discover which token-saving capability
is preferred for the active runtime. A capability may be used as the default only
when it is installed/available, attached, and appropriate for the current task.

Use judgment before activating compressed output:

- use token-saving mode when it reduces filler without losing technical detail;
- prefer normal concise prose for security warnings, irreversible actions,
  multi-step instructions, architectural trade-offs, user confusion, or any case
  where compression could create ambiguity;
- treat concrete token-saving tools as optional external capabilities, not as
  mandatory workflow steps;
- do not claim a token-saving capability is active unless the runtime confirms
  it is installed/available and attached.

## Prompt-driven integration policy

The neutral install/attach contract lives in `.agents/integrations/README.md`.

Global policy:

- natural-language requests such as “instala X”, “acopla Y”, or “quiero Z en
  este proyecto” are valid triggers;
- the system must first classify whether the request is **install**,
  **attach-only**, **list/discover**, or **recommend**;
- installation is never silent: confirmation is mandatory before any install
  command runs;
- default sources are official/curated only unless the user explicitly asks for
  another source;
- recommendation mode is explicit-only and must not activate for a specific
  install request unless the user asks for suggestions;
- success means the capability is available in the intended scope, attached to
  the neutral AI flow, and documented.

## Capability packaging and attachment policy

The neutral portable-capability blueprint lives in `.agents/capabilities/README.md`.

It defines:

- portable core vs repo overlay ownership;
- the minimum capability manifest contract;
- install vs attach lifecycle semantics;
- stable attach-point vocabulary;
- runtime wiring minimum across Codex, GitHub/Copilot, Claude Code, and future wrappers.

Use this policy when the task is about packaging the workflow for reuse,
declaring how capabilities fit the system, or keeping runtime adapters thin
while preserving a portable contract.

## Memory sharing and runtime parity governance

The neutral memory and parity governance policy lives in `.agents/memory/README.md`.

It defines:

- memory scopes (`local-session`, `local-user`, `project-shared`, `runtime-derived`);
- opt-in shared-memory export/import posture;
- sensitivity and do-not-share rules;
- minimum shared-memory artifact fields;
- runtime parity checklist requirements for Codex, GitHub/Copilot, Claude Code, and future wrappers.

Use this policy whenever a workflow promotes memory into repo-shareable context
or when runtime wrappers need parity review after neutral contract changes.

## Model routing, cost posture, and delegation policy

The neutral cross-runtime policy lives in `.agents/model-routing/README.md`.

It defines:

- `lean / balanced / premium` cost posture;
- `Grande / Mediano / Liviano` model tiers;
- delegation defaults (avoided / recommended / required);
- explicit user override behavior;
- the rule that automatic model switching must never be claimed unless the runtime confirms it;
- parity as equivalent tier/risk intent, not strict exact-model identity.

Use this policy whenever a workflow or wrapper must choose a model hint, tier, or delegation default.

## Runtime adapter rule

Runtime adapters may define:

- tool-specific metadata;
- current exact model defaults or model hints that implement the neutral tier policy;
- sandbox/tool constraints;
- how to point to the shared skill path and neutral routing policy.

Runtime adapters must not become the canonical owner of workflow logic.
