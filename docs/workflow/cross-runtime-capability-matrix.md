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

## Plugin mode

Plugin mode (pilot) runs the kit as the plugin `fhh` from the marketplace
`fhh-ia-ecosystem`; see [Quickstart, plugin mode](../quickstart.md#11-plugin-mode-pilot).
This section records what is verified and what is only documented, using the
statuses above. It is separate from the delegation baseline.

| Runtime | Plugin mode | Status |
| --- | --- | --- |
| Claude Code | supported | `observed` by a smoke: the plugin loads, its skills are `fhh:*`, `fhh:kit-root` gives the kit root, and the overlay is read from the repository |
| VS Code Copilot | supported format | `documented` only, not verified here |
| Copilot CLI | supported format | partly `observed` by a smoke (CLI 1.0.51, model gpt-4.1, the only one available to the test account): the plugin loads with `--plugin-dir`; its skills are listed without a prefix (`kit-root`, `create-prd`); only `kit-root` is visible to the model; the adapter's kit-location instruction reaches the model, and `kit-root` gives the kit root when it is invoked. with the entry points named in the adapter, gpt-4.1 names the right router path but answers without reading any file, so routing is not verified; stronger models were not available to test |
| Copilot cloud agent | not verified | `unknown` |
| Codex, Cursor | not supported yet | planned for a future phase |
| Antigravity, opencode | repo mode only | no plugin mode |

Not verified for Copilot (assumptions of the pilot):

- S7: which manifest VS Code picks when a plugin has two, how it resolves
  repeated names, and whether it resolves the plugin root inside a skill body.
- S8: that the Copilot cloud agent loads plugins.
- S9: that `copilot plugin install fhh@fhh-ia-ecosystem` works with the
  marketplace declared in the repository.
- S11: that Copilot follows a marketplace whose plugin points at another branch
  (`plugin`).
- S12: observed in Copilot CLI (the model sees only `kit-root`); not checked in
  VS Code.
- S13: Copilot CLI lists plugin skills without a prefix, so the adapter names
  the skill both ways (`fhh:kit-root` in Claude Code, `kit-root` in Copilot);
  whether Copilot prefixes a plugin's agents is not verified.

One documented Copilot CLI fact: when a project or personal skill has the same
name as a plugin skill, the project or personal skill wins and the plugin's is
ignored.

