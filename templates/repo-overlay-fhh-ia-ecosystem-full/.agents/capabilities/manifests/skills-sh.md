# Capability manifest: skills-sh

## Identity

| Field | Value |
| --- | --- |
| `name` | `skills-sh` |
| `type` | Installable external skill-pack source/policy |
| `source` | `https://www.skills.sh/` |
| `source_policy` | official/curated by default; explicit user override required for non-default sources |
| `availability` | external source; only available after explicit install/attach workflow succeeds |
| `scope` | hybrid: external source plus repo/project attach semantics |
| `install_mode` | conditional: install only after explicit confirmation; otherwise policy-only |
| `owner_layer` | repo-overlay capability manifest |
| `status` | optional / installable / attachable |

## Attach points

| Attach point | Usage |
| --- | --- |
| `workflow-routing` | Clarify whether a requested external skill belongs to install, attach-only, list, or recommend flow |
| `skill-execution` | Enable future use of installed external skills only after they are attached and governed |
| `documentation` | Record source, trust notes, attach state, and fallback behavior |
| `runtime-adapter` | Runtime wrappers may expose install surfaces but must defer to neutral integration policy |

## Activation rules

`skills-sh` counts as active for implementation only when:

1. the user explicitly requested or approved use of an external skill source;
2. the install/attach workflow from `.agents/integrations/README.md` completed successfully;
3. the selected external skill is documented with source and scope;
4. the resulting skill is attached to the neutral workflow rather than assumed active by installation alone.

Fallback:

- use repo-owned skills and current attached capabilities only;
- if the desired external skill is not installed/attached, report that state explicitly instead of assuming its guidance.
