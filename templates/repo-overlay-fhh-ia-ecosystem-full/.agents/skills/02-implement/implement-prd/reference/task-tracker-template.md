# Task Tracker Template

Use this template when the orchestrator initializes `<prd-directory>/_meta/task_tracker.toon` at Phase 2 (Slicing).
Copy and fill all fields. Use TOON format. Do not leave placeholder text — remove any field that does not apply.

---

```
# task_tracker
prd: <path-to-prd-file>
mode: small/local | controlled-lite | controlled-implementation | standard | autonomous-safe | resume
started: <ISO-date>
execution_lock: <ignored path-to-prd-directory/_meta/execution-lock.toon>
quality_gate: <verified path | none, with reason>
validation_commands[N]: <command>
loaded_docs[N]: <path>
required_instructions[N]: <path>

# acceptance_criteria
ac[N]{id,description,status,evidence}:
  AC-01,<description>,NOT_STARTED,none
  AC-02,<description>,NOT_STARTED,none

# phases
phases[N]{name,status,evidence}:
  Phase 0 - Readiness,NOT_STARTED,none
  Phase 1 - Discovery,NOT_STARTED,none
  Phase 2 - Slicing,NOT_STARTED,none
  Phase 3 - Matcher,NOT_STARTED,none
  Phase 4 - Implementation,NOT_STARTED,none
  Phase 5 - Contract Verification,NOT_STARTED,none
  Phase 6 - Validation,NOT_STARTED,none
  Phase 7 - QA,NOT_STARTED,none
  Phase 8 - Closure,NOT_STARTED,none

# slices
slices[N]{name,owner,files_owned,status,ac_covered}:
  <slice-name>,<agent-alias>,<file-path>,NOT_STARTED,<ac-ids>

# open_risks
open_risks[N]: <description>

# qa_gate
qa_gate:
  acceptance_criteria: COMPLETE | INCOMPLETE
  regressions: PASS | FAIL | PARTIAL
  standards: PASS | FAIL | PARTIAL
  tests: PASS | FAIL | PARTIAL
  edge_cases: PASS | FAIL | PARTIAL
  ready_to_close: yes | no

# closure_gate
closure_gate[N]{item,status,evidence}:
  acceptance-criteria,NOT_STARTED,none
  regressions,NOT_STARTED,none
  standards,NOT_STARTED,none
  tests,NOT_STARTED,none
  edge-cases,NOT_STARTED,none
  qa-readiness,NOT_STARTED,none

# handoff_log
handoff_log[N]{phase,agent,timestamp,status,notes}:
  <phase>,<agent>,<ISO-datetime>,<VERIFIED|IMPLEMENTED|BLOCKED>,<brief>
```

## Status Values

- `NOT_STARTED` — slice has not begun
- `IMPLEMENTED` — code written, not yet tested
- `TESTED` — tests added/run, not yet validated
- `VALIDATED` — validation commands passed
- `VERIFIED` — all evidence present; ready to proceed
- `PENDING_SUBAGENT` — delegate was launched and the orchestrator is waiting for its terminal handoff
- `BLOCKED` — stop condition triggered; awaiting user input

## Update Rules

- Set the slice to `PENDING_SUBAGENT` when a delegate is launched, then update again after the terminal handoff.
- Change slice `status` in place — do not append duplicates.
- Add a row to `handoff_log` for every delegation event.
- Record matcher evidence before the implementation owner starts on the same slice.
- Distinguish slicing, matcher, and implementation handoffs in `handoff_log`.
- Add to `open_risks` whenever a subagent returns a risk.
- Record the ignored PRD-local execution lock; it is coordination state, as is this tracker. Persist closure evidence in the final response and durable PRD documentation before cleanup.
- Record only a quality-gate path confirmed to exist; a missing configured path is a stop condition, not `none`.
- Mark `evidence` in `ac` when the acceptance criterion has concrete proof (test path, validation output, or explicit residual risk).
- Update `qa_gate` and `closure_gate` after validation and QA; Phase 8 cannot be `VERIFIED` while any item is not passing with evidence.
