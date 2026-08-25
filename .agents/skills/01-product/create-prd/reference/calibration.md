# Calibration

## Purpose

Before writing PRD content, calibrate the repository and available ecosystem. Record the result in `<prd-directory>/_meta/orchestration.md` under `## Calibration` before starting Phase 2. One active PRD has one writer for this file; concurrent sessions must not edit it.

## Required Discovery

Use exists-or-skip for every listed path. A missing file is not a failed search: record `missing: <path>` under `## Calibration` and continue with available context.

Read these when they exist and apply to the request:

- `docs/foundations/ARCHITECTURE.md` when the work is cross-layer, architectural, migration-heavy, authorization-sensitive, tenancy-sensitive, or changes persistent read paths
- `docs/foundations/DOMAIN_MODEL.md` when domain ownership or entities change
- `docs/standards/BACKEND_STANDARDS.md` and/or `docs/standards/FRONTEND_STANDARDS.md` for touched surfaces
- `docs/standards/CODE_QUALITY.md` only when the PRD will add or change quality/test conventions
- The referenced parent epic, including its `Invariantes No Negociables` table and the `Path vivo y corte de fases` block when present
- The parent epic's companion ledger (`<slug>-ledger.md`) when it exists
- The parent epic's evidence pack (`<slug>-evidence.md`) when it exists; reuse its local and external findings instead of rediscovering the same context
- The immediately preceding sibling PRD in the epic's queue, including its `Contrato entre Fases` postcondiciones, when this is not the first PRD
- `.agents/skills/registry.md`, `.agents/capabilities/README.md`, and `.agents/integrations/README.md` only when this PRD changes workflow skills, capabilities, or integrations
- Persistent memory context when a memory capability is available

Inspect the existing models, services, queries, controllers, schema, and tests that own the requested behavior. Use `semantic_search`, `grep_search`, `read_file`, and `file_search` proportionally.

When a recent comparable PRD exists, read exactly one as a structure anchor. Calibrate tone, section density, table depth, and acceptance evidence from it; do not copy its business content.

Determine existing columns and services, naming conventions, reusable base classes or concerns, bounded-context ownership, namespace and table conventions, and inherited parent-epic invariants.

## Required Artifact

Write these fields under `## Calibration`:

- `work_type`
- `touched_surfaces`
- `visible_ui`: `yes` when the PRD changes a user-facing screen, page, or navigable view; otherwise `no`
- `ui_lock`: `required` when `visible_ui: yes`, else `not-applicable`
- `comparable_anchor`
- major risks
- unresolved questions

## Summary Visibility

Persist the artifact even when no summary is shown in chat. Show the summary on explicit user request or when the calibration finds a missing required source, conflicting repository guidance, unclear touched surfaces, or low confidence in the selected comparable anchor.