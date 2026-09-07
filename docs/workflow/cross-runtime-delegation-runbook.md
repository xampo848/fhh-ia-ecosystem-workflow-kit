# Cross-Runtime Delegation Baseline Runbook

Use this runbook to collect a small, reproducible runtime smoke for Copilot or
Claude Code. Its purpose is evidence collection, not a claim of compatibility.

## Preconditions

1. Use an authorized environment and a disposable, non-secret fixture.
2. Capture the kit revision, runtime name, exact surface, runtime version, and
   the invocation schema/version when exposed.
3. Preserve applicable user, organization, and environment overrides. Record
   their source and effect; do not disable them to force specialization.
4. Confirm the agent identity registered in the selected surface and the actual
   permissions exposed by the runtime. Instructions alone do not prove
   isolation.

## Smoke Procedure

1. Invoke one bounded read-only task with a declared `requested_model`, or
   explicitly record inheritance when that is the configured request.
2. Record the registered agent, effective agent when the runtime exposes it,
   execution result, and the exact observable evidence.
3. Record `resolved_model` only when the runtime exposes it. Otherwise write
   `resolved_model: unknown`.
4. Record every unavailable field as `unknown`, including runtime version,
   schema version, agent identity, overrides, permissions, and result when they
   cannot be observed.
5. Update the matching row in the capability matrix, identifying each value as
   `documented`, `configured`, `observed`, `unknown`, or `unsupported`.
6. Repeat only after a runtime, schema, configuration, or permission change.

## Evidence Record

Use this record for each smoke. Do not store prompts, secrets, full traces,
token estimates, or cost estimates.

```text
runtime: Copilot | Claude Code
surface: unknown
kit_revision: unknown
runtime_version: unknown
schema_version: unknown
registered_agent: unknown
effective_agent: unknown
requested_model: unknown | inherit | <runtime-exposed value>
resolved_model: unknown | <runtime-observed value>
overrides: unknown
permissions: unknown
fixture: <non-secret fixture reference>
command: <exact command or UI procedure>
result: unknown | pass | fail | unsupported
evidence: <observable output or screenshot reference>
limitations: <unknown fields and scope limits>
timestamp: <ISO-8601 timestamp>
```

## Interpretation And Stop Rules

- `documented` describes an upstream source. `configured` describes local
  setup. Only `observed` describes the executed runtime/surface/version.
- Do not state that Copilot or Claude Code is compatible, supported, isolated,
  or selected a model until a smoke record supplies matching observed evidence.
- Do not treat a model declaration, agent frontmatter, or a tool name as proof
  that the runtime selected that model or effective agent.
- A missing `resolved_model` does not block delivery by itself; record it as
  `unknown`. A required hard capability with no observed evidence blocks only
  the dependent slice.
- A failed, timed-out, or partially written smoke requires inspection of its
  effects before a bounded retry. Never use a retry to conceal a partial write.
- This baseline has no observed runtime/schema evidence. It must remain an
  unknown baseline until a record above is completed.
