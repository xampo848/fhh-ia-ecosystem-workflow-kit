# Cross-Runtime Delegation Benchmark (Piloto Comparativo)

Baseline recorded: 2026-09-07. No runtime pilot has been executed yet; every
metric in this document is a contract for future measurement, not a result.

## Purpose

Compare a baseline delegation run against a candidate run on equivalent
fixtures, to see whether the neutral delegation envelope and context policy
(see [.agents/model-routing/README.md](../../.agents/model-routing/README.md)
and [delegation-diagnostics-policy.md](delegation-diagnostics-policy.md))
reduce redundant work without adding gaps or rework. This is evidence
collection, not a marketing claim.

## Preconditions

1. Both baseline and candidate runs use the same fixture task, the same
   acceptance criteria, and the same quality gates. Only the delegation
   contract/context policy may differ between them.
2. Record the kit revision, runtime, surface, and runtime version for each run.
3. Use a disposable, non-secret fixture repository or slice.

## Fixture Set

| Fixture | Shape | Purpose |
| --- | --- | --- |
| bounded-task | Single-file, single-slice change | Measures overhead floor for trivial delegation |
| cohesive-backend | Multi-file backend slice, one writer | Measures context reuse across a cohesive change |
| cross-cutting-qa | Backend + QA independent review | Measures fresh-context QA cost without redundant re-discovery |

## Measured Fields

```text
run_id: <id>
fixture: bounded-task | cohesive-backend | cross-cutting-qa
variant: baseline | candidate
runtime: <runtime | unknown>
reads_count: <integer | unknown>
bytes_read: <integer | unknown>
bootstrap_repeats: <integer | unknown>
delegate_calls: <integer | unknown>
retries: <integer | unknown>
duration_ms: <integer | unknown>
gaps_or_risks[N]: <risk | none>
rework_events: <integer | unknown>
tokens_billed: <integer | unknown-no-real-source>
cost_estimate: <value | unknown-no-real-source>
```

## Interpretation Rules

1. Compare only matching fixture/variant pairs with identical controls and
   acceptance criteria; do not compare across different fixtures.
2. Report `tokens_billed` and `cost_estimate` only when a real, inspectable
   source (not a heuristic) produced them. Otherwise record
   `unknown-no-real-source`. Do not equate byte counts or tool-call counts with
   monetary cost.
3. Do not fix a savings percentage without a completed baseline/candidate pair
   for that fixture. A single run is not a comparison.
4. A candidate with more reads but fewer gaps and less rework is not
   automatically worse; report both, do not collapse them into one score.
5. Repeat a fixture pair only after a runtime, schema, or policy change that
   could affect its result.

## Current Status

No baseline/candidate pair has been executed for any fixture in this
repository. This document defines the comparison contract only. Do not cite
this document as evidence of measured savings until at least one completed
fixture pair with observed evidence is recorded here.
