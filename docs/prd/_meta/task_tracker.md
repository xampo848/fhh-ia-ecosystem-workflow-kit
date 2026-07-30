# task_tracker
prd: docs/prd/runtime-routing-hardening/2026-07-29-project-formation-router-parity/project-formation-router-parity.md
mode: controlled-implementation
started: 2026-07-29
quality_gate: docs/standards/CODE_QUALITY.md
validation_commands[6]: bun run check:docs
validation_commands[6]: node --test test/turn-routing-contract.test.mjs
validation_commands[6]: node --test test/skill-registry-sync.test.mjs test/workflow-contract.test.mjs test/planner.test.mjs
validation_commands[6]: bun run check:workflow
validation_commands[6]: bun run check:legal
validation_commands[6]: bun run test
loaded_docs[4]: .github/copilot-instructions.md
loaded_docs[4]: .agents/skills/02-implement/implement-prd/SKILL.md
loaded_docs[4]: docs/prd/runtime-routing-hardening/2026-07-29-project-formation-router-parity/project-formation-router-parity.md
loaded_docs[4]: .agents/skills/02-implement/implement-prd/reference/task-tracker-template.md
required_instructions[2]: .agents/instructions.md
required_instructions[2]: .github/copilot-instructions.md

# acceptance_criteria
ac[8]{id,description,status,evidence}:
  AC-1,Antigravity y Copilot enrutan prompts no triviales sin bypass del router,VERIFIED,node --test test/turn-routing-contract.test.mjs and node --test test/workflow-contract.test.mjs
  AC-2,project-formation sigue siendo la ruta recomendada para shaping integral,VERIFIED,node --test test/turn-routing-contract.test.mjs
  AC-3,create-prd explícito no se colapsa a project-formation,VERIFIED,node --test test/turn-routing-contract.test.mjs test/workflow-contract.test.mjs
  AC-4,Copilot re-enruta en follow-up turns no triviales,VERIFIED,node --test test/turn-routing-contract.test.mjs
  AC-5,artefactos de registry y overlay quedan sincronizados o fallan,VERIFIED,bun run check:workflow
  AC-6,skills locales no registradas fallan explícitamente en validación,VERIFIED,node --test test/planner.test.mjs test/workflow-contract.test.mjs
  AC-7,Antigravity expresa garantías suficientes sin redefinir workflow logic,VERIFIED,node --test test/doctor.test.mjs test/turn-routing-contract.test.mjs
  AC-8,la versión queda con evidencia de checks de release relevantes,VERIFIED,bun run check:release and bun run test

# phases
phases[9]{name,status,evidence}:
  Phase 0 - Readiness,VERIFIED,PRD loaded and mode classified as controlled-implementation
  Phase 1 - Discovery,VERIFIED,Baseline files and routing tests reviewed before edits
  Phase 2 - Slicing,VERIFIED,Implementation split into runtime parity, tests, registry docs, registry validation, final checks
  Phase 3 - Matcher,VERIFIED,No extra pattern skill matching needed; one-writer contract/docs/tests scope
  Phase 4 - Implementation,VERIFIED,Antigravity adapter parity plus registry merge refresh and release docs were implemented
  Phase 5 - Contract Verification,VERIFIED,Runtime adapter validator now checks Copilot and Antigravity routing guarantees
  Phase 6 - Validation,VERIFIED,Focal suites plus bun run check:workflow and bun run check:release passed
  Phase 7 - QA,VERIFIED,bun run check:docs and bun run check:legal passed
  Phase 8 - Closure,VERIFIED,bun run test passed with 115/115 tests after version bump

# slices
slices[5]{name,owner,files_owned,status,ac_covered}:
  antigravity-runtime-parity,inline,ANTIGRAVITY.md|templates/runtime-adapters/antigravity/ANTIGRAVITY.md,VERIFIED,AC-1|AC-7
  runtime-contract-tests,inline,test/turn-routing-contract.test.mjs|test/workflow-contract.test.mjs|src/workflow-contract/adapters.mjs|test/doctor.test.mjs,VERIFIED,AC-1|AC-2|AC-3|AC-4|AC-7
  registry-runbook,inline,docs/workflow/runbooks/update-skill-registry.md|docs/release-plan.md,VERIFIED,AC-5|AC-8
  registry-validation-hardening,inline,src/planner.mjs|test/planner.test.mjs,VERIFIED,AC-5|AC-6
  release-validation,inline,package.json|repo-root,VERIFIED,AC-8

# open_risks
open_risks[2]: Antigravity may not support every conversational affordance that Copilot wrappers describe; parity must stay at observable contract level.
open_risks[2]: Registry Markdown is preserved on install while registry.json is merged; hardening must not break existing non-destructive install behavior.

# handoff_log
handoff_log[1]{phase,agent,timestamp,status,notes}:
  Discovery,inline,2026-07-29T00:00:00Z,VERIFIED,Baseline routing and registry surfaces reviewed; no subagents used by design
handoff_log[5]{phase,agent,timestamp,status,notes}:
  Implementation,inline,2026-07-29T00:15:00Z,VERIFIED,Antigravity runtime adapter and mirror now declare visible trace rerouting execution gate and project-formation continuity
  Validation,inline,2026-07-29T00:20:00Z,VERIFIED,turn-routing contract tests passed after Antigravity parity edit
  Implementation,inline,2026-07-29T00:30:00Z,VERIFIED,registry install merge now refreshes toolkit-owned entries while preserving custom entries
  Contract Verification,inline,2026-07-29T00:40:00Z,VERIFIED,doctor and workflow-contract checks now detect missing routing guarantees in Antigravity and Copilot wrappers
  Closure,inline,2026-07-29T00:55:00Z,VERIFIED,release gate and full test suite passed after bumping version to 0.7.16-router-parity