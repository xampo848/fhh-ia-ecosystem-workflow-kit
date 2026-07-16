# Research Playbook

Use this reference when shaping an epic that should feel like a professional project investigation, not a thin backlog wrapper.

## Research Lenses

### 1. Business and Product Narrative

Answer:

- What business or user question is unanswered today?
- Why does the current product fail to answer it clearly?
- What decision will stakeholders be able to make after the epic ships?
- Which metric, workflow, or capability proves the project worked?

Prefer outcome language over feature language. If the project cannot name a measurable or observable outcome, mark it as an open product risk.

### 2. Opportunity and Assumption Mapping

Use the Opportunity Solution Tree lens:

- Desired outcome: the business/product result.
- Opportunity space: user needs, pains, constraints, and jobs discovered from code, docs, user context, or web research.
- Solution space: candidate feature or technical approaches.
- Assumption tests: what must be true for the solution to work.

Do not present the first solution as inevitable. Show why the recommended path is the smallest credible path for the stated appetite.

### 3. Codebase and Architecture Discovery

Build an evidence map:

| Area | What to inspect |
| ---- | --------------- |
| Backend/domain | models, services, jobs, serializers, policies/abilities, migrations, seeds, tests |
| Frontend/UX | routes, pages, components, hooks, API modules, stores, i18n, tests, empty/error states |
| Data/contracts | schemas, payloads, queries, normalization, imports, exports, cache, data quality flags |
| Operations | feature flags, jobs, retries, observability, performance, rollback paths |
| Docs/history | existing PRDs, guides, architecture docs, old decisions, known limitations |

Record file paths and findings. Avoid vague claims like "backend supports this" without evidence.

### 4. External Research

Use web research unless forbidden. Prefer:

- Official docs for third-party APIs, providers, standards, or methods.
- Primary framework references for agile, discovery, roadmap, and delivery concepts.
- Current vendor docs for limits, pricing, changelogs, integration constraints, and security details.
- Reputable product/UX/engineering sources for practice guidance.

When recency matters, note access date or publication date. If sources conflict, document the tradeoff instead of forcing consensus.

### 5. Project Investigation Structure

Mirror the useful shape of `docs/internal-documentation/business-metrics/value-stream-business-metrics.md`:

1. Context and problem
2. Scope and non-scope
3. User flow
4. Business rules
5. Business use cases
6. Technical architecture with Mermaid flow
7. Operational limits and robustness
8. Delivery phases
9. PRD queue and workflow handoff
10. Sources and technical annexes

## Delivery Decomposition

The epic should create a phase queue, not implementation tickets directly.

Each phase must be small enough to become one focused PRD and should be completed through:

1. `create-prd`: formalize strict requirements for the phase.
2. `implement-prd`: implement and validate the approved PRD.
3. `document-development`: document the delivered phase for technical and non-technical stakeholders.

### Appetite and Phase Sizing Rules

- One phase should fit one PRD.
- One PRD should be implementable without reopening the whole epic.
- The user or team fixes the appetite; the epic shapes scope to fit it.
- Appetite can be expressed as a small bet, medium bet, large bet, one cycle, multi-cycle initiative, team capacity, deadline, or explicit budget.
- A larger appetite can contain more phases, but each committed phase still needs a clear outcome, risk, validation path, and PRD handoff.
- If the requested project cannot credibly fit the appetite, reduce scope or split the work into current appetite and future bets.
- Technical foundation phases are allowed only when they unlock later user/business value and have clear validation.
- If a phase depends on an external integration, define the fallback/proxy path or call it out as a blocker.

### Phase Table Fields

Use these fields when planning:

| Field | Meaning |
| ----- | ------- |
| Outcome | User/business or platform-visible result |
| Scope | What the PRD will include |
| Non-scope | What the PRD must not include |
| Dependencies | Prior phases, data, decisions, integrations |
| Risk | Main reason this phase could fail |
| Validation | Tests, contract checks, UX review, data verification |
| Documentation | Guide/update expected after implementation |

## Source References

Use these references as starting points. Add domain-specific sources for each epic.

| Topic | Source | How to apply |
| ----- | ------ | ------------ |
| Epics as large backlog items | Agile Alliance: https://agilealliance.org/glossary/epic/ | Treat epics as containers to split into smaller stories/PRDs when ready. |
| Stories and tasks quality | Agile Alliance INVEST: https://agilealliance.org/glossary/invest/ | Check child PRD slices for independence, value, testability, and size. |
| Sprint planning and increments | Scrum Guide 2020: https://scrumguides.org/docs/scrumguide/v2020/2020-Scrum-Guide-US.pdf | Tie phases to Sprint Goal, Definition of Done, and usable increments. |
| Appetite and vertical slices | Shape Up: https://basecamp.com/shapeup/0.3-chapter-01 | Bound committed scope by appetite and prefer vertical slices over sprawling task lists. |
| Opportunity Solution Tree | Product Talk: https://www.producttalk.org/glossary-discovery-opportunity-solution-tree/ | Connect outcome, opportunities, solutions, and assumption tests. |
| Discovery assumptions | Product Talk: https://www.producttalk.org/discovering-solutions/ | Separate generative discovery from evaluative assumption testing. |
| Roadmap hierarchy and strategy | Atlassian: https://www.atlassian.com/agile/project-management/epics-stories-themes | Keep relationships clear between initiatives, epics, stories, and tasks. |
| Roadmap communication | ProductPlan: https://www.productplan.com/learn/product-roadmap-contents | Make the epic communicate strategy instead of listing features only. |
| Product strategy to backlog | Roman Pichler framework: https://www.romanpichler.com/downloads/tools/Romans-Product-Strategy-Framework.pdf | Link product goals, timeframes, selected features, metrics, and backlog items. |

## Red Flags

- The epic is just a PRD with a bigger title.
- The scope cannot fit the stated appetite but no future bet or reduced-scope version is declared.
- The research annex contains links but no findings.
- The codebase evidence lists files but no interpretation.
- Business rules are missing, so implementation agents must infer behavior.
- The phase plan skips `document-development`, leaving no stakeholder-ready closeout.
- The first PRD prompt is too broad to implement safely.
