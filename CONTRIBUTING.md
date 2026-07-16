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
