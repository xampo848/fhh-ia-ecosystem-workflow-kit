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
2. Tell it to use `.agents/skills/registry.md` for discovery.
3. Avoid copying workflow algorithms into the adapter.
4. Keep runtime-specific details small and explicit.

## Validation

Run:

```bash
npm run check:templates
```

The validator checks required files, thin adapter references, and forbidden product-specific terms in adapters.
