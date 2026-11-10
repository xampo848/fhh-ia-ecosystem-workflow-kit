# Level N2 · Standard change

Read only when the confirmed level is N2 (former `controlled-lite` and
`controlled-implementation`): bounded scope, one primary surface or a narrow
backend/frontend area, explicit acceptance criteria, some material risk, and
fewer than two hazards.

## Context budget

Load: the input (PRD, ticket, bug, or iteration delta), `../SKILL.md`, the
directly relevant layer instructions, compact readiness/discovery/slicing
evidence, and targeted source files (at most 5 exploratory files before the
first plan). Do not load delegate matrices, subagent prompt packs, broad
architecture, or pattern docs unless a risk trigger justifies them.
Never load frontend instructions for a backend-only PRD. When a budget is exceeded,
record why and propose N3 instead of expanding context silently.

## Required stage pipeline (N2 and N3)

Capitana Alcance → Sherlock Estructura → Arquitecta Fases → matcher → writer → validation → QA Relampago.

Do not omit a stage to save tokens. The cost cut is compact or inline execution
of the same stage, not skipping it.
Combine readiness, discovery, and slicing into one compact preflight when the input already contains locked decisions,
touched files, patterns, and validation commands. A coding slice may proceed
only with matcher `success`, or with user-accepted `partial`/`blocked` plus
documented fallback docs and risk.

## Delegation

- Decide `avoided`, `recommended`, or `required` before the first slice using
  the heuristics in `.agents/model-routing/README.md`, and record the concrete
  reason in the tracker (`delegation_posture`, `delegation_reason`).
- At most one delegate per slice, and only where independent context, file
  ownership, or validation evidence reduces risk. One lightweight delegate per
  stage is the ceiling; no ceremonial subagents.
- Code-writing defaults to the specialized implementers
  (`backend-phase-implementer`, `frontend-phase-implementer`,
  `acceptance-test-engineer`); inline writing is a narrow one-writer exception
  that must be recorded.
- When delegating, follow the join contract in `level-n3.md` (blocking
  handoffs, wait barrier, inspect the diff before another writer touches the
  same files).

## Coordination state

- Maintain the physical tracker at `<prd-directory>/_meta/task_tracker.toon`
  (template in `../../implement-prd/reference/task-tracker-template.md`) for
  coordination only; it is not closure authority.
- Initialize the ignored immutable execution lock for each coding slice at
  `<prd-directory>/_meta/locks/<slice-id>.toon` (fields in `level-n3.md`,
  "Execution Lock Baseline").
- For visible UI, do not start a coding slice until the PRD Contrato Visual is
  `locked`.

## Slices

One observable outcome per slice and one primary acceptance objective; prefer
1-2 owned production files; split backend and frontend into producer and
consumer slices unless strict atomicity is required. A dependent slice starts
only after its predecessor is `VERIFIED`.

## QA and closure

Final QA is mandatory and focused: changed files, findings, and the acceptance
criteria touched. Escalate to fresh-context QA when a risk trigger fires.
Closure: the N1 evidence plus coverage of the touched acceptance criteria,
focused QA with `ready_to_close: yes`, and `## 10. Evidencia de
Implementacion` updated when a PRD exists. After that, `<prd-directory>/_meta/`
is removed.
