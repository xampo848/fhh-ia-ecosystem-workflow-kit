# Capability manifest: cavecrew

## Identity

| Field | Value |
| --- | --- |
| `name` | `cavecrew` |
| `type` | Repo-owned AI capability / compressed helper delegation |
| `source` | repo-local helper skill set |
| `source_policy` | repo-owned |
| `availability` | repo-local |
| `scope` | repo/project |
| `runtime_support` | Codex, GitHub Copilot, Claude Code, and Antigravity when repo helper skills are exposed |
| `install_mode` | attach-only |
| `owner_layer` | repo-overlay capability manifest |
| `status` | optional / attached when helper skills are available |

## Attach points

| Attach point | Usage |
| --- | --- |
| `delegation` | Narrow locate/edit/review helper tasks |
| `skill-execution` | Token-saving helper use during implementation phases |

## Activation rules

`cavecrew` counts as active for implementation only when:

1. helper skills are available in the repo/runtime;
2. the task is narrow enough for compressed helper delegation;
3. using cavecrew reduces context without obscuring risk.

Fallback:

- use normal delegate flow or inline execution with concise prose.
