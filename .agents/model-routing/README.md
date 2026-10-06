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
- For `create-prd`, use Liviano for Phase 1 calibration and Phase 2 ambiguity detection, Mediano for Phase 3 pattern lock and Phase 5 self-audit, and Grande only for Phase 4 drafting. Apply this only when the runtime permits phase-level tier selection; never claim an automatic switch otherwise.
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
possible, report the block and require an explicitly authorized tier change;
never change tiers automatically.

Fallback behavior must be explicit:

- default mode is `auto-with-fallback`;
- every fallback must emit a brief reason;
- fallback must never silently violate a stronger user override;
- when the requested tier has no observed candidate, report it as blocked and
  ask for a human choice; do not change tier or silently inherit the parent
  model.

## User control mode

Users must be able to choose between automatic routing and explicit control.

Allowed control modes:

| Mode | Behavior |
| --- | --- |
| `auto-with-fallback` | System chooses by posture/tier and applies safe fallback when needed. |
| `user-pinned-model` | User forces exact model; fallback only with explicit user consent and a warning. |
| `user-pinned-tier` | User forces tier; runtime may choose the closest model in that tier. |

Rules:

1. Default remains `auto-with-fallback` unless user requests otherwise.
2. User may switch mode per task or per session.
3. If `user-pinned-model` is unavailable or blocked by policy, the system must
   ask for confirmation before applying any fallback.
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
- Discovery and validation delegates usually map to **Liviano** defaults.
- Readiness, slicing, acceptance-test, QA, review, and main implementation/writer delegates usually map to **Mediano** defaults.
- High-risk architecture or release-critical review may escalate to **Grande** through an explicit risk rationale, never because the tier is assumed to be more expensive or better.
- Delegation policy must remain compatible with `implement-prd` wait barriers,
  one-writer-per-file ownership, and explicit handoff rules.

## Implement-PRD role routing

Use these defaults as the conservative fallback when no task context exists. They are not strength metrics. A Copilot orchestrator derives the tier from the task context first (see `Contextual task selection`) and may escalate on a concrete trigger or cheapen only a clearly mechanical task:

| Role | Default tier | Escalate when |
| --- | --- | --- |
| Orchestrator | Mediano | Architecture, deep debugging, or release-critical risk requires `Grande`; do not use `xhigh` for the whole session by default |
| Readiness (`capitana-alcance`) and slicing (`arquitecta-fases`) | Mediano | High risk, high ambiguity, or a named critical concern needs `Grande`; bounded, complete, low-risk mechanical checks may use `Liviano` |
| Discovery (`sherlock-estructura`) | Liviano | Substantive, ambiguous, or incomplete-context work needs `Mediano` or `Grande` |
| Implementation writer | Mediano | Destructive migration, security/tenancy, or deep cross-layer contract risk needs a targeted `Grande` review |
| Acceptance tests (`testinator-5000`) and terse review (`cavecrew-reviewer`) | Mediano | A named critical concern or high risk needs `Grande` |
| Focused validation | Liviano | Flaky, broad, or non-obvious failures need `Mediano` |
| Final QA | Mediano | Release-critical or high-blast-radius review needs `Grande` |

The orchestrator must record the requested tier and any escalation reason in
the tracker. A runtime may not support changing its own model or pinning a
subagent tier; in that case, report the limitation and do not claim that the
requested tier was applied.

## Documentation role routing

`document-development` synthesizes work that is already implemented and validated, so it defaults to `lean` and tier **Liviano**.

| Aspect | Rule |
| --- | --- |
| Default tier | Liviano; delegate `escriba-doc` where the runtime can pin a subagent model |
| Bounded reads | PRD, implementation evidence (tracker/QA handoff), and the key files that evidence cites |
| Escalate to Mediano when | PRD contradicts the evidence or code, or real complexity appears (cross-layer flow, auth/tenancy, key-file set that cannot be bounded) |
| Success criterion | In 2-3 real cases, Liviano output matches the quality of the previous default |

Record the escalation reason when the tier is raised. Apply the same no-automatic-switching rule: report the recommended tier when the runtime cannot pin it.

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
decision_mode: contextual | legacy
contextual_tier: <tier derived from taskContext | none>
fallback_reason: <optional reason>
user_confirmed_fallback: true | false | not-required
```

`requested_model` records an adapter request, not proof of execution. Set
`resolved_model: unknown` unless the runtime exposes execution evidence that
correlates to the delegated run. Do not ask a delegate to self-report its model
identity and do not infer it from an agent label, prompt, catalog, or fallback
choice.

### Copilot explicit invocation

GitHub Copilot exposes a per-call `model` parameter for `runSubagent`, so the
orchestrator passes the registered agent name and a runtime-qualified model
(for example `Claude Sonnet 5.5 (copilot)`) explicitly. The selected model is the
`requested_model`; the model that executed is `resolved_model` and stays
`unknown` until correlated runtime evidence exists. Candidate lists are static
and only valid after revalidation against options observed in the current
session. Technical tiers do not imply billing levels; availability and cost
constraints remain runtime-owned. The procedure lives in the `Copilot Invocation
Protocol` of `.agents/skills/02-implement/implement-prd/reference/subagent-prompts.md`.
The resolver and the evidence verifier ship in this directory as generated,
Node-only helpers (`copilot-model-routing.mjs`, `delegate-agent-catalog.json`,
`verify-copilot-model-evidence.mjs`); do not edit them by hand.

### Contextual task selection

The orchestrator interprets the task before each new non-trivial `runSubagent`
invocation and passes an explicit structured `taskContext` to the resolver. The
resolver only classifies the supplied signals; it does not read the task, call a
live catalog, or switch a running agent. The rule enums live in the canonical
catalog (`copilotModelRouting.contextPolicy`), not in this file.

| Signal | Values |
| --- | --- |
| `objective` | non-empty string |
| `workKind` | `lookup`, `mechanical-validation`, `evidence-synthesis`, `readiness`, `planning`, `implementation`, `test-design`, `contract-review`, `review`, `causal-investigation` |
| `risk`, `ambiguity` | `low`, `medium`, `high` |
| `contextCompleteness` | `complete`, `partial`, `unknown` |
| `bounded` | explicit boolean |
| `criticalConcerns` | optional list from the catalog enum (for example `security`, `data-loss`, `public-contract`) |

Decision rules:

1. Malformed, unsupported, or missing context blocks as `INVALID_CONTEXT`; unknown context is never defaulted to safe.
2. High risk, high ambiguity, or any named critical concern requires `Grande`, and the named reason is recorded. `Grande` is a risk-justified tier, not an assumption of higher cost or an automatic escalation to a specific premium model.
3. Only `lookup`, `mechanical-validation`, or synthesis of already validated evidence (`evidence-synthesis`) that is bounded, complete, low risk, low ambiguity, and has no concerns may use `Liviano`.
4. All work outside that explicit exception needs at least `Mediano`, even for a read-only or ordinarily lightweight role.
5. `partial` or `unknown` completeness never cheapens a role and returns `clarificationRequired` so the orchestrator clarifies before delegating.
6. An explicit tier below the contextual requirement blocks (`TIER_CONFLICT`); a higher explicit tier is honored and recorded.
7. A user-pinned model keeps user control, but when it is not shown adequate for the required tier the result carries a clear `overrideWarning` and a recorded `contextMismatch`.
8. A call without `taskContext` is the legacy path: the output says `decisionMode: legacy` and no contextual check was applied. New non-trivial invocations must pass context.

Selection stays within the required tier: exact qualified identities, no silent tier fallback, strict boolean fallback consent, and at most one pre-execution correction. Luna is an economical `Liviano` candidate and MAI a reliable alternative; neither is a quality-benchmark winner. `GPT-6.1 Sol` and `GPT-6 Sol` are ordinary `Mediano` candidates that remain `Grande` eligible. Output reports `suitability.basis: unbenchmarked` and `resolved_model: unknown`.

`contextualPosture` names the decision rule (`mechanical-exception`, `role-floor`,
or `critical`). The separate `costPosture` field uses `lean`, `balanced`, or
`premium` as routing intent, not a model's price band. Structured CLI input rejects
unknown fields and explicit null context/cost/budget objects instead of silently
ignoring a misspelled constraint; omit optional objects to use the legacy path.

### Optional cost and budget contract

The resolver accepts caller-supplied token counts (`costEstimate`) and an optional `budget`. It never measures or invents telemetry. Prices live in the catalog (`copilotModelRouting.pricing`) with source, verification date, per-model standard and long-context rates, and cache read/write applicability.

- Counts are non-negative integers: `uncachedInputTokens`, `cachedInputTokens`, `cacheWriteTokens`, `outputTokens`, plus `billingMode` and an explicit `estimationDate` (`YYYY-MM-DD`). `totalContextInputTokens` is optional and, if given, must equal the three input categories; it selects the standard or long rate.
- A budget (`maxUsd`) requires complete counts and `billingMode: token`; otherwise it blocks. It accepts at most six decimal places and never rounds a limit up. `legacy-annual-request` billing is not a USD token estimate and blocks a budget.
- A candidate with unknown pricing, an unsupported cache-write rate, an expired promotion, or an unpriced long context cannot pass a budget; it is excluded within the same required tier and never replaced by a cheaper tier.
- An available user-pinned model over budget or unpriceable blocks (`BUDGET_EXCEEDED`); it is never substituted.
- Estimates are list-rate figures, not actual spend, a billing receipt, or evidence of ability.

## Neutral Delegation Envelope

Use `delegation-envelope/v1` for every non-trivial delegated slice. It is a
portable record contract, not an SDK schema, runtime invocation API, generated
identifier format, or automatic enforcement mechanism. The orchestrator records
the envelope once in the tracker and passes only the applicable fields to a
delegate prompt.

```text
schema_version: delegation-envelope/v1
run_id: <orchestrator correlation id>
slice_id: <slice id>
execution_lock_id: <lock id | none>
role: <orchestrator | delegate role>
skill_path: <exact SKILL.md path>

invocation:
   runtime: <runtime name>
   surface: <runtime surface | unknown>
   registered_agent: <registered identity | unknown>
   requested_tier: Liviano | Mediano | Grande
   escalation_reason: <reason | none>
   routing_mode: auto-with-fallback | user-pinned-model | user-pinned-tier
   requested_model: <runtime model identifier | inherit | unknown>
   availability_source: <runtime-observed source | unknown>
   resolved_model: <runtime-confirmed identifier | unknown>
   resolved_model_evidence: <runtime evidence reference | none>

task:
   objective: <observable outcome>
   acceptance_criteria[N]: <AC id>
   files_owned[N]: <path>
   files_forbidden[N]: <path>
   verified_predecessors[N]: <slice id | none>
   producer_consumer_contract: <contract | none>

context:
   required_reads[N]: <path or section>
   discovery_summary: <relevant bounded discovery | none>
   selected_patterns[N]: <path or none>
   provenance: <source and freshness | unknown>
   open_questions[N]: <question | none>

verification:
   required_checks[N]: <command or check>
   expected_evidence[N]: <evidence>
   evidence_state: fresh | stale | missing

output:
   status: success | partial | blocked
   files_changed[N]: <path | none>
   ac_covered[N]: <AC id | none>
   commands_executed[N]: <command | none>
   validation_result: PASS | FAIL | NOT_RUN
   gaps_or_risks[N]: <risk | none>
   fallback_reason: <reason | none>
```

Rules:

1. `requested_model` and `resolved_model` are separate fields. A missing or
    unobservable runtime execution identity is recorded as `resolved_model:
    unknown`; that fact alone does not block delivery.
2. A non-`unknown` `resolved_model` requires `resolved_model_evidence` from the
    runtime. This contract does not define how a runtime emits that evidence.
3. When a lock is required, `execution_lock_id` must be present, must not be
    `none`, and must equal the active lock for the same `run_id` and `slice_id`.
4. A slice may be marked `VERIFIED` only when its correlated lock is present,
    complete, and matching, and its command evidence is `fresh`. Missing,
    `none`, mismatched, stale, or missing lock/evidence data blocks `VERIFIED`.
5. These rules define workflow checks for the orchestrator and reviewers. They
    do not claim runtime-side validation, automatic model resolution, or
    enforcement.

## Cross-runtime routing matrix

| Workflow / task | Risk signal | Cost posture | Tier | Codex default | GitHub/Copilot default | Delegation default | User override rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Freeform routing, tiny docs, repetitive validation | low ambiguity, low blast radius | `lean` | Liviano | closest lightweight equivalent | closest lightweight equivalent | Avoided unless a narrow helper reduces context | Allowed; warn if user forces unnecessary premium |
| `create-prd` and high-ambiguity planning | ambiguous scope, synthesis risk, architecture/product trade-off | `balanced` by default, `premium` if risk is high | Grande | strongest allowed planning-capable equivalent | strongest allowed planning-capable equivalent | Usually avoided inline unless workflow explicitly delegates | Allowed; warn if user forces a cheaper tier that risks under-specification |
| `implement-prd` orchestration and main writer slices | normal multi-step technical work | `balanced` | Mediano | closest allowed technical-workhorse equivalent | closest allowed technical-workhorse equivalent | Recommended/required depending on slice boundaries | Allowed; warn if user forces Liviano for non-trivial implementation |
| Discovery and validation delegates | focused read/triage with mostly noisy failure modes | `lean` by default | Liviano | closest allowed lightweight equivalent | closest allowed lightweight equivalent | Recommended when they reduce risk/context; avoided in simple docs-only work | Allowed; warn if user forces Grande without added value |
| Acceptance-test, QA, and review delegates | substantive evidence judgment | `balanced` | Mediano | closest allowed technical-workhorse equivalent | closest allowed technical-workhorse equivalent | Recommended when they add independent review | Allowed; warn if user forces Liviano for substantive review |
| Readiness and implementation slicing delegates | approved PRD with explicit scope, ownership, sequencing, and evidence | `balanced` by default; `lean` only for bounded, complete, low-risk mechanical checks; escalate for unresolved ambiguity | Mediano | closest allowed technical-workhorse equivalent | closest allowed technical-workhorse equivalent | Recommended only when they reduce context or review bias | Allowed; warn if user forces Liviano when unresolved ambiguity materially affects downstream rework |
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
- `.agents/skills/index.md` owns startup discovery; `.agents/skills/registry.md` owns full inventory and loading posture.
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
