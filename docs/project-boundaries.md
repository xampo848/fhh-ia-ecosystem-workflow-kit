# Project Boundaries

This scaffold exists to become a standalone distribution for a portable AI workflow kit.

## Portable core

Portable core is the reusable workflow contract:

- neutral startup instructions;
- skill registry shape;
- workflow orchestration skills;
- model routing and cost posture policy;
- capability lifecycle vocabulary;
- integration install/attach policy;
- memory and runtime parity governance.

Portable core must not include product-specific backend/frontend rules from FHH IA Ecosystem.

## Repo overlay

Repo overlay is local to a target repository:

- domain standards;
- product-specific pattern skills;
- local validation commands;
- local capability manifests and activation defaults;
- local runtime adapter references.

The installer may generate starter placeholders, but it must not pretend FHH IA Ecosystem overlay rules are universal.

## Runtime adapters

Runtime adapters are thin entrypoints for tools such as Codex, GitHub Copilot, Claude Code, or future runtimes. They should point back to neutral `.agents/**` files and avoid duplicating workflow logic.

## Current phase limits

This scaffold does not install, merge, backup, publish, or create repositories. Those behaviors require later PRDs and explicit validation.
