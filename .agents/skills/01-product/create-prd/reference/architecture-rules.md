# Architecture, Enumeration, and Testing Rules

Part of [SKILL.md](../SKILL.md). Read it in Phase 4, when the PRD touches the data model, domain placement, enumerations, or tests.

### Required architectural rules

When the PRD has a parent epic:

- declare the exact `parent_epic` path;
- map every inherited invariant ID to one or more child acceptance criteria;
- stop before drafting if requested scope contradicts an inherited invariant;
- continue only after an explicit user-approved change request records the invariant ID, reason, and approver.
- read the companion ledger (`<slug>-ledger.md`) and, when this is not the first PRD in the queue, the immediately preceding sibling PRD's `Contrato entre Fases` postcondiciones, before drafting scope;
- declare a `Contrato entre Fases` section listing this PRD's preconditions (what it assumes from prior phases, verified against real code during calibration, not assumed from the epic's original plan) and postconditions (what it guarantees for later phases);
- treat an unverifiable precondition as a blocking ambiguity, not a silent assumption;
- inherit the parent epic's locked live path and phase-cut sequence when present (`INV-CUT-*` or the epic's "Path vivo y corte de fases" block);
- stop before drafting if this PRD would invert that cut — for example by leaving the live path on the old system when the epic locked the live path onto the new system, or by reordering the chosen sequence;
- continue only after an explicit user-approved change request records the cut invariant ID, reason, and approver.

PRDs that introduce backend entities must explicitly define:

- bounded context;
- namespace strategy;
- table naming strategy;
- append-only vs mutable lifecycle;
- multi-tenancy rules;
- test strategy with the project's test framework;
- enumerations following the project's convention.

### Enumeration rules

Do not leave constrained values as anonymous string arrays only.

PRDs must define explicit enumeration classes when applicable, for example:

```ruby
Analytics::SeverityEnumeration
Analytics::DetectionStatusEnumeration
```

### Testing rules

PRDs must align to the repository backend testing standard:

- backend tests use the project's test framework;
- tenant boundaries must be tested;
- append-only models must test immutability;
- lifecycle consistency rules must be tested.
