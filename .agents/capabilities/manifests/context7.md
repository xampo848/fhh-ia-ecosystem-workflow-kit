# Capability manifest: context7

## Identity

| Field | Value |
| --- | --- |
| `name` | `context7` |
| `type` | Runtime capability already available |
| `source` | runtime-provided MCP/docs capability |
| `source_policy` | attach-only from current runtime when available |
| `availability` | already available in supported runtimes when the tool is exposed |
| `scope` | hybrid: runtime/user availability plus repo/project attach semantics |
| `install_mode` | attach-only |
| `owner_layer` | repo-overlay capability manifest |
| `status` | optional / attachable |

## Attach points

| Attach point | Usage |
| --- | --- |
| `workflow-routing` | Decide current-doc lookup need for libraries/frameworks/APIs/cloud services |
| `skill-execution` | Use during implementation when slice work needs up-to-date technical docs |
| `runtime-adapter` | Runtime wrappers may indicate whether Context7 tools are exposed |

## Activation rules

`context7` counts as active for implementation only when:

1. the runtime exposes the Context7 tools;
2. the implementation task involves a library/framework/API/cloud-service question;
3. the capability is attached through the neutral workflow contract.

Fallback:

- use official docs already loaded locally if sufficient;
- otherwise stop or report the gap instead of inventing current APIs.
