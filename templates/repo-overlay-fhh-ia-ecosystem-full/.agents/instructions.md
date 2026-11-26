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
   follow for a workflow such as `create-prd`, `implement-change`, or
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
- `.claude/skills/**` holds generated Claude Code wrappers for the directly routable workflow skills; GitHub Copilot and Codex read `.agents/skills/**` directly.
- `.github/**` and `.codex/**` remain valid runtime wrappers, but they must point back to `.agents/` and must not redefine workflow logic.
- Kit and project ownership is defined in `.agents/kit-boundary.md` and the manifest `.agents/workflow-kit/manifest.json`. Project skills live under `.agents/project/skills/**`, are registered in `.agents/project/index.md`, and are reached through `workflow-router`: no runtime discovers that folder natively.

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
| N2 Standard | the normal implementation route | per route | Only for routes that write (see the execution authorization gate) | full or compact routing trace | `balanced` |
| N3 High risk | full gates | per route | As N2; an irreversible action always names the concrete risk and waits for an explicit yes | full or compact routing trace | `premium` |

The level sets the default cost posture. A route's cost hint in
`.agents/skills/index.md` may lower it one step only for documentation and
workflow-maintenance routes. Never raise the posture silently: raising it
requires naming the concrete risk in the trace.

Level pre-filter (single source; generated copies live in the runtime
adapters between the same markers; `workflow-kit doctor` warns when an adapter's block was edited and `workflow-kit update` restores it):

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
- N1: emit one line (`N1 · surgical · <files>`), wait for a short yes, edit only the target files, and run one focused check (lint, build, or test). When behavior changes, add or update a test and make that check the touched tests (lint or build alone is not enough); for a bug, the test must fail before the fix and pass after it.
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
Do not assume that the workflow selected for a previous prompt still applies:
classify the new prompt, and keep that workflow only through the continuation
fast-path below.
Start with the level pre-filter above: N0 and N1 do not load the router.

Outside an explicit skill invocation, an N0 request, or an N1 request,
`workflow-router` is the default authority that decides which workflow runs
next. Runtime adapters, repo overlays, and copied instruction wrappers must
point back to this contract and then to the router instead of embedding
alternate routing rules, workflow stacks, or implementation gates that can
drift. The only routing content an adapter may carry is the generated level
pre-filter plus the shared bootstrap lines listed in "Runtime adapter rule".

Router-first enforcement:

- For any non-trivial request (N2 or N3) that does not continue the active workflow, run `workflow-router` before planning, editing, or implementing.
- Do not skip router execution by jumping directly into coding or PRD creation.
- If router is unavailable, stop non-trivial execution and report the missing file/tool.

User-owned PRD decision enforcement:

- The AI must never decide unilaterally to create a PRD, epic, or PM ticket.
- When the route could be `create-prd`, `create-epic`, or `generate-pm-ticket`, present options and wait for explicit user choice.
- The only exception is an explicit user command naming that workflow.

Execution authorization gate:

- The gate applies to routes that write: code, PRDs, epics, tickets, installs, or other repository files.
- Read-only routes (review, audit, explanation, or discovery the user asked for) need no extra confirmation, and neither does an explicit imperative that names the work ("audita X", "revisa este PR", "implementa este PRD"): that imperative is the authorization.
- Intent language from the user (for example: "quiero", "necesito", "hagamos") is not execution authorization by itself.
- Level exceptions: in N0 the user's intent is enough; in N1 a short "yes" to the one-line surgical proposal authorizes it. An irreversible operational action (push, deploy, delete) always names the concrete risk and waits for an explicit yes, even after an imperative.
- Before explicit route authorization of a writing route, the agent must stay in `awaiting-user-choice` for route-selection turns.
- While in `awaiting-user-choice`, the agent must not inspect product code for implementation, must not plan implementation tasks, and must not edit files.
- Execution starts only after the user explicitly authorizes the selected route (for example: "usa create-prd", "implementa este PRD", "haz el ticket", "procede con esa ruta").

Routing-to-execution binding (mandatory):

- For non-trivial work, the workflow or skill selected in the latest routing trace is binding for the next execution step.
- The agent must load and follow that selected skill before planning, editing, or implementing beyond intake.
- If the agent must change workflow because of new information, risk, or user redirect, it must emit a new routing trace first and apply the same authorization gate.
- Never announce one workflow (for example `implement-change`) and execute a different path in the same step.

Natural-language skill invocation binding:

- Treat explicit natural-language directives as explicit skill invocation, for example: "usa create-prd", "implementa este PRD", "run implement-change".
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
- Session memory is the conversation itself: the latest routing trace still
  visible in context records the active workflow, its level, and its cost
  posture. A memory tool or file is optional and used only if the runtime has
  one.
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
  request to explain or reconsider the route, or no routing trace for an
  active workflow is visible in the current context (new session or
  compacted away).
- On a continuation turn, do not re-read `.agents/instructions.md` or the
  full router `SKILL.md` body again, and do not re-run the full
  classification table. Emit only the compact continuation trace:
  `[skill] · continuing · no reroute`, then proceed with the active
  workflow's next step.
- On a break, emit a new full or compact routing trace as usual before
  switching workflows; that trace becomes the new session memory.

### Delegated context contract

The orchestrator performs intake, readiness, discovery, slicing, and matching
for a delegated slice. A delegate executes that bounded slice and follows
`.agents/delegation/delegate-contract.md`, the single source of delegate rules
(required reads, observable reuse, resume validation, bounded input, brakes,
compact handoff, and the escape rule). Delegates do not load this file or
`workflow-router`; that is the explicit exception to the loading rules below.
Runtime adapters carry the generated summary of that contract.

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
  loading it, and delegates load `.agents/delegation/delegate-contract.md`
  instead.
- Use `.agents/skills/index.md` as the neutral startup discovery contract, then
  `.agents/project/index.md` and `.agents/project/routing.md` when they exist
  (project catalog and routing rules; a missing file is an empty overlay).
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

In a repository that installed the kit, extend the workflow only from the
project overlay `.agents/project/**`, following `.agents/kit-boundary.md`:

- **add** a project skill under `.agents/project/skills/<name>/SKILL.md` and
  register it in `.agents/project/index.md` (`add-project-pattern` does both);
- **extend** at a declared extension point, such as project routing rules in
  `.agents/project/routing.md` (the only extension of the router and of this
  file) or project additions in `.agents/project/quality-gate.md`;
- **shadow** a kit leaf skill under `.agents/project/shadows/<skill>/` with its
  `shadow.json`, only when extend is not enough.

Never edit a kit file (`.agents/workflow-kit/manifest.json` lists them) to adapt
the workflow: a kit update stops delivering fixes to an edited file. Editing the
router, this file, or the kit catalogs is kit maintenance, done in the kit's
source repository, where these boundaries apply:

- router policy in `.agents/skills/00-router/workflow-router/SKILL.md`;
- startup contract in `.agents/instructions.md`;
- startup discovery metadata in `.agents/skills/index.md`;
- full skill metadata in `.agents/skills/registry.md`;
- skill algorithm in each skill `SKILL.md` file.

After extension edits, run relevant repository validation commands and summarize outcomes.

## Project runbooks

A runbook is a project procedure (environment promotion, release, hotfix,
rollback) kept as a project skill of class `Runbook` under
`.agents/project/skills/runbooks/<name>/SKILL.md` (`.agents/kit-boundary.md`).
The router reaches it and applies the kit's execution rules in
`.agents/skills/00-router/workflow-router/reference/project-overlay.md`.

Capture rule (applies to N2/N3 work, which loads this file; at N0/N1 the user
can still ask for it):

- When a task in which the user taught or corrected an operational procedure
  ends, or when the user asks, propose saving it once: for a new runbook, the
  full file built from `.agents/skills/06-patterns/authoring/runbook-template.md`
  plus its `Skills` row; for an existing one, the diff.
- Never write a runbook, or a change to one, without an explicit yes to that
  proposal. The yes covers exactly the content shown. After a no, do not
  propose it again in the session.
- Before showing the proposal, replace every secret value (token, key,
  password, URL with credentials) with a placeholder and say so: runbooks are
  `public-in-repo` (`.agents/memory/README.md`).
- Mark every irreversible step (push, deploy, delete, data migration,
  publish) `confirm: required` with its `risk:`. A runbook never removes that
  confirmation.
- Write it with `add-project-pattern` (runbook variant).


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
- summarize large tool payloads instead of echoing raw output;
- in N2/N3 implementation, propose a new session at each slice cut point or
  size brake (`.agents/skills/02-implement/implement-change/reference/session-checkpoint.md`);
  its checkpoint carries the routing trace, so the resumed session applies
  the continuation fast-path.

Compressed delegation preference:

- when narrow helper delegation is needed (locate, surgical edit, focused review), prefer attached compressed helpers such as cavecrew;
- fall back to verbose delegates or inline execution when compressed output could hide important nuance;
- in N2/N3 implementation the orchestrator does not read raw: see "Orchestrator reads (N2/N3)" in `.agents/skills/02-implement/implement-change/SKILL.md`;
- in N2/N3, when delegating, pick one of the delegates installed for your runtime by role (listed in `.agents/skills/02-implement/implement-prd/reference/delegate-skill-matrix.md`): discovery `sherlock-estructura`, backend writer `turbo-backend`, frontend writer `pixel-ninja`, acceptance tests `testinator-5000`, focused validation or CI fixes `lint-ranger`, independent QA `qa-relampago`; for a narrow locate, edit, or review task use `cavecrew-investigator`, `cavecrew-builder`, or `cavecrew-reviewer`. Use `general-purpose` only when no catalog delegate fits the role, and state why before launching it.

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
  `workflow-kit:level-prefilter` markers by the kit; `workflow-kit update`
  refreshes it.

Every runtime entrypoint carries the same hand-written "Shared bootstrap"
block, apart from runtime-specific notes: a pointer to this file as the source
of truth, the generated level pre-filter (or a pointer to the adapter that
carries it), the continuation line (classify every new prompt; if it continues
the active workflow, apply the continuation fast-path above; re-route only on a
break signal), the loading-order line, and one line for the execution
authorization gate with its exceptions. Route-specific safeguards (PR comments,
project formation, and other hard triggers) live in `workflow-router`, never in
an adapter.

Runtime adapters must not become the canonical owner of workflow logic; any
other routing rule belongs here or in `workflow-router`.
