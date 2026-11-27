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

- Codex: `AGENTS.md`, `.codex/README.md`, `.codex/agents/*.toml`
- Copilot: `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/ai-workflow.instructions.md`, `.github/agents/*.agent.md`
- Claude: `CLAUDE.md`, `.claude/agents/*.md`
- Antigravity: `ANTIGRAVITY.md`; use shared skills inline because its documented project model has no declared custom-agent file format.

Verification rule:

- Every adapter must reference `.agents/instructions.md`.
- Every adapter must require per-turn intake.
- Generated delegate adapters must not be edited by hand; `workflow-kit doctor` reports an adapter block that was edited, and `workflow-kit update` restores it.

## 3) Skill catalog readiness

1. Confirm the kit skills are registered: `.agents/skills/registry.md` and `.agents/skills/index.md` exist.
2. Let doctor confirm the install; the registry and the generated adapters are kit-owned and `workflow-kit update` refreshes them.
3. Add your own skills under `.agents/project/` (see `.agents/kit-boundary.md`), never inside the kit folders.

Commands:

```bash
workflow-kit doctor --target /path/to/repo --runtime codex,copilot
workflow-kit update --target /path/to/repo --runtime codex,copilot
```

`doctor` exits non-zero when it finds an error diagnostic. `update` without `--apply --yes` is a dry run: after a clean install its summary shows no `create` and no `overwrite` entries.

## 4) Project-specific instruction hooks (required for real product repos)

For repositories with backend/frontend code, create project runtime instruction hooks:

- `.agents/project/backend.md`
- `.agents/project/frontend.md`

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

- the project's own lint and test commands (the ones recorded in `.agents/project/context.md`);
- `workflow-kit doctor --target . --runtime <list>`, which exits non-zero on an error diagnostic.

## Done criteria

Runtime-native readiness is complete only when all are true:

- Install/apply and doctor pass for selected runtimes.
- Adapter entrypoints are present and semantically aligned.
- Doctor reports no error diagnostics, so the kit registry and adapters are intact.
- Project instruction hooks exist for active code surfaces.
- Manual routing smoke passes in native runtime.
- CI gates are active and green.
