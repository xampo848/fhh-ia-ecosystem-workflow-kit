# All Metrics Workflow Kit

This directory defines the repo-local packaging boundary for reusing the All
Metrics AI workflow in another project.

It is **not an installer**, marketplace package, or published distribution. It
is a packaging blueprint that separates portable core from repo overlay and
runtime thin adapter concerns.

## Package layers

| Layer | Role |
| --- | --- |
| Portable core | Neutral AI contracts, generic workflow skills, registry/schema/cache mechanics, capability lifecycle vocabulary |
| Repo overlay | All Metrics product/domain rules, local pattern skills, local capability adoption, local docs |
| Runtime adapters | Thin adapter files for Codex, GitHub Copilot, Claude Code, or future runtimes |
| Derived artifacts | Registry JSON/cache generated from canonical Markdown and skill files |

## Source-of-truth rules

- Portable core semantics live under `.agents/**`.
- Runtime wrappers must remain thin adapters over `.agents/**`.
- Product/backend/frontend code is excluded from portable core.
- Generated artifacts are derived and must be regenerated/validated before reuse.

## Files

- `manifest.json` — structured packaging boundary.
- `overlay-example.md` — how another repo should define its local overlay.
- `adoption-checklist.md` — step-by-step adoption checklist.

## Validation

Run:

```bash
python3 scripts/validate_workflow_kit.py --check
```

This validates manifest paths and rejects backend/frontend product paths inside
the portable core.
