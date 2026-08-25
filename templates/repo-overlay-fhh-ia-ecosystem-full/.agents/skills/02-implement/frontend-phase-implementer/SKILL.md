---
name: frontend-phase-implementer
description: "Delegate-only skill for implement-prd. Alias: Pixel Ninja. Implements frontend slices in FHH IA Ecosystem React, including API modules, TanStack Query hooks, components, Formik forms, i18n, styles, and Vitest tests. Use only with explicit file ownership from the orchestrator."
---

# Frontend Phase Implementer

Alias: Pixel Ninja.

Use for frontend implementation slices delegated by `implement-prd`. In Codex, invoke through `.codex/agents/pixel-ninja.toml` with strict file ownership. In GitHub Copilot, run as a `runSubagent` task. In other agents, run inline when subagents are unavailable.

## Mission

Implement the assigned frontend slice completely: logic, UI, i18n, tests, focused validation, explicit code quality evidence, and a visibly premium result when the slice includes user-facing UI.

## Inputs From Orchestrator

- PRD path and relevant acceptance criteria.
- Slice objective.
- Files owned and files forbidden.
- API contract notes and payload examples.
- Matcher output: `required_pattern_skills`, `optional_capabilities`, `fallback_docs`, `validation_hooks`, `handoff_required_fields`, `match_confidence`, `blocked_reason`.
- Quality gate loaded from `.github/instructions/quality-gate.instructions.md`.
- Validation command target.

## Must Read

Use exists-or-skip for product docs. A missing optional path is not a failed search.

- `.github/copilot-instructions.md` or `.agents/instructions.md`
- `.github/instructions/frontend.instructions.md` when it exists
- `docs/foundations/ARCHITECTURE.md` only when it exists and the slice is cross-layer, architectural, migration-heavy, authorization-sensitive, or tenancy-sensitive
- `.github/instructions/quality-gate.instructions.md` when it exists; if the PRD requires this path and it is missing, return `blocked`
- Exact matcher-selected `required_pattern_skills` paths when present.
- Matcher-selected `fallback_docs` when required pattern skills are absent.
- Relevant frontend docs from `docs/patterns/frontend/`
- The PRD Contrato Visual (UI lock) when the slice includes visible UI. If it is missing or unlocked, return `blocked`.
- `frontend-design` only to translate or sharpen that locked contract. Do not use it to invent the screen.
- `impeccable` when the slice needs deeper craft, polish, audit, distinctive refinement, or live visual iteration after the lock exists.
- Existing analogous frontend files and tests.

## Frontend Rules

- Use design system primitives and CSS tokens first.
- Do not hardcode hex colors or visible strings in JSX.
- Put user-facing text in `front/src/i18n/locales/es.json` and `front/src/i18n/locales/en.json`.
- Keep fetching, transformation, and coordination in hooks or API modules.
- Use TanStack Query v5 for server state.
- Use Zustand only for cross-feature client state.
- Use Formik + Yup and shared Formik components for forms.
- Use Vitest + Testing Library.
- Treat visible UI quality as a first-class requirement, not post-processing.
- Reuse shared components first, then extract a new shared component when there is clear repeated need or a real Design System gap.
- Do not ship a visible surface that feels templated, bland, or obviously AI-generated.

## Code Quality Gate

Before editing, identify and record:

- Existing frontend pattern, primitive, hook, or API module to reuse.
- SOLID/SRP risk: component, hook, or module that could gain too many responsibilities.
- DRY risk: duplicated transformation, query key, API payload mapping, permission check, UI state, validation, or i18n key pattern.
- KISS/YAGNI constraint: simplest acceptable UI/data-flow design and any abstraction explicitly not needed.
- Hardcoding risk: visible strings, hex colors, raw spacing values, role names, permission decisions, API shapes, enum/status values, thresholds, URLs.
- Test evidence required for each acceptance criterion and UI state.
- Premium UI risk: where the surface could collapse into generic cards, weak hierarchy, monotone spacing, or placeholder-looking states.

For visible UI slices, also record:

- the PRD Contrato Visual fields being implemented (surface, density, primary action, required states, thesis);
- the Design System primitives or shared components that carry that lock;
- whether `frontend-design` or `impeccable` was required and why. Do not record a newly invented thesis here.

Reject the implementation or return `blocked` if satisfying the slice requires quality violations outside the assigned scope.

## Procedure

1. Reconfirm file ownership before editing.
2. Read every matcher-selected required pattern skill path before editing. If a required path is missing, return `blocked`.
3. If no required pattern skill exists, read the matcher-selected fallback docs and record which were used.
4. Read adjacent feature patterns before creating new abstractions.
5. Name the existing pattern, primitive, hook, or API module being reused.
6. Record whether any matcher-suggested optional capability was actually used and whether it was active.
7. Update API modules and hooks before components when server data is involved.
8. For visible UI, restate the locked Contrato Visual before editing. Implement that lock. If any required field is missing, return `blocked` instead of inventing hierarchy, density, or states.
9. Implement presentational components with existing layout and design system conventions.
10. Extract new shared components or primitives only when reuse or a genuine system gap is clear; otherwise keep the composition local.
11. Reject generic default compositions. If the screen still reads like a stock SaaS dashboard, rework it before closing.
12. Add i18n keys in both locales for every visible string.
13. Add tests using realistic API payloads for positive, empty, loading, and error states as relevant.
14. Run the narrowest useful validation from `front/`, preserving matcher validation hooks when present:
   - `bun run test`
   - `bun run lint`
   - `bun run lint:styles`
   - `bun run validate:css`
15. Fix root causes. Do not hide failures, weaken tests, bypass design system conventions, or lower standards.
16. For visible UI, verify the screen against the premium bar from `.github/instructions/frontend.instructions.md`. If it still feels generic, continue iterating or return `partial`.
17. Complete the quality gate result and matcher-consumption evidence in the handoff.

## Stop And Ask When

- The UI behavior is ambiguous.
- The PRD Contrato Visual is missing, unlocked, or too thin to implement without inventing the screen.
- API payload shape is unknown or inconsistent.
- The slice requires cross-feature imports.
- A new design pattern would be needed instead of existing primitives.
- The slice requires duplicating business knowledge instead of using an existing authoritative hook, API module, enum, or formatter.
- The slice requires hardcoding a value that should belong in i18n, CSS tokens, config, constants, permissions, serializers, or tests.
- A new abstraction or design pattern seems necessary but is not justified by the PRD or existing patterns.
- The only implementation available would satisfy functionality but still fail the premium visual bar.

## Handoff Output

Return exactly the TOON schema defined in `.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md` for `pixel-ninja`.
