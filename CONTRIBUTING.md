# Contributing

Thanks for helping improve the FHH IA Ecosystem Workflow Kit.

## What you can contribute

The kit is a public CLI and TUI (`init`, `update`, `upgrade`, `export`,
`doctor`, `rollback`, `tui`) plus the workflow contract it installs
(`.agents/**` and the runtime adapter templates). Contributions may improve any
of them, their tests, and the docs. Publishing behavior (npm, release uploads)
stays out of scope without explicit maintainer approval.

## Ground rules

- Keep portable core separate from repo-specific overlay.
- Keep runtime adapters thin wrappers over neutral `.agents/**` contracts.
- Do not add publishing automation (npm publish, release uploads, tag pushes) without explicit maintainer approval.
- Do not copy FHH IA Ecosystem backend/frontend domain rules as generic defaults.
- Prefer explicit docs and validation over implicit behavior.

## Legal and provenance requirements

- Every non-trivial PR must include a provenance declaration (origin, source URL, license, and redistribution basis).
- Do not add third-party text/code/templates without documenting them in `THIRD_PARTY_NOTICES.md`.
- If source/license is unknown, mark as blocked and keep it out of distribution until resolved.
- Corporate-origin contributions require explicit authorization per `docs/legal/CORPORATE-CONTRIBUTIONS.md`.

## DCO sign-off

All commits must be signed off:

```bash
git commit -s -m "your message"
```

This adds the `Signed-off-by` line required by the Developer Certificate of Origin process.

## Local validation

```bash
bun install
bun run check:security
bun run test
bun run check
bun run check:workflow
bun run check:templates
bun run check:docs
bun run check:legal
bun run check:release
```

Changes to `.agents/**`, `templates/**`, `src/**`, `bin/**`, `scripts/**`, or
CI need a `package.json` version bump and a `CHANGELOG.md` entry.

## PR checklist

- [ ] README and docs match the real CLI behavior.
- [ ] `package.json` remains `private: true` and exposes only the local `workflow-kit` bin.
- [ ] Template boundaries are clear.
- [ ] All local validation commands pass.
- [ ] Any future-facing claim is labeled as planned, not implemented.
- [ ] Provenance and licensing impact was reviewed.
- [ ] DCO sign-off is present on all commits.
