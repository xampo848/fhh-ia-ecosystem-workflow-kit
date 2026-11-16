# FHH IA Ecosystem Agent Context

This directory exposes the project agent context for tools that discover
instructions and skills from `.agents/`.

## Neutral source layer

`.agents/` is now the **tool-neutral AI contract layer** for the repository.

Start here:

- `.agents/instructions.md` — canonical neutral AI startup contract

## Runtime wrappers

- `.github/**` is the GitHub/Copilot runtime wrapper surface
- `.codex/**` is the Codex runtime wrapper surface
- `.claude/**` holds generated Claude Code agents and skill wrappers
- `AGENTS.md`, `CLAUDE.md`, and `ANTIGRAVITY.md` are the root bootstraps

Skill bodies live only under `.agents/skills/**`; wrappers point back to them.

## Artifact roles

- `.agents/instructions.md` → neutral first-prompt contract for AI agents
- `.agents/skills/**` → neutral canonical home for workflow skills and
  standards/pattern skills
- `.agents/integrations/**` → neutral contract for integrations/plugins/tools
  and prompt-driven install/attach behavior
- `.agents/capabilities/**` → neutral packaging and capability-attachment
  blueprint for portable core vs repo overlay wiring
- `.agents/memory/**` → neutral memory-sharing and runtime parity governance
- `docs/**` → human-facing explanation, rationale, onboarding, and durable docs
- `.github/**`, `.codex/**`, `.claude/**`, `AGENTS.md`, `CLAUDE.md`, `ANTIGRAVITY.md` → wrappers/adapters that
  must inherit from the neutral layer

When updating the AI workflow contract, prefer editing `.agents/` first and
then update wrappers/adapters as needed.
