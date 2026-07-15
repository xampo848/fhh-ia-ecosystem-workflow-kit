# Workflow Kit Adoption Checklist

Use this checklist before reusing the All Metrics workflow kit in another repo.

## 1. Portable core

- [ ] Copy or vendor the portable core files from `manifest.json`.
- [ ] Keep `.agents/instructions.md` as the neutral source-of-truth contract.
- [ ] Preserve workflow skill semantics and wait barriers.

## 2. Repo overlay

- [ ] Define local product code roots.
- [ ] Replace All Metrics-specific pattern skills with local pattern skills.
- [ ] Document local validation commands.
- [ ] Create or update local capability manifests.

## 3. Runtime thin adapters

- [ ] Point runtime wrappers back to `.agents/**`.
- [ ] Do not duplicate workflow logic inside runtime wrappers.
- [ ] Verify Codex/GitHub Copilot/other wrapper parity if supported.

## 4. Registry and cache

- [ ] Update `.agents/skills/registry.md`.
- [ ] Regenerate structured registry artifacts.
- [ ] Run registry and cache checks.

## 5. Final validation

- [ ] Run `python3 scripts/validate_workflow_kit.py --check`.
- [ ] Confirm no backend/frontend product code is included in portable core.
- [ ] Confirm this packaging is not an installer or marketplace publication.
