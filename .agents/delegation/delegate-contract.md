# Delegate Contract

Single source of the rules for any delegate launched by an orchestrator
(`implement-change` roles and helpers). A delegate reads this file instead of
`.agents/instructions.md` or `workflow-router`: it executes a bounded slice and
never routes. Runtime adapters carry the generated summary below.

<!-- delegate-contract:summary:start -->
Delegate contract (summary of `.agents/delegation/delegate-contract.md`):

- Do not route: no intake, readiness, discovery, slicing, matching, or router selection beyond your role.
- Read only your role `SKILL.md`, the slice lock (owned and forbidden files, criteria, required reads), layer instructions for the layers you touch, the quality gate if you write code, and the relevant part of `.agents/project-context.md`. Do not read `.agents/instructions.md` or `workflow-router`.
- Edit only explicitly owned files; one writer per file.
- Brakes: at most 2 repair rounds per slice, one recovery attempt for an environment failure, one rerun for a flaky test.
- Return a compact handoff: the return envelope, status, evidence (command, result, log path), and details only for findings and blockers.
- If something is not covered (scope change, route decision, installation, missing information), stop and return `blocked` to the orchestrator. Never improvise.
<!-- delegate-contract:summary:end -->

## Rules

1. **No routing.** The orchestrator performs intake, readiness, discovery,
   slicing, and matching for a delegated slice. A delegate executes that
   bounded slice; it must not restart those parent stages or recursively
   reroute the same request.
2. **Required reads.** A new delegate reads its complete required skill, applicable instructions,
   and the source that controls the assigned change. A parent summary or a path
   mention is not evidence that this content was received. "Applicable
   instructions" means: this contract, the layer instructions for the layers
   the slice touches, the quality gate for code-writing roles, and the relevant
   section of `.agents/project-context.md`.
3. **Observable reuse.** Reuse pre-injected content only when the runtime makes the complete content,
   its provenance, and its current freshness observable. In that case, record
   the provenance and do not re-read the identical source.
4. **Resume.** A resumed delegate revalidates the relevant delta and affected dependencies
   before reusing prior context. Irrelevant changes do not invalidate context;
   a changed dependency or contract requires a directed revalidation.
5. **Bounded input.** Required input is the role-relevant subset: owned files,
   the PRD index entries and sections for the slice, required reads, selected
   patterns, focused checks, and open questions. A delegate may ask for one PRD
   section by its reference; nobody re-pastes the full PRD, tracker, or
   unrelated agent matrix.
6. **Unknown is not permission.** `unknown` is a record of unavailable evidence, not permission to assume
   freshness, injected content, runtime capability, or a completed control.
7. **Bounded output and tools.** No raw dumps, no full logs, no broad
   repository or web searches as a first step; prefer narrow queries and
   summarize large tool output.
8. **No installs.** Never install or attach a capability without the user's
   confirmation.
9. **No model claims.** Never claim a model switch the runtime did not confirm.
10. **Plain prose for risk.** Do not use compressed output for security
    warnings, irreversible actions, or residual risks.
11. **Neutral contract wins.** If a runtime adapter contradicts this contract
    or the role skill, the neutral files win; report the conflict.
12. **File boundaries.** Edit only explicitly owned files; one writer per file.
    A fix outside the ownership boundary is a stop, not a judgment call.
13. **Brakes.** At most 2 repair rounds per slice, one recovery attempt for an
    environment failure, one rerun for a flaky test
    (`.agents/skills/02-implement/implement-prd/reference/validation-and-stop-conditions.md`).
14. **Compact handoff.** Follow the Compact Handoff Rules in
    `.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md`.
15. **Escape rule.** When something is not covered by this contract and the
    role skill (changing scope, deciding a route, installing something, missing
    information), stop and return `blocked` to the orchestrator with what is
    missing. Never open `.agents/instructions.md` or the router to decide.
