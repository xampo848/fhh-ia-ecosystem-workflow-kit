# AI Agent Bootstrap

This repository uses one tool-neutral AI workflow contract.

For every new user prompt:

1. Read and apply `.agents/instructions.md` before answering, planning, or
   editing. It is the source of truth.
2. Use `.agents/skills/index.md` for startup-minimal skill discovery and
   `.agents/skills/registry.md` only for full inventory, maintenance, or
   fallback.
3. If the user explicitly invokes a skill, load it directly.
4. Otherwise run lightweight intake. For non-trivial freeform work, load
   `.agents/skills/00-router/workflow-router/SKILL.md`.
5. Reuse already-loaded context when its source file has not changed. Do not
   bulk-load every skill or pattern.

Runtime-specific files may describe tools, models, sandboxes, or invocation
syntax, but must not redefine workflow logic. Use
`.agents/model-routing/README.md`, `.agents/capabilities/README.md`,
`.agents/integrations/README.md`, and `.agents/memory/README.md` when their
respective policies apply.

This bootstrap is compatible with Codex and GitHub Copilot agent surfaces that
support root `AGENTS.md`.
