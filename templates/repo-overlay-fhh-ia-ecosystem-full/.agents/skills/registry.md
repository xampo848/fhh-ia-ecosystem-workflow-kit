# Neutral skill registry

This file is the neutral registry for AI-executable skills in FHH IA Ecosystem.

It is intentionally a lightweight Markdown registry. It records discovery and
loading metadata only; it does **not** copy full skill algorithms. Agents must
open the referenced `SKILL.md` only when the trigger and loading posture match.

## Purpose

The registry answers four questions:

1. Which skills exist?
2. Where is each skill physically stored canonically?
3. When should an agent load the full `SKILL.md`?
4. Which skills are workflow controllers, delegated implementation skills,
   standards/pattern procedures, quality checks, overlays, or helper modes?

## Registry fields

| Field | Meaning | Required now? | Future structured key |
| --- | --- | --- | --- |
| Skill name | Stable user/runtime-facing skill name | Yes | `name` |
| Class | Primary classification for routing and ownership | Yes | `class` |
| Physical path | Canonical `.agents/skills/**/SKILL.md` path | Yes | `path` |
| Trigger | When to load the full `SKILL.md` | Yes | `trigger` |
| Loading posture | Startup-minimal, explicit-only, just-in-time, delegated-only, overlay, or helper/mode | Yes | `loading_posture` |
| Cost hint | Advisory lean/balanced/premium hint when already established by existing docs | Optional | `cost_hint` |
| Runtime notes | Runtime/delegation notes that do not redefine the skill algorithm | Optional | `runtime_notes` |
| Future structured key | Stable slug for a later YAML/JSON/TOML registry | Yes | `key` |

## Loading postures

| Loading posture | Contract |
| --- | --- |
| Startup-minimal | Mention in startup docs or registry summary only; do not load the full skill body by default. |
| Explicit-only | Load when the user names the skill, command, or clearly requests its capability. |
| Just-in-time | Load when the active workflow reaches the relevant surface or quality gate. |
| Delegated-only | Load only from the owning orchestrator or subagent handoff with explicit ownership. |
| Overlay | May supplement another workflow when triggered; does not replace the primary workflow unless the skill says so. |
| Helper/mode | Narrow communication, compression, or helper output mode; load only for that command/mode. |

## Class vocabulary

| Class | Definition |
| --- | --- |
| Workflow | Owns sequence, gates, artifacts, and stop/continue decisions. |
| Product sub-workflow | Product-thinking workflow below or alongside `product-studio`. |
| Delegate-only implementation | Used inside `implement-prd` or a specific orchestrator with explicit ownership. |
| Quality/validation | Specialized validation, testing, contract, or QA procedure. |
| Cross-cutting overlay | Supplements a primary workflow when the trigger applies. |
| Mode/helper | Alters communication style or creates narrow helper artifacts. |
| Standards/pattern | AI-executable repeatable procedure for a technical pattern. |

## Pattern skill contract

Repo-owned implementation pattern skills live under:

```text
.agents/skills/06-patterns/<domain>/<skill>/SKILL.md
```

The authoring and slice metadata contract for those skills lives in:

```text
.agents/skills/06-patterns/README.md
```

Use that contract when a PRD, slice plan, matcher, implementer, validator, or
review handoff needs to declare:

- `required_pattern_skills`
- `optional_capabilities`
- `fallback_docs`
- `validation_hooks`
- `handoff_required_fields`

Boundary rules:

1. Required pattern skills must reference exact `SKILL.md` paths.
2. Optional capabilities remain governed by `.agents/integrations/README.md`
   and `.agents/capabilities/**`; they are not registry-owned skills.
3. Fallback docs may point to `docs/patterns/**`, standards, or architecture
   docs when a pattern skill does not exist yet.
4. Pattern skills are loaded just-in-time, not at startup.

## Integration boundary

Integrations/plugins/tools are not skills. This registry may mention that a skill
uses an external capability, but install/attach policy, source policy,
confirmation policy, and capability lifecycle live in
`.agents/integrations/README.md`.

If a user asks to install, attach, list, discover, or recommend a capability,
load `.agents/integrations/README.md` instead of treating the capability as a
skill registry entry.

## Physical skill ownership

The canonical taxonomy, registry, and repo-owned skill bodies live under `.agents/skills/**`. The logical skill identity stays stable even if runtime adapters expose compatibility symlinks such as `.github/skills/**` or `.codex/skills/**`.

Derived structured artifacts for automation live at `.agents/skills/registry.json`
and `.agents/skills/registry.schema.json`, but `.agents/skills/registry.md`
remains canonical in this phase.

YAML/JSON/TOML tooling, automatic skill matching, telemetry, model routing v2, and portable packaging remain out of scope for this registry file.

## Authoring rules

When adding or changing a skill, update this registry if any of these change:

- skill name;
- physical path;
- primary class;
- trigger;
- loading posture;
- delegation status;
- external capability dependency;
- future structured key.

Rules:

1. A skill has one stable logical name.
2. A skill has exactly one primary class; secondary tags may appear in notes.
3. Trigger text must be narrow enough to prevent accidental broad loading.
4. Delegate-only skills must identify the owning orchestrator.
5. Runtime notes must not redefine the skill algorithm.
6. External capability requirements must link to `.agents/integrations/README.md`
   instead of embedding install or attach instructions here.

## Skill inventory

| Skill name | Class | Physical path | Trigger | Loading posture | Cost hint | Future structured key | Runtime notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `workflow-router` | Workflow | `.agents/skills/00-router/workflow-router/SKILL.md` | Freeform non-trivial request without explicit skill | Startup-minimal | lean | `workflow-router` | Default entrypoint; load full skill only when routing is needed. |
| `product-studio` | Workflow | `.agents/skills/01-product/product-studio/SKILL.md` | Product strategy, discovery, JTBD, prioritization, roadmap, or deciding what should exist | Explicit-only | balanced | `product-studio` | May route to product sub-workflows. |
| `create-epic` | Workflow | `.agents/skills/01-product/create-epic/SKILL.md` | Large initiative needing research, appetite, phases, or multiple PRDs | Explicit-only | balanced | `create-epic` | Use before PRD queue creation. |
| `create-prd` | Workflow | `.agents/skills/01-product/create-prd/SKILL.md` | Feature/ticket/spec needs formal PRD before implementation | Explicit-only | balanced | `create-prd` | Expected predecessor to `implement-prd`. |
| `generate-pm-ticket` | Workflow | `.agents/skills/01-product/generate-pm-ticket/SKILL.md` | User needs a backlog/Jira-style ticket rather than full PRD | Explicit-only | lean | `generate-pm-ticket` | Smaller planning artifact than PRD. |
| `discovery-process` | Product sub-workflow | `.agents/skills/01-product/product-studio/discovery-process/SKILL.md` | Product discovery cycle from hypothesis to experiments | Just-in-time | balanced | `discovery-process` | Usually loaded by `product-studio`. |
| `jobs-to-be-done` | Product sub-workflow | `.agents/skills/01-product/product-studio/jobs-to-be-done/SKILL.md` | Clarify customer jobs, pains, and gains | Just-in-time | balanced | `jobs-to-be-done` | Usually loaded by `product-studio`. |
| `prioritization-advisor` | Product sub-workflow | `.agents/skills/01-product/product-studio/prioritization-advisor/SKILL.md` | Choose prioritization framework or scoring approach | Just-in-time | lean | `prioritization-advisor` | Usually loaded by `product-studio`. |
| `product-strategy-session` | Product sub-workflow | `.agents/skills/01-product/product-studio/product-strategy-session/SKILL.md` | End-to-end product strategy across positioning/discovery/roadmap | Just-in-time | balanced | `product-strategy-session` | Usually loaded by `product-studio`. |
| `roadmap-planning` | Product sub-workflow | `.agents/skills/01-product/product-studio/roadmap-planning/SKILL.md` | Turn strategy into roadmap or release sequence | Just-in-time | balanced | `roadmap-planning` | Usually loaded by `product-studio`. |
| `user-story` | Product sub-workflow | `.agents/skills/01-product/product-studio/user-story/SKILL.md` | Convert needs into user stories and Gherkin acceptance criteria | Just-in-time | lean | `user-story` | Usually loaded by `product-studio`. |
| `workshop-facilitation` | Product sub-workflow | `.agents/skills/01-product/product-studio/workshop-facilitation/SKILL.md` | PM workflow needs one-question-at-a-time facilitation | Just-in-time | lean | `workshop-facilitation` | Shared facilitation protocol. |
| `implement-prd` | Workflow | `.agents/skills/02-implement/implement-prd/SKILL.md` | Approved PRD needs implementation | Explicit-only | balanced | `implement-prd` | Orchestrator for delegate-only implementation skills. |
| `prd-readiness-review` | Delegate-only implementation | `.agents/skills/02-implement/prd-readiness-review/SKILL.md` | `implement-prd` needs readiness/go-stop review | Delegated-only | lean | `prd-readiness-review` | Owned by `implement-prd`. |
| `codebase-discovery` | Delegate-only implementation | `.agents/skills/02-implement/codebase-discovery/SKILL.md` | `implement-prd` needs targeted codebase discovery | Delegated-only | balanced | `codebase-discovery` | Owned by `implement-prd`. |
| `implementation-slicing` | Delegate-only implementation | `.agents/skills/02-implement/implementation-slicing/SKILL.md` | `implement-prd` needs executable slice plan | Delegated-only | balanced | `implementation-slicing` | Owned by `implement-prd`. |
| `implementation-skill-matcher` | Delegate-only implementation | `.agents/skills/02-implement/implementation-skill-matcher/SKILL.md` | `implement-prd` needs slice-to-pattern-skill matching after slicing and before coding | Delegated-only | balanced | `implementation-skill-matcher` | Owned by `implement-prd`; classifies reusable knowledge/capabilities without changing slice ownership. |
| `backend-phase-implementer` | Delegate-only implementation | `.agents/skills/02-implement/backend-phase-implementer/SKILL.md` | Backend slice assigned by implementation plan | Delegated-only | balanced | `backend-phase-implementer` | Owned by `implement-prd`; writes assigned backend files only. |
| `frontend-phase-implementer` | Delegate-only implementation | `.agents/skills/02-implement/frontend-phase-implementer/SKILL.md` | Frontend slice assigned by implementation plan | Delegated-only | balanced | `frontend-phase-implementer` | Owned by `implement-prd`; writes assigned frontend files only. |
| `acceptance-test-engineer` | Delegate-only implementation | `.agents/skills/02-implement/acceptance-test-engineer/SKILL.md` | Acceptance criteria require focused tests | Delegated-only | lean | `acceptance-test-engineer` | Owned by `implement-prd`. |
| `contract-verifier` | Quality/validation | `.agents/skills/02-implement/contract-verifier/SKILL.md` | Backend response feeds frontend or API contract changes | Just-in-time | lean | `contract-verifier` | Bridges quality validation and standards/pattern procedure. |
| `validation-runner` | Delegate-only implementation | `.agents/skills/02-implement/validation-runner/SKILL.md` | `implement-prd` needs focused validation/failure triage | Delegated-only | lean | `validation-runner` | Owned by `implement-prd`. |
| `qa-handoff-review` | Delegate-only implementation | `.agents/skills/02-implement/qa-handoff-review/SKILL.md` | Final fresh-context QA is required for implementation handoff | Delegated-only | balanced | `qa-handoff-review` | Owned by `implement-prd`. |
| `document-development` | Workflow | `.agents/skills/03-quality/document-development/SKILL.md` | Feature/system is complete and needs durable internal documentation | Explicit-only | lean | `document-development` | Expected after substantial delivered changes. |
| `playwright-testing` | Quality/validation | `.agents/skills/03-quality/playwright-testing/SKILL.md` | User asks for Playwright tests or E2E validation is required | Just-in-time | balanced | `playwright-testing` | Stack-gated: only for navigable UI flows with explicit/required E2E intent; requires Playwright tooling if used. |
| `react-doctor` | Quality/validation | `.agents/skills/03-quality/react-doctor/SKILL.md` | Meaningful React changes need post-change audit | Just-in-time | balanced | `react-doctor` | Stack-gated: only when React surface is present; command/tool availability follows runtime policy. |
| `engineering-mentor` | Cross-cutting overlay | `.agents/skills/04-crosscutting/engineering-mentor/SKILL.md` | Task benefits from teaching, challenge, and better engineering judgment | Overlay | balanced | `engineering-mentor` | Overlay only; does not replace primary workflow. |
| `frontend-design` | Cross-cutting overlay | `.agents/skills/04-crosscutting/frontend-design/SKILL.md` | Need early visual direction or aesthetic shaping | Overlay | lean | `frontend-design` | Usually before frontend implementation. |
| `impeccable` | Cross-cutting overlay | `.agents/skills/04-crosscutting/impeccable/SKILL.md` | UI/design craft, audit, polish, redesign, live visual iteration | Overlay | balanced | `impeccable` | May use external design tooling; see integrations contract for install/attach requests. |
| `pr-comments-resolution` | Cross-cutting overlay | `.agents/skills/04-crosscutting/pr-comments-resolution/SKILL.md` | Resolve or review PR comments in an orderly way | Overlay | balanced | `pr-comments-resolution` | GitHub tooling availability is runtime-specific. |
| `cavecrew` | Mode/helper | `.agents/skills/05-caveman/cavecrew/SKILL.md` | User asks to delegate to cavecrew or use caveman-compressed subagents | Explicit-only | lean | `cavecrew` | Decision guide for cavecrew helpers. |
| `cavecrew-investigator` | Mode/helper | `.agents/skills/05-caveman/cavecrew-investigator/SKILL.md` | Need compressed read-only code location or pattern lookup | Delegated-only | lean | `cavecrew-investigator` | Helper delegate; no writes. |
| `cavecrew-builder` | Mode/helper | `.agents/skills/05-caveman/cavecrew-builder/SKILL.md` | Need surgical 1-2 file mechanical edit with known scope | Delegated-only | lean | `cavecrew-builder` | Helper delegate; bounded writes only. |
| `cavecrew-reviewer` | Mode/helper | `.agents/skills/05-caveman/cavecrew-reviewer/SKILL.md` | Need terse diff/file review | Delegated-only | lean | `cavecrew-reviewer` | Helper delegate; review only unless assigned otherwise. |
| `caveman` | Mode/helper | `.agents/skills/05-caveman/caveman/SKILL.md` | User asks for caveman mode/less tokens, or installed runtime selects quality-preserving token-saving mode | Helper/mode | lean | `caveman` | External optional communication capability; use only when clarity is preserved. |
| `caveman-commit` | Mode/helper | `.agents/skills/05-caveman/caveman-commit/SKILL.md` | User asks for commit message or staging/commit helper output | Helper/mode | lean | `caveman-commit` | Conventional commit helper. |
| `caveman-compress` | Mode/helper | `.agents/skills/05-caveman/caveman-compress/SKILL.md` | User asks to compress a memory/instruction file | Helper/mode | lean | `caveman-compress` | Rewrites target memory file and creates backup per skill. |
| `caveman-help` | Mode/helper | `.agents/skills/05-caveman/caveman-help/SKILL.md` | User asks for caveman help or command reference | Helper/mode | lean | `caveman-help` | One-shot help. |
| `caveman-review` | Mode/helper | `.agents/skills/05-caveman/caveman-review/SKILL.md` | User asks for compressed PR/code review comments | Helper/mode | lean | `caveman-review` | Review format helper. |
| `caveman-stats` | Mode/helper | `.agents/skills/05-caveman/caveman-stats/SKILL.md` | User invokes `/caveman-stats` for real token usage stats | Helper/mode | lean | `caveman-stats` | Depends on session log/hook availability. |

## Standards/pattern skill slot

The registry is ready for dedicated standards/pattern skills under
`.agents/skills/06-patterns/**`, such as importer, serializer, API contract,
validator, empty-state, feature-flag, tenant-safe-data-access, or data-backfill
procedures.

Current repo-owned v1 pattern skills:

| Skill name | Class | Physical path | Trigger | Loading posture | Cost hint | Future structured key | Runtime notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `add-project-pattern` | Standards/pattern | `.agents/skills/06-patterns/authoring/add-project-pattern/SKILL.md` | User asks to create/register project-specific pattern skills in repo overlay | Explicit-only | lean | `pattern-authoring-add-project-pattern` | Bootstrap helper for local pattern authoring and registry sync. |

Human docs in `docs/patterns/**` remain references and fallback docs when a
pattern skill is insufficient or a narrower repo-owned skill does not exist yet.
