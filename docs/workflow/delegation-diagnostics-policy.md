# Delegation Diagnostics Policy (Opt-In)

Baseline recorded: 2026-09-07.

This policy defines an optional, local, git-ignored diagnostic summary for a
delegated run. It exists to help a maintainer inspect one piloted execution; it
is not a telemetry platform, not versioned, and not part of PRD closure
evidence.

## Storage And Retention

- Location: `.agents/workflow-kit/diagnostics/<run_id>.toon`, one file per run.
- This path is ignored by Git. It must never be committed or attached to a PR.
- Opt-in only: the orchestrator writes this file solely when the user explicitly
  requests local diagnostics for that run.
- Retention: delete the file once its findings are reviewed, and always before
  or during PRD closure. A stale diagnostic file older than the current PRD run
  must not be reused as evidence for a different run.
- Deletion is manual and explicit; this policy does not add automatic cleanup
  beyond the existing `_meta/` removal step in `implement-prd`.

## What This Summary May Record

```text
run_id: <orchestrator correlation id>
slice_id: <slice id>
requested_model: <value | unknown>
resolved_model: <value | unknown>
fallback_reason: <reason | none>
commands_executed[N]: <command>
reads_count: <integer | unknown>
bootstrap_repeats: <integer | unknown>
retries: <integer | unknown>
duration_ms: <integer | unknown>
gaps_or_risks[N]: <risk | none>
limitations: <unknown fields and scope limits>
```

## What This Summary Must Never Record

- Prompts, full conversation transcripts, or complete tool-call payloads.
- Secrets, credentials, tokens, or environment variable values.
- Full runtime traces beyond the compact counts above.
- Token counts or monetary cost unless a real, inspectable source produced
  them; otherwise the field stays absent or `unknown`. Never estimate a figure
  and present it as measured.

## Promotion Rule

A conclusion from this local summary may be copied into shared documentation
(for example a runbook or the capability matrix) only after explicit
maintainer review and only as a sanitized statement: no prompts, no secrets, no
per-run identifiers that leak an internal correlation id used elsewhere.

## Absence Is Not A Blocker

Missing diagnostics do not block PRD closure. Delivery evidence (tests,
validation commands, and the PRD's own `## 10. Evidencia de Implementacion`)
is independent of this optional artifact.
