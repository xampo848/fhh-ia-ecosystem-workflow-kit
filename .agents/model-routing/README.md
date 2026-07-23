# Neutral model routing, cost posture, and delegation policy

This document is the neutral cross-runtime policy for choosing **cost posture**,
**model tier**, **delegation default**, and **user override behavior** in All
Metrics AI workflows.

This policy is normative at the **tier and posture** level. Exact model names are
current runtime defaults, not eternal contract terms.

## Core principles

1. Route by **risk and intent**, not by brand loyalty or exact model name.
2. Use the **lowest safe cost posture** that preserves quality.
3. Treat **tier** and **cost posture** as distinct concepts.
4. Use **delegation** only when it reduces risk, context load, or review bias.
5. Never claim **automatic model switching** unless the runtime explicitly
   confirms it.
6. Honor **explicit user override**, but warn briefly when the override is risky.

## Cost posture

| Cost posture | Meaning | Default use |
| --- | --- | --- |
| `lean` | Lowest safe cost for low-risk, repetitive, routing, docs, narrow review, focused validation | routing, documentation, ticketing, repetitive checks, lightweight review |
| `balanced` | Default for reliable reasoning in most planning and implementation work | PRDs, implementation, tests, moderate debugging, normal QA |
| `premium` | Escalated posture only when ambiguity, architecture, release sensitivity, or risk justify it | architecture, deep debugging, high-risk QA, security/tenancy, migration/cutover review |

Rules:

- Non-trivial routed work must name a cost posture.
- `premium` requires an explicit risk rationale.
- Cost posture is not an exact model name.
- Runtime adapters may choose the closest current model for the intended posture.

## Model tiers

| Tier | Meaning | Typical use |
| --- | --- | --- |
| Grande | Highest-reasoning tier for ambiguous planning, architecture, and high-stakes synthesis | `create-epic`, `create-prd`, subtle architecture/product decisions, release-critical review |
| Mediano | Default technical workhorse for implementation and normal multi-step reasoning | `implement-prd`, main writers, normal QA, acceptance test work |
| Liviano | Focused reading, discovery, repetitive validation, narrow review, compressed helpers | discovery/review delegates, validation, narrow helper tasks |

Rules:

- The **tier** is the canonical contract.
- Exact model names are descriptive current defaults for each runtime.
- Parity is evaluated by equivalent tier/risk fit, not exact same model name.
- Do not claim automatic switching unless the runtime confirms it.

## User override

Explicit user override is allowed.

Rules:

1. If the user explicitly asks for a stronger or cheaper model/tier, that
   override takes precedence over the default.
2. The workflow should add a brief warning when the requested override is likely
   unsafe for the task.
3. The system must not silently downgrade a user-requested stronger tier.
4. Wrapper docs must distinguish between **default routing** and **user-forced
   override**.

## Model resolution and fallback contract

Routing must resolve in this order:

1. Determine task risk/intent.
2. Select target **cost posture** (`lean`, `balanced`, `premium`).
3. Select target **tier** (Liviano, Mediano, Grande).
4. Resolve to the closest allowed runtime model for that tier.

If the preferred model is unavailable (policy, plan, rollout, region, runtime
constraint), use the nearest safe fallback in the same tier. If that is not
possible, move one tier up before moving one tier down.

Fallback behavior must be explicit:

- default mode is `auto-with-fallback`;
- every fallback must emit a brief reason;
- fallback must never silently violate a stronger user override.

## User control mode

Users must be able to choose between automatic routing and explicit control.

Allowed control modes:

| Mode | Behavior |
| --- | --- |
| `auto-with-fallback` | System chooses by posture/tier and applies safe fallback when needed. |
| `user-pinned-model` | User forces exact model; fallback only if that model is unavailable, with explicit warning. |
| `user-pinned-tier` | User forces tier; runtime may choose the closest model in that tier. |

Rules:

1. Default remains `auto-with-fallback` unless user requests otherwise.
2. User may switch mode per task or per session.
3. If `user-pinned-model` is blocked by policy, the system must ask for
   confirmation before applying fallback.
4. The system must preserve the no-silent-downgrade rule for stronger
   user-requested tiers.

## Delegation policy

Delegation is part of routing policy, not a separate afterthought.

| Delegation state | Meaning |
| --- | --- |
| Avoided | Inline work is cheaper and safer than spawning delegates |
| Recommended | A delegate reduces context load, review bias, or focused risk |
| Required | Contract boundary, ownership boundary, independent review, or high-risk workflow requires it |

Rules:

- `controlled-lite` docs-only or one-surface work should usually avoid
  delegation when it adds ceremony.
- Discovery/review/validation delegates usually map to **Liviano** defaults.
- Main implementation/writer delegates usually map to **Mediano** defaults.
- High-risk architecture or release-critical review may escalate to **Grande**.
- Delegation policy must remain compatible with `implement-prd` wait barriers,
  one-writer-per-file ownership, and explicit handoff rules.

## Runtime parity

Cross-runtime parity is **equivalent**, not strict exact-model identity.

Parity means:

1. The same workflow/task type maps to the same **cost posture**.
2. The same workflow/task type maps to the same **tier intent**.
3. Exact model names may differ when runtime capabilities differ.
4. A parity review fails only when two runtimes route the same task to
   materially different risk/quality levels without explanation.

## Runtime model resolution

The neutral workflow never assumes that one provider, family, or exact model is
available everywhere. A runtime resolves a requested tier only from its own
currently allowed model catalog, which may be constrained by account, plan,
organization policy, repository policy, region, rollout, or runtime version.

Each runtime adapter must state whether it can:

| Capability | Meaning |
| --- | --- |
| Discover catalog | Read the models currently available to this user/runtime. |
| Pin a subagent model | Start a delegated agent with an exact model identifier. |
| Pin a subagent tier | Start a delegated agent with a tier and let the runtime resolve its model. |
| Auto fallback | Automatically replace an unavailable requested model. |

An adapter must not claim support for a capability unless the active runtime
confirms it. If catalog discovery or model pinning is unavailable, the adapter
must report that limitation and ask the user to select a model in the runtime UI
when a choice is required.

### Resolution record

For a non-trivial delegated task, record or report when the runtime permits it:

```text
routing_mode: auto-with-fallback | user-pinned-model | user-pinned-tier
requested_tier: Liviano | Mediano | Grande
requested_model: <optional runtime model identifier>
resolved_model: <runtime-confirmed model identifier, if exposed>
fallback_reason: <optional reason>
user_confirmed_fallback: true | false | not-required
```

## Cross-runtime routing matrix

| Workflow / task | Risk signal | Cost posture | Tier | Codex default | GitHub/Copilot default | Delegation default | User override rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Freeform routing, tiny docs, repetitive validation | low ambiguity, low blast radius | `lean` | Liviano | closest lightweight equivalent | closest lightweight equivalent | Avoided unless a narrow helper reduces context | Allowed; warn if user forces unnecessary premium |
| `create-prd` and high-ambiguity planning | ambiguous scope, synthesis risk, architecture/product trade-off | `balanced` by default, `premium` if risk is high | Grande | strongest allowed planning-capable equivalent | strongest allowed planning-capable equivalent | Usually avoided inline unless workflow explicitly delegates | Allowed; warn if user forces a cheaper tier that risks under-specification |
| `implement-prd` orchestration and main writer slices | normal multi-step technical work | `balanced` | Mediano | closest allowed technical-workhorse equivalent | closest allowed technical-workhorse equivalent | Recommended/required depending on slice boundaries | Allowed; warn if user forces Liviano for non-trivial implementation |
| Discovery, readiness, slicing, review, validation delegates | focused read/review/triage | `lean` by default | Liviano | closest allowed lightweight equivalent | closest allowed lightweight equivalent | Recommended when they reduce risk/context; avoided in simple docs-only work | Allowed; warn if user forces Grande without added value |
| Release-critical QA, deep debugging, architecture-sensitive review | high ambiguity, high blast radius, release or migration risk | `premium` | Grande or strongest equivalent | strongest available equivalent | strongest available equivalent | Recommended or required depending on risk | Allowed; never silently downgrade a user-requested stronger tier |

## Wrapper contract

Runtime wrappers may define:

- current exact model defaults;
- runtime-specific syntax for selecting a model;
- runtime-specific caveats.

Runtime wrappers must not redefine:

- what `lean / balanced / premium` mean;
- what `Grande / Mediano / Liviano` mean;
- the user override rule;
- the no-fake-auto-switch rule;
- the equivalent-parity rule.

## Relationship to other neutral docs

- `.agents/instructions.md` owns the neutral AI source hierarchy.
- `.agents/skills/registry.md` owns skill discovery and loading posture.
- `.agents/integrations/README.md` owns install/attach/tooling policy.
- This file owns cross-runtime model routing, cost posture, and delegation
  meaning.

## Out of scope for this phase

- telemetry or automated token accounting;
- dynamic model switching infrastructure;
- adaptive routing engines;
- memory governance;
- packaging blueprint;
- backend/frontend product code.
