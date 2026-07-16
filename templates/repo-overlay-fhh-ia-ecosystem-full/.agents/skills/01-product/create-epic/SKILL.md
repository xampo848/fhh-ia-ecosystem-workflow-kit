---
name: create-epic
description: Create a formal epic or project research document before individual PRDs, shaped by the user's appetite instead of a fixed delivery window. Use when Codex must investigate a large feature, initiative, or product area; combine web research, codebase discovery, architecture review, business rules, user flows, risks, UX/data/API implications, and phased delivery planning; then produce an epic with a prioritized PRD queue where each phase flows through create-prd, implement-prd, and document-development.
---

# Create Epic

Use this skill to turn a broad opportunity, feature idea, business need, or ambiguous project into a professional epic that can feed multiple focused PRDs.

The output is not a PRD. It is the parent project definition and investigation artifact: strategic context, discovered constraints, business rules, user flow, technical architecture, delivery slices, risks, and a recommended sequence of PRDs shaped by the project's appetite.

## Core Rules

- Research before drafting. Use local code/docs and web sources before writing the epic.
- Write the epic with the depth of `docs/internal-documentation/business-metrics/value-stream-business-metrics.md`: business narrative first, technical architecture second, sources and files in annexes.
- Shape committed delivery around an explicit appetite. The appetite is the investment boundary; scope is variable.
- Do not invent implementation certainty. Separate evidence, inference, assumptions, and open questions.
- Prefer slices that can become standalone `create-prd` inputs and later close with `document-development`.
- Ask targeted questions only after initial discovery, unless the request is too vague to begin.
- Do not modify product code while creating the epic unless the user explicitly asks.
- Save the final epic to `docs/epics/<feature-or-project>/<slug>.md` by default when the user asks to create a project artifact.

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

Read the project instructions first:

- `.github/copilot-instructions.md`
- `.github/instructions/backend.instructions.md` if backend may be touched
- `.github/instructions/frontend.instructions.md` if frontend may be touched
- `docs/foundations/ARCHITECTURE.md` for non-trivial initiatives
- Only relevant pattern docs from `docs/patterns/README.md`
- Existing PRDs, guides, tests, models, services, controllers, hooks, pages, serializers, API modules, and i18n files related to the idea

Use `rg`/`rg --files` first. Build a short evidence map of files and current behavior before making recommendations.

### 3. Research the External Context

Use web research unless the user explicitly forbids it. Prioritize primary or authoritative sources:

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

Cover every relevant dimension, but keep the result concise:

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

Mark each item as `In scope`, `Out of scope`, `Future`, `Risk`, or `Open question` where useful.

### 6. Design the Delivery Pipeline

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

Avoid creating phases that are only technical chores unless they unlock a user-visible or platform-visible outcome. If a technical foundation is required, explain what later phase it enables.

### 7. Ask Blocking Questions

Ask only questions that would materially change scope, sequencing, architecture, data contracts, UX, or acceptance criteria.

Use this format:

```markdown
Antes de cerrar la epica necesito resolver estas dudas:

1. **[Tema]** Pregunta concreta y por que bloquea.
2. **[Tema]** Pregunta concreta y por que bloquea.
```

If questions do not block a useful draft, produce the draft and list them as open questions.

### 8. Create the Epic

Use `references/epic-template.md` for the final structure. Adapt headings when the project is smaller, but always include:

- Clear objective and scope boundary
- Evidence from code/docs
- Evidence from web research
- Business rules, user flow, use cases, and technical architecture
- Appetite-based delivery plan
- PRD queue with each child PRD title, goal, scope, dependencies, and recommended order
- Per-phase workflow through `create-prd`, `implement-prd`, and `document-development`
- Risks, open questions, and explicit non-goals

### 9. Hand Off to `create-prd`

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
- Omits web/source evidence when external context matters
- Treats assumptions as facts
- Ignores the stated appetite or treats scope as fixed when the investment boundary is fixed
- Mixes multiple unrelated products into one PRD queue
- Fails to name the first PRD and its strict scope
- Fails to define how each phase moves through `create-prd`, `implement-prd`, and `document-development`
