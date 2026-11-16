# Extending the Workflow

The installer gives each target repository a full `.agents` tree. You can
extend it in two ways, and mix them:

- AI-assisted: ask the agent to explain or perform the extension.
- Manual: edit the files directly yourself.

For new runtime adapters, see [Adapter authoring](adapter-authoring.md).

## AI-assisted extension

Ask for guidance only:

```text
Explain how to add a new workflow route named "<workflow-name>" in this repository.
Show exact files to edit and a minimal validation checklist.
Do not edit files yet.
```

Ask the agent to do it:

```text
Implement a new workflow route named "<workflow-name>".
Requirements:
1) Update .agents/skills/00-router/workflow-router/SKILL.md with trigger signals and disambiguation rules; keep it at or under 200 lines and move menus, gates, or examples to its reference/ files.
2) Update .agents/instructions.md if startup/routing contract or task levels change, then run node scripts/sync-level-prefilter.mjs --write.
3) Keep routing trace format consistent.
4) Do not change unrelated routes.
5) Run relevant validation checks and summarize results.
```

Add a new project skill:

```text
Create a new project skill at .agents/skills/06-patterns/<domain>/<skill-name>/SKILL.md and register it in .agents/skills/registry.md.
Requirements:
1) Include purpose, trigger, required inputs, and expected outputs.
2) Add registry metadata: class, physical path, trigger, loading posture.
3) Update router rules only if this skill should be auto-routed for freeform requests.
4) Keep existing skills unchanged.
5) Run relevant validation checks and summarize results.
```

## Manual extension

When editing by hand, keep this order:

1. Update routing behavior in `.agents/skills/00-router/workflow-router/SKILL.md` (core, at most 200 lines) or in its `reference/` files (`route-menus.md`, `route-gates.md`, `router-evals.md`).
2. Update the startup contract in `.agents/instructions.md` if routing/entry behavior or the task levels (N0–N3) change. The level pre-filter is copied to the runtime adapters by `node scripts/sync-level-prefilter.mjs --write`; `bun run check:workflow` fails if a copy drifts.
3. Add or update skills under `.agents/skills/06-patterns/<domain>/<skill-name>/SKILL.md`.
4. Register every new skill in `.agents/skills/registry.md`.

For each registry entry, define at least:

- `Skill name`
- `Class`
- `Physical path`
- `Trigger`
- `Loading posture` (`startup-minimal`, `explicit-only`, `just-in-time`, `delegated-only`, `overlay`, `helper/mode`)

## Validation checklist

1. In this toolkit repository, validate the template packs:

   ```bash
   bun run check:templates
   ```

2. In a target repository, preview managed updates before applying:

   ```bash
   workflow-kit update --target /path/to/repo
   ```

3. Test routing with three prompts, plus the level test prompts in
   `.agents/skills/00-router/workflow-router/reference/router-evals.md` when
   the pre-filter or router changed:

   - one prompt that should trigger `workflow-router` only,
   - one prompt that should trigger your new workflow or skill,
   - one nearby prompt that should not trigger it.

4. If behavior is wrong, tighten the `Trigger` text in
   `.agents/skills/registry.md` and the route selection rules in
   `.agents/skills/00-router/workflow-router/SKILL.md`.

This keeps discovery (`registry.md`) and execution policy (`workflow-router`)
aligned, so skills load just in time instead of always-on.
