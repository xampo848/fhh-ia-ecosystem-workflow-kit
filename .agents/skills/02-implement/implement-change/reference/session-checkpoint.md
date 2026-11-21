# Session checkpoint: cut point and resume

Read it only at N2/N3 when a slice reaches its cut point, when the size brake
below fires, or when a new session starts from a checkpoint. It is the single
rule for cutting a long implementation session; other files only point here.

The orchestrator's context grows with every slice it closes. A closed slice
needs none of that context again: its evidence already lives in the tracker,
its lock, and its handoff. Cutting the session at that point lets the next
slice start from a small context instead of carrying every closed slice.

## Cut point

A slice reaches its cut point when all of these hold:

1. its terminal handoff was read (never a partial result or a visible diff);
2. its validation is recorded in the tracker and the slice is `VERIFIED`;
3. no other delegate is `PENDING_SUBAGENT`.

At the cut point the orchestrator writes the checkpoint below and proposes the
cut. The last slice of the change has no cut point: closure follows instead.

## Size brake

The cut is also proposed before a slice closes when the session is large:

- If the runtime exposes the current context size, propose a cut once it
  passes about 150k tokens.
- If it does not, use an observable substitute counted since the session
  start or the last cut: 4 terminal handoffs read or 60 tool calls by the
  orchestrator, whichever comes first. Say which substitute fired
  (`freno de tamaño: sustituto, 4 handoffs`); never report a context size the
  runtime did not show.

A size-brake cut mid-slice records that slice as in progress, not `VERIFIED`;
the resumed session revalidates it before continuing.

## Proposal, never imposed

- Propose the cut in one short question: (A) continue in a new session with the
  checkpoint (recommended), (B) compact this session, if the runtime offers
  it, or (C) continue here. Never cut, compact, or start a session silently.
- Never propose it while a delegate is `PENDING_SUBAGENT`: wait for every
  terminal handoff first, then propose (the wait barrier is never broken).
- With the autonomous modifier, write the checkpoint, state the proposal in one
  line, and keep going; the user may cut at any time.
- A stop condition takes precedence: ask that question first; the cut waits.

## Checkpoint content

The checkpoint is the tracker plus one `checkpoint` block
(`../../implement-prd/reference/task-tracker-template.md`). No parallel file or
format. When no tracker exists yet (a single-slice N2), create it with only the
fields that apply.

The tracker already holds the input (`prd`), level, modifiers, current
`validation_commands`, and each slice and criterion with its evidence. The
block adds only what the tracker lacks:

- `trigger`: the cut point or the size-brake signal that fired;
- `route_trace`: the latest routing trace line, verbatim;
- `closed_slices`: ids of the `VERIFIED` slices (their evidence stays in
  `slices` and `ac`; the block points to it, it does not copy it);
- `next_slice` and `next_lock`: the slice to start and its lock path;
- `open_decisions`: questions still waiting for the user;
- `branch`, `commit`, and `working_tree` (`clean` or the uncommitted files).

The user starts the new session with one line: `continúa desde
.ai-work/<prd-slug>/task_tracker.toon`.

## What the resumed session reads

1. `.agents/instructions.md` and `../SKILL.md`, as every session start does.
2. The tracker with its `checkpoint` block.
3. The lock of `next_slice` and the reads that lock lists as required.
4. The level reference named by `route_trace`.

Before anything else it compares `branch` and `commit` with the repository and
`working_tree` with `git status`. A change inside a closed slice's validated
scope makes that evidence stale: revalidate that slice only.

## What it does not repeat

- Routing: the `route_trace` in the checkpoint is the session memory, so it
  emits `implement-change · continuing · no reroute` and does not load the
  router.
- Readiness, discovery, slicing, and matching while their evidence stays fresh
  under the freshness rules of
  `../../implement-prd/reference/validation-and-stop-conditions.md`.
- Validation of slices that are `VERIFIED` with fresh evidence.
- Reading closed slices' handoffs, diffs, `events.log`, or the full PRD; the
  PRD is read only in the sections the next lock lists.

A missing or incomplete checkpoint falls back to the normal resume
(`modifiers.md`).
