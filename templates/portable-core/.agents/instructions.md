# AI Agent Instructions

This file is the neutral source-of-truth contract for this repository's AI workflow.

## Source hierarchy

1. `.agents/instructions.md` owns neutral workflow rules.
2. `.agents/skills/registry.md` lists available workflow and pattern skills.
3. Runtime adapters such as `AGENTS.md`, `.github/copilot-instructions.md`, and `CLAUDE.md` must stay thin and point back here.
4. Local project/domain rules belong in the repo overlay, not in portable core.

## Mandatory startup

For non-trivial work:

1. Read this file.
2. Read `.agents/skills/registry.md`.
3. Route via `workflow-router` unless the user explicitly invokes another skill.
4. Use `create-prd` for unclear implementation requirements.
5. Use `implement-prd` for approved PRDs or production code changes.

## Safety rules

- Read applicable instructions before planning or editing.
- Keep implementation slices small and verifiable.
- Wait for subagents to finish before continuing dependent work.
- Do not silently install, publish, overwrite, or enable external capabilities.
- Keep external capability installation separate from attachment and active use.
- Keep local project/domain rules in overlay files, not portable core.
