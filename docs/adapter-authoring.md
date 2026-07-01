# Template and Adapter Authoring Guide

This guide explains how to extend the starter template packs safely.

## Pack layers

| Pack | Purpose | Must not contain |
| --- | --- | --- |
| `portable-core` | Neutral workflow contract and starter workflow skills | Product-specific backend/frontend/domain rules |
| `repo-overlay` | Local project customization placeholders | Claims that examples are universal defaults |
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
2. Tell it to use `.agents/skills/registry.md` for discovery.
3. Avoid copying workflow algorithms into the adapter.
4. Keep runtime-specific details small and explicit.

## Validation

Run:

```bash
npm run check:templates
```

The validator checks required files, thin adapter references, and forbidden product-specific terms in portable core and adapters.
