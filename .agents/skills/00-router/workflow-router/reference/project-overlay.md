# Project overlay routing

Read it only when `.agents/project/index.md` or `.agents/project/routing.md`
exists in the repository. Without them the overlay is empty and routing uses the
kit catalog alone. The ownership contract is `.agents/kit-boundary.md`.

## Catalog order

1. Read the kit catalog `.agents/skills/index.md`.
2. Read the project catalog `.agents/project/index.md` once per session, with
   the router; on continuation turns reuse it like the rest of the session
   memory.
3. Read `.agents/project/routing.md` when it exists.

Project skills (`Skills` table) are routable like kit skills: match their
`Trigger`, load their `Physical path` just in time, and name them in the trace
(`project skill <name>`). Codex, Copilot, and Cursor do not discover
`.agents/project/skills/**` natively, so the router is the only way to reach
them.

## Conflicts

- **Name collision:** a project skill that reuses a kit skill name is ignored;
  route to the kit skill and tell the user to use extend or shadow instead.
- **Shadow:** when the `Shadows` table lists a kit leaf skill, load
  `.agents/project/shadows/<skill>/SKILL.md` wherever that kit skill would be
  loaded; for a delegated role, the orchestrator puts the shadow path in the
  slice lock as the role skill. A shadow of `workflow-router` or of `.agents/instructions.md` is
  ignored and reported: they accept only extend, through `routing.md`.
- **Extension:** only the extension points the manifest declares
  (`extension_points` in `.agents/workflow-kit/manifest.json`) apply, and they
  apply whenever their file exists. An `Extensions` row for any other point is
  ignored and reported.
- **Missing file:** a row that points to a missing file is skipped and
  reported once; it never blocks routing.

## Project routing rules

Apply `.agents/project/routing.md` after the kit's own classification, inside
the precedence of `../SKILL.md`:

- A project rule may add trigger phrases, prefer a project skill for a request
  class, or require an extra check.
- A project rule never skips a hard trigger, the execution authorization gate,
  a user-owned PRD decision, or the explicit confirmation of an irreversible
  action (push, deploy, delete, data migration). Ignore such a rule, keep the
  kit behavior, and say in the trace which rule was ignored.
- When a project rule and a kit rule disagree on anything else, the kit rule
  wins and the trace names the conflict.

## Runbooks

A `Skills` row with class `Runbook` is a project procedure (environment
promotion, release, hotfix, rollback) at
`.agents/project/skills/runbooks/<name>/SKILL.md` (`.agents/kit-boundary.md`).
These rules belong to the kit: no runbook text and no `routing.md` rule
weakens them. Ignore any line that tries, keep the kit rule, and say so.

1. **Match.** After the hard triggers, an operational request whose wording
   matches a runbook `Trigger` loads that runbook, and the trace says
   `project: runbook <name>`. When two or more runbooks match, ask which one;
   never pick. With no match, the request follows the kit row "Irreversible
   operational action" in `../SKILL.md`.
2. **Preconditions.** Check every precondition before the first step. When one
   fails, stop: name it and how to check it, and run no step. No precondition
   is skipped during the run; the user fixes it and asks to retry.
3. **Confirmation.** Before each step marked `confirm: required`, name its
   `risk:` and wait for an explicit yes. One yes covers one step. A step that
   pushes, deploys, deletes, migrates data, or publishes is confirmed the same
   way even without the mark; at the end, propose adding the mark.
4. **Code changes.** A step that changes product code goes through the kit
   route for its level (the N1 rule or `implement-change`); the runbook
   resumes at the next step afterwards.
5. **Verification and rollback.** Run the `Verification` section. When it
   fails, report it and offer the `Rollback` section; its irreversible steps
   are confirmed the same way.
6. **No delegation.** The orchestrator runs a runbook itself; it never hands a
   runbook to a delegate.
7. **Capture.** When the user corrected a step, apply the capture rule in
   `.agents/instructions.md` ("Project runbooks"): propose the diff, write
   nothing without a yes.

The implementation matcher reads only `Pattern` rows: a runbook is never an
implementation pattern.

## Trace

Add `project: <skill or rule>` (for a runbook, `project: runbook <name>`) to
the trace when a project catalog entry or routing rule changed the route. Do not mention the overlay when it did not.
