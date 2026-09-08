# Cross-Runtime Delegation Capability Matrix

Baseline recorded: 2026-09-07.

This matrix is a reproducible evidence record for Copilot and Claude Code. It
separates product documentation, repository configuration, and execution
observation. A documented or configured value is not proof that a runtime
accepted it or used it.

## Evidence Status

| Status | Meaning |
| --- | --- |
| `documented` | Described by an upstream product source. |
| `configured` | Present in repository or user-visible configuration. |
| `observed` | Captured by a reproducible runtime smoke with its version and result. |
| `unknown` | Not available from the current evidence. It must not be inferred. |
| `unsupported` | Rejected or unavailable in an observed runtime/version. |

## Baseline Matrix

| Runtime | Surface | Runtime version | Schema version | Registered agent | Requested model | Resolved model | Overrides | Permissions | Result | Documented | Configured | Observed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Copilot | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` |
| Claude Code | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` | `unknown` |

No runtime/schema has been observed for this baseline. This document does not
claim compatibility, support, model selection, tool isolation, or an effective
agent for either runtime.

## Recording Rules

1. Record the exact runtime and surface separately, for example a terminal,
   IDE integration, or custom-agent surface. Do not transfer evidence across
   surfaces.
2. Record runtime version and schema version verbatim. Keep them `unknown` when
   the runtime does not expose them.
3. Record the registered agent and the effective agent separately when both are
   observable. Otherwise record the effective agent as `unknown`.
4. Record `requested_model` from the invocation and `resolved_model` only from
   runtime evidence. `resolved_model: unknown` is valid and does not by itself
   fail a quality check.
5. Record user, organization, and environment overrides with their source. Do
   not bypass an override to make a specialization appear available.
6. Record permissions as observed capability boundaries, not as instructions or
   an agent label. A read-only instruction is not proof of isolation.
7. Record the command, fixture, timestamp, observable result, and limitations
   in the runbook entry. Values unavailable to the runtime remain `unknown`.

Use [the runbook](cross-runtime-delegation-runbook.md) to add observed evidence.
