# Handoff Schemas

All subagents in the `implement-prd` flow MUST return output in TOON format using the schema defined here.
Schemas are **minimum required fields**. Subagents may add fields when the skill's handoff format requires it — they may NOT omit required fields.
The orchestrator reads these schemas to update `docs/prd/_meta/task_tracker.md` and plan the next step.

---

## `capitana-alcance` → Orchestrator (PRD Readiness)

```
decision: GO | STOP
mode: small/local | controlled-implementation | standard | autonomous-safe | resume
scope: <one-line description>
surfaces[N]: backend | frontend | both | none
risks[N]: <risk description> | none
blocking_questions[N]: <question> | none
acceptance_criteria[N]: <criterion id and description>
phases[N]: <phase name>
required_instructions[N]: <file path> | none
```

If `decision: STOP`, the orchestrator must surface `blocking_questions` to the user and halt.

---

## `sherlock-estructura` → Orchestrator (Codebase Discovery)

```
status: success | partial | blocked
patterns[N]{name,file,relevance}: <name>,<path>,<why-relevant>
files_likely_touched[N]: <path>
tests_likely_affected[N]: <path>
docs_loaded[N]: <path>
docs_skipped[N]{doc,reason}: <path>,<why-skipped>
validation_commands[N]: <command>
risks[N]: <risk description> | none
open_questions[N]: <question> | none
stop_conditions[N]: <condition> | none
required_instructions[N]: <path> | none
simpler_existing_pattern: <name> | none
next: implementation-slicing
```

`required_instructions` tells the orchestrator which domain instructions to load and forward to implementers.

---

## `arquitecta-fases` → Orchestrator (Implementation Slicing)

```
slices[N]{name,owner,files_owned,files_forbidden,ac_covered,evidence_expected,validation,status}:
  <name>,<agent-alias>,<paths>,<paths>,<ac-ids>,<evidence-description>,<command>,NOT_STARTED
parallelizable: yes | no
parallelizable_reason: <reason> | none
user_decision_points[N]: <decision point> | none
atomicity_rationale[N]: <slice-name>,<reason> | none
next: implementation-slices
```

---

## `turbo-backend` → Orchestrator (Backend Implementation)

```
status: success | partial | blocked
matcher_status_consumed: success | partial | blocked | skipped
skills_read[N]: <path> | none
fallback_docs_used[N]: <path> | none
capabilities_used[N]: <capability,status,reason> | none
files_changed[N]: <path>
tests_added_or_updated[N]: <path>
commands_executed[N]: <command>
validation_result: PASS | FAIL
ac_covered[N]: <ac-id>
contract_changes[N]: <description> | none
quality_gate:
  pattern_reused: <name>
  solid_dry_kiss_notes: <notes>
  hardcoding_check: PASS | FAIL | <description>
  new_abstraction_introduced: yes | no
  new_abstraction_rationale: <rationale> | none
trade_off: <decision taken> | none
learning: <concept>,<why-it-matters-in-all-metrics> | none
residual_risks[N]: <risk description> | none
next: validation-runner | contract-verifier | none
```

---

## `pixel-ninja` → Orchestrator (Frontend Implementation)

```
status: success | partial | blocked
matcher_status_consumed: success | partial | blocked | skipped
skills_read[N]: <path> | none
fallback_docs_used[N]: <path> | none
capabilities_used[N]: <capability,status,reason> | none
files_changed[N]: <path>
tests_added_or_updated[N]: <path>
commands_executed[N]: <command>
validation_result: PASS | FAIL
ac_covered[N]: <ac-id>
i18n_keys_added[N]: <key>
ui_states_covered[N]: <state>
quality_gate:
  pattern_reused: <name>
  solid_dry_kiss_notes: <notes>
  hardcoding_check: PASS | FAIL | <description>
  premium_ui_check: PASS | FAIL | <description>
  shared_component_decision: <extracted | kept-local | not-applicable>
  new_abstraction_introduced: yes | no
  new_abstraction_rationale: <rationale> | none
trade_off: <decision taken> | none
learning: <concept>,<why-it-matters-in-all-metrics> | none
residual_risks[N]: <risk description> | none
next: validation-runner | contract-verifier | none
```

---

## `testinator-5000` → Orchestrator (Acceptance Tests)

```
status: success | partial | blocked
matcher_status_consumed: success | partial | blocked | skipped
skills_read[N]: <path> | none
fallback_docs_used[N]: <path> | none
capabilities_used[N]: <capability,status,reason> | none
acceptance_matrix[N]{ac_id,test_file,scenario,assertion}: <ac-id>,<path>,<scenario>,<assertion>
files_changed[N]: <path>
commands_executed[N]: <command>
validation_result: PASS | FAIL
passing_tests[N]: <test name>
criteria_uncovered[N]: <ac-id and reason> | none
residual_risks[N]: <risk description> | none
next: validation-runner | none
```

---

## `guardia-contrato` → Orchestrator (Contract Verifier)

```
status: success | partial | blocked
matcher_status_consumed: success | partial | blocked | skipped
skills_read[N]: <path> | none
fallback_docs_used[N]: <path> | none
capabilities_used[N]: <capability,status,reason> | none
contract_fields_verified[N]: <field name>
backend_test: PASS | FAIL | MISSING
frontend_test: PASS | FAIL | MISSING
positive_scenario: PASS | FAIL | N/A
error_scenario: PASS | FAIL | N/A
breaking_consumers: yes | no
breaking_consumer_details[N]: <consumer,impact> | none
residual_risks[N]: <risk description> | none
next: validation-runner | none
```

---

## `lint-ranger` → Orchestrator (Validation Runner)

```
status: success | partial | blocked
matcher_status_consumed: success | partial | blocked | skipped
skills_read[N]: <path> | none
fallback_docs_used[N]: <path> | none
capabilities_used[N]: <capability,status,reason> | none
commands_executed[N]: <command>
validation_result: PASS | FAIL
failures[N]{file,error}: <path>,<error description> | none
fixes_applied[N]{file,change}: <path>,<change description> | none
residual_risks[N]: <risk description> | none
next: none | qa-handoff-review
```

---

## `qa-relampago` → Orchestrator (QA Handoff Review)

```
status: success | partial | blocked
matcher_status_consumed: success | partial | blocked | skipped
skills_read[N]: <path> | none
fallback_docs_used[N]: <path> | none
capabilities_used[N]: <capability,status,reason> | none
findings[N]{severity,file,description,pattern_protected}:
  <critical|high|medium|low>,<path>,<description>,<pattern name>
ac_evidence: COMPLETE | INCOMPLETE
ac_gaps[N]: <ac-id and gap description> | none
validation_status: PASS | FAIL | PARTIAL
residual_risks[N]: <risk description> | none
teaching_note: <concept>,<why-it-matters-in-all-metrics>
ready_to_close: yes | no
next: none | <specific follow-up>
```

---

## General Rules

- Use `[N]` for variable-length lists. Populate with actual items; do not leave `[N]` in the output.
- Use `| none` for optional fields that have no value.
- Do not add markdown prose or section headers to the handoff. Return the raw TOON block only.
- The orchestrator will treat any missing required field as a `blocked` status and halt.
