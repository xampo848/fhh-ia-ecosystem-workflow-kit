# AI Workflow Instructions

This file exists for GitHub/Copilot surfaces that load `.github/instructions/**`.

Delegate durable workflow rules to `.agents/instructions.md` and `.agents/skills/registry.md`. Always run router intake for each new user prompt/question before selecting workflow logic. Keep this adapter thin.

Use `.agents/model-routing/README.md` for tier, fallback, and user-control
semantics. The Copilot model picker is the source of truth for the active
catalog; organizational or repository policy may restrict it.
