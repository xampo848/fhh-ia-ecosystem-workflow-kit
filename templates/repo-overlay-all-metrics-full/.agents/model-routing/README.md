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

## Current observed runtime defaults

These are descriptive current defaults, not permanent contract terms.

| Runtime surface | Current observed default |
| --- | --- |
| GitHub PRD-oriented agent | `GPT 5.5` |
| Main implementation/writer agents | `GPT 5.4` |
| Light discovery/review/validation delegates | `GPT 5.4-mini` |

## Cross-runtime routing matrix

| Workflow / task | Risk signal | Cost posture | Tier | Codex default | GitHub/Copilot default | Delegation default | User override rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Freeform routing, tiny docs, repetitive validation | low ambiguity, low blast radius | `lean` | Liviano | closest lightweight equivalent | closest lightweight equivalent | Avoided unless a narrow helper reduces context | Allowed; warn if user forces unnecessary premium |
| `create-prd` and high-ambiguity planning | ambiguous scope, synthesis risk, architecture/product trade-off | `balanced` by default, `premium` if risk is high | Grande | strongest planning-capable equivalent available | `GPT 5.5` currently for GitHub PRD agent | Usually avoided inline unless workflow explicitly delegates | Allowed; warn if user forces a cheaper tier that risks under-specification |
| `implement-prd` orchestration and main writer slices | normal multi-step technical work | `balanced` | Mediano | `GPT 5.4` currently | `GPT 5.4` currently | Recommended/required depending on slice boundaries | Allowed; warn if user forces Liviano for non-trivial implementation |
| Discovery, readiness, slicing, review, validation delegates | focused read/review/triage | `lean` by default | Liviano | `GPT 5.4-mini` currently for these delegates | `GPT 5.4-mini` currently for these delegates | Recommended when they reduce risk/context; avoided in simple docs-only work | Allowed; warn if user forces Grande without added value |
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
