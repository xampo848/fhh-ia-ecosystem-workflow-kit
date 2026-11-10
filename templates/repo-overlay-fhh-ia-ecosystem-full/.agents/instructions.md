# FHH IA Ecosystem — Neutral AI Instructions

This file is the tool-neutral AI contract layer for the repository.

## Purpose

- Define the canonical startup contract for AI agents without coupling the source
  of truth to a single runtime or vendor.
- Separate AI-executable instructions from human-facing documentation.
- Let `.github/`, `.codex/`, `AGENTS.md`, `CLAUDE.md`, and other tool surfaces
  behave as wrappers/adapters over the same neutral rules.

## Source hierarchy

1. **Neutral AI base contract**: `.agents/instructions.md`
2. **Skill discovery**: `.agents/skills/index.md` for startup-minimal routing
  and `.agents/skills/registry.md` for the neutral full inventory and
  authoring contract
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
- The compact startup discovery index lives at `.agents/skills/index.md`.
- The neutral full skill registry lives at `.agents/skills/registry.md`.
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

The compact startup discovery index in `.agents/skills/index.md` records the
minimum directly routable set needed for initial loading.

The neutral full skill registry in `.agents/skills/registry.md` records:

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

## Task levels (N0–N3)

Every prompt is classified into one task level before any workflow file is
loaded. The level decides how much context is loaded, whether the user is asked
first, how visible the routing is, and the cost posture.

| Level | What it loads | Budget | Ask before acting? | Visibility | Cost posture |
| --- | --- | --- | --- | --- | --- |
| N0 Operational | nothing from the workflow | up to 3 tool calls; if more are needed, stop and propose N1 | No: the user's intent is enough | no trace | `lean` |
| N1 Surgical | the target files, their tests, and at most one PRD | no tracker, no delegates, no Discovery; one focused check | Yes, a short "yes" | one line, for example `N1 · surgical · touches X and its test` | `lean` |
| N2 Standard | the normal implementation route | per route | Yes | full or compact routing trace | `balanced` |
| N3 High risk | full gates | per route | Yes | full or compact routing trace | `premium` |

The cost posture follows from the level; it is not a separate decision.

Level pre-filter (single source; generated copies live in the runtime
adapters between the same markers and `check:workflow` fails when they drift):

<!-- workflow-kit:level-prefilter:start -->
Level pre-filter (apply to every new user prompt before loading any workflow file):

| Signal | Minimum level |
| --- | --- |
| Read-only question, lookup, or local command without side effects | N0 |
| Non-semantic edit (formatting, indentation, typo, comment, docs wording) | N0 |
| Behavior-changing edit in 1–2 files with clear scope | N1 |
| Uncertain scope, more than 2 files, or several pieces | N2 |
| Contracts, data or migrations, auth or tenancy, dependencies, CI, or anything irreversible (push, deploy, delete) | N3 |
| Hard triggers: explicit skill invocation, PR/review comments, explicit PRD | per that skill, whatever the level |

- The level is the highest signal that applies; when unsure between two levels, pick the higher one.
- N0: act directly without reading workflow files or emitting a trace; after 3 tool calls, stop and propose N1.
- N1: emit one line (`N1 · surgical · <files>`), wait for a short yes, edit only the target files, and run one focused check (lint, build, or test). Add or update a test only when behavior changes; for a bug, the test must fail before the fix.
- N2/N3: apply `.agents/instructions.md` and `workflow-router` before planning, editing, or implementing.
- If something unexpected appears in N0 or N1 (another file, a contract, a test you do not understand), stop and propose a higher level.
- The user can force a level ("hazlo quirúrgico", "hazlo completo"); forcing below an N3 signal requires naming the risk first.
<!-- workflow-kit:level-prefilter:end -->

Level rules:

- The level is the highest level triggered by any signal. The N0/N1 boundary is
  whether the change is **semantic**, not whether it reads or writes:
  non-semantic edits are N0 without asking.
- Focused check in N1 is not "mandatory test": run lint, build, or test as
  appropriate. Adding or updating a test is mandatory only when behavior
  changes. For a bug, the test must fail before the fix.
- Escalation and de-escalation are proposed, never silent: if N0 or N1 meets
  something unexpected, stop and propose a higher level; if N2 Discovery shows
  the change is small, propose N1. Both cases ask the user.
- The user can force a level. Forcing a level below an N3 signal requires
  naming the concrete risk before proceeding.
- A test set of prompts with their expected level lives in
  `.agents/skills/00-router/workflow-router/reference/router-evals.md`.

## Mandatory per-turn intake

Apply this contract before choosing a response path for every new user prompt.
Do not assume that the workflow selected for a previous prompt still applies.
Start with the level pre-filter above: N0 and N1 do not load the router.

Outside an explicit skill invocation, an N0 request, or an N1 request,
`workflow-router` is the default authority that decides which workflow runs
next. Runtime adapters, repo overlays, and copied instruction wrappers must
point back to this contract and then to the router instead of embedding
alternate routing rules, workflow stacks, or implementation gates that can
drift. The only routing content an adapter may carry is the generated level
pre-filter.

Router-first enforcement:

- For any non-trivial request (N2 or N3), run `workflow-router` before planning, editing, or implementing.
- Do not skip router execution by jumping directly into coding or PRD creation.
- If router is unavailable, stop non-trivial execution and report the missing file/tool.

User-owned PRD decision enforcement:

- The AI must never decide unilaterally to create a PRD, epic, or PM ticket.
- When the route could be `create-prd`, `create-epic`, or `generate-pm-ticket`, present options and wait for explicit user choice.
- The only exception is an explicit user command naming that workflow.

Execution authorization gate:

- Intent language from the user (for example: "quiero", "necesito", "hagamos") is not execution authorization by itself.
- Level exceptions: in N0 the user's intent is enough; in N1 a short "yes" to the one-line surgical proposal authorizes it. N2 and N3 keep this gate unchanged.
- Before explicit route authorization, the agent must stay in `awaiting-user-choice` for route-selection turns.
- While in `awaiting-user-choice`, the agent must not inspect product code for implementation, must not plan implementation tasks, and must not edit files.
- Execution starts only after the user explicitly authorizes the selected route (for example: "usa create-prd", "implementa este PRD", "haz el ticket", "procede con esa ruta").

Routing-to-execution binding (mandatory):

- For non-trivial work, the workflow or skill selected in the latest routing trace is binding for the next execution step.
- The agent must load and follow that selected skill before planning, editing, or implementing beyond intake.
- If the agent must change workflow because of new information, risk, or user redirect, it must emit a new routing trace first and apply the same authorization gate.
- Never announce one workflow (for example `implement-prd`) and execute a different path in the same step.

Natural-language skill invocation binding:

- Treat explicit natural-language directives as explicit skill invocation, for example: "usa create-prd", "implementa este PRD", "run implement-prd".
- Once invoked, the agent must execute that skill's protocol until completion or an explicit user redirect.

1. If the user explicitly invokes a skill, load that skill and follow it.
2. Otherwise perform structured per-turn intake before answering, planning, or editing,
  starting with the level pre-filter.
3. A direct answer (N0) may proceed without loading the full router only when the request is trivial,
  informational or non-semantic, and does not require planning or multi-step execution.
  An N1 surgical change follows the N1 rules above without loading the router.
4. For non-trivial (N2 or N3), iterative, implementation-adjacent, or multi-step freeform work, locate
  `workflow-router` through `.agents/skills/index.md`, load its `SKILL.md`, and follow its gates.
5. Emit a visible routing trace when choosing a meaningful workflow,
  skill, capability, cost posture, delegation posture, or risk path.
6. Load only the selected workflow, required patterns, and attached
   capabilities. Reuse already-loaded context when its source file has not
   changed.

### Continuation fast-path (session-scoped)

Full per-turn intake means classifying intent every turn, not re-reading every
policy document every turn. Use this fast-path to avoid reloading unchanged
context:

- On the first non-trivial turn of a session, or immediately after a genuine
  workflow switch, run full intake: read `.agents/instructions.md` and the
  selected skill's `SKILL.md`, then emit a full or compact routing trace.
- Persist the active workflow, its cost posture, and its routing trace to
  session memory right after that full intake.
- On each following turn, first check session memory for an active workflow.
  If one is present, classify only whether the new prompt continues that
  workflow (answers an open question, selects a presented option, confirms an
  implementation choice, or replies inside an active multi-step loop such as
  `pr-comments-resolution` Phase 2) or breaks it.
- Continuation signals: no explicit skill invocation, no topic change, no
  redirect language, no new scope/file/feature outside the active workflow.
- Break signals (any of these end the fast-path and force full intake):
  explicit skill invocation, explicit redirect ("cambiemos a...", "en
  realidad quiero..."), a materially different topic or scope, an explicit
  request to explain or reconsider the route, or missing/stale session
  memory for the active workflow.
- On a continuation turn, do not re-read `.agents/instructions.md` or the
  full router `SKILL.md` body again, and do not re-run the full
  classification table. Emit only the compact continuation trace:
  `[skill] · continuing · no reroute`, then proceed with the active
  workflow's next step.
- On a break, emit a new full or compact routing trace as usual before
  switching workflows, and update session memory with the new active
  workflow.

### Delegated context contract

The orchestrator performs intake, readiness, discovery, slicing, and matching
for a delegated slice. A delegate executes that bounded slice; it must not
restart those parent stages or recursively reroute the same request.

Before a delegate acts, apply the context required by its role:

- A new delegate reads its complete required skill, applicable instructions,
  and the source that controls the assigned change. A parent summary or a path
  mention is not evidence that this content was received.
- Reuse pre-injected content only when the runtime makes the complete content,
  its provenance, and its current freshness observable. In that case, record
  the provenance and do not re-read the identical source.
- A resumed delegate revalidates the relevant delta and affected dependencies
  before reusing prior context. Irrelevant changes do not invalidate context;
  a changed dependency or contract requires a directed revalidation.
- Required input is the role-relevant subset: owned files, relevant PRD
  sections and ACs, required reads, selected patterns, focused checks, and
  open questions. Do not re-paste the full PRD, tracker, or unrelated agent
  matrix.

`unknown` is a record of unavailable evidence, not permission to assume
freshness, injected content, runtime capability, or a completed control.

If the runtime cannot load `workflow-router` or the registry, do not silently
continue with unrestricted implementation work. Only trivial direct answers may proceed;
non-trivial development must preserve specification and implementation gates,
capability installation still requires confirmation, and the response must name
the unavailable file and the reduced fallback being applied.

Repo-specific standards, architecture notes, and validation defaults remain
valuable, but they should be loaded just in time by the workflow that the router
selected rather than front-loaded into every runtime entrypoint.

## Loading rules

- Apply the generated level pre-filter from the runtime adapter first. Load
  this file before any N2 or N3 work; N0 and N1 follow the pre-filter without
  loading it.
- Use `.agents/skills/index.md` as the neutral startup discovery contract.
- Use `.agents/skills/registry.md` as the neutral full inventory, taxonomy,
  and authoring contract.
- Apply the mandatory per-turn intake above for every new user prompt.
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
- startup discovery metadata in `.agents/skills/index.md`;
- full skill metadata in `.agents/skills/registry.md`;
- skill algorithm in each skill `SKILL.md` file.

After extension edits, run relevant repository validation commands and summarize outcomes.


## Token-saving posture

FHH IA Ecosystem prefers saving AI tokens when quality is preserved. This is a base
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

Direct-answer defaults (automatic):

- for trivial informational requests (N0), prefer inline answers with `lean` posture;
- target `0` tool calls when the answer is already reliable;
- allow up to `3` focused tool calls in N0 before escalating;
- if more than `3` tool calls are needed, state the reason briefly and propose N1 or explicit routed execution.

Token-spike prevention defaults:

- avoid wide-result tools as a first step (broad repo/web searches, full inventories, raw dumps);
- prefer bounded output requests (top-N, precise include pattern, narrow symbol/file scopes);
- avoid re-reading long policy files in the same turn when already loaded and unchanged;
- avoid re-reading long policy files across turns in the same session when
  already loaded and unchanged for the active workflow; apply the
  continuation fast-path above and rely on session memory instead of
  re-deriving routing from scratch every turn;
- summarize large tool payloads instead of echoing raw output.

Compressed delegation preference:

- when narrow helper delegation is needed (locate, surgical edit, focused review), prefer attached compressed helpers such as cavecrew;
- fall back to verbose delegates or inline execution when compressed output could hide important nuance.

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
- how to point to the shared skill path and neutral routing policy;
- the generated level pre-filter, copied verbatim from this file between the
  `workflow-kit:level-prefilter` markers by `scripts/sync-level-prefilter.mjs`.

Runtime adapters must not become the canonical owner of workflow logic. The
generated level pre-filter is the only workflow logic an adapter may carry; any
other routing rule belongs here or in `workflow-router`.
