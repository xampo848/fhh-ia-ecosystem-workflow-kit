# Evidence Reuse

Part of [validation-and-stop-conditions.md](validation-and-stop-conditions.md). Read it before running an expensive deterministic check (package typecheck, unit suite, build).

## Evidence Reuse

A check is not rerun when nothing it depends on changed. The check still
exists; only its result is reused, and only when a script proves the content
is identical.

1. **Fingerprint by script.** Compute it with
   `node .agents/skills/02-implement/validation-runner/scripts/validation-fingerprint.mjs fingerprint --scope <paths> [--config <paths>] [--generated <paths>] [--migrations <paths>] [--tool <name=version>]`.
   It hashes the scope files, lockfiles, the given configuration, generated
   code, migrations, and the runtime and tool versions. Never compute or guess
   a fingerprint by hand: if the script cannot run, the fingerprint is
   `unknown` and the check runs.
2. **Registry.** Every check records one line in
   `.ai-work/<prd-slug>/validation-registry.jsonl` (`record`): command, scope,
   fingerprint, result, stage, and time.
3. **Decide before running** (`decide`):
   - same command, scope, and fingerprint with PASS: reuse it and note
     "reutilizado de <etapa>, huella <x>";
   - same command, scope, and fingerprint with FAIL: do not rerun it "to see
     if it passes" (a flaky rerun follows the brakes above);
   - a PASS over a wider scope covers a narrower one **only for lint and
     types**; a narrower scope never covers a wider one, and this never applies
     to tests;
   - a different or `unknown` fingerprint: run.
4. **What is reused.** Only expensive deterministic checks: package
   typecheck, unit suites, and build. Cheap checks (lint of a few files) simply
   run. Integration and E2E are never reused between stages because they
   depend on state the fingerprint cannot see (database, seeds, environment
   variables, external services).
5. **Never reused:** slices that touch a `criticalConcern`, and the full suite
   at closure, which always runs once.
6. **Shadow mode first.** Reuse starts in shadow mode: `decide` answers `RUN`
   and reports what it would have reused. A project switches to active reuse by
   adding `validation_reuse: active` to `.agents/project-context.md` after 2 or
   3 implementations whose shadow results never differed. If a defect escapes
   that a reused check would have caught, go back to shadow.
7. **Transparency.** Section 10 lists each reused check as "reutilizado de
   <etapa>, huella <x>".
