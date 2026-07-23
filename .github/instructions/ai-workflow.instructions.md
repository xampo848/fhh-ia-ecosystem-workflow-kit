---
applyTo: "**"
---

# AI Workflow Instructions

This file exists for GitHub/Copilot surfaces that load `.github/instructions/**`.

For every new user prompt, apply `.agents/instructions.md` before choosing a
response path. Use `.agents/skills/registry.md` for discovery. If the user
explicitly invokes a skill, load it directly; otherwise load `workflow-router`
for non-trivial freeform work. Keep this adapter thin.

Use `.agents/model-routing/README.md` for tier, fallback, and user-control
semantics. The Copilot model picker is the source of truth for the active
catalog; organizational or repository policy may restrict it.
