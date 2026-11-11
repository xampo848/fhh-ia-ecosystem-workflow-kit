# Stack Rules: Rails API + React

<!-- workflow-kit:stack-pack: rails-react -->

Stack-specific rules for this project. They were part of the workflow skills
before those became stack-neutral; delegates that write, test, or review code
read this file together with `.agents/project/backend.md` and
`.agents/project/frontend.md`. The project owns this file: edit it freely.

## Backend (Rails API)

- Controllers delegate business logic to services.
- Services inherit from `BaseService` or the namespace base and expose `success?`, `result`, and `errors`.
- Models only include validations, relationships, and simple scopes.
- Use CanCanCan. Do not introduce Pundit.
- Respect `acts_as_tenant` and explicit organization scoping.
- Never add cross-tenant queries without explicit inline justification and regression tests.
- Put user-facing text in `backend/config/locales/es.yml` and `backend/config/locales/en.yml`.
- Use Minitest, not RSpec.
- Use `enumerate_it` conventions for enumerations.
- DB column names and Ruby variables use English identifiers, even when the domain language is Spanish.

## Frontend (React)

- Use design system primitives and CSS tokens first.
- Do not hardcode hex colors or visible strings in JSX.
- Put user-facing text in `front/src/i18n/locales/es.json` and `front/src/i18n/locales/en.json`.
- Keep fetching, transformation, and coordination in hooks or API modules.
- Use TanStack Query v5 for server state.
- Use Zustand only for cross-feature client state.
- Use Formik + Yup and shared Formik components for forms.
- Use Vitest + Testing Library.

## Tests

- Backend: Minitest with the factories and fixtures already present; service, controller, and serializer tests as appropriate. `Bullet` must be active in tests to catch N+1 query regressions.
- Frontend: Vitest and Testing Library. Mock every network request with MSW (Mock Service Worker); create or update MSW handlers that return deterministic payloads derived from the verified contract.

## Validation commands

Copy these into the "Validation commands" table of `.agents/project-context.md`
with their real cost in this project.

Backend, run from `backend/`; prefer `make` targets:

- `make test-fast`
- `make tests_run`
- `make test-full`
- `make tests`
- `make test-coverage` only when risk warrants it
- targeted `bundle exec rails test path/to/test.rb` only when already established for the slice or when it is the narrowest reliable check
- targeted `bundle exec rubocop` against touched backend files when lint is needed

Frontend, run from `front/`:

- `bun run test` (`bun run test --run` for a quick isolated check)
- `bun run lint`
- `bun run lint:styles`
- `bun run validate:css`
- `bun run validate:all` only for broad changes

## Review focus

- Backend: service boundaries, CanCanCan, tenancy, i18n, Minitest.
- PRDs follow `BACKEND_STANDARDS.md`; new PRDs do not use RSpec instructions.
