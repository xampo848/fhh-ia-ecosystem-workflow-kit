# Quality Bar, Iteration, Future Scope, and Anti-Patterns

Part of [SKILL.md](../SKILL.md). Read it after each round of answers and before delivering the PRD.

## 🎯 Output Quality Bar

The final PRD must read like a repository-native planning artifact, not a generic requirements dump.

- The opening context should explain the real problem, why it matters now, and the strict scope boundary in concrete terms.
- Current-state tables should name actual repo artifacts, not placeholders, whenever the exploration phase found them.
- Requirement sections should state confirmed behavior, not hedged guesses.
- Phase plans should feel implementable by `implement-prd` without inventing missing behavior, validation, or ownership boundaries.
- Risks, future scope, and open questions should be specific enough that a reviewer can challenge them.
- The document should be as short as the scope allows, but never so compressed that acceptance, sequencing, or evidence become ambiguous.

## 🔄 Iteration Rules

After the user answers any round of questions:

1. **Immediately update** the PRD sections affected by the answer.
2. **Mark answered questions** as resolved in the "Decisiones Tomadas" table.
3. **Remove** any content in "Preguntas Abiertas" that is now resolved.
4. **Check** if the answer revealed new ambiguities — if so, ask a second round.
5. **Confirm** when the document reaches zero open questions.

---

### Phase 5: Self-Audit and Hardening

Load and execute [reference/self-audit.md](reference/self-audit.md). This is a hard gate; persist its required artifact and final readiness declaration before delivering the PRD.

## Future Scope

Product future scope remains out of the current PRD. Workflow reuse of `.ai-work/<prd-slug>/orchestration.md` is now in scope:

- `implement-prd` must read `## Calibration`, `## Pattern Lock`, and `## Self-Audit` when those sections exist.
- `implementation-slicing` must use `touched_surfaces` from `## Calibration` to detect scope expansion.
- `qa-handoff-review` must reconcile `## Self-Audit` residual risks before allowing `ready_to_close: yes`.
- Missing `.ai-work/<prd-slug>/orchestration.md` is allowed only for historical PRDs created before this model.

## ⚠️ Anti-Patterns

- Writing the full PRD before asking questions — **always explore + ask first**
- Mixing implementation phases with future scope in the same section
- Leaving "TBD" or "to confirm" inline in requirement tables
- Silently redefining a non-negotiable invariant inherited from a parent epic
- Inverting a parent epic's locked live path or phase-cut sequence without an approved change request
- Delivering a visible-UI PRD whose screen `implement-prd` would still have to invent
- Treating a mockup or photo as the visual contract instead of locking density, hierarchy, primary action, and UI states
- Using Spanish names for code identifiers
- Describing UI changes in an importer-only PRD (they belong in a separate PRD)
- Assuming a feature flag is not needed — **always ask**
- Vague business rules like "divide as needed" — rules must be deterministic and complete
- Forgetting backward compatibility requirements (files without new columns must still import)
- Ignoring bounded contexts or DDD ownership.
- Creating root-level models for bounded-context concepts.
- Omitting multi-tenancy rules.
- Omitting lifecycle rules for stateful entities.
- Recreating deleted legacy models accidentally.
- Using a test framework other than the project's in new PRDs.
- Using ad-hoc enums instead of the project's enumeration convention.
- Using inconsistent table naming strategies.
- Treating “phase” and “execution slice” as synonyms.
- Delivering a PRD with acceptance criteria but no explicit Casos de Uso, Estrategia de Tests, or Matriz de Edge Cases tables.
- Leaving an acceptance criterion, use case, or mandatory edge-case category unmapped without an explicit justification.
- Creating only two or three large phases whose tasks still span multiple contracts or risks.
- Adding arbitrary phases instead of splitting work at failure, ownership, contract, or validation boundaries.
- Deferring tests, lint, contract checks, or quality review until the end of the PRD.
- Writing vague tasks such as “implement backend”, “add UI”, or “test everything”.
- Omitting the Mermaid class diagram or replacing it with a flowchart.
```
