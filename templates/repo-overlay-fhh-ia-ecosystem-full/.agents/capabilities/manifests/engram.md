# Capability manifest: engram

## Identity

| Field | Value |
| --- | --- |
| `name` | `engram` |
| `type` | Runtime capability already available |
| `source` | runtime-provided durable memory capability |
| `source_policy` | attach-only from current runtime when available |
| `availability` | already available in supported runtimes when the tool is exposed |
| `scope` | hybrid: runtime/user availability plus repo/project attach semantics |
| `install_mode` | attach-only |
| `owner_layer` | repo-overlay capability manifest |
| `status` | optional / attachable |

## Attach points

| Attach point | Usage |
| --- | --- |
| `memory` | Persist decisions, discoveries, preferences, and session summaries |
| `skill-execution` | Support implementation workflows with durable context |
| `documentation` | Normalize durable knowledge and summaries |

## Activation rules

`engram` counts as active for implementation only when:

1. the runtime exposes Engram tools;
2. the workflow uses the memory protocol intentionally;
3. the memory scope/shareability rules from `.agents/memory/**` are respected.

Fallback:

- local session context only, with explicit risk that durable memory was not persisted.
