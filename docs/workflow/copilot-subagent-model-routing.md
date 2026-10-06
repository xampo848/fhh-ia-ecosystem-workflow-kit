# Copilot Subagent Model Routing: Operational Recipe

Procedure to select, invoke, and verify a GitHub Copilot subagent model. The authoritative delegation protocol is the `Copilot Invocation Protocol` in `.agents/skills/02-implement/implement-prd/reference/subagent-prompts.md`; this guide only adds the commands and the smoke check.

## Limits

- No generic SDK or Node script can invoke `runSubagent`. The orchestrator must call the tool exposed by the Copilot runtime.
- `scripts/copilot-model-routing.mjs` validates option names observed in the runtime. It is not an interceptor of the VS Code tool and does not prove which model executed.
- The helpers are installed with the overlay as byte-identical copies under `.agents/model-routing/` (`copilot-model-routing.mjs`, `delegate-agent-catalog.json`, `verify-copilot-model-evidence.mjs`), generated from `scripts/` by `node scripts/sync-delegate-runtime-adapters.mjs --write`. They need only Node.js; installed repositories have no `scripts/` directory, so use the `.agents/model-routing/` paths there. Never edit the copies by hand.
- Catalog lists, agent `model` front matter, and picker configuration are selections, not execution proof.
- Technical tiers (`Liviano`, `Mediano`, `Grande`) are not billing levels or quality scores. Availability and cost limits remain runtime-owned; catalog prices are list-rate estimates, not actual spend or ability.
- If `Grande` has no observed or permitted candidate, the result is `BLOCKED`, never `PASS`.

## 1. Resolve

Pass the options the runtime currently exposes (tool validation options or names the user confirms in the model picker), either qualified (`Claude Sonnet 5.5 (copilot)`) or as picker names (`Claude Sonnet 5.5`) whose Copilot provider is confirmed. For another or unknown provider, require its exact qualified identifier; the resolver cannot discover the provider of a bare display name. In an installed repository run the same commands with `node .agents/model-routing/copilot-model-routing.mjs`.

```sh
node scripts/copilot-model-routing.mjs --agent cavecrew-investigator \
  --available "MAI-Code-1.1-Flash" --available "Gemini 3.8 Flash (copilot)"

# Installed repository (no scripts/ directory)
node .agents/model-routing/copilot-model-routing.mjs --agent cavecrew-investigator \
  --available "MAI-Code-1.1-Flash" --available "Gemini 3.8 Flash (copilot)"

# Explicit task tier (including Grande)
node scripts/copilot-model-routing.mjs --agent qa-relampago --tier Grande \
  --available "GPT-6.1 Sol (copilot)"

# User-pinned model; the pinned model is observed, so no fallback is needed
node scripts/copilot-model-routing.mjs --agent turbo-backend --model "Claude Sonnet 5.5" \
  --available "Claude Sonnet 5.5"

# Same pin when it may be unavailable: add the flag only after explicit user consent to fall back
node scripts/copilot-model-routing.mjs --agent turbo-backend --model "Claude Sonnet 5.5" \
  --available "Claude Sonnet 5.5" --allow-pinned-fallback

# Structured input (file path or - for stdin; must be a JSON object)
node scripts/copilot-model-routing.mjs --input request.json
```

`request.json` fields: `agentSlug`, `availableModels`, `tier`, `overrideModel`, `allowPinnedFallback`, and the contextual fields `taskContext`, `costEstimate`, `budget`. Input that is not a JSON object (`null`, array, number, string), not valid JSON, has unsupported fields, or sets a context/cost/budget object to null is a usage error (exit `2`). Omit optional objects instead; unknown keys never silently disable a constraint.

### Contextual input (required for a new non-trivial invocation)

The orchestrator interprets the task and passes the result; the resolver validates it, never reads the task itself. Executable example (stdin):

```sh
node scripts/copilot-model-routing.mjs --input - <<'JSON'
{
  "agentSlug": "qa-relampago",
  "availableModels": ["Claude Sonnet 5.5 (copilot)", "GPT-6.1 Sol (copilot)"],
  "taskContext": {
    "objective": "Independent QA of the routing slice",
    "workKind": "review",
    "risk": "medium",
    "ambiguity": "medium",
    "contextCompleteness": "complete",
    "bounded": true,
    "criticalConcerns": []
  },
  "costEstimate": {
    "billingMode": "token",
    "estimationDate": "2026-10-06",
    "uncachedInputTokens": 100000,
    "cachedInputTokens": 0,
    "cacheWriteTokens": 0,
    "outputTokens": 10000
  },
  "budget": { "maxUsd": 1 }
}
JSON
```

Context fields: `objective` (non-empty string); `workKind` one of `lookup`, `mechanical-validation`, `evidence-synthesis`, `readiness`, `planning`, `implementation`, `test-design`, `contract-review`, `review`, `causal-investigation`; `risk` and `ambiguity` one of `low`, `medium`, `high`; `contextCompleteness` one of `complete`, `partial`, `unknown`; `bounded` an explicit boolean; `criticalConcerns` optional, from the catalog enum (`security`, `authorization`, `tenancy`, `data-loss`, `migration`, `public-contract`, `legal`, `release-integrity`, `irreversible-action`). The rules and enums are owned by `copilotModelRouting.contextPolicy` in the catalog.

Output adds `decisionMode` (`contextual` or `legacy`), `contextualTier`, `contextualPosture` (`mechanical-exception`, `role-floor`, `critical`), `costPosture` (`lean`, `balanced`, `premium`), `decisionReasons`, `clarificationRequired`, `suitability` (always `unbenchmarked`), `contextMismatch` and `overrideWarning` for pins, `costEstimate`, `budget`, and `budgetExclusions`. `resolvedModel` stays `unknown`.

Only bounded, complete, low-risk, low-ambiguity lookup, mechanical validation, or
synthesis of already validated evidence qualifies for Liviano without critical
concerns. Other tasks have a Mediano floor. Partial/unknown context requires the
orchestrator to clarify before invocation; a selected result is not permission to
proceed despite `clarificationRequired`.

Cost fields: all counts and their combined input total are non-negative safe integers; `totalContextInputTokens` is optional and must equal the sum of the three input categories; it selects the standard or long-context rate. `estimationDate` is supplied by the caller (no wall clock), and an expired promotion cannot be priced. Prices come from `copilotModelRouting.pricing` (source, verification date, per-model rates, cache read/write applicability); a model absent there is unpriced, not free. `maxUsd` accepts at most six decimal places; finer limits are rejected, never rounded up.

Unsupported or blocking cases (exit `1`, `code` in the JSON):

| Code | Case |
| --- | --- |
| `INVALID_CONTEXT` | malformed, unsupported, or missing context fields |
| `TIER_CONFLICT` | explicit `tier` below the contextual requirement |
| `NO_TIER_CANDIDATE` | no observed candidate in the required tier; no other tier is tried |
| `INVALID_COST_ESTIMATE`, `INVALID_BUDGET` | negative, fractional, non-numeric, or contradictory counts; malformed budget |
| `BUDGET_ESTIMATE_INCOMPLETE` | budget without complete counts, `billingMode`, or `estimationDate` |
| `BUDGET_BILLING_UNSUPPORTED` | budget with `legacy-annual-request` billing, which is not a USD token estimate |
| `BUDGET_EXCEEDED` | available pinned model over budget or unpriceable; it is never substituted |
| `NO_BUDGET_CANDIDATE` | every observed same-tier candidate is over budget, unpriced, lacks cache-write pricing, or has an expired promotion; no cheaper tier is tried |

A user-pinned model below the required tier is kept, with `overrideWarning` and `contextMismatch` recorded. A call without `taskContext` still works and is reported as `decisionMode: legacy`.

Named critical concerns take precedence over a low-risk label; incomplete context
prevents a mechanical exception and requests clarification. Those combinations
are handled conservatively, not rejected as contradictory input.

Exit codes: `0` selected, `1` blocked (`code` and `message` in the JSON), `2` usage error. Use `invocation.agentName` and `invocation.model` from the output as the explicit `runSubagent` arguments. `resolvedModel` is always `unknown` here.

## 2. Invoke

The orchestrator calls `runSubagent` with `agentName` set to the registered Copilot alias (for example `Cavecrew Investigator`, not the `.claude` slug) and `model` set to the qualified selected model. It records the start and end time of the call.

Allowed correction: one retry only when the tool rejects the agent name or model before any work starts and lists a valid observed option in the same tier. Never replay after a timeout, tool failure, or task failure.

## 3. Read-only smoke

Use the same probe for every model so results are comparable:

```text
Read package.json without editing anything. Reply with exactly two lines:
SMOKE_NAME=<value of "name">
SMOKE_VERSION=<value of "version">
```

Pass criteria for the probe: both markers appear with the values from `package.json` and no file changes (`git status --short` unchanged).

## 4. Collect request IDs

1. Save the Copilot Chat log to a file you choose (for example from the Output panel); call it `<log>`. The log path, agent name, model identifiers, and request IDs are operator-supplied; do not commit them or paste private data (prompts, user paths) into records.
2. In the lines between the recorded start and end of the invocation, find the records tagged `[tool/runSubagent-<Agent Name>]` that belong to this invocation (`ccreq:<id>`).
3. Supply only IDs you can attribute to this run. An agent label alone is not proof: concurrent calls with the same label have different IDs.

Copilot rotates its log files. Preserve the complete correlated request lines
immediately after the probe, without prompts or other log contents. If IDs disappear
from the active log, inspect its rotated files; missing records stay `NOT_VERIFIED`.

## 5. Verify

Supply every runtime model identifier that may appear (requested and served variants). The mapping from selected name to runtime identifier is explicit, never guessed.

The supplied identifiers must be confirmed aliases of the one selected model, not
a set of alternative models. The verifier checks records against that set; it
cannot establish alias equivalence or attribute concurrent requests by itself.
If attribution or alias mapping is uncertain, keep the run unverified.

```sh
node scripts/verify-copilot-model-evidence.mjs --log <log> \
  --agent "Cavecrew Investigator" \
  --model-id claude-sonnet-5.5 --model-id claude-sonnet-5-5 \
  --request-id 77296111 --request-id <another-id> \
  --since "2026-10-06 12:12:00" --until "2026-10-06 12:13:00"
```

`--request-id` may be repeated and `--since`/`--until` are optional. In an installed repository use `node .agents/model-routing/verify-copilot-model-evidence.mjs` with the same arguments.

Verdicts and exit codes: `VERIFIED` `0`, `NOT_VERIFIED` `1` (missing, malformed, failed or cancelled, outside the interval), usage `2`, `MISMATCH` `3` (wrong agent, wrong or mixed model chain, conflicting records). Output contains only IDs, agent, status, model chain, duration, and timestamp; it never prints prompts or raw log lines.

## 6. Record

Keep per run: VS Code version, Copilot Chat version, invoked `agentName`, tier, selected model, request IDs, probe markers, verifier verdict, and any `BLOCKED` reason. Set `resolved_model` in the delegation envelope only when the verdict is `VERIFIED`.
