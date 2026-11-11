# Level N1 · Surgical change

Read only when the confirmed level is N1 (former `small/local`). It replaces the
N1 rules of the pre-filter with the full inline procedure.

## Entry criteria

All must hold; if one stops holding while working, stop and propose N2:

1. At most one or two files, with the exact change already clear.
2. No database, API contract, authorization, tenancy, background job,
   analytics, cross-layer, or migration impact, and no `criticalConcern`.
3. The focused check (lint, build, or test) can be named before editing.

## Context budget

Load only: the target files, their tests, at most one PRD (or the bug or ticket
text), and the narrowest validation command. No tracker, no delegates, no
Discovery, no execution locks, no delegate matrix or prompt packs.

## Flow

1. Propose `N1 · surgical · <files and check>` and wait for a short "yes".
2. Read the target files and their tests.
3. Bug: reproduce, then write the test that fails before the fix. Behavior
   change: add or update the test. Non-semantic edit: no new test.
4. Edit only the target files.
5. Run the focused check and the existing tests of the touched area
   (regression). For an iteration, also run the tests listed in the PRD's
   section 10 for that feature.
6. Close with short evidence: what changed, which tests and checks ran with
   their result, and the change reference. If a PRD exists, append it to its
   section 10 as described for the input type.

## Stop and escalate

Stop and propose N2 or N3 when any of these appear: another file is needed, a
contract or shared type is involved, a test failure you cannot explain in one
step, a hazard from the list in `../SKILL.md`, or the check cannot run. Never
widen scope silently.
