---
name: generate-pm-ticket
description: 'Create deep product tickets, Jira issues, backlog items, or PRDs from raw requirements, screenshots, or feature ideas. Use when writing PM tickets with strong acceptance criteria, scope boundaries, edge cases, and implementation notes, especially when repository code context is available.'
argument-hint: 'Describe the feature, problem, screenshot, or rough requirement'
user-invocable: true
---

# Generate PM Ticket

Use this skill when the user wants:

- a high-quality product ticket
- a Jira issue with deep acceptance criteria
- a Linear issue ready for grooming
- a PRD from a rough requirement
- a backlog item grounded in the current codebase
- a strong prompt they can reuse in Gemini or another LLM

This skill is designed to work in two scenarios:

1. **Repository-aware mode**: there is code context available and the ticket should be grounded in the existing implementation.
2. **Context-light mode**: there is no codebase access, or the user only provides business context, notes, screenshots, or mockups.

## Outcome

Produce a ticket that is:

- precise enough for engineering to implement
- explicit enough for product/design to review
- structured enough for QA to validate
- honest about unknowns when context is incomplete

Use the structure in [ticket template](assets/ticket-template.md).

If the user wants a portable prompt for Gemini or another LLM, provide or adapt the text in [portable master prompt](assets/portable-master-prompt.md).

## Core Rules

1. **Explore first, write second**.
2. **Never invent repository facts** you did not verify.
3. **Ask only blocker questions** and ask them in one grouped batch.
4. **Separate facts, assumptions, and open questions** whenever uncertainty exists.
5. **Define defaults, limits, interactions, and failure states**. Generic tickets are not acceptable.
6. **If screenshots exist, inspect them at the beginning and re-check them before finalizing**.

## Procedure

### Step 1. Normalize the request

Rewrite the ask internally as:

- current surface or module
- actor
- desired change
- expected outcome
- likely areas affected

### Step 2. Detect available context

#### If code context exists

Inspect the minimum relevant set:

- related routes
- controllers
- views
- services
- presenters/serializers
- models and schema fields
- existing specs
- relevant frontend controllers/assets

Look for:

- current naming conventions
- reuse points
- existing user flows
- public/shared versions of the same feature
- permission boundaries
- feature flag patterns
- data fields that already exist

#### If code context does not exist

Build context from:

- user description
- screenshots/mockups
- terminology in the request
- explicit business goals
- inferred workflow

Do not fabricate technical architecture. Use assumptions only when clearly labeled.

### Step 3. Run a gap analysis

Probe these categories before drafting:

- scope boundary
- default behavior
- interaction with existing filters or controls
- ranking/order rules
- limits and caps
- permission/visibility rules
- impact on shared/public/report/export flows
- edge cases and empty states
- loading/error states
- data granularity
- performance-sensitive behavior
- rollout/feature flag decision

### Step 4. Ask targeted questions only if needed

Questions must be short, grouped, and only about points that would lead to materially different implementations.

Recommended structure:

```text
Antes de cerrar el ticket necesito resolver estas dudas:

- [Scope] ...
- [Business rule] ...
- [Default behavior] ...
```

### Step 5. Draft the ticket

Use the template in [ticket template](assets/ticket-template.md) and adapt the depth to the request.

Minimum sections expected:

- Title
- Context
- Objective
- User story
- In scope
- Out of scope
- Functional rules
- Edge cases / states
- Acceptance criteria
- Implementation notes
- Risks / dependencies
- Open questions
- Definition of done

### Step 6. Deepen implementation notes when code exists

If repository context is available, tie the ticket to real implementation surfaces:

- likely controllers or endpoints
- services/queries that should be extended
- existing widgets or views that should be preserved
- data fields already present vs. fields missing
- public/shared variants that must not regress
- test surfaces that should be updated

Do this carefully: illuminate likely implementation paths without turning the ticket into a speculative code diff.

### Step 7. Run a quality pass

Before finalizing, verify the ticket answers these questions:

- Is the current behavior clear?
- Is the default state defined?
- Are filter interactions explicit?
- Are limits/caps defined?
- Are empty/loading/error states covered?
- Are permissions or public sharing impacts covered?
- Is it obvious what QA must validate?
- If context was incomplete, are assumptions clearly labeled?

## Special Heuristics

### For maps

Explicitly define:

- initial viewport
- filtering by visible bounds
- marker granularity
- behavior on pan/zoom
- counters vs. map viewport semantics
- comparison mode
- color semantics
- handling of overlapping/shared entities

### For tabs

Explicitly define:

- default tab
- preservation of current content
- whether state persists when switching tabs
- impact on shared/public versions

### For comparisons

Explicitly define:

- first auto-selection rule
- ranking metric
- maximum comparable entities
- add/remove behavior
- behavior when global filters already exist
- color consistency

### For reports and dashboards

Explicitly define:

- filter precedence
- data source granularity
- loading strategy
- shared/report-link behavior
- empty states
- performance-sensitive queries

## Output Adaptation

If the user asks for a specific delivery format, keep the same substance and transform only the presentation:

- **Jira**: summary + description + acceptance criteria
- **Linear**: concise issue with strong problem/scope/AC sections
- **PRD**: expanded version with phases, decisions, risks, and open questions
- **Portable prompt**: return or adapt [portable master prompt](assets/portable-master-prompt.md)