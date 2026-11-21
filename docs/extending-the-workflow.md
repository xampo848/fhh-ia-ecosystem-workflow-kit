# Extending the Workflow

A repository that installs the kit extends it only from its own overlay,
`.agents/project/`. The kit's files (listed in
`.agents/workflow-kit/manifest.json`) are never edited in place: a later
`workflow-kit update` will not deliver fixes to an edited kit file. The full
contract is `.agents/kit-boundary.md`; ownership is explained in
[Project boundaries](project-boundaries.md).

You can extend it in two ways, and mix them:

- AI-assisted: ask the agent to explain or perform the extension.
- Manual: edit the overlay files yourself.

For new runtime adapters, see [Adapter authoring](adapter-authoring.md).

## Three extension levels

Use the first level that works.

| Level | When | Where |
| --- | --- | --- |
| **add** | A new project skill (pattern or runbook) or a new routing rule | `.agents/project/skills/<name>/SKILL.md` (runbooks under `.agents/project/skills/runbooks/<name>/`), registered in `.agents/project/index.md`; rules in `.agents/project/routing.md` |
| **extend** | Add rules to a kit skill that declares an extension point | The file the manifest names under `extension_points`, for example `.agents/project/routing.md` (router and instructions) or `.agents/project/quality-gate.md` (quality gate) |
| **shadow** | Replace a kit leaf skill entirely, when extend is not enough | `.agents/project/shadows/<skill>/SKILL.md` plus `shadow.json` with the kit file's hash |

The router and `.agents/instructions.md` cannot be shadowed: change routing
through `.agents/project/routing.md`. A routing rule can add triggers or prefer
a project skill, but it never removes a hard trigger, the authorization gate,
or the confirmation of an irreversible action.

Project skills are reached through the router, which reads
`.agents/project/index.md` after the kit catalog. Codex, Copilot, and Cursor do
not discover `.agents/project/skills/` on their own, so do not copy or symlink
project skills into `.agents/skills/`.

A shadow keeps a fork of a kit skill. When the kit file changes, compare it
with the `base_sha256` in `shadow.json` and review the shadow. Prefer extend.

## Project runbooks

A runbook stores a project procedure, such as promoting a build to an
environment, a release, a hotfix, or a rollback, so the agent does not have to
learn it again in every session. It is a project skill of class `Runbook` at
`.agents/project/skills/runbooks/<name>/SKILL.md`, built from the kit template
`.agents/skills/06-patterns/authoring/runbook-template.md`. The contract is the
`Runbooks` section of `.agents/kit-boundary.md`.

- **Running one.** A request that matches a runbook trigger (for example "pass
  this to staging") loads it. The agent checks every precondition first and
  stops if one fails. Before each irreversible step (push, deploy, delete,
  data migration, publish) it names the risk and waits for your yes; one yes
  covers one step. A step that changes code goes through the normal kit route.
- **Capturing one.** When you teach or correct a procedure during an N2/N3
  task, the agent proposes, once, to save it: the full runbook, or a diff of
  the existing one. It writes nothing until you say yes, and it replaces any
  secret value with a placeholder first. You can also ask for it directly.
- **Limits.** A runbook cannot remove the confirmation of an irreversible
  step: the kit's rules win and the agent reports the line it ignored. Store
  secrets only as variable or secret-store names: runbooks are committed to
  the repository.

## AI-assisted extension

Ask for guidance only:

```text
Explain how to add a project rule so that "<phrase>" routes to <skill>.
Show the overlay files to edit and a minimal validation checklist.
Do not edit files yet.
```

Add a project pattern skill:

```text
Use add-project-pattern to create a project skill named "<skill-name>" for <surface>.
```

The skill writes `.agents/project/skills/<skill-name>/SKILL.md` and its row in
`.agents/project/index.md`, and never touches `.agents/skills/**`.

Save a procedure as a runbook:

```text
Use add-project-pattern to create a runbook named "<runbook-name>" for <procedure>.
```

Add a project routing rule:

```text
Add a rule to .agents/project/routing.md: requests about "<topic>" prefer the
project skill "<skill-name>". Keep every kit gate and confirmation.
```

## Manual extension

1. Create `.agents/project/index.md` with the tables from
   `.agents/kit-boundary.md` (`Skills`, `Extensions`, `Shadows`; each optional).
2. Add each project skill under `.agents/project/skills/<name>/SKILL.md`, with
   the folder name equal to the frontmatter `name`, and add its row to `Skills`.
   Do not reuse a kit skill name.
3. Put routing rules in `.agents/project/routing.md`.
4. Put quality-gate additions in `.agents/project/quality-gate.md`; the kit
   default always applies first.
5. In project files, name kit skills by name (`implement-change`), never by
   path: kit paths may change between versions.

## Changing the kit itself

Editing the router, `.agents/instructions.md`, the kit catalogs, or any kit
skill is kit maintenance and happens in the kit's source repository:

1. Update routing behavior in `.agents/skills/00-router/workflow-router/SKILL.md` (core, at most 200 lines) or in its `reference/` files.
2. Update `.agents/instructions.md` if routing/entry behavior or the task levels change, then run `node scripts/sync-level-prefilter.mjs --write`.
3. Register every new kit skill in `.agents/skills/registry.md` and run `node scripts/sync-skill-registry.mjs --write`.
4. Give every new installable file a class in `.agents/workflow-kit/manifest.json`.
5. Keep `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/` identical to `.agents/`.
6. Run `bun run check:workflow`.

## Validation checklist

1. In a target repository, preview managed updates before applying:

   ```bash
   workflow-kit update --target /path/to/repo
   ```

2. Test routing with three prompts, plus the level test prompts in
   `.agents/skills/00-router/workflow-router/reference/router-evals.md` when
   the overlay, pre-filter, or router changed:

   - one prompt that should trigger `workflow-router` only,
   - one prompt that should trigger your project skill or rule,
   - one nearby prompt that should not trigger it.

3. If behavior is wrong, tighten the `Trigger` text in
   `.agents/project/index.md` or the rule in `.agents/project/routing.md`.
