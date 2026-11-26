# Handoff Schemas: Validation and QA

Part of [handoff-schemas.md](handoff-schemas.md). Read it when reading or writing a validation or final QA handoff.

## `lint-ranger` → Orchestrator (Validation Runner)

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
commands_executed[N]: <command>
validation_result: PASS | FAIL
failures[N]{file,error}: <path>,<error description> | none
fixes_applied[N]{file,change}: <path>,<change description> | none
unrelated_failures[N]{description,user_decision}: <description>,<repair_now|log_as_risk|block|pending> | none
regression_checks[N]: <command or scenario proved> | none
standards_checks[N]: <instruction or gate checked> | none
residual_risks[N]: <risk description> | none
next: none | qa-handoff-review
```

## `qa-relampago` → Orchestrator (QA Handoff Review)

```
status: success | partial | blocked
review_scope: full | focused
origin_review: <review id whose untouched verdicts are kept | none>
impact_radius[N]: <path reviewed because the repair affects it>
files_reviewed[N]{path,fingerprint}: <path>,<fingerprint | unknown>
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
findings[N]{severity,file,description,pattern_protected}:
  <critical|high|medium|low>,<path>,<description>,<pattern name>
blocking_findings_open: yes | no
ac_evidence: COMPLETE | INCOMPLETE
ac_gaps[N]: <ac-id and gap description> | none
validation_status: PASS | FAIL | PARTIAL
regression_status: PASS | FAIL | PARTIAL
regression_gaps[N]: <scenario and gap> | none
standards_status: PASS | FAIL | PARTIAL
standards_gaps[N]: <rule and gap> | none
test_gap_status: PASS | FAIL | PARTIAL
test_gaps[N]: <missing test and why it matters> | none
edge_case_status: PASS | FAIL | PARTIAL
edge_case_gaps[N]: <scenario and gap> | none
residual_risks[N]: <risk description> | none
teaching_note: <concept>,<why-it-matters> (optional; only when a finding teaches something)
ready_to_close: yes | no
next: none | <specific follow-up>
```
