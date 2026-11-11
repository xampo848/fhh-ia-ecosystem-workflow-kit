# Handoff Schemas: Implementation

Part of [handoff-schemas.md](handoff-schemas.md). Read it when reading or writing a backend, frontend, acceptance-test, or contract handoff.

## `turbo-backend` → Orchestrator (Backend Implementation)

```
status: success | partial | blocked
matcher_status_consumed: success | partial | blocked | skipped
execution_lock_id: <lock-id>
slice_id: <slice-id>
evidence_state: fresh | stale | missing
waiver_state: none | waived_by_user
required_checks[N]: <required command or check>
validated_file_scope[N]: <path>
validated_content_ref: <commit SHA or file-hash manifest>
command_scope_confirmed: yes | no | not-applicable
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
learning: <concept>,<why-it-matters> (optional; omit when no relevant decision was made)
residual_risks[N]: <risk description> | none
edge_cases_covered[N]: <scenario and evidence> | none
next: validation-runner | contract-verifier | none
```

## `pixel-ninja` → Orchestrator (Frontend Implementation)

```
status: success | partial | blocked
matcher_status_consumed: success | partial | blocked | skipped
execution_lock_id: <lock-id>
slice_id: <slice-id>
evidence_state: fresh | stale | missing
waiver_state: none | waived_by_user
required_checks[N]: <required command or check>
validated_file_scope[N]: <path>
validated_content_ref: <commit SHA or file-hash manifest>
command_scope_confirmed: yes | no | not-applicable
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
learning: <concept>,<why-it-matters> (optional; omit when no relevant decision was made)
residual_risks[N]: <risk description> | none
edge_cases_covered[N]: <scenario and evidence> | none
next: validation-runner | contract-verifier | none
```

## `testinator-5000` → Orchestrator (Acceptance Tests)

```
status: success | partial | blocked
matcher_status_consumed: success | partial | blocked | skipped
execution_lock_id: <lock-id>
slice_id: <slice-id>
evidence_state: fresh | stale | missing
waiver_state: none | waived_by_user
required_checks[N]: <required command or check>
validated_file_scope[N]: <path>
validated_content_ref: <commit SHA or file-hash manifest>
command_scope_confirmed: yes | no | not-applicable
skills_read[N]: <path> | none
fallback_docs_used[N]: <path> | none
capabilities_used[N]: <capability,status,reason> | none
acceptance_matrix[N]{ac_id,test_file,scenario,assertion}: <ac-id>,<path>,<scenario>,<assertion>
files_changed[N]: <path>
commands_executed[N]: <command>
validation_result: PASS | FAIL
passing_tests[N]: <test name>
criteria_uncovered[N]: <ac-id and reason> | none
edge_cases_covered[N]: <scenario and evidence> | none
residual_risks[N]: <risk description> | none
next: validation-runner | none
```

## `guardia-contrato` → Orchestrator (Contract Verifier)

```
status: success | partial | blocked
matcher_status_consumed: success | partial | blocked | skipped
execution_lock_id: <lock-id>
slice_id: <slice-id>
evidence_state: fresh | stale | missing
waiver_state: none | waived_by_user
required_checks[N]: <required command or check>
validated_file_scope[N]: <path>
validated_content_ref: <commit SHA or file-hash manifest>
command_scope_confirmed: yes | no | not-applicable
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
