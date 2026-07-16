# Delegate Skill Matrix

Use exact paths. Do not delegate by alias alone.

This matrix is for delegated phases. It is not a mandate to use every delegate. `controlled-lite` and low-risk `controlled-implementation` may run compact preflight or implementation inline when that preserves one-writer ownership, focused validation, and context budget.

| Step | Skill | Alias | Shared skill path | Codex adapter | Copilot adapter | Writes |
| --- | --- | --- | --- | --- | --- | --- |
| PRD readiness | `prd-readiness-review` | Capitana Alcance | `.agents/skills/02-implement/prd-readiness-review/SKILL.md` | `.codex/agents/capitana-alcance.toml` | `.github/agents/capitana-alcance.agent.md` | No |
| Codebase discovery | `codebase-discovery` | Sherlock Estructura | `.agents/skills/02-implement/codebase-discovery/SKILL.md` | `.codex/agents/sherlock-estructura.toml` | `.github/agents/sherlock-estructura.agent.md` | No |
| Execution slicing | `implementation-slicing` | Arquitecta Fases | `.agents/skills/02-implement/implementation-slicing/SKILL.md` | `.codex/agents/arquitecta-fases.toml` | `.github/agents/arquitecta-fases.agent.md` | No |
| Backend implementation | `backend-phase-implementer` | Turbo Backend | `.agents/skills/02-implement/backend-phase-implementer/SKILL.md` | `.codex/agents/turbo-backend.toml` | `.github/agents/turbo-backend.agent.md` | Yes, owned backend files |
| Frontend implementation | `frontend-phase-implementer` | Pixel Ninja | `.agents/skills/02-implement/frontend-phase-implementer/SKILL.md` | `.codex/agents/pixel-ninja.toml` | `.github/agents/pixel-ninja.agent.md` | Yes, owned frontend files |
| Contract verification | `contract-verifier` | Guardia Contrato | `.agents/skills/02-implement/contract-verifier/SKILL.md` | `.codex/agents/guardia-contrato.toml` | `.github/agents/guardia-contrato.agent.md` | Tests and small owned contract fixes |
| Acceptance tests | `acceptance-test-engineer` | Testinator 5000 | `.agents/skills/02-implement/acceptance-test-engineer/SKILL.md` | `.codex/agents/testinator-5000.toml` | `.github/agents/testinator-5000.agent.md` | Tests, fixtures, assigned fixes |
| Validation | `validation-runner` | Lint Ranger | `.agents/skills/02-implement/validation-runner/SKILL.md` | `.codex/agents/lint-ranger.toml` | `.github/agents/lint-ranger.agent.md` | Assigned validation fixes only |
| Final QA | `qa-handoff-review` | QA Relampago | `.agents/skills/02-implement/qa-handoff-review/SKILL.md` | `.codex/agents/qa-relampago.toml` | `.github/agents/qa-relampago.agent.md` | No, unless explicitly assigned |

## Cavecrew Helper Delegates

Use these as secondary helpers from the main implement-prd delegates when the narrower contract is enough:

| Helper | Shared skill path | Codex adapter | Copilot adapter | Typical use |
| --- | --- | --- | --- | --- |
| `cavecrew-investigator` | `.agents/skills/05-caveman/cavecrew-investigator/SKILL.md` | `.codex/agents/cavecrew-investigator.toml` | `.github/agents/cavecrew-investigator.agent.md` | Focused symbol/path/test lookup |
| `cavecrew-builder` | `.agents/skills/05-caveman/cavecrew-builder/SKILL.md` | `.codex/agents/cavecrew-builder.toml` | `.github/agents/cavecrew-builder.agent.md` | Known 1-2 file surgical edit inside owned scope |
| `cavecrew-reviewer` | `.agents/skills/05-caveman/cavecrew-reviewer/SKILL.md` | `.codex/agents/cavecrew-reviewer.toml` | `.github/agents/cavecrew-reviewer.agent.md` | Terse diff or file bug sweep |

The primary owner skill remains accountable for the slice. Cavecrew helpers do not change ownership; they only compress a narrower subtask.

## Parallelization Rules

Good candidates for parallel work:

- Read-only readiness and discovery follow-up questions on different domains.
- Backend and frontend implementation only when API contracts are already fixed and file ownership is disjoint.
- Final QA review while the orchestrator prepares the delivery summary, if no more edits are expected.

Do not parallelize:

- Two writers on the same file.
- Frontend consuming an API shape that backend has not decided.
- Validation fixes that may alter implementation files another slice still owns.
- Destructive migrations or tenancy-sensitive work.

## Ownership Contract

Every writable delegate receives:

- Files owned.
- Files forbidden.
- Acceptance criteria.
- Validation expected.
- Handoff output format.

If ownership is unclear, stop and ask before editing.

## Delegation Efficiency Gate

Before launching any delegate, name the benefit in one short phrase:

- `risk`: independent review prevents a likely defect;
- `context`: delegate can solve with narrower context than the orchestrator;
- `ownership`: one writer owns a bounded file set;
- `validation`: delegate can run or stabilize focused checks;
- `bias`: fresh context review is materially useful.

If none apply, do the work inline in the orchestrator and record why delegation was skipped.