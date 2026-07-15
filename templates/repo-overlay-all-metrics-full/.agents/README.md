# All Metrics Agent Context

This directory exposes the project agent context for tools that discover
instructions and skills from `.agents/`.

## Neutral source layer

`.agents/` is now the **tool-neutral AI contract layer** for the repository.

Start here:

- `.agents/instructions.md` — canonical neutral AI startup contract

## Transitional compatibility

The repository is still transitioning from tool-coupled paths:

- `.github/**` remains a GitHub/Copilot-oriented runtime wrapper surface
- `.codex/**` remains a Codex-oriented runtime wrapper surface
- `AGENTS.md` remains the Codex repository bootstrap
- many shared skill bodies still live under `.agents/skills/**`

This means canonical ownership is neutral even when some physical skill files
are still stored in compatibility paths.

## Artifact roles

- `.agents/instructions.md` → neutral first-prompt contract for AI agents
- `.agents/skills/**` → future neutral canonical home for workflow skills and
  standards/pattern skills
- `.agents/integrations/**` → neutral contract for integrations/plugins/tools
  and prompt-driven install/attach behavior
- `.agents/capabilities/**` → neutral packaging and capability-attachment
  blueprint for portable core vs repo overlay wiring
- `.agents/memory/**` → neutral memory-sharing and runtime parity governance
- `.agents/workflow-kit/**` → portable workflow-kit packaging boundary,
  manifest, overlay example, and adoption checklist; not an installer
- `docs/**` → human-facing explanation, rationale, onboarding, and durable docs
- `.github/**`, `.codex/**`, `AGENTS.md`, `CLAUDE.md` → wrappers/adapters that
  must inherit from the neutral layer

When updating the AI workflow contract, prefer editing `.agents/` first and
then update wrappers/adapters as needed.
