# Template and Adapter Authoring Guide

This guide explains how to extend the template packs safely.

## Pack layers

| Pack | Purpose | Must not contain |
| --- | --- | --- |
| `repo-overlay-fhh-ia-ecosystem-full` | Complete workflow payload installed in target repositories | Runtime-specific entrypoint duplication |
| `runtime-adapters/*` | Thin runtime entrypoints | Duplicated workflow algorithms |

## Manifest rules

Update `templates/template-manifest.json` whenever you add required payload files.

Each pack declares:

- `id` — stable pack identifier;
- `source` — directory under `templates/`;
- `required_files` — payload files that must exist;
- `documentation_only` — files like pack README files that are docs, not install payload;
- `requires_reference` — adapter files must point back to `.agents/instructions.md`.

## Adapter rules

Runtime adapters should be boring:

1. Tell the runtime to read `.agents/instructions.md`.
2. Re-apply the neutral **per-turn intake** on every user prompt; session startup alone is not enough.
3. Tell it to use `.agents/skills/index.md` for startup discovery and `.agents/skills/registry.md` only for full inventory or fallback.
4. Give explicit skill invocation precedence over automatic routing.
5. Carry the generated **level pre-filter** (N0–N3) between the
   `<!-- workflow-kit:level-prefilter:start -->` and `end` markers. N0 and N1
   requests follow it without loading workflow files; N2 and N3 load
   `workflow-router`. Never edit the block by hand: change it in
   `.agents/instructions.md` and run `node scripts/sync-level-prefilter.mjs --write`.
6. Avoid copying any other workflow algorithm into the adapter; the pre-filter
   is the only exception.
7. Delegate agent adapters (`.claude/agents`, `.codex/agents`, `.github/agents`)
   are generated: they point to the role `SKILL.md` and to
   `.agents/delegation/delegate-contract.md`, and embed that contract's summary.
   Change delegate rules in the contract (and in
   `scripts/delegate-rule-inventory.json`), then run
   `node scripts/sync-delegate-runtime-adapters.mjs --write`.
8. Keep runtime-specific details small and explicit.

`AGENTS.md` is a shared adapter pack used by Codex and Copilot-compatible
surfaces. Claude Code and Antigravity keep thin syntax-specific entrypoints.
Runtime selection remains an explicit mapping in `src/runtime-matrix.mjs`.

## Adding a runtime

1. Add a thin pack under `templates/runtime-adapters/<runtime>/`.
2. Register the pack in `templates/template-manifest.json`.
3. Add the explicit runtime-to-pack mapping and entrypoints in `src/runtime-matrix.mjs`.
4. Add routing-contract and planner coverage.
5. Add the runtime to `.agents/memory/parity-checklist.md`.

Do not create a second workflow contract in the adapter. Unsupported runtime
features must use a documented safe fallback instead.

## Validation

Run:

```bash
bun run check:workflow
```

The validator checks required files, neutral references, per-turn intake,
Copilot `applyTo: "**"` coverage, skill registry integrity, capability
manifests, and canonical/overlay drift.

For end-to-end rollout hardening (including agent entrypoints, skills registry,
and project instruction hooks), run the checklist in
`docs/workflow/runbooks/runtime-native-readiness-checklist.md`.
