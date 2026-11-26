# Route gates

Read only the section for the candidate route. The decision rules live in
`../SKILL.md`; task levels live in `.agents/instructions.md`.

## Production-ready implementation gate

Any development work assumes production readiness: build or implement
something, create a screen, add an endpoint, fix behavior, modify backend or
frontend, change API contracts or serializers, change data models, migrations,
jobs, analytics, permissions, tenancy, or tests.

```text
Development request -> do not code directly -> route through implement-change, its safe predecessor, or an authorized N1 surgical change.
```

"Just do it" does not override this for N2/N3 work; speed does not override
production safety.

### When an input exists (PRD, bug, ticket, iteration)

Use `implement-change` (alias `implement-prd`) when the user provides a PRD
path, says the PRD is approved, asks to implement it, reports a reproducible
bug, gives a ticket with acceptance criteria, or asks to change something
already implemented from a PRD (iteration). Say:

```text
Voy a usar implement-change porque esto ya es trabajo de desarrollo: el nivel decide la ceremonia y el tipo de entrada la evidencia, sin saltarse tests, contratos ni QA.
```

Then load `.agents/skills/02-implement/implement-change/SKILL.md`. An iteration
is usually N1: propose it and wait for the user's "yes".

### When no PRD, bug, ticket, or iteration exists

Do not choose the predecessor for the user. Present the options from
`route-menus.md` ("Production change without a PRD"):

- N1 surgical change when the N1 criteria below hold;
- `generate-pm-ticket` for tiny backlog-sized changes;
- `create-prd` for feature work with business rules, UX, API, data, tests, acceptance criteria, tenancy, or cross-layer impact;
- `create-epic` only for broad initiatives that need research, phases, appetite, and several PRDs;
- `project-formation` for end-to-end shaping through GTM and dossier handoff.

## N1 surgical offer

The router offers N1 explicitly instead of hiding it as an exception. Offer it,
as an option with its one-line trace (`N1 · surgical · <files and check>`), only
when all of these hold:

1. The change touches at most one or two files.
2. The target files and exact change are already clear.
3. There is no database, API contract, authorization, tenancy, background job, analytics, cross-layer, or migration impact.
4. The focused check (lint, build, or test) can be named before editing.

A short "yes" authorizes it. Then follow the N1 rules in
`.agents/instructions.md`: no tracker, no delegates, no Discovery, one focused
check, a test only when behavior changes, and a failing-first test for bugs. If
any condition turns out false while working, stop and propose N2.

## Review/QA applicability gate

Before loading any review/QA skill:

1. Detect the changed surface from the request and current diff: backend-only, frontend non-React, React frontend, contract-only, or mixed.
2. Select only applicable quality skills:
   - Backend-only: prefer inline review and/or `contract-verifier`; do not load `react-doctor` or `playwright-testing` by default.
   - Frontend non-React: do not load `react-doctor`; load `playwright-testing` by default when there is a navigable user-facing UI flow and tooling is available. Skip only with an explicit documented exception or user waiver.
   - React frontend: load `react-doctor` for meaningful React changes.
   - Formal E2E ask, release-critical flow validation, or default-required navigable UI validation: load `playwright-testing` when a navigable UI flow exists and tooling is available.
3. If no specialized quality skill applies, continue with inline review and explain why specialized skills were skipped.

Visual direction goes to `frontend-design`; broad craft, polish, or audit to
`impeccable`; React technical review to `react-doctor`.

## Epic safety gate

Do not start `create-epic` just because the request sounds important. Use it
only when the user explicitly asks for an epic, initiative, roadmap, phases,
MVP, research document, or multi-PRD plan; or the work clearly spans several
phases, product areas, integrations, or capabilities; or it needs research,
appetite shaping, evidence, risks, and a PRD queue. If unclear, ask the epic
question from `route-menus.md`.

## Workflow extension maintenance

When the request is about extending the workflow itself (router, registry,
custom skills):

1. Decide the mode: explanation-only ("how") or execution (apply changes).
2. Keep edits scoped to workflow contract files unless the user asks for more.
3. Preserve boundaries: routing policy in `workflow-router/SKILL.md` and its
   references, startup contract and task levels in `.agents/instructions.md`,
   startup discovery in `.agents/skills/index.md`, full metadata in
   `.agents/skills/registry.md`, algorithm details in each skill `SKILL.md`.
4. After execution-mode edits, run the relevant repository checks and report
   the outcome.
