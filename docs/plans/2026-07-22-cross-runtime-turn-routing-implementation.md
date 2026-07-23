# Cross-Runtime Per-Turn Routing Implementation Plan

**Goal:** Make per-turn workflow intake reliable and equivalent across Codex,
GitHub Copilot, Claude Code, and Antigravity while preserving a single neutral
contract and extensible skill/capability registries.

**Architecture:** `.agents/instructions.md` remains the canonical contract.
`workflow-router/SKILL.md` owns the detailed routing algorithm. Runtime adapters
repeat only the minimum bootstrap invariant required by their native surfaces.
Shared validation powers both packaged-template checks and `workflow-kit doctor`.

**Tech stack:** Node.js 20+, ES modules, `node:test`, Markdown/JSON workflow
artifacts.

## Global Constraints

- Do not create `.superpowers/` or `docs/superpowers/`.
- Do not create commits unless the user explicitly requests one.
- Do not replace the explicit runtime map with dynamic manifest-driven runtime
  registration.
- Support Codex, Copilot, Claude, and Antigravity as first-class runtimes.
- Keep `.agents/instructions.md` as the only canonical workflow contract.
- Keep runtime adapters thin; do not copy the router algorithm into wrappers.
- Preserve existing backup, `skip_modified`, and `skip_unmanaged` behavior.
- Apply changes to canonical `.agents/**` files and their installable overlay
  copies in the same task.
- Use tests first for every behavioral change.

---

## Task 1: Define and test the per-turn neutral contract

**Files**

- Create: `test/turn-routing-contract.test.mjs`
- Modify: `.agents/instructions.md`
- Modify: `.agents/skills/00-router/workflow-router/SKILL.md`
- Modify: `.agents/skills/registry.md`
- Modify: `.agents/skills/registry.json`
- Modify:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/instructions.md`
- Modify:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/00-router/workflow-router/SKILL.md`
- Modify:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/registry.md`
- Modify:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/registry.json`

**Contract**

- Every new user prompt receives lightweight intake.
- Explicit skill invocation takes precedence.
- Direct answers do not require full router loading or a visible trace.
- Non-trivial freeform work loads `workflow-router`.
- Visible traces are required only for meaningful workflow, skill, capability,
  cost, delegation, or risk decisions.
- The workflow selected for the previous prompt is never assumed to apply to
  the next prompt.
- Already-loaded unchanged context may be reused.
- Failure to load the router uses an explicit safe fallback.

**Steps**

- [ ] Add tests that read canonical and overlay files and require:
  - a `## Mandatory per-turn intake` section;
  - explicit-skill precedence;
  - direct-answer fast path;
  - non-trivial router loading;
  - visible-trace conditions;
  - no previous-turn route reuse;
  - identical canonical and overlay contract/router content.
- [ ] Run:

  ```bash
  node --test test/turn-routing-contract.test.mjs
  ```

  Expected: FAIL because the mandatory section and aligned router language do
  not yet exist.

- [ ] Add the mandatory section to both copies of `.agents/instructions.md`.
- [ ] Update both router copies so “intake always” is distinct from “load the
  full router for non-trivial work.”
- [ ] Update the workflow-router registry trigger and runtime note in Markdown
  and JSON without changing its `Startup-minimal` loading posture.
- [ ] Re-run the focused test.

  Expected: PASS.

---

## Task 2: Introduce one shared `AGENTS.md` bootstrap

**Files**

- Create: `AGENTS.md`
- Create: `templates/runtime-adapters/agents-md/AGENTS.md`
- Delete: `templates/runtime-adapters/codex/AGENTS.md`
- Modify: `templates/runtime-adapters/codex/.codex/README.md`
- Modify: `templates/template-manifest.json`
- Modify: `src/planner.mjs`
- Modify: `test/planner.test.mjs`
- Modify: `test/template-packs.test.mjs`

**Interfaces**

- `runtimeTemplatePaths.codex` resolves shared `agents-md` plus `codex`.
- `runtimeTemplatePaths.copilot` resolves shared `agents-md` plus `copilot`.
- Claude and Antigravity keep their current runtime-specific packs.
- `selectedTemplateFiles()` continues returning a sorted, deduplicated array.

**Steps**

- [ ] Add planner tests proving:
  - Codex-only includes exactly one `AGENTS.md`;
  - Copilot-only includes exactly one `AGENTS.md`;
  - Codex+Copilot includes exactly one identical `AGENTS.md`;
  - all runtimes still produce unique target paths.
- [ ] Add template-pack tests requiring a new `adapter-agents-md` pack and
  removing `AGENTS.md` ownership from `adapter-codex`.
- [ ] Run:

  ```bash
  node --test test/planner.test.mjs test/template-packs.test.mjs
  ```

  Expected: FAIL because the shared pack does not exist.

- [ ] Create a generic root bootstrap based on the approved All Metrics
  `AGENTS.md`, containing:
  - neutral source-of-truth precedence;
  - mandatory per-turn intake;
  - explicit skill invocation;
  - full router loading for non-trivial work;
  - JIT loading and context reuse;
  - model, capability, integration, and memory references;
  - Codex/Copilot compatibility notes.
- [ ] Keep the repository root `AGENTS.md` identical to the template payload.
- [ ] Change the planner’s explicit runtime mapping values from single paths to
  fixed path arrays. Do not read runtimes dynamically from the manifest.
- [ ] Add `adapter-agents-md` to the template manifest and make its only
  required file `AGENTS.md`.
- [ ] Remove `AGENTS.md` from the Codex pack and update its README to point to
  the shared adapter.
- [ ] Re-run focused tests.

  Expected: PASS.

---

## Task 3: Align all supported runtime adapters

**Files**

- Modify: `.github/copilot-instructions.md`
- Modify: `.github/instructions/ai-workflow.instructions.md`
- Modify:
  `templates/runtime-adapters/copilot/.github/copilot-instructions.md`
- Modify:
  `templates/runtime-adapters/copilot/.github/instructions/ai-workflow.instructions.md`
- Modify: `templates/runtime-adapters/claude/CLAUDE.md`
- Modify: `templates/runtime-adapters/antigravity/ANTIGRAVITY.md`
- Modify: `templates/runtime-adapters/antigravity/.antigravity/README.md`
- Modify: `test/turn-routing-contract.test.mjs`
- Modify: `test/template-packs.test.mjs`

**Adapter minimum**

Every adapter must:

1. point to `.agents/instructions.md`;
2. require intake for every new prompt;
3. preserve explicit skill precedence;
4. load the router for non-trivial freeform work;
5. avoid duplicating the router classification table;
6. state runtime-specific limitations without changing neutral semantics.

**Steps**

- [ ] Extend tests to enumerate Codex/shared, Copilot, Claude, and Antigravity
  entrypoints and assert the adapter minimum.
- [ ] Add a focused test requiring the Copilot scoped instruction to begin with:

  ```yaml
  ---
  applyTo: "**"
  ---
  ```

- [ ] Run focused tests.

  Expected: FAIL for current Copilot front matter and incomplete adapter
  bootstraps.

- [ ] Update top-level and template Copilot files together.
- [ ] Update Claude and Antigravity templates with equivalent per-turn
  bootstraps.
- [ ] Keep adapter wording short and reference neutral files for details.
- [ ] Re-run focused tests.

  Expected: PASS.

---

## Task 4: Build reusable workflow conformance validation

**Files**

- Create: `src/workflow-contract/diagnostics.mjs`
- Create: `src/workflow-contract/adapters.mjs`
- Create: `src/workflow-contract/skills.mjs`
- Create: `src/workflow-contract/capabilities.mjs`
- Create: `src/workflow-contract/drift.mjs`
- Create: `src/workflow-contract/index.mjs`
- Create: `test/workflow-contract.test.mjs`
- Modify: `scripts/validate-template-packs.mjs`

**Interfaces**

```js
diagnostic({ code, path, message, severity = 'error' })

validateAdapterContracts({ root, runtimes })
validateSkillRegistry({ root })
validateCapabilityRegistry({ root })
validateOverlayDrift({ root })

validateWorkflowContract({
  root,
  runtimes,
  checkOverlayDrift = false
})
// => { ok, diagnostics }
```

`ok` is false only when at least one diagnostic has severity `error`.

**Required diagnostic codes**

- `neutral/missing-instructions`
- `router/missing-skill`
- `router/missing-registry-entry`
- `adapter/missing-neutral-reference`
- `adapter/missing-turn-intake`
- `copilot/missing-apply-to`
- `skills/invalid-registry`
- `skills/duplicate-name`
- `skills/duplicate-key`
- `skills/missing-file`
- `skills/unregistered-file`
- `capabilities/malformed-manifest`
- `capabilities/duplicate-name`
- `capabilities/unknown-attach-point`
- `overlay/content-drift`

**Steps**

- [ ] Write unit tests using temporary fixture directories for every diagnostic
  code and one fully valid fixture.
- [ ] Run:

  ```bash
  node --test test/workflow-contract.test.mjs
  ```

  Expected: FAIL because the validator modules do not exist.

- [ ] Implement diagnostic construction and deterministic sorting by
  `severity`, `code`, then `path`.
- [ ] Implement adapter checks using the explicit runtime list supplied by the
  caller.
- [ ] Implement skill checks from `registry.json` plus filesystem discovery of
  `.agents/skills/**/SKILL.md`.
- [ ] Implement capability checks from the manifest Markdown identity and attach
  point tables.
- [ ] Implement package-source versus overlay drift checks only when
  `checkOverlayDrift` is true.
- [ ] Integrate the reusable validator into template-pack validation without
  removing existing forbidden-term and required-file checks.
- [ ] Re-run unit and template tests.

  Expected: PASS.

---

## Task 5: Make the skill registry maintainable with the shipped Node toolchain

**Current gap**

`.agents/skills/registry.json` and `registry.cache.json` name Python generator
scripts that are not present in this repository.

**Files**

- Create: `scripts/sync-skill-registry.mjs`
- Create: `test/skill-registry-sync.test.mjs`
- Modify: `.agents/skills/registry.json`
- Modify: `.agents/skills/registry.cache.json`
- Modify:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/registry.json`
- Modify:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/registry.cache.json`
- Modify: `package.json`
- Modify: `.agents/skills/README.md`
- Modify:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/README.md`

**Interfaces**

```bash
node scripts/sync-skill-registry.mjs --check
node scripts/sync-skill-registry.mjs --write
```

- `--check` exits non-zero when Markdown, JSON, cache hashes, or skill files are
  inconsistent.
- `--write` regenerates derived JSON/cache files from canonical
  `.agents/skills/registry.md`, mirrors them into the installable overlay, and
  verifies byte-for-byte parity. The command does not accept an arbitrary
  runtime registry or change runtime discovery.

**Steps**

- [ ] Write tests for table parsing, duplicate detection, check-mode failure,
  deterministic output, cache hashes, and write-mode regeneration.
- [ ] Run:

  ```bash
  node --test test/skill-registry-sync.test.mjs
  ```

  Expected: FAIL because the Node sync tool does not exist.

- [ ] Parse the `Skill inventory` and `Standards/pattern skill slot` Markdown
  tables without changing the current registry format.
- [ ] Validate allowed class/loading-posture values against the registry
  documentation.
- [ ] Generate `registry.json` and SHA-256 cache data deterministically.
- [ ] Replace stale `generated_by` paths with
  `scripts/sync-skill-registry.mjs`.
- [ ] Add:

  ```json
  "check:workflow": "node scripts/sync-skill-registry.mjs --check && node scripts/validate-template-packs.mjs"
  ```

- [ ] Run write mode once, then check mode.

  Expected: both canonical and overlay artifacts are synchronized and check
  mode exits 0.

---

## Task 6: Normalize and validate capability manifests

**Files**

- Modify: `.agents/capabilities/README.md`
- Modify: `.agents/capabilities/registry.md`
- Modify: `.agents/capabilities/manifests/*.md`
- Modify:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/capabilities/README.md`
- Modify:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/capabilities/registry.md`
- Modify:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/capabilities/manifests/*.md`
- Modify: `test/workflow-contract.test.mjs`

**Steps**

- [ ] Add tests requiring every capability manifest to declare:
  - name;
  - type;
  - availability;
  - scope;
  - install mode;
  - runtime support;
  - source policy;
  - owner layer;
  - status;
  - at least one stable attach point;
  - activation rules.
- [ ] Add tests for duplicate names and attach points outside the stable
  vocabulary.
- [ ] Run the focused validator tests.

  Expected: FAIL because current manifests do not consistently include
  `runtime_support`.

- [ ] Normalize all current manifests without changing their capability
  semantics.
- [ ] Include Antigravity explicitly where a capability is cross-runtime and
  distinguish “contract supported” from “tool availability confirmed.”
- [ ] Keep install commands in `.agents/integrations/**`, not capability
  manifests.
- [ ] Mirror canonical changes into the overlay.
- [ ] Re-run focused tests and `bun run check:workflow`.

  Expected: PASS.

---

## Task 7: Upgrade `workflow-kit doctor` from presence checks to diagnostics

**Files**

- Modify: `src/doctor.mjs`
- Modify: `src/cli/commands.mjs`
- Modify: `test/doctor.test.mjs`
- Modify: `test/cli.test.mjs`

**Return contract**

```js
{
  ok,
  targetPath,
  runtimes,
  overlay,
  present,
  missing,
  diagnostics
}
```

**Steps**

- [ ] Add doctor tests covering:
  - valid all-runtime installation;
  - invalid Copilot front matter;
  - missing per-turn adapter bootstrap;
  - missing router registry entry;
  - unregistered skill;
  - malformed capability manifest;
  - Antigravity adapter failure;
  - locally modified managed file as a warning;
  - deterministic formatted diagnostic output.
- [ ] Run:

  ```bash
  node --test test/doctor.test.mjs test/cli.test.mjs
  ```

  Expected: FAIL because doctor currently checks only file presence.

- [ ] Call `validateWorkflowContract()` after the existing presence scan.
- [ ] Read `.agents/workflow-kit/install-state.json` when available and report
  checksum drift as warnings without overwriting anything.
- [ ] Format diagnostics as:

  ```text
  - [code] path: message
  ```

- [ ] Keep CLI exit code 1 for errors and 0 when only warnings exist.
- [ ] Re-run focused tests.

  Expected: PASS.

---

## Task 8: Document authoring, migration, and parity

**Files**

- Modify: `docs/adapter-authoring.md`
- Modify: `docs/migration.md`
- Modify: `docs/troubleshooting.md`
- Modify: `docs/quickstart.md`
- Modify: `.agents/memory/parity-checklist.md`
- Modify:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/memory/parity-checklist.md`
- Modify: `scripts/validate-docs.mjs`
- Modify: `test/docs.test.mjs`

**Required documentation**

- Shared `AGENTS.md` ownership for Codex and Copilot-compatible agents.
- Mandatory per-turn intake semantics.
- How to add a skill and run registry sync/check.
- How to add a capability manifest and validate attach points.
- How to interpret doctor errors versus warnings.
- Migration from old Codex-only `AGENTS.md`.
- Copilot `applyTo: "**"` correction.
- Antigravity parity expectations.
- Explicit statement that arbitrary runtime registration remains out of scope.

**Steps**

- [ ] Add documentation tests/required phrases first.
- [ ] Run:

  ```bash
  node --test test/docs.test.mjs
  ```

  Expected: FAIL for missing new guidance.

- [ ] Update documentation and parity checklist.
- [ ] Run:

  ```bash
  bun run check:docs
  node --test test/docs.test.mjs
  ```

  Expected: PASS.

---

## Task 9: Full validation and clean handoff

**Steps**

- [ ] Run focused workflow checks:

  ```bash
  bun run check:workflow
  ```

- [ ] Run repository checks:

  ```bash
  bun run check
  bun run check:templates
  bun run check:docs
  bun run test
  ```

- [ ] Run CLI smoke tests in temporary repositories for:

  ```bash
  codex_target="$(mktemp -d)"
  copilot_target="$(mktemp -d)"
  combined_target="$(mktemp -d)"
  other_target="$(mktemp -d)"

  node bin/workflow-kit.mjs init --target "$codex_target" --runtime codex --apply --yes
  node bin/workflow-kit.mjs init --target "$copilot_target" --runtime copilot --apply --yes
  node bin/workflow-kit.mjs init --target "$combined_target" --runtime codex,copilot --apply --yes
  node bin/workflow-kit.mjs init --target "$other_target" --runtime claude,antigravity --apply --yes
  node bin/workflow-kit.mjs doctor --target "$combined_target" --runtime codex,copilot
  node bin/workflow-kit.mjs doctor --target "$other_target" --runtime claude,antigravity
  ```

- [ ] Confirm:
  - no `.superpowers/` or `docs/superpowers/` exists;
  - no runtime path collisions exist;
  - canonical and overlay files match;
  - no automatic commit was created;
  - `git status --short` contains only intended implementation files.

## Completion Criteria

The work is complete when:

1. every supported runtime enforces equivalent per-turn intake;
2. trivial direct answers remain low-noise;
3. meaningful routing decisions remain observable;
4. Codex and Copilot share one root `AGENTS.md`;
5. Copilot scoped instructions contain valid front matter;
6. skill and capability extensions have deterministic validation;
7. doctor reports actionable semantic diagnostics;
8. Antigravity passes the same parity checks;
9. all checks pass without automatic commits.
