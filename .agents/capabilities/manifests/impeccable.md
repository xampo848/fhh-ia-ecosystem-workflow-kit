# Capability manifest: impeccable

## Identity

| Field | Value |
| --- | --- |
| `name` | `impeccable` |
| `type` | Repo-owned AI capability / frontend craft overlay |
| `source` | repo-local overlay skill |
| `source_policy` | repo-owned |
| `availability` | repo-local |
| `scope` | repo/project |
| `runtime_support` | Codex, GitHub Copilot, Claude Code, and Antigravity when the repo overlay skill is exposed |
| `install_mode` | attach-only |
| `owner_layer` | repo-overlay capability manifest |
| `status` | optional / attached when the overlay skill is available |

## Attach points

| Attach point | Usage |
| --- | --- |
| `skill-execution` | Premium frontend craft overlay during visible UI implementation |
| `validation` | Visual QA and refinement before closure |

## Activation rules

`impeccable` counts as active for implementation only when:

1. the slice includes meaningful visible frontend UI;
2. the overlay skill is available in the repo;
3. the workflow explicitly invokes it for premium craft or visual QA.

Fallback:

- use `frontend-design`, design-system rules, and frontend instructions;
- report residual visual-risk if premium craft was not available.
