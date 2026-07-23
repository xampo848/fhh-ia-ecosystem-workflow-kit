# Copilot Instructions

This is a thin GitHub Copilot runtime adapter.

For every new user prompt, read and apply `.agents/instructions.md` first and
treat it as the source of truth. Use `.agents/skills/registry.md` for
just-in-time discovery. If the user explicitly invokes a skill, load it
directly; otherwise use lightweight intake and load `workflow-router` for
non-trivial freeform work. Do not duplicate workflow logic here.

For model routing, read `.agents/model-routing/README.md`. Use the Copilot model
picker as the source of truth for models allowed to the active user. Organization
or repository policy can hide models; do not infer availability from a global
model list. Select a model or `Auto` only when the user requests it or the
runtime exposes that choice. Do not claim that a delegated agent is pinned to a
specific model unless Copilot confirms it.
