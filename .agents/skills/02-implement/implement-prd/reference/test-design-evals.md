# Test design evals (maintainers only)

Never load this file during execution. It holds the scenarios used to maintain
[test-design-rules.md](test-design-rules.md) and the coverage gate that points
to it. They live next to the rules, not in the router evals, because they test
how an implementer writes tests and how QA reviews them, not which route or
level a prompt gets.

`node --test` validates the table shape and that the required scenarios exist.
The behavior is verified by giving each scenario to the implementer
(`backend-phase-implementer` or `acceptance-test-engineer`) and to
`qa-handoff-review`, and recording the result in the PR after any change to
the rules.

<!-- test-design-evals:start -->
| ID | Scenario | Expected decision | Rule |
| --- | --- | --- | --- |
| T01 | A query filters orders by status, date range, and seller with 6 variants proven in the query test. The new endpoint that exposes it gets a request test. | The request test covers authentication, authorization, company isolation, invalid params (422), status and response shape, plus one happy path for the filter. It does not repeat the 6 variants; QA flags a copy of them as a duplicate. | 1 |
| T02 | A nightly job calls the invoice service, whose rules are already proven in the service test. | The job test covers record selection, batching, retry on a transient error, and error handling, with the service exercised once or replaced by a double. Re-proving the service rules in the job test is a duplicate finding. | 1 |
| T03 | A PR adds a migration plus a test that runs its up/down and a backfill. The migration is merged to the main branch. | The up/down and backfill test is marked temporary, listed in `Que queda obsoleto` (type `test`, action `eliminar`), and deleted once the migration is on the main branch. The check constraint it creates gets a test next to the model or database tests, without loading the migration class. | 6 |
| T04 | A new private helper only forwards its arguments to an existing service method that is already tested. | No test of its own; it is covered by the service test. The coverage gate passes because no new branch lacks an assertion. | 2 |
| T05 | A discount rule has 5 input combinations that all go through the same branch. | One table-driven test with 5 rows, not 5 separate tests. | 5 |
| T06 | A query already scopes records by company, and the endpoint that uses it changes. | The entry-point test still proves that another company's user gets no data: tenancy is tested at the entry point even when the query filters. | 1 |
| T07 | A test asserts the exact number of SQL queries of a listing endpoint, and it is not marked as a performance test. | QA finding: implementation detail. Either drop the count or mark the test as a performance test whose requirement is that count. | 7 |
| T08 | A batching test creates 200 rows to cross a batch boundary of 100, in a non-transactional test. | Lower the batch-size parameter to 2 and use 3 rows inside a transaction; a real commit is allowed only with a comment naming why it is required. | 8 |
| T09 | A slice adds a new expiry condition to a rule. Searching by the rule's error key finds an existing service test of that rule under another name. | Extend the existing test with a new case (or row) instead of writing a parallel test; the handoff names the extended test. | 4 |
<!-- test-design-evals:end -->
