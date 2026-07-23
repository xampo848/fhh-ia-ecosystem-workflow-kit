# Contributing

Thanks for helping improve the FHH IA Ecosystem Workflow Kit.

## Current phase

This project is currently in Safe CLI MVP phase. Contributions may improve the dry-run-first CLI, planner, doctor, tests, and template boundaries without adding TUI or publishing behavior.

## Ground rules

- Keep portable core separate from repo-specific overlay.
- Keep runtime adapters thin wrappers over neutral `.agents/**` contracts.
- Do not add publishing automation until the publishing/release PRD.
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
npm run check
```

## PR checklist

- [ ] README remains accurate for the current phase.
- [ ] `package.json` remains `private: true` and exposes only the local `workflow-kit` bin.
- [ ] Template boundaries are clear.
- [ ] Scaffold validation passes.
- [ ] Any future-facing claim is labeled as planned, not implemented.
- [ ] Provenance and licensing impact was reviewed.
- [ ] DCO sign-off is present on all commits.
