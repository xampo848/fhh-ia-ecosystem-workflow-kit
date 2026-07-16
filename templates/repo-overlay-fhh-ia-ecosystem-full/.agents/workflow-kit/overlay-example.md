# Repo Overlay Example

Use this template when adapting the portable core to another project.

## Project overlay identity

| Field | Value |
| --- | --- |
| Project | `<target-project>` |
| Runtime wrappers | `<Codex/GitHub Copilot/Claude/future>` |
| Local domain | `<domain summary>` |
| Product code roots | `<backend path>`, `<frontend path>` |

## Overlay responsibilities

The repo overlay owns:

- local product/domain standards;
- local pattern skills under a repo-owned path;
- local capability manifests and activation defaults;
- local validation commands;
- local runtime adapter references.

The repo overlay must not redefine portable core semantics such as lifecycle
states, attach-point vocabulary, wait barriers, or source-of-truth hierarchy.

## Minimum local files

```text
.agents/skills/registry.md
.agents/skills/06-patterns/README.md
.agents/capabilities/registry.md
AGENTS.md or runtime bootstrap
```

## Local adoption notes

- Replace FHH IA Ecosystem domain pattern skills with target-project pattern skills.
- Keep runtime adapters as thin adapters over `.agents/**`.
- Regenerate registry JSON/cache after changing registry entries.
