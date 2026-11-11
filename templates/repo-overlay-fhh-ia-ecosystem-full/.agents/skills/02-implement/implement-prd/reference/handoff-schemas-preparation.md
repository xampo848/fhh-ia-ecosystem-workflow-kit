# Handoff Schemas: Preparation

Part of [handoff-schemas.md](handoff-schemas.md). Read it when reading or writing a readiness, discovery, or slicing handoff.

## `capitana-alcance` → Orchestrator (PRD Readiness)

```
decision: GO | STOP
level: N1 | N2 | N3
modifiers[N]: autonomous | resume
scope: <one-line description>
surfaces[N]: backend | frontend | both | none
risks[N]: <risk description> | none
blocking_questions[N]: <question> | none
acceptance_criteria[N]: <criterion id and description>
phases[N]: <phase name>
required_instructions[N]: <file path> | none
```

If `decision: STOP`, the orchestrator must surface `blocking_questions` to the user and halt.

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
