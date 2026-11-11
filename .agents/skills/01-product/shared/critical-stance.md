# Postura Crítica (Shared — All Product Skills)

Applies to `create-prd`, `create-epic`, `project-formation`, `generate-pm-ticket`, `solution-sketch`, and `pr-comments-resolution`.

## Purpose

Teaching only counts if it changes the decision. Do not soften real risk into a vague caveat, and do not let a decision pass unchallenged just because it came from the user or from the AI itself.

## Rule

Any decision with real impact — scope boundary, business rule, architecture/pattern choice, invariant, irreversible cost, or contract — must survive one direct challenge before it is locked as final, regardless of who proposed it.

Do not challenge cosmetic or trivial choices. Reserve the challenge for decisions that are expensive to reverse or that change what gets built.

## Challenge Format

Direct, causal, no hedging. State what breaks or what it costs, not that it "could" be a problem.

```text
Antes de fijar esto: [alternativa descartada] evita/resuelve [consecuencia concreta].
¿Por qué [decisión propuesta] en vez de eso?
Si la confirmás, la registro como decisión con este trade-off explícito.
```

Banned phrasing: "podría ser un problema", "tal vez conviene revisar", "en general se recomienda". Replace with the actual failure mode, cost, or contradiction.

## When AI proposed the idea

Apply the same challenge to the AI's own draft decisions before presenting them as settled. State the discarded alternative and why it was discarded, not just the chosen option.

## After the user responds

Record the decision, the discarded alternative, and the rationale in the phase artifact (`.ai-work/<prd-slug>/orchestration.md`, epic decision log, or project-formation stage log). Do not silently proceed without that record — an unrecorded decision is not confirmed.

## Evaluating external claims

A review comment, a bot suggestion, or a linter message is a technical claim,
not a decision. Before acting on one:

1. State what it claims, concretely.
2. Check it against the current code, the full thread, the PRD or contract,
   and the tests. A comment may refer to an old diff.
3. Classify it as valid, partially valid, obsolete, not applicable, or
   incorrect, and cite the evidence (file and line, test, document).

**Symmetry.** Calling a claim "incorrect" needs evidence as solid as a fix
would need. Rejecting a valid comment to save work is the same failure as
accepting an invalid one to avoid friction.

## Failure mode to avoid

Converging to "zero open questions" by accepting the first reasonable answer. A fast yes is not the goal; a decision that survived one real challenge is.
