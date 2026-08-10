---
name: init-legacy-attachments
description: "Guided bootstrap for attaching pre-existing local skills and pattern skills that existed before workflow installation."
user-invocable: true
---

# Init Legacy Attachments

Use when the user asks to initialize, attach, or adopt local skills/patterns that
already existed in the repository before the neutral workflow was installed.

This skill is deterministic first. Use AI-assisted matching only when metadata
is incomplete or ambiguous.

## Goal

Attach pre-existing repo skills/patterns safely by:

1. discovering what already exists,
2. classifying what is already attached vs missing registry state,
3. guiding the user through explicit selection,
4. applying deterministic attach operations,
5. validating functional readiness inside the workflow.

## Inputs

- Repository root path.
- User intent and preferred scope (repo/project is default).
- Current `.agents/skills/registry.md`.
- Existing local skill files (`SKILL.md`) found in the repo.

## Deterministic-first policy

Always run this decision order:

1. Deterministic discovery and classification.
2. Deterministic attach suggestions with explicit user selection.
3. AI-assisted fallback only for unresolved metadata.

Do not start from freeform recommendations if deterministic evidence is enough.

## Functional readiness gate (mandatory)

An attached candidate is considered `working` only if all checks below pass:

1. `discoverable`: candidate appears in `.agents/skills/registry.md` and derived registry artifacts.
2. `addressable`: registered `path` exists and contains valid frontmatter with matching `name`.
3. `contract-aligned`: class/loading posture/trigger are coherent with intended use.
4. `workflow-compatible`: delegated entries identify an owning orchestrator and do not break route boundaries.
5. `behavior-smoke`: a minimal prompt-level smoke check confirms the skill can be selected/used as expected.

If any check fails, mark candidate as `not-ready` and do not report successful incorporation.

## Guided procedure

### 1) Build inventory

Collect candidates from these locations when present:

- `.agents/skills/**/SKILL.md`
- `.github/skills/**/SKILL.md`
- `.codex/skills/**/SKILL.md`
- legacy skill folders explicitly pointed by the user

Normalize each candidate as:

- physical path,
- inferred class (workflow, quality, overlay, helper, pattern),
- inferred logical name,
- inferred trigger sentence,
- inferred loading posture.

### 2) Compare against registry

Use `.agents/skills/registry.md` as canonical source. Bucket each candidate:

- `attached`: already registered with matching path.
- `path-drift`: same logical name exists but path differs.
- `unregistered-pattern`: file exists under `.agents/skills/06-patterns/**` but is missing in registry.
- `unregistered-skill`: file exists under `.agents/skills/**` and is missing in registry.
- `runtime-wrapper-only`: exists in wrapper path only (`.github/skills/**`, `.codex/skills/**`).
- `ambiguous`: missing enough metadata to register safely.

### 3) Present guided selection menu

Show one compact table grouped by bucket and ask user to choose actions per group.

Required options:

1. Attach all safe deterministic candidates.
2. Review candidate-by-candidate.
3. Attach patterns only.
4. Attach none and export report.

For candidate-by-candidate mode, ask exactly these fields:

- action: attach | skip | defer
- logical name
- trigger sentence
- loading posture
- class
- stable key

### 4) Apply deterministic attach operations

For each candidate approved as `attach`:

1. Ensure canonical placement under `.agents/skills/**`.
2. Add or update row in `.agents/skills/registry.md`.
3. If candidate is a pattern skill, register under the pattern slot table.
4. Keep runtime wrappers as adapters only; do not make wrappers canonical.
5. Regenerate artifacts with:

```bash
node scripts/sync-skill-registry.mjs --write
```

6. Mirror canonical registry artifacts to overlay through the sync script output.

### 5) AI-assisted fallback (only when needed)

Use AI only for `ambiguous` candidates after deterministic extraction fails.

AI fallback must produce at most 3 constrained proposals per candidate:

- proposed logical name,
- proposed class,
- proposed trigger,
- proposed loading posture,
- confidence.

Ask the user to select one proposal or skip. Do not auto-attach low-confidence
proposals.

### 6) Validate and report

Run:

```bash
node scripts/sync-skill-registry.mjs --check
node --test test/skill-registry-sync.test.mjs test/planner.test.mjs test/workflow-contract.test.mjs
```

Then run per-candidate readiness checks:

1. Registry presence and exact path mapping.
2. Frontmatter `name` parity with registry `name`.
3. Class/loading posture sanity:
	- pattern skill under `.agents/skills/06-patterns/**`;
	- delegated entry declares owning orchestrator in runtime notes;
	- startup-minimal only for direct-routing set.
4. Behavioral smoke by candidate type:
	- explicit/overlay/helper: trigger prompt should select/invoke the skill path coherently.
	- delegated-only: parent orchestrator flow should still reference and constrain delegation correctly.
	- standards/pattern: one sample slice contract should resolve to the skill path without ambiguity.

Minimum behavioral smoke evidence format:

- candidate key
- smoke prompt used
- expected route/selection
- observed route/selection
- verdict: pass | fail

Report:

- attached count,
- skipped count,
- deferred count,
- ambiguous unresolved count,
- ready count,
- not-ready count,
- any validation failures with exact file references.

## Deterministic tie-break rules

When multiple deterministic mappings are possible:

1. Prefer canonical `.agents/skills/**` path over wrapper paths.
2. Prefer existing registry key conventions over new key shapes.
3. Prefer narrow trigger language over generic trigger language.
4. Prefer `Explicit-only` posture unless evidence clearly requires another posture.

## Stop conditions

Stop and ask before writing when:

- logical name conflicts with an existing registry row and resolution is unclear,
- class cannot be inferred with acceptable confidence,
- requested operation would overwrite canonical workflow skills,
- behavior-smoke fails for a candidate and no deterministic fix is obvious,
- user asks to auto-install external capabilities (route to integrations policy first).

## Out of scope

- Installing external capabilities directly.
- Rewriting workflow-router policy unrelated to attachment.
- Editing product/business code.
