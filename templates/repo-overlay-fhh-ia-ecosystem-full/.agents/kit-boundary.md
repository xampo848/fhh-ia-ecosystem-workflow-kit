# Kit boundary and project overlay

This file is the contract between the workflow kit and the project that
installs it. Read it when you add, adjust, or replace a skill, a routing rule,
or a project instruction, and before editing any file under `.agents/`.

The machine-readable side is `.agents/workflow-kit/manifest.json`. The kit
source repository checks both with `node scripts/validate-kit-boundary.mjs`
(part of `check:workflow`).

## Who owns what

- **Kit paths** are a closed list: a path belongs to the kit only when an entry
  of the manifest covers it (the most specific entry wins). Classes:
  - `kit`: the kit owns the whole file; a kit update replaces it.
  - `derived`: the kit generates it (catalogs, wrappers, rendered agents).
  - `adapter`: the kit owns only the block between
    `<!-- workflow-kit:managed:start -->` and `<!-- workflow-kit:managed:end -->`
    (or the entry's own `block` name); text outside the block is the project's.
  - `seed`: the kit creates it once when it is missing; then the project owns it.
  - `state`: install state written by the `workflow-kit` CLI.
- **Project paths** are everything under `.agents/project/`. A kit update never
  edits them. A path that is neither kit nor project is reported, never touched.
- Never edit a `kit` or `derived` file in a target repository to adapt the
  workflow: the next kit update will not deliver fixes to an edited file. Use
  one of the three extension levels below instead.

## Overlay layout

| Path | Purpose |
| --- | --- |
| `.agents/project/index.md` | Project catalog: project skills, extensions, and shadows |
| `.agents/project/routing.md` | Project routing rules (the router's extension point) |
| `.agents/project/skills/<name>/SKILL.md` | Project skills of class `Pattern` |
| `.agents/project/skills/runbooks/<name>/SKILL.md` | Project skills of class `Runbook` (see Runbooks below) |
| `.agents/project/extensions/<skill>.md` | Reserved for kit skills that declare an extension point there (none does yet) |
| `.agents/project/shadows/<skill>/` | Full replacement of a kit leaf skill |
| `.agents/project/context.md` | Project knowledge base (legacy path: `.agents/project-context.md`) |
| `.agents/project/quality-gate.md` | Project additions to the kit quality gate |
| `.agents/project/backend.md`, `.agents/project/frontend.md`, `.agents/project/stack.md` | Layer and stack instructions |
| `.agents/project/paths.json` | Name-to-path map for projects with another layout |

A missing file is an empty overlay (exists-or-skip): the kit never fails
because the project has not created it.

Legacy layout: read `.agents/project/context.md`, or `.agents/project-context.md` while the new one does not exist.
The manifest lists every such pair under `legacy_paths`; a kit file that names
a legacy path names its current path on the same line. Keep the legacy file
until `workflow-kit update` migrates it: today's `workflow-kit doctor` and
installer still check and seed the legacy path, not `.agents/project/context.md`.

## Extension levels

Use the first level that works:

1. **add**: a new file in the overlay, such as a project skill under
   `.agents/project/skills/<name>/SKILL.md` registered in the `Skills` table of
   `.agents/project/index.md`. A project skill never reuses the name of a kit
   skill; to change a kit skill, use extend or shadow.
2. **extend**: a file at an extension point the manifest declares under
   `extension_points` (skill name to project file). The kit skill reads it
   after its own rules. An extension may add or tighten rules; it never removes
   a gate, a confirmation, or a validation the kit requires.
3. **shadow**: a full replacement of a kit leaf skill at
   `.agents/project/shadows/<skill>/SKILL.md`, next to a `shadow.json`:

   ```json
   { "skill": "<kit skill name>", "kit_path": ".agents/skills/<...>/SKILL.md", "base_sha256": "<sha256 of that kit file when the shadow was made>", "kit_version": "<kit version>" }
   ```

   When the kit file no longer matches `base_sha256`, review the shadow.
   `workflow-router` and `.agents/instructions.md` cannot be shadowed (manifest
   `not_shadowable`): they accept only extend, through
   `.agents/project/routing.md`.

A declared extension-point file is read whenever it exists; listing it in the
`Extensions` table is optional, and a row for a point the manifest does not
declare is ignored. A shadow takes effect only when its row is in the
`Shadows` table of `.agents/project/index.md`, and it applies wherever the kit
skill is loaded by name: the router loads the shadow instead, and the
orchestrator passes the shadow path as the role skill in a delegate's slice
lock.

## Project catalog format

`.agents/project/index.md` has up to three tables; each is optional. The
`Class` column of `Skills` is `Pattern` or `Runbook`, and the folder of a
runbook equals its name:

```markdown
## Skills

| Skill name | Class | Trigger | Physical path | Cost hint |
| --- | --- | --- | --- | --- |
| `<name>` | Pattern | <when to use it> | `.agents/project/skills/<name>/SKILL.md` | lean |
| `<runbook-name>` | Runbook | <operational phrases> | `.agents/project/skills/runbooks/<runbook-name>/SKILL.md` | lean |

## Extensions

| Kit skill | Extension file |
| --- | --- |
| `quality-gate` | `.agents/project/quality-gate.md` |

## Shadows

| Kit skill | Shadow directory |
| --- | --- |
| `<kit leaf skill>` | `.agents/project/shadows/<kit leaf skill>/` |
```

## Runbooks

A runbook is a project procedure: environment promotion, release, hotfix,
rollback. It lives at `.agents/project/skills/runbooks/<name>/SKILL.md`, where
the folder equals the frontmatter `name`, and has a `Runbook` row in the
`Skills` table. A `Pattern` never lives under `.agents/project/skills/runbooks/`.

- Required headings: `## Trigger`, `## Preconditions`, `## Steps`,
  `## Verification`, `## Rollback` (it may say `Not applicable: <reason>`),
  plus `## Owner` with the owning role and `last_verified: <YYYY-MM-DD>`.
- Each precondition says how to check it (a command or an observation).
- An irreversible step (push, deploy, delete, data migration, publish) carries
  `confirm: required` and `risk: <consequence>`.
- Secrets appear only as variable or secret-store names, never values: a
  runbook is `public-in-repo` (`.agents/memory/README.md`).
- Start from the kit template
  `.agents/skills/06-patterns/authoring/runbook-template.md` through the
  `add-project-pattern` skill.

Routing, execution, and capture rules belong to the kit
(`.agents/skills/00-router/workflow-router/reference/project-overlay.md` and
`.agents/instructions.md`); no runbook text can weaken them. The kit ships no
runbook.

## Routing rules format

`.agents/project/routing.md` holds plain rules the router applies after its
own: extra trigger phrases for project skills, or a preferred project skill for
a request class. A rule never skips a hard trigger, the execution
authorization gate, or the explicit confirmation of an irreversible action
(push, deploy, delete, data migration); the router ignores such a rule and says
so.

## Path references

- **Kit to kit:** a path anchored at the kit root (`.agents/...`) or a link
  relative to the file. It must resolve inside the kit tree.
- **Kit to project:** the fixed path `.agents/project/...` from the overlay
  layout, always read with exists-or-skip.
- **Project to kit:** by skill name, never by path: kit paths may change
  between versions, names do not.

## Kit defaults and project additions

When the kit ships a default that a project may tighten, the default lives in
a kit file and the project file holds only additions. Readers load the kit
default first and the project file after it when it exists. The quality gate
works this way: kit default `.agents/delegation/quality-gate.md`, project
additions `.agents/project/quality-gate.md`. A project file never edits the
kit default in place.

## Project skills and native discovery

Codex, GitHub Copilot, and Cursor discover skills only in fixed folders such as
`.agents/skills/`, so they do not find `.agents/project/skills/**`. Project
skills are reached through the router, which reads `.agents/project/index.md`
after the kit catalog. Do not copy, stub, or symlink a project skill into a kit
folder.
