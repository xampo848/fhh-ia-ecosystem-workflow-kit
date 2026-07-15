---
name: codebase-discovery
description: "Delegate-only skill for implement-prd. Alias: Sherlock Estructura. Explores the All Metrics codebase for an approved PRD, finds existing patterns, touched files, tests, APIs, risks, and docs to load. Use before implementation slicing or when resuming unknown work. Optimized for targeted discovery and low-context handoffs."
context: fork
---

# Codebase Discovery

Alias: Sherlock Estructura.

Use after PRD readiness passes when the orchestrator cannot name the likely touched files, analogous patterns, tests, and validation commands with high confidence. In Codex, invoke through `.codex/agents/sherlock-estructura.toml`. In GitHub Copilot, invoke through `runSubagent`. In other agents, run inline when delegation is unavailable.

## Mission

Build the smallest useful map of the existing implementation. Do not write code. Do not bulk-load unrelated docs.

Discovery exists to reduce implementation risk. It is not a codebase tour.

## Inputs From Orchestrator

- PRD path and readiness brief.
- Suspected touched surfaces.
- Candidate operating mode.
- Resume context, if any.

## Must Read

- `.github/copilot-instructions.md`.
- The PRD sections and readiness brief relevant to discovery.
- `docs/foundations/ARCHITECTURE.md` only when the work is cross-layer, architectural, migration-heavy, authorization-sensitive, tenancy-sensitive, or changes persistent read paths.
- Backend instructions when confirmed backend files will be read or touched: `.github/instructions/backend.instructions.md`.
- Frontend instructions when confirmed frontend files will be read or touched: `.github/instructions/frontend.instructions.md`.
- `docs/patterns/README.md` only as an index; load only pattern docs that match the discovered implementation surface.

Do not load `CODE_QUALITY.md` or `.github/instructions/quality-gate.instructions.md` during discovery. Code-writing and code-review delegates load the quality gate on demand.

## Context Budget

Use an index-first strategy:

1. Start with `rg`, `rg --files`, route files, model/service names, test names, and schema lookups.
2. Open at most 5 exploratory source files before producing the first discovery map.
3. If more files are needed, explain the risk and either narrow the search or recommend escalation to `standard` mode.
4. Prefer exact paths, symbols, and tests over prose descriptions.
5. Reuse already-loaded context when the orchestrator provides it.

## Docs Routing

Backend docs, load only when directly relevant:

- `docs/patterns/backend/service-object-pattern.md`
- `docs/patterns/domain/domain-immutability.md`
- `docs/patterns/backend/data-layer-adapter.md`
- `docs/patterns/backend/integration-api.md`
- `docs/patterns/domain/relationships-and-constraints.md`
- `docs/patterns/domain/domain-vocabulary.md`
- `docs/epics/analytics-foundation/analytics-facts-rollups-metrics-redesign-epic.md`

Frontend docs, load only when directly relevant:

- `docs/internal-documentation/workflows/frontend-new-feature.md`
- `docs/patterns/frontend/custom-hook-state.md`
- `docs/patterns/frontend/design-system-ui.md`
- `docs/patterns/frontend/formik-forms.md`
- `docs/patterns/frontend/oauth-first-pattern.md`
- `docs/patterns/frontend/browser-e2e-verify.md`

## Procedure

1. Use `rg` and `rg --files` first. When subagents are available and the task is narrow path/symbol/test lookup, prefer `cavecrew-investigator` via `.agents/skills/05-caveman/cavecrew-investigator/SKILL.md`.
2. Find analogous features, models, services, controllers, serializers, adapters, hooks, components, routes, tests, and i18n keys.
3. Identify current conventions for naming, class naming, service orchestration, error handling, authorization, tenancy, API response shape, form handling, and validation.
4. For data model changes, inspect `backend/db/schema.rb` and the most relevant adjacent migrations only.
5. For frontend changes, identify design system primitives, token usage, hooks, query keys, i18n namespaces, and test style.
6. For resume mode, inspect implemented files and current test state without re-implementing.
7. Use Context7 (MCP tools resolve-library-id and query-docs) only when validating third-party framework or library patterns where project-local code is insufficient.
8. Surface risks and unknowns that must shape the implementation plan.

## Boundaries

- Do not edit files.
- Do not propose new architecture until existing local patterns are described.
- Do not treat an empty UI state as correct without identifying the backing data path.
- Do not expand to broad directory reads because a PRD is important. Importance changes validation rigor, not the right to bulk-load context.

## Handoff Output

Return exactly the TOON schema defined in `.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md` for `sherlock-estructura`.

Ensure you populate the `required_instructions[N]` field with `.github/instructions/backend.instructions.md` and/or `.github/instructions/frontend.instructions.md` if those surfaces are touched.

For `controlled-lite`, keep findings compact and prioritize:

- analogous files;
- target files;
- tests;
- validation commands;
- risks requiring escalation;
- docs intentionally skipped and why.