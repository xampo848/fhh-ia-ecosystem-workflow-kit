# Governance

## Project model

This project follows an open-core model:

- Portable open source core (neutral workflows, CLI/TUI/planner/apply/doctor, thin adapters, generic templates).
- Confidential overlays for company-specific rules, integrations, and internal practices.

## Maintainers

Maintainers control:

- acceptance/rejection of pull requests,
- roadmap prioritization,
- release timing and compatibility policy,
- security and legal gating before publication.

## Decision principles

- Legitimacy over speed: no release if IP/licensing provenance is unresolved.
- Safety over convenience: confidential/corporate material stays out of public core.
- Reproducibility: all legal and technical checks must be automatable.

## Contribution acceptance gates

A PR can be merged only if:

- CI passes,
- DCO sign-off is present,
- provenance section is complete,
- no secrets or confidential data,
- licensing impact is compatible and documented.

## Escalation

Issues touching IP ownership, third-party licensing ambiguity, trademarks, or confidentiality must be escalated to legal review before merge.
