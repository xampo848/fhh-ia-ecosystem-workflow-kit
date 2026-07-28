# Session State Template

Use this state on each turn to keep the workflow coherent.

## State Snapshot

- Stage: discovery | shaping | roadmap | gtm | dossier
- Stage Confidence: low | medium | high
- Skip-Guard Verdict: pass | hold
- Ambiguity Status: high | partial | clear
- Appetite Hint: small | medium | large | unknown
- Top Risks:
  - [risk]
- Open Assumptions:
  - [assumption]
- Open Ambiguities:
  - [ambiguity]
- Decision Rationale (latest): [one sentence]
- Next Question: [single highest-signal question]
- Next Micro-Step: [single concrete action]

## Update Rules

- Refresh confidence and skip-guard every turn.
- Refresh ambiguity status every turn.
- Add only unresolved assumptions.
- Keep only ambiguities that can change stage routing or decision quality.
- Remove assumptions once validated or explicitly accepted as risk.
- Keep next question singular to avoid overwhelming the PM.
