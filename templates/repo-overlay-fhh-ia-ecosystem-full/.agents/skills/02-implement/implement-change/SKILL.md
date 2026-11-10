---
name: implement-change
description: "General implementation route for FHH IA Ecosystem (alias: implement-prd). Turns an approved PRD, a bug, a ticket, or an iteration over an implemented PRD into working, validated code. The task level (N1/N2/N3) decides the ceremony and the input type decides the required evidence. Native custom-agent targets: Codex, GitHub Copilot, and Claude Code; other runtimes run the shared skill inline."
argument-hint: "PRD path, bug description, ticket id, or the change to an implemented PRD"
license: MIT
metadata:
  author: fhh-ia-ecosystem
  version: "3.0"
---

# Implement Change

Control surface for every code change that needs more than an N0 answer.
`implement-prd` is a permanent alias of this skill: "implementa este PRD" lands
here. Keep this file loaded and read a reference only when its condition holds.

Two independent axes decide the work:

- the **level** (N1/N2/N3, from the pre-filter in `.agents/instructions.md`)
  decides ceremony: tracker, delegates, Discovery, QA;
- the **input type** (PRD, bug, ticket, iteration) decides the evidence.

## References

| Reference | Read it only when |
| --- | --- |
| [reference/level-n1.md](reference/level-n1.md) | the level is N1 (surgical, inline) |
| [reference/level-n2.md](reference/level-n2.md) | the level is N2 (compact preflight, focused QA) |
| [reference/level-n3.md](reference/level-n3.md) | the level is N3 (full delegated flow, 12-point closure) |
| [reference/input-types.md](reference/input-types.md) | always, but only the section of the detected input type |
| [reference/modifiers.md](reference/modifiers.md) | autonomous execution or resume applies |

Shared references stay under `../implement-prd/reference/` and are read only in
N2/N3 when the step uses them: `orchestration-flow.md`, `delegate-skill-matrix.md`,
`subagent-prompts.md`, `handoff-schemas.md`, `task-tracker-template.md`,
`validation-and-stop-conditions.md`. Native delegate adapters are generated from
`scripts/delegate-agent-catalog.json`; never edit them by hand.

## Workspace

All temporary AI state for a change lives in one Git-ignored directory:
`.ai-work/<prd-slug>/` (the PRD directory name, or a short slug of the bug or
ticket): tracker, `events.log`, `locks/`, handoffs, `logs/`, and the PRD
orchestration notes. Nothing temporary goes under `docs/` or into a PR; the
PRD keeps only the durable section 10. Remove the workspace after closure; an
open or blocked change keeps it. Legacy `<prd-directory>/_meta/` is read-only
fallback for PRDs started before this layout.

## Step 1 · Detect the input type

| Type | Recognized by | Required evidence |
| --- | --- | --- |
| PRD | a PRD path or "implementa este PRD" | acceptance-criteria coverage matrix |
| Bug | observed behavior differs from expected | reproduction, a test that fails before the fix and passes after, one-line root cause |
| Ticket | a ticket id or short acceptance criteria | each acceptance criterion covered by a test or check |
| Iteration | a change to something already implemented from a PRD | delta against the PRD and its `## 10. Evidencia de Implementacion` |

Read only the matching section of `reference/input-types.md`.

## Step 2 · Confirm the level

The router or the pre-filter proposes the level; this skill confirms it before
any edit. One classification only: the old operating modes map to levels.

| Level | Former mode | Load |
| --- | --- | --- |
| N1 | `small/local` | `reference/level-n1.md` |
| N2 | `controlled-lite`, `controlled-implementation` | `reference/level-n2.md` |
| N3 | `standard` | `reference/level-n3.md` |

`autonomous-safe` and `resume` are no longer modes: they are modifiers over any
level (`reference/modifiers.md`). Where a shared reference still says
`small/local`, `controlled-*`, or `standard`, read N1, N2, or N3.

Escalation rules, applied before choosing the level reference:

1. **Hazard rule.** The fixed hazard list is: rollout mechanism or feature
   flag; data migration, backfill, or persisted cutover; background job or
   asynchronous execution; public API or cross-layer contract change;
   authorization or tenancy behavior; visible user-facing UI. A change or
   dependent slice with two or more listed hazards MUST run at N3.
2. **Critical concerns.** A delta that touches a `criticalConcern`
   (`.agents/model-routing/README.md`) runs at N3 with all its gates.
3. **Size.** If N1 needs 4+ exploratory reads, 2+ non-mechanical edits, or
   cross-layer reasoning, stop and propose N2. If N2 Discovery shows the change
   is small, propose N1. Both are proposals the user confirms.

Authorization: N1 needs a short "yes" to the one-line proposal
(`N1 · surgical · <files and check>`). N2 and N3 need explicit route
authorization; together with it, offer **supervised** (default: review pause
between phases) or **autonomous** (`reference/modifiers.md`).

## Step 3 · Execute with the level reference

Load exactly one of `level-n1.md`, `level-n2.md`, or `level-n3.md`, plus the
input-type section. Do not preload N3 material for N1 or N2 work.

## Invariants (every level)

No level, modifier, or user hurry removes these:

1. **Authorization** as defined in Step 2; intent language alone never authorizes.
2. **Escalation** on two or more hazards or any `criticalConcern`.
3. **Tests of the delta and regression.** Behavior changes get a test; a bug
   gets a test that fails before the fix; existing tests of the touched area
   (and, for an iteration, the tests listed in the PRD's section 10) run again.
4. **Quality gate.** Code-writing work applies the project quality gate
   (today `.github/instructions/quality-gate.instructions.md`) and the layer
   instructions it touches. Verify each required path exists; a missing
   configured path is a hard stop, never an implicit pass.
5. **Stop conditions and brakes** in `../implement-prd/reference/validation-and-stop-conditions.md`
   always stop the run, autonomous or not: at most 2 repair rounds per slice,
   one recovery attempt for an environment failure, one rerun for a flaky test.
6. **One writer per file**, and a delegate's handoff is the only
   synchronization point: never continue from partial output or silence.
7. **No closure without evidence**: closure follows the level table below.
8. **Teach and challenge** only when it matters: when a better alternative
   exists, state the trade-off briefly, recommend one path, and continue.

## Closure by level

| Level | Closure |
| --- | --- |
| N1 | delta tests, regression of the touched area, focused check, short evidence in the PRD or the final response |
| N2 | N1 + coverage of the acceptance criteria touched + focused QA + `## 10. Evidencia de Implementacion` updated when a PRD exists |
| N3 | the 12-point Mandatory Closure Contract in `reference/level-n3.md` |

An iteration closes with an "Iteración N" subsection in section 10 instead of
repeating the full contract (`reference/input-types.md`).

## Final Response

- Level, input type, and modifiers used.
- PRD phases or delta completed.
- Files changed by area.
- Tests and validation run, including regression.
- Acceptance criteria coverage.
- Code quality gate result.
- Key trade-offs challenged or improved.
- Open risks or follow-ups.
- Next expected skill only when useful (`document-development` for N3 or durable knowledge changes).
