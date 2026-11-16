# Project Boundaries

This repository is the standalone distribution of a portable AI workflow kit: a public, GitHub-installable CLI and TUI.

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

## What the tool does today

The CLI and TUI install (`init`), update (`update`), export (`export`), check
(`doctor`), and undo the last applied run (`rollback`) in a target repository,
always dry-run first, with backups before every overwrite or merge and a
recorded install state. They never publish packages or create repositories;
releases stay approval-gated (see `RELEASE.md`).
