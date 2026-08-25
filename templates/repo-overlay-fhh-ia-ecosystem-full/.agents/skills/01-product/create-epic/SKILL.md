---
name: create-epic
description: Create a formal epic or project research document before individual PRDs, shaped by the user's appetite instead of a fixed delivery window. Use when Codex must investigate a large feature, initiative, or product area; combine web research, codebase discovery, architecture review, business rules, user flows, risks, UX/data/API implications, and phased delivery planning; lock the live production path and a concrete phase cut with the user before writing the PRD queue when current behavior must coexist with a replacement; then produce an epic where each phase flows through create-prd, implement-prd, and document-development.
---

# Create Epic

Use this skill to turn a broad opportunity, feature idea, business need, or ambiguous project into a professional epic that can feed multiple focused PRDs.

The output is not a PRD. It is the parent project definition and investigation artifact: strategic context, discovered constraints, business rules, user flow, technical architecture, delivery slices, risks, and a recommended sequence of PRDs shaped by the project's appetite.

## Core Rules

- Research before drafting. Use local code/docs first. Use web research only when the epic depends on a vendor, regulation, public standard, or other external constraint, or when the user explicitly asks for it.
- Write the epic with the depth of `docs/internal-documentation/business-metrics/value-stream-business-metrics.md`: business narrative first, technical architecture second, sources and files in annexes.
- Shape committed delivery around an explicit appetite. The appetite is the investment boundary; scope is variable.
- Do not invent implementation certainty. Separate evidence, inference, assumptions, and open questions.
- Prefer slices that can become standalone `create-prd` inputs and later close with `document-development`.
- Record non-negotiable epic invariants with stable IDs, owners, and rationale so child PRDs cannot silently contradict them.
- Create a companion ledger file `docs/epics/<feature-or-project>/<slug>-ledger.md` alongside the epic, seeded with one pending row per invariant and one pending row per PRD in the queue. `document-development` updates this ledger at each child PRD's closure; it is not optional and does not depend on the user asking for a status update. Do not mark the epic `Completado` until every invariant row reads `Cumplido` or `Cumplido con excepcion aprobada`.
- Ask targeted questions after initial discovery. Ask before writing the phase table when the live path, cycle fit, or an unresolved business rule would change the cut. Do not wait until the draft exists to lock that cut.
- Load [../shared/critical-stance.md](../shared/critical-stance.md). Before recording an epic invariant, appetite boundary, live-path/cut decision, or business rule as final, challenge it directly — state the discarded alternative and why, whether the idea came from the user or from the AI's own draft.
- Do not modify product code while creating the epic unless the user explicitly asks.
- Save the final epic to `docs/epics/<feature-or-project>/<slug>.md` by default when the user asks to create a project artifact.
- If a file already exists at this path, ask the user whether to overwrite, version, or merge before saving.

## Reference Files

- `references/epic-template.md` - final epic structure.
- `references/research-playbook.md` - research lenses, source strategy, and external references to use when shaping an epic.

## Discovery Workflow

### 1. Frame the Request

Extract:

- User/business problem
- Target users and impacted roles
- Desired outcome or metric
- Appetite: the amount of time/effort the team is willing to invest, such as a small bet, medium bet, large bet, one cycle, or multi-cycle initiative
- Known constraints, deadlines, integrations, or stakeholders
- Expected artifact: inline brief, saved Markdown epic, or both

If the scope is too broad for the stated appetite, shape a smaller valuable version and place the rest in later bets or future phases. Treat the appetite as a hard boundary: the epic must describe the best slice that fits, not a wishlist that spills.

### 2. Load Local Context

Read the project instructions first, using exists-or-skip. A missing file is not a failed search: record `missing: <path>` in the evidence pack and continue.

- `.github/copilot-instructions.md` or `.agents/instructions.md`
- `.github/instructions/backend.instructions.md` if backend may be touched
- `.github/instructions/frontend.instructions.md` if frontend may be touched
- `docs/foundations/ARCHITECTURE.md` only for cross-layer, architectural, migration-heavy, or tenancy-sensitive initiatives
- Only relevant pattern docs from `docs/patterns/README.md`
- Existing PRDs, guides, tests, models, services, controllers, hooks, pages, serializers, API modules, and i18n files related to the idea

Use `rg`/`rg --files` first. Persist a reusable evidence pack at `docs/epics/<feature-or-project>/<slug>-evidence.md` with local findings, missing paths, and any external sources. Child `create-prd` runs should reuse this pack instead of rediscovering the same context.
If later web research contradicts local code behavior, flag the discrepancy explicitly in the epic as a risk or open question rather than silently reconciling it.

### 3. Research the External Context

Skip this step unless the epic depends on a vendor, regulation, public standard, pricing/limit constraint, or the user explicitly asks for web research. When it applies, prioritize primary or authoritative sources:

- Official product/API/provider docs
- Standards, regulations, or security guidance
- Vendor changelogs, pricing, limits, and integration docs
- Public competitor or market references when useful
- Current best practices for the relevant domain

Read `references/research-playbook.md` before synthesizing the research strategy. Record source URLs and dates when recency matters. If network access is unavailable, state the limitation and keep the epic grounded in local evidence.

### 4. Synthesize Like a Project Research Document

Use the narrative pattern from `docs/internal-documentation/business-metrics/value-stream-business-metrics.md`:

- Start with the business problem and why the current product cannot answer it well.
- Define strict scope and explicit non-scope.
- Describe the target user flow in plain language.
- State business rules with rationale and interpretation risks.
- Name real business use cases, not technical actions.
- Explain the architecture end-to-end, including a Mermaid flow when useful.
- Describe operational limits, failure modes, data confidence, and methodology.
- Add an annex with external sources and code/docs references.

### 5. Analyze the Project Professionally

Cover every relevant dimension in a compact table. Summarize each dimension in 1-3 sentences unless evidence requires more detail, and cap this section at about 2 short paragraphs worth of text plus the table.

- Product outcome and success metrics
- User journeys and UX states
- Backend/domain model impact
- Frontend/UI impact
- API and contract changes
- Data model, data migration, import/export, and reporting impact
- Authorization, tenancy, privacy, security, and audit concerns
- Observability, performance, reliability, and rollback
- Testing strategy and acceptance coverage
- Dependencies, unknowns, risks, and non-goals
- Rollout, feature flags, documentation, and support impact

Use a table with `Dimension`, `Status`, and `Notes` columns. Mark each row as `In scope`, `Out of scope`, `Future`, `Risk`, or `Open question`, and keep each `Notes` cell to 1-2 sentences.

### 6. Lock Live Path And Phase Cut

Before locking the cut or writing the PRD queue, offer `solution-sketch` once when the epic introduces an architecture or model shared by several child PRDs. Do not auto-start the skill. If the user declines, record `sketch: skipped` in the epic and continue. If `docs/design/<slug>-sketch.md` already exists, reuse it. Do not write the queue until the offer is skipped or a sketch is locked.

Do this before writing any phase table or PRD queue when the epic changes a live production path, replaces or adds a provider or source, or introduces an architecture that must coexist with current behavior. If none of those apply, record `No aplica` in the epic and continue.

Do not ask the user to pick a named strategy. Infer first. Ask only what would change the cut.

Resolve, in this order:

1. Must the current production path keep working during this appetite?
2. Does the committed scope fit one cycle, or must it be split?
3. If it must be split: show two concrete phase sequences for this epic — not labels — and wait for an explicit choice.
4. If an unresolved business rule would change which sequence is correct, ask that rule before writing the queue. Do not invent the rule. A domain example from a prior conversation is not a standing rule.

Default when the user does not override:

- One cycle, and the current path can be cut so the whole increment can be tested together: one PRD, single cutover.
- Multiple cycles, or the current path cannot be turned off: phase 1 already runs the live path on the new system; unfinished replacements may stay empty if they are not the live path.
- Do not encode a personal preference for single cutover. Challenge it when a new dependency or unresolved business rule would stay hidden until the last week.

After the cut is locked:

- Each committed phase must leave the live path usable.
- Empty implementations are allowed only when they are not the live path.
- The committed epic as a whole must end as a usable replacement. Permanent empty implementations and indefinitely dual live paths fail the epic Definition of Done.
- Record the chosen sequence, the discarded sequence, and why as an epic invariant (`INV-CUT-01` or the next free `INV-CUT-NN`) so child PRDs cannot invert it.

Use this prompt when a choice is still blocking:

```markdown
Antes de escribir la cola de PRDs:

1. **[Path vivo]** El path actual [debe seguir / se puede cortar] porque [hecho del discovery]. ¿Es correcto?
2. **[Corte]** Propongo esta secuencia: [fase 1 -> ...]. La alternativa es: [fase 1 -> ...]. La primera gana porque [consecuencia concreta]. ¿Cual cerramos?
```

### 7. Design the Delivery Pipeline

Do not start this step until step 6 has locked the cut or recorded `No aplica`.

Every committed phase or task must have a workflow handoff:

1. `create-prd` - transform the phase into a focused PRD with strict scope.
2. `implement-prd` - implement only that approved PRD and validate it.
3. `document-development` - document the delivered phase after implementation.

For each phase, define:

- Phase goal and user/business outcome
- Scope included and excluded
- Dependencies and sequencing
- Expected PRD title
- Implementation risk
- Validation strategy
- Documentation target
- Definition of Done

Avoid creating phases that are only technical chores unless they unlock a user-visible or platform-visible outcome. If a technical foundation is required, explain what later phase it enables. The set of committed phases, taken together, must be a usable replacement of the live behavior in scope. A phase may be incomplete relative to the epic, but it may not leave the live path unusable.

### 8. Ask Blocking Questions

Ask only questions that would materially change scope, sequencing, architecture, data contracts, UX, or acceptance criteria.

Use this format:

```markdown
Antes de cerrar la epica necesito resolver estas dudas:

1. **[Tema]** Pregunta concreta y por que bloquea.
2. **[Tema]** Pregunta concreta y por que bloquea.
```

If questions do not block a useful draft, produce the draft and list them as open questions instead of stopping to ask. Live-path, cycle-fit, and cut-changing business rules are not optional open questions; they stay in step 6 until locked.

### 9. Create the Epic

Use `references/epic-template.md` for the final structure. If the appetite is a small bet (single sprint or less), you may merge the Architecture and Risks sections into one heading, but always include:

- Clear objective and scope boundary
- Evidence from code/docs
- Evidence from web research when the external-context trigger applied, or an explicit `No aplica` when it did not
- A reusable evidence pack at `docs/epics/<feature-or-project>/<slug>-evidence.md`
- Business rules, user flow, use cases, and technical architecture
- A compact `Invariantes No Negociables` table with stable IDs, owners, rationale, and child-PRD mapping expectations
- Appetite-based delivery plan, including the locked live-path/cut decision or an explicit `No aplica`
- PRD queue with each child PRD title, goal, scope, dependencies, and recommended order
- Per-phase workflow through `create-prd`, `implement-prd`, and `document-development`
- A pointer to the companion ledger file and a one-line explanation of how it is kept current
- Risks, open questions, and explicit non-goals

### 10. Hand Off to `create-prd`

End with the next action:

- Recommend the first child PRD to create.
- Provide a ready-to-use prompt for `create-prd`.
- Explain that after the PRD is approved the expected flow is `implement-prd`, then `document-development`.
- Do not expand every slice into full PRDs unless the user asks.

Example handoff:

```markdown
Siguiente PRD recomendado: "PRD 1 - [Nombre]"

Prompt:
Use $create-prd to create the PRD for "[Nombre]" using `docs/epics/<feature-or-project>/<slug>.md` as parent context. Focus only on [scope] and keep [items] out of scope.

After that PRD is approved, use $implement-prd on the PRD file. After implementation and validation, use $document-development to document the delivered phase.
```

## Output Quality Bar

The epic is ready when another agent can run `create-prd` on the first slice without rediscovering the whole project context.

The epic is not ready if it:

- Lacks codebase evidence
- Omits web/source evidence when a vendor, regulation, or other external constraint matters
- Runs web research by default when local code/docs already answer the epic
- Treats assumptions as facts
- Ignores the stated appetite or treats scope as fixed when the investment boundary is fixed
- Mixes multiple unrelated products into one PRD queue
- Fails to name the first PRD and its strict scope
- Omits stable IDs for non-negotiable inherited requirements
- Fails to define how each phase moves through `create-prd`, `implement-prd`, and `document-development`
- Fails to create the companion ledger file or leaves it without one row per invariant and per queued PRD
- Fails to persist the reusable evidence pack for child PRDs
- Writes a PRD queue before locking the live path and phase cut when the step 6 trigger applies
- Asks the user to pick named strategies instead of choosing between two concrete sequences
- Commits phases that do not converge to a usable replacement, or that leave empty implementations on the live path
