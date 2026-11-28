# Project Context

<!-- workflow-kit:project-context:template -->

Fixed knowledge base of this project for AI work. Discovery reads it first and
explores only what is specific to a change. It is versioned, reviewed by
humans, and limited to 200 lines. After the initial Discovery, only the orchestrator updates it, at closure,
with a small diff in the same PR. Point to other documents; do not copy them.

> **Template notice.** This file is still the template. Ask your agent for the initial Discovery of the project (the router handles it as project context setup) and review the diff before relying on it. What the code does not settle is one line `not determined: <reason>`, never a `[TODO`. When no `[TODO` is left, delete this whole block and the marker line above.

## Structure map

| Path | Responsibility |
| --- | --- |
| [TODO: folder] | [TODO: what lives there] |

## Validation commands

| Layer | Command | Cost | When to run |
| --- | --- | --- | --- |
| [TODO: backend] | `[TODO: exact command]` | [TODO: seconds or minutes] | [TODO: per slice / closure / CI] |

Mark expensive suites explicitly (for example "full E2E ~13 min: closure or CI
only") so they run once and not per slice.

## Test conventions

- [TODO: where tests live, fixtures or factories, how to mock network calls]

## Environment quirks

- [TODO: slow seeding, fixed ports, test database markers, and how each is handled]

## Pointers

| Document | Read it when |
| --- | --- |
| [TODO: your project's architecture document, such as docs/foundations/ARCHITECTURE.md] | [TODO: cross-layer or architectural work] |
