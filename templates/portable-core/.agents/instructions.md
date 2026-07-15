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
4. For every new user prompt or question, run the router intake decision first; do not skip this step.
5. Use `create-prd` for unclear implementation requirements.
6. Use `implement-prd` for approved PRDs or production code changes.

## Workflow extension requests

When the user asks how to extend the AI workflow itself (router, registry, or custom skills), support both modes:

1. Explanation mode: describe exact files, ordering, and validation steps without editing.
2. Execution mode: perform the edits when the user asks to apply them.

For extension work, keep boundaries explicit:

- router policy in `.agents/skills/00-router/workflow-router/SKILL.md`;
- startup contract in `.agents/instructions.md`;
- skill discovery metadata in `.agents/skills/registry.md`;
- skill algorithm in each skill `SKILL.md` file.

After extension edits, run the relevant repository validation commands and report results.

## Safety rules

- Read applicable instructions before planning or editing.
- Keep implementation slices small and verifiable.
- Wait for subagents to finish before continuing dependent work.
- Do not silently install, publish, overwrite, or enable external capabilities.
- Keep external capability installation separate from attachment and active use.
- Keep local project/domain rules in overlay files, not portable core.
