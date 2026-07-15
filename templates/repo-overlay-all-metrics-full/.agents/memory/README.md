# Neutral memory sharing and runtime parity governance

This directory defines the neutral governance contract for optional shared
memory and runtime parity review in All Metrics AI workflows.

## Purpose

Memory is useful only when it improves future work without leaking sensitive
context or turning noisy chat history into a second source of truth.

This policy answers:

1. which memory remains local-only;
2. which knowledge may become project-shared;
3. how export/import must preserve provenance;
4. what must never be shared;
5. how runtime wrappers prove parity with the neutral contract.

## Memory scopes

| Scope | Meaning | Default sharing posture |
| --- | --- | --- |
| `local-session` | Short-lived context for one session/runtime only | Never export by default |
| `local-user` | Durable personal memory for one user/runtime environment | Never export by default |
| `project-shared` | Repo-relevant memory that may be shared through versioned files or approved shared storage | Opt-in only |
| `runtime-derived` | Reconstructible runtime metadata or transient tool state | Do not treat as durable memory of record |

Rules:

- Not all memory is shareable.
- Project-shared memory is opt-in and must be curated.
- Personal/local memory must not be exported by default.
- Shared memory is durable workflow knowledge, not raw chat exhaust.

## Shareability criteria

Shareable memory may include:

- architecture/workflow decisions;
- validated conventions and guardrails;
- non-sensitive implementation learnings;
- parity decisions and rollout notes;
- durable glossary/mappings for the AI workflow layer.

Do not share by default:

- secrets, tokens, credentials, private keys;
- personal/private user preferences unrelated to the repo;
- noisy transient prompts or failed scratchpad thoughts;
- environment-specific local paths unless intentionally normalized;
- information whose sharing would create security or privacy risk.

## Sensitivity levels

| Sensitivity | Meaning | Allowed in repo-shared memory? |
| --- | --- | --- |
| `public-in-repo` | Safe to commit/share with normal repository readers | Yes |
| `restricted` | Potentially useful but requires review or a narrower storage location | Not by default |
| `do-not-share` | Secrets, personal data, noisy private context, or unsafe content | No |

## Export/import posture

Shared-memory export/import is selective, explicit, and provenance-aware.

Rules:

1. Export must be intentionally scoped to `project-shared` content.
2. Import into another runtime/repo context must preserve provenance.
3. Source-of-truth docs remain separate from memory artifacts.
4. Repo-shared memory should be normalized before it becomes team guidance.
5. Automatic continuous sync is out of scope for this phase.

## Shared-memory artifact contract

Minimum fields:

| Field | Meaning |
| --- | --- |
| `title` | Searchable summary |
| `type` | `decision`, `discovery`, `pattern`, `preference`, `risk`, `glossary`, or `rollout-note` |
| `scope` | `local-user` or `project-shared` |
| `source` | runtime, session summary, curated note, PRD, docs review, etc. |
| `provenance` | author/runtime/date or equivalent attribution |
| `content` | durable normalized knowledge |
| `sensitivity` | `public-in-repo`, `restricted`, or `do-not-share` |
| `status` | `draft`, `validated`, `superseded`, or `active` |
| `topic_key` | stable logical grouping when relevant |

Requirements:

- Shared memory must be understandable without the original chat.
- `do-not-share` items must never be promoted into repo-shared memory.
- This shape is documentation-first and prepared for future YAML/JSON/TOML
  automation.

## Runtime parity governance

Runtime parity means semantic equivalence across wrappers, not identical file
formats or identical tool support.

Supported current runtime targets:

- Codex
- GitHub Copilot
- Claude Code

Future wrappers may join if they point back to the same neutral policies.

Runtime wrappers may differ in:

- file format;
- command syntax;
- available tools;
- adapter metadata.

Runtime wrappers must not differ in:

- source-of-truth hierarchy;
- skill loading semantics;
- install/attach policy;
- capability attachment semantics;
- model/cost/delegation meaning;
- memory shareability and exclusion rules;
- closure/reporting expectations for substantial work.

## Review triggers

Run a parity review:

- after neutral contract changes under `.agents/`;
- after wrapper bootstrap changes in `AGENTS.md`, `.github/**`, `CLAUDE.md`, or
  `.codex/**`;
- before claiming support for a new runtime;
- before promoting shared memory conventions broadly across the team.

Recommended cadence:

- focused parity review per substantial governance PRD;
- periodic audit for accumulated wrapper drift.

## Rollout guidance

1. Start with optional `project-shared` memory.
2. Use the parity checklist before building heavy automation.
3. Record explicit fallbacks when a runtime lacks a capability.
4. Disable shared memory for a project/team if noise or sensitivity risk
   outweighs value.

## Relationship to other neutral docs

- `.agents/instructions.md` owns the neutral AI source hierarchy.
- `.agents/skills/registry.md` owns skill discovery and loading posture.
- `.agents/integrations/README.md` owns install/attach request flow.
- `.agents/capabilities/README.md` owns capability packaging and attach points.
- `.agents/model-routing/README.md` owns routing/cost/delegation semantics.
- This file owns memory shareability and runtime parity governance.

## Out of scope for this phase

- automatic memory sync daemons;
- encrypted secret stores or key-management systems;
- telemetry platforms for memory usage;
- product backend/frontend code;
- fully automated runtime conformance test harnesses;
- replacing Engram or building a new memory backend.
