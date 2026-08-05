# Project Runtime Instructions Template

Use this file as a starter when onboarding workflow-kit into a real product repository.

Goal: make backend/frontend implementation skills load project-specific rules instead of guessing conventions.

## Required files in the target repository

Create these files when those surfaces exist:

- `.github/instructions/backend.instructions.md`
- `.github/instructions/frontend.instructions.md`

If your project has only one surface (for example backend-only), create only the relevant file and document the missing surface as N/A in your standards docs.

## Backend template

Create `.github/instructions/backend.instructions.md`:

```md
---
applyTo: "<backend path glob, for example: api/**/*.ts or backend/**/*.rb>"
---

# Backend Instructions

## Stack and architecture
- Language/runtime: <node|ruby|python|go|...>
- Framework: <express|rails|fastapi|...>
- Layer boundaries: <controllers/services/repositories/etc>

## Coding rules
- Naming conventions: <required format>
- Error handling policy: <exceptions/result objects/http mapping>
- Data and migrations: <forward/backward compatibility rules>
- Security rules: <authz/authn/input validation/secrets>

## Validation commands
- Lint: `<command>`
- Tests: `<command>`
- Type checks/static analysis: `<command>`
- Contract checks (if backend serves frontend): `<command>`

## Delivery constraints
- Required tests before merge: <unit/integration/contracts>
- Performance constraints: <latency, memory, DB query budget>
- Observability requirements: <logs/metrics/traces>

## Out of scope
- <what this instruction file should not decide>
```

## Frontend template

Create `.github/instructions/frontend.instructions.md`:

```md
---
applyTo: "<frontend path glob, for example: web/src/**/*.tsx or frontend/**/*.{js,ts,tsx}>"
---

# Frontend Instructions

## Stack and architecture
- Framework: <react/vue/svelte/...>
- State/data flow: <query library, state management>
- UI architecture: <design system/components/tokens>

## Coding and UX rules
- Accessibility baseline: <WCAG level, keyboard rules>
- Responsive behavior: <breakpoints/layout constraints>
- UX writing/tone: <copy and microcopy conventions>
- Error and empty states: <minimum handling expectations>

## Validation commands
- Lint/format: `<command>`
- Unit/integration tests: `<command>`
- E2E tests: `<command>`
- Visual or a11y checks: `<command>`

## Contract consumption rules
- API compatibility expectations: <required response shape handling>
- Backward compatibility policy: <feature flags/fallback UI>

## Out of scope
- <what this instruction file should not decide>
```

## Fast adoption checklist

1. Create both instruction files (or document one as N/A).
2. Replace every `<...>` placeholder with project-specific decisions.
3. Run each validation command locally and ensure it works.
4. Add the same commands to CI for enforcement.
5. Link these files from your onboarding and contribution docs.
