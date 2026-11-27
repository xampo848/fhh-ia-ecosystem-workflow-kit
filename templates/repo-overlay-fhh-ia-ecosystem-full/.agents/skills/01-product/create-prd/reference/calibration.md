# Calibration

Read it in Phase 1, before writing any PRD content.

## Purpose

Before writing PRD content, calibrate the repository and available ecosystem. Record the result in `.ai-work/<prd-slug>/orchestration.md` under `## Calibration` before starting Phase 2. One active PRD has one writer for this file; concurrent sessions must not edit it.

## Required Discovery

Use exists-or-skip for every listed path. A missing file is not a failed search: record `missing: <path>` under `## Calibration` and continue with available context.

Read these when they exist and apply to the request:

- `.agents/project/context.md`, plus `.agents/project/backend.md` and/or `.agents/project/frontend.md` for touched surfaces, and `.agents/project/stack.md` only when a stack pack was installed
- `docs/workflow/standards/backend.md` and `docs/workflow/standards/frontend.md` are setup guides for the person adopting the kit, not standards: do not read them for a PRD. Follow any pointer in the project files above to standards the project keeps under `docs/workflow/standards/` or elsewhere
- A project file above that still carries its template marker (`<!-- workflow-kit:project-context:template -->` in `context.md`, `<!-- workflow-kit:project-instructions:template -->` in `backend.md` and `frontend.md`) is not filled in: record that under `## Calibration`, tell the user once, in the first message you send them after calibration (the first question round or the draft, whichever comes first), that the project context is not set up (an initial Discovery of the project fills it in, and doing so improves results), and continue from the code itself; do not block. Once the marker is gone, use the file and treat any remaining `[TODO` field as unknown for that field only
- The project's own architecture, domain-model, and quality docs only when the project has them (their paths are recorded in `.agents/project/context.md`; `.agents/project/paths.json` maps relocated project files): read the architecture doc when the work is cross-layer, architectural, migration-heavy, authorization-sensitive, tenancy-sensitive, or changes persistent read paths; the domain model when domain ownership or entities change; the quality or test conventions doc only when the PRD will add or change quality/test conventions
- The referenced parent epic, including its `Invariantes No Negociables` table and the `Path vivo y corte de fases` block when present
- The parent epic's companion ledger (`<slug>-ledger.md`) when it exists
- The parent epic's evidence pack (`<slug>-evidence.md`) when it exists; reuse its local and external findings instead of rediscovering the same context
- The immediately preceding sibling PRD in the epic's queue, including its `Contrato entre Fases` postcondiciones, when this is not the first PRD
- `.agents/skills/registry.md`, `.agents/capabilities/README.md`, and `.agents/integrations/README.md` only when this PRD changes workflow skills, capabilities, or integrations
- Persistent memory context when a memory capability is available

Inspect the existing models, services, queries, controllers, schema, and tests that own the requested behavior. Start with a bounded set of 8-15 owner artifacts; expand only to resolve a concrete ownership, contract, or inherited-invariant boundary.

When delegated discovery is useful and Cavecrew/Caveman is available, prefer `cavecrew-investigator` for file-path-first compressed findings. Use a normal exploratory agent only when the calibration needs architecture commentary instead of a location/result list.

Use the search and read tools of your runtime proportionally. Do not enumerate a whole module or stream calibration notes into chat; persist the artifact and surface it only under Summary Visibility.

When a recent comparable PRD exists, read exactly one as a structure anchor. Calibrate tone, section density, table depth, and acceptance evidence from it; do not copy its business content.

Determine existing columns and services, naming conventions, reusable base classes or concerns, bounded-context ownership, namespace and table conventions, and inherited parent-epic invariants.

Determine the language of code identifiers, in this order: what the project's rules say (`.agents/project/backend.md`, `.agents/project/frontend.md`, or `.agents/project/stack.md` when a stack pack was installed); else the dominant language of the identifiers in the owner artifacts just inspected; else English.

## Unknowns Inventory

Run this whenever the PRD involves an external integration, real data, or
third-party limits. List every external or poorly known dependency (external
API, shape and volume of real data, a third party's limits, legacy data
quality) and classify it:

- **verificada**: evidence in code, contract, or documentation;
- **asumida**: taken as true without evidence;
- **desconocida**: nobody on the thread knows.

For an assumed or unknown item that affects an acceptance criterion, in this
order:

1. Ask the user whether they know.
2. Propose a bounded, read-only **exploratory probe** (call the API sandbox,
   count or sample real data, read the third party's documentation). It needs
   the user's explicit approval, never uses production credentials unless the
   user says so, and its result is recorded as a verified assumption with its
   evidence.
3. If it cannot be verified beforehand, record it as a risk and make the
   **first slice** of the implementation verify it, with a stop condition if it
   turns out false.

Every item goes into the PRD's `Supuestos e integraciones` table.

## Obsolescence Scan

For each concept the PRD changes (a fixed value that becomes dynamic, a
replaced entity, a renamed endpoint), search for what the change makes
obsolete: usages of the symbol and of the literal value, flag names,
translation keys, tests, fixtures, and documentation. Control question: "after
the change, are there two sources of truth for X?".

- If every consumer is in the repository, the PRD removes or adapts it.
- If there are external consumers (public API, mobile apps, reports, other
  services) or persisted data, retire it in stages (add the new, migrate,
  remove the old). The final removal may be a later slice or future scope with
  an explicit ticket, never implicit. This is a business decision: ask the
  user.

Tests count too: tests of the removed behavior, temporary migration tests, tests
of a one-off tool that leaves, and tests that duplicate a rule this change moves
to another layer.

Record each item in the PRD's `Que queda obsoleto` table, with a verification
search that must return zero usages. Only what **this** change makes obsolete
counts; unrelated dead code is a suggestion, not scope.

## Required Artifact

Write these fields under `## Calibration`:

- `work_type`
- `touched_surfaces`
- `visible_ui`: `yes` when the PRD changes a user-facing screen, page, or navigable view; otherwise `no`
- `ui_lock`: `required` when `visible_ui: yes`, else `not-applicable`
- `comparable_anchor`
- `identifier_language`: the language new identifiers use and its source, `project-rules | existing-code | default`
- major risks
- unresolved questions
- `unknowns`: the Unknowns Inventory, or `none`
- `obsolete_items`: the Obsolescence Scan result, or `none`

## Summary Visibility

Persist the artifact even when no summary is shown in chat. Show the summary on explicit user request or when the calibration finds a missing required source, conflicting repository guidance, unclear touched surfaces, low confidence in the selected comparable anchor, or a project file that still carries its template marker (a one-line notice, not the full summary).