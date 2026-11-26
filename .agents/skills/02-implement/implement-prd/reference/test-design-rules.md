# Test Design Rules

Part of [validation-and-stop-conditions.md](validation-and-stop-conditions.md).
Read it before writing, extending, or reviewing a test, and when a PRD or a
slice assigns tests or edge-case rows to layers. This file is the single source
of the test-design rules; the owning skills keep a one-line pointer here.
Stack-specific examples (test directories, fixture options, framework helpers)
live in `.agents/project/stack.md` when a stack pack was installed, otherwise in the project's own test conventions.

Goal: prove each behavior once, at the cheapest layer that contains it. A
redundant test costs suite time and maintenance on every run and catches
nothing the owning test does not already catch.

## 1. Owning layer

- Each business rule is tested exhaustively in one layer only: the lowest
  layer that contains it (query, service, domain model, pure function).
- Entry-point tests (HTTP controller, request, handler, resolver) cover only
  their own concerns: authentication, authorization, tenant or company
  isolation, parameter validation, status codes, and response shape, plus
  **one** happy-path case per business rule to prove the wiring. They never
  repeat the rule's variants.
- Background jobs cover their own selection of records, batching, retries,
  scheduling, and error handling. The service they call is proven in its own
  test; the job test exercises it once for wiring or replaces it with a double.
- Frontend: a component tests rendering and interaction states; logic that
  lives in a hook or utility is tested there, not again through the component.
- **Exception:** tenancy and authorization are always tested at the entry
  point, even when the query also filters. A missing scope at the entry point
  is where data leaks, so that test is never a duplicate.
- A method that only delegates is covered by the test of the layer above or
  below it; it needs no test of its own.

## 2. Coverage gate: every new branch in its owning layer

This replaces "one test per new file or method". Every new or changed branch
of production code (condition, error path, boundary, early return) has an
executed assertion in its owning layer. Coverage evidence maps
`branch → test → layer`. A new file or method with no test of its own passes
when all its branches are covered at their owning layer; a branch with no
assertion anywhere fails, unless an explicit `waived_by_user` record names the
reason.

## 3. Edge-case matrix layer

The PRD's Matriz de Edge Cases has a `Capa duena` column. Slicing gives each
row to the slice that owns that layer. QA checks that the evidence sits at that
layer: a row proven only at another layer is a gap; a row proven again at extra
layers is a duplicate finding (`low`, or `medium` when the extra tests are slow).

## 4. Search before writing

Before adding a test, search the existing tests of the same behavior in every
layer, by subject name (class, endpoint, job, component) and by the rule itself
(domain term, error message or key, status value). If one exists, extend it
with a new case instead of writing a parallel test. The handoff names which
tests were extended and which are new, with the reason a new one was needed.

## 5. Parametrize variants

Variants that pass through the same branch go into one table-driven test (a
table of inputs and expected results), not into separate tests. A separate
test is justified only by a different branch, a different setup, or a different
layer concern.

## 6. Migration test lifecycle

- A test of a migration's up/down or of a data backfill is **temporary**. Mark
  it as such in a comment at its top, list it in the PRD's `Que queda obsoleto`
  table (type `test`, action `eliminar`, trigger: the migration reaches the main
  branch), and delete it once the migration is on the main branch.
- A database rule that stays live (check constraint, unique index, trigger,
  stored function) is protected by a test next to the model or database tests,
  run against the current schema, without loading migration classes.
- Tests of a single-use cutover tool (one-off script, backfill task) are
  deleted together with the tool.
- Never replay an old migration's up/down inside the suite: it can overwrite a
  live database object (for example a stored function) with an older version.

## 7. Behavior, not implementation

Forbidden by default:

- asserting method signatures or arity, private methods, or internal state read
  through reflection;
- asserting console or log output, unless that output is the public contract
  (for example a CLI's documented output);
- exact query counts, unless the test is explicitly marked as a performance
  test (by name or tag) and that count is the requirement;
- testing test-support code (factories, fixture builders, helpers).

An exception carries a one-line comment naming why the detail is the contract.

## 8. Cheap setup by default

- Tests run inside a rolled-back transaction unless a real commit is required
  (concurrency between connections, deferred constraints or triggers,
  after-commit hooks); then a comment on the test says why.
- Minimal data: the fewest rows that exercise the branch. To prove batching,
  lower the batch-size parameter or the fixture size instead of creating
  hundreds of rows.
- Instrumentation (tracing, query counters, profilers), threads, and real waits
  belong only in the tests that verify that concern, never in shared setup or
  on every request. Guards that the project's stack rules make mandatory for
  the whole suite stay as the project declares them.

## 9. Obsolete tests

The PRD's `Que queda obsoleto` table also lists the tests this change makes
meaningless: tests of removed behavior, tests of a migration or tool that
leaves, and tests that duplicate a rule the change moves to another owning
layer. The owning slice deletes or adapts them, and the row's verification
search proves they are gone. Pruning unrelated existing tests is out of scope:
note those as suggestions.

## Checklist (implementer before writing, QA when reviewing)

- [ ] Each new or extended test sits at its owning layer; entry-point and job
      tests stay within their own concerns (rule 1).
- [ ] Tenancy and authorization have an entry-point test (rule 1 exception).
- [ ] Every new branch has an executed assertion at its owning layer (rule 2).
- [ ] No test in another layer already proves the same rule; existing tests
      were searched by name and by rule and extended when found (rule 4).
- [ ] Same-branch variants are one table-driven test (rule 5).
- [ ] Migration tests are marked temporary and listed as obsolete; live
      database rules are tested without migration classes (rule 6).
- [ ] No signature, console, internal-state, or unmarked query-count
      assertions; no tests of test-support code (rule 7).
- [ ] Transactional, minimal data, no default instrumentation or threads; any
      exception is commented (rule 8).
- [ ] Tests made obsolete by this change are listed and removed (rule 9).

Worked cases for maintaining these rules live in
[test-design-evals.md](test-design-evals.md).
