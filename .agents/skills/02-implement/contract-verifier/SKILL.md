---
name: contract-verifier
description: "Delegate-only skill for implement-prd. Alias: Guardia Contrato. Verifies backend and frontend API contracts in FHH IA Ecosystem, including serializers, controller responses, hooks, query payloads, tests, empty states, and data-shape mismatches. Use whenever backend responses feed frontend behavior."
---

# Contract Verifier

Alias: Guardia Contrato.

Use after backend or frontend slices that add or change API data. In Codex, invoke through `.codex/agents/guardia-contrato.toml`. In GitHub Copilot, invoke through `runSubagent`. In other agents, run inline when delegation is unavailable. This skill may edit tests and small contract fixes only when the orchestrator grants explicit ownership.

## Mission

Prove that the backend response shape and frontend consumption shape match. Do not accept "empty state works" until the data source has been checked.

## Inputs From Orchestrator

- API endpoints, serializers, hooks, and components involved.
- Expected payload fields from the PRD.
- Files owned for contract tests or small fixes.
- Positive and empty/error scenarios to verify.
- Matcher output: `required_pattern_skills`, `optional_capabilities`, `fallback_docs`, `validation_hooks`, `handoff_required_fields`, `match_confidence`, `blocked_reason`.

## Must Read

- `.github/copilot-instructions.md`
- Backend and frontend instructions when both sides are touched.
- Exact matcher-selected `required_pattern_skills` paths when present.
- Matcher-selected `fallback_docs` when required pattern skills are absent.
- Related serializer/controller tests.
- Related frontend API module, hook, and component tests.

## Procedure

1. Read every matcher-selected required pattern skill path before verifying the contract. If a required path is missing, return `blocked`.
2. If no required pattern skill exists, read the matcher-selected fallback docs and record which were used.
3. Locate the backend source of truth: controller, serializer, service result, and test.
4. Locate the frontend consumer: API module, query hook, transform, component, and test.
5. Record whether any matcher-suggested optional capability was actually used and whether it was active.
6. Compare field names, nesting, nullability, enum values, IDs, timestamps, arrays, and error shapes.
7. Verify authorization and organization scoping for the endpoint.
8. Add or update backend contract tests for new or changed response fields.
9. Add or update frontend tests with realistic payloads, not hand-wavy minimal objects.
10. Include one representative positive-data scenario and one empty/error scenario when relevant.
11. Preserve matcher validation hooks when they affect contract evidence.
12. If local data exists, use a read-only query or runner command before concluding no records exist.

## Stop And Ask When

- Backend and frontend disagree and the PRD does not define the canonical shape.
- Fixing the contract requires a public API change outside scope.
- Empty state depends on uncertain production data assumptions.

## Handoff Output

Return exactly the TOON schema defined in `.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md` for `guardia-contrato`.
