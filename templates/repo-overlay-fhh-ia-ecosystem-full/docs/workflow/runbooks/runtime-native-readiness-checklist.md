# Runtime-Native Readiness Checklist

## Purpose

Harden runtime installation so adapters are not only present, but operationally usable in each native environment.

## Scope

Use this checklist right after `workflow-kit init --apply --yes` and before rolling to a team.

## 1) Baseline installation and contract checks

1. Run install preview and apply for the intended runtimes.
2. Run doctor with the same runtime list.
3. Confirm no error diagnostics remain.

Commands:

```bash
workflow-kit init --target /path/to/repo --runtime codex,copilot --apply --yes
workflow-kit doctor --target /path/to/repo --runtime codex,copilot
```

## 2) Runtime adapter files (agent entrypoints)

Ensure these native entrypoints exist per runtime:

- Codex: `AGENTS.md`, `.codex/README.md`
- Copilot: `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/ai-workflow.instructions.md`
- Claude: `CLAUDE.md`
- Antigravity: `ANTIGRAVITY.md`

Verification rule:

- Every adapter must reference `.agents/instructions.md`.
- Every adapter must require per-turn intake.

## 3) Skill catalog readiness

1. Confirm local skills are registered.
2. Sync generated registry artifacts.
3. Re-run workflow checks.

Commands:

```bash
node scripts/sync-skill-registry.mjs --check
bun run check:workflow
```

If you added or changed skills:

```bash
node scripts/sync-skill-registry.mjs --write
bun run check:workflow
```

## 4) Project-specific instruction hooks (required for real product repos)

For repositories with backend/frontend code, create project runtime instruction hooks:

- `.github/instructions/backend.instructions.md`
- `.github/instructions/frontend.instructions.md`

Use this starter:

- `docs/workflow/standards/project-instructions-template.md`

Then wire real commands (no placeholders) for:

- Lint
- Tests
- Type/static checks
- Contracts/E2E when applicable

## 5) Manual behavior smoke (native runtime)

In each runtime you enabled:

1. Send one non-trivial request and verify routing trace appears before edits.
2. Verify the selected workflow is the one executed next.
3. Verify workflow switch requires a new routing trace first.
4. Verify explicit skill invocation is respected.

Use this checklist:

- `docs/workflow/runbooks/router-skill-enforcement-manual-checklist.md`

## 6) CI and release hardening

Add minimum gates to CI before rollout:

```bash
bun run check:workflow
bun run check:templates
bun run test
```

Recommended release gate:

```bash
bun run check:release
```

## Done criteria

Runtime-native readiness is complete only when all are true:

- Install/apply and doctor pass for selected runtimes.
- Adapter entrypoints are present and semantically aligned.
- Skill registry is synchronized.
- Project instruction hooks exist for active code surfaces.
- Manual routing smoke passes in native runtime.
- CI gates are active and green.
