# Handoff Schemas

Read it when launching a delegate or reading its handoff; then load only the stage file listed under References.

All subagents in the `implement-change` flow (alias `implement-prd`) MUST return output in TOON format using the schema defined here.
Schemas list the fields a role may report. The orchestrator reads them to update `.ai-work/<prd-slug>/task_tracker.toon` and plan the next step.

## Compact Handoff Rules

A delegate returns only what is new; it never echoes its inputs back.

1. **Return envelope.** A handoff starts with the short return envelope below
   (`run_id`, `slice_id`, `execution_lock_id`, `resolved_model`,
   `resolved_model_evidence`). Objective, acceptance criteria, owned and
   forbidden files, required reads, predecessors, and contract already live in
   the slice lock; do not repeat them.
2. **Fields with content.** Report status, result, and evidence, and give
   detail only for findings and blockers. An empty list is omitted; writing
   `| none` is accepted but not required.
3. **Two kinds of missing data.** A missing bookkeeping field that the lock
   determines (run, slice, role, skill path, tier) is completed by the
   orchestrator and never blocks. Only missing **evidence** blocks: the
   command, its result, or the validated content. All `VERIFIED` rigor stays:
   a valid lock and fresh evidence.
4. **Validation evidence and logs.** The full log is written to
   `.ai-work/<prd-slug>/logs/`. The handoff carries one evidence row per
   command (see `Validation Evidence` below) and at most ~30 relevant lines per
   failure: the first error and its stack. Never paste a whole log.
5. The orchestrator opens a full log only when the excerpt is not enough, and
   then with a bounded read (grep or tail), never the whole file.
6. **Learning notes are optional.** Fill `learning` or `teaching_note` only
   when the slice involved a relevant decision; otherwise omit the field. The
   orchestrator gathers them, removes duplicates, and decides which reach the
   user.

### Return envelope

```
schema_version: delegation-envelope/v1
run_id: <orchestrator correlation id>
slice_id: <slice-id>
execution_lock_id: <lock-id | none>
resolved_model: <runtime-confirmed identifier | unknown>
resolved_model_evidence: <runtime evidence reference | none>
```

### Validation Evidence

```
evidence[N]{command,exit_code,duration_s,passed,failed,log_path,fingerprint,reused_from}:
  <exact command>,<code>,<seconds>,<count>,<count>,<.ai-work/<prd-slug>/logs/<file> | none>,<fingerprint | unknown>,<stage | none>
failure_excerpt[N]{command,lines}: <command>,<first error and stack, at most ~30 lines>
```

## Delegation Envelope Prefix

The orchestrator records this full `delegation-envelope/v1` request once, in
the slice lock and the tracker, when it launches a delegate. It is a neutral
record contract, not an SDK schema or runtime enforcement mechanism. Delegates
answer with the return envelope above instead of repeating it.

```
schema_version: delegation-envelope/v1
run_id: <orchestrator correlation id>
slice_id: <slice-id>
execution_lock_id: <lock-id | none>
role: <agent alias>
skill_path: <exact SKILL.md path>
runtime: <runtime | unknown>
surface: <runtime surface | unknown>
registered_agent: <registered identity | unknown>
requested_tier: Liviano | Mediano | Grande
escalation_reason: <reason | none>
routing_mode: auto-with-fallback | user-pinned-model | user-pinned-tier
requested_model: <runtime model identifier | inherit | unknown>
availability_source: <runtime-observed source | unknown>
resolved_model: <runtime-confirmed identifier | unknown>
resolved_model_evidence: <runtime evidence reference | none>
objective: <observable outcome>
acceptance_criteria[N]: <AC id>
files_owned[N]: <path>
files_forbidden[N]: <path>
verified_predecessors[N]: <slice id | none>
producer_consumer_contract: <contract | none>
required_reads[N]: <path or section>
context_provenance: <source and freshness | unknown>
open_questions[N]: <question | none>
expected_evidence[N]: <evidence>
```

`requested_model` does not prove execution. `resolved_model: unknown` is
required when runtime evidence is absent; a non-`unknown` value requires
`resolved_model_evidence`. When a lock is required, `execution_lock_id` must be
present, non-`none`, complete, and match the immutable slice lock for the same `run_id`
and `slice_id`. A handoff with absent, `none`, mismatched, incomplete, stale, or
missing lock/evidence data cannot promote its slice to `VERIFIED`.

---

## References

Load a reference only when its condition holds:

- [handoff-schemas-preparation.md](handoff-schemas-preparation.md) — read it when reading or writing a readiness, discovery, or slicing handoff
- [handoff-schemas-implementation.md](handoff-schemas-implementation.md) — read it when reading or writing a backend, frontend, acceptance-test, or contract handoff
- [handoff-schemas-validation.md](handoff-schemas-validation.md) — read it when reading or writing a validation or final QA handoff

## General Rules

- Use `[N]` for variable-length lists. Populate with actual items; do not leave `[N]` in the output.
- Use `| none` for optional fields that have no value.
- Do not add markdown prose or section headers to the handoff. Return the raw TOON block only.
- The orchestrator will treat any missing required field as a `blocked` status and halt.
- For closure, any `FAIL`, `PARTIAL`, `INCOMPLETE`, or `no` value in required QA fields blocks completion until the owning slice is repaired and the affected validation/QA is rerun.
- A `partial` QA handoff must name a concrete repair or validation action in `next`; a `blocked` handoff must name the ambiguity or decision required to resume.
- Any handoff with `evidence_state: stale | missing` may not advance that slice to `VERIFIED` unless `waiver_state: waived_by_user` is explicitly present with rationale in residual risks.
- A `command_scope_confirmed: no` result means `evidence_state: missing`; a green command does not count unless its scope covers the declared `required_checks` and `validated_file_scope`.
- `validated_content_ref` must identify the content validated. Any later change inside `validated_file_scope` makes that evidence `stale`.
- `blocking_findings_open: yes` (any `critical`/`high` finding not `repaired` or `waived_by_user`) forbids `ready_to_close: yes` regardless of every other field's value.
- A `waived_by_user` entry for a `critical`/`high` finding, or for authorization/tenancy/destructive-migration gaps, is valid only when it quotes the concrete risk the user accepted; a generic acknowledgement without a named risk is treated as `evidence_state: missing`.
- `unrelated_failures[N]` with `user_decision: pending` blocks the slice from `VERIFIED`; the orchestrator must obtain an explicit `repair_now | log_as_risk | block` decision from the user before continuing.
- `VERIFIED` requires a `delegation-envelope/v1` prefix with a present,
  non-`none`, matching `execution_lock_id`, complete immutable slice-lock fields, and
  `evidence_state: fresh`. `waived_by_user` does not permit an absent, `none`,
  or mismatched lock. A missing runtime model identity remains
  `resolved_model: unknown` and is not a `VERIFIED` blocker by itself.
