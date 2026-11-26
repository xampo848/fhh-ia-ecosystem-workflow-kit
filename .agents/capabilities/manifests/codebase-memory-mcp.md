# Capability manifest: codebase-memory-mcp

## Identity

| Field | Value |
| --- | --- |
| `name` | `codebase-memory-mcp` |
| `type` | Runtime capability already available |
| `source` | runtime-provided code graph capability (`mcp_codebase-memo_*`) |
| `source_policy` | attach-only from current runtime when available |
| `availability` | already available in supported runtimes when MCP tools are exposed |
| `scope` | hybrid: runtime/user availability plus repo/project attach semantics |
| `runtime_support` | Codex, GitHub Copilot, Claude Code, and Antigravity when the runtime exposes `mcp_codebase-memo_*` tools |
| `install_mode` | attach-only |
| `owner_layer` | repo-overlay capability manifest |
| `status` | optional / attachable |

## Attach points

| Attach point | Usage |
| --- | --- |
| `workflow-routing` | Decide whether discovery should use code graph tools first |
| `skill-execution` | Accelerate multi-hop code exploration, caller/callee tracing, and cross-file impact checks |
| `validation` | Improve impact analysis confidence before implementation |
| `runtime-adapter` | Runtime wrappers may indicate whether MCP graph tools are exposed |

## Activation rules

`codebase-memory-mcp` counts as active for discovery/implementation only when:

1. the runtime exposes at least one `mcp_codebase-memo_*` tool;
2. the target project is indexed and `status` is `ready`;
3. the task requires multi-hop exploration (cross-file impact, call graph traversal, or architecture discovery), not only a single exact file lookup.

Efficiency-first selection rule:

- Prefer `codebase-memory-mcp` for:
  - graph-augmented architecture exploration;
  - callers/callees and impact analysis;
  - ambiguous discovery where more than 2-3 files are likely involved.
- Prefer repository-native search (`rg`, targeted reads) for:
  - exact known file path or symbol lookups;
  - one-file checks with no graph traversal need.

Fallback:

- If MCP tools are unavailable, project is not indexed, or graph query fails, continue with repository-native search and targeted reads.
- Never block execution waiting for MCP availability when a native search path can complete the task.

## Workflow prompt (drop-in)

Use this prompt in workflows that perform discovery:

```text
When doing codebase discovery, use codebase-memory-mcp first only if it is exposed and project index status is ready.
If active, prioritize it for multi-hop exploration (callers/callees, cross-file impact, architecture path tracing).
If unavailable, unready, or query fails, fall back immediately to repository-native search (`rg`, targeted file reads) without blocking.
For exact single-file/single-symbol lookups, use native search directly.
Always state which path was chosen and why in one sentence.
```