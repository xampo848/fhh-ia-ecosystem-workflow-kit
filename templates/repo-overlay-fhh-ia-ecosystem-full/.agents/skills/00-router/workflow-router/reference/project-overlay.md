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

## Trace

Add `project: <skill or rule>` to the trace when a project catalog entry or
routing rule changed the route. Do not mention the overlay when it did not.
