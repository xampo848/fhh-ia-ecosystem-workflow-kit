# Update Skill Registry

## Purpose

Keep skill discovery, routing, and installable overlays synchronized whenever a workflow skill, runtime adapter, trigger, loading posture, or registry-owned metadata changes.

This runbook is mandatory for changes that touch any of the following:

- `.agents/skills/registry.md`
- `.agents/skills/index.md`
- `.agents/skills/registry.json`
- `.agents/skills/registry.cache.json`
- `.agents/skills/00-router/**`
- runtime adapters such as `ANTIGRAVITY.md` or `.github/copilot-instructions.md`
- new or moved `.agents/skills/**/SKILL.md` files

## Source of truth

1. `.agents/skills/registry.md` is the human-authored canonical inventory.
2. `scripts/sync-skill-registry.mjs` is the only supported way to derive:
   - `.agents/skills/index.md`
   - `.agents/skills/registry.json`
   - `.agents/skills/registry.cache.json`
   - mirrored overlay copies under `templates/repo-overlay-fhh-ia-ecosystem-full/`
3. `registry.json` is the validation input consumed by doctor and workflow-contract checks.

Do not hand-edit derived registry artifacts unless you are immediately replacing that change by running the sync script.

## Standard procedure

### 1. Edit canonical sources

Update the smallest canonical files needed:

- `.agents/skills/registry.md` for inventory metadata
- the relevant `SKILL.md` files for workflow behavior
- runtime adapters when routing guarantees need to be more explicit

If you are adding a new skill:

1. Create the new `.agents/skills/**/SKILL.md` file.
2. Register it in `.agents/skills/registry.md` with the correct class, trigger, loading posture, cost hint, and stable key.
3. If it is directly routable at startup, ensure it belongs in the compact index contract.

### 2. Synchronize derived artifacts

Run:

```bash
bun run check:workflow
```

If the command reports out-of-sync registry artifacts, regenerate them with:

```bash
node scripts/sync-skill-registry.mjs --write
```

Then rerun:

```bash
bun run check:workflow
```

Expected outcome:

- canonical and overlay copies of `index.md`, `registry.json`, and `registry.cache.json` are identical to generated output
- drift is detected before release

### 3. Validate runtime contract changes

When the change touches router rules or runtime adapters, run the focused contract suite:

```bash
node --test test/turn-routing-contract.test.mjs test/workflow-contract.test.mjs test/doctor.test.mjs
```

Use this to catch:

- missing routing trace guarantees
- missing follow-up re-routing guarantees
- missing execution authorization gate language
- broken overlay parity

### 4. Validate registry/install behavior

When the change affects registration or update/install merge behavior, run:

```bash
node --test test/skill-registry-sync.test.mjs test/planner.test.mjs test/workflow-contract.test.mjs
```

Use this to confirm:

- generated registry artifacts are deterministic
- built-in registry entries refresh correctly during install/update
- custom/local skills remain preserved and discoverable
- unregistered local `SKILL.md` files fail explicitly in validation

### 5. Validate docs and overlay legal readiness

If you changed docs or installable overlay content, run:

```bash
bun run check:docs
bun run check:legal
```

### 6. Final release-level pass

Before shipping a release with routing or registry changes, run:

```bash
bun run test
bun run check:workflow
bun run check:docs
bun run check:legal
```

## Existing repository installs

The installer intentionally preserves existing `.agents/skills/index.md` and `.agents/skills/registry.md` in target repositories to avoid clobbering local catalogs.

The installed `.agents/skills/registry.json` is merged instead of overwritten.

Important rule:

- toolkit-owned entries must refresh to the current metadata
- custom/local entries must remain preserved

This is why install/update behavior must always be validated through `test/planner.test.mjs` after changing merge logic.

## Failure modes

If `bun run check:workflow` fails:

1. Inspect whether `.agents/skills/registry.md` and the touched `SKILL.md` files contain the intended metadata.
2. Regenerate derived artifacts with `node scripts/sync-skill-registry.mjs --write`.
3. Re-run focused tests before widening scope.

If `doctor` reports `skills/unregistered-file`:

1. Decide whether the `SKILL.md` is a real skill or stray file.
2. If it is real, add the registry entry in `.agents/skills/registry.md`.
3. Regenerate derived artifacts and rerun validation.

If install/update keeps stale built-in metadata in `registry.json`:

1. Re-check planner merge behavior.
2. Confirm toolkit-owned keys are refreshed from current generated artifacts.
3. Add or update planner coverage before merging.