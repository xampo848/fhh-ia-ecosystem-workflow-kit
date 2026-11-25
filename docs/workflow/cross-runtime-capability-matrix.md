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
| Claude Code | supported | `observed` by a smoke (Claude Code 2.1.142, model `sonnet`, headless `claude -p` with the built plugin loaded for the session by `--plugin-dir dist/plugin`, read-only tools): the plugin loads, its skills are `fhh:*`, `fhh:kit-root` gives the kit root, and the overlay is read from the repository. The marketplace install is not verified (see below) |
| VS Code Copilot | supported format | `documented` only, not verified here |
| Copilot CLI | supported | `observed` by a smoke (Copilot CLI 1.0.115, model choice `auto`, which ran `mai-code-2-flash` and `gpt-6-luna`; the test account refuses an explicit model such as `gpt-6.1-terra`, `gpt-6.2-sol` or `gpt-6.2-astra`): the plugin loads with `--plugin-dir`; its skills are listed without a prefix (`kit-root`, `create-prd`) and only `kit-root` is visible to the model; the model loads `kit-root` by itself, reads the contract and the router from the plugin, and reads the project context, catalog and runbook from the repository. With the older `gpt-4.1` (CLI 1.0.51) the model answered without reading files |
| Copilot cloud agent | not verified | `unknown` |
| Codex, Cursor | not supported yet | planned for a future phase |
| Antigravity, opencode | repo mode only | no plugin mode |

Not verified for Claude Code:

- The install path the docs give people: the marketplace declared in the
  repository (plugin on the branch `plugin`) and
  `claude plugin install fhh@fhh-ia-ecosystem --scope project`. The branch
  `plugin` is not published yet, so the smoke loaded the plugin with
  `--plugin-dir` instead.
- The real output of `claude plugin list --json`, which `doctor` reads; the
  tests use a stub.

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
- Explicit model choice (`gpt-6.1-terra`, `gpt-6.2-sol`, `gpt-6.2-astra`) was
  not available to the test account; those models were not run.
- S13: Copilot CLI lists plugin skills without a prefix, so the adapter names
  the skill both ways (`fhh:kit-root` in Claude Code, `kit-root` in Copilot);
  whether Copilot prefixes a plugin's agents is not verified.

One documented Copilot CLI fact: when a project or personal skill has the same
name as a plugin skill, the project or personal skill wins and the plugin's is
ignored.

