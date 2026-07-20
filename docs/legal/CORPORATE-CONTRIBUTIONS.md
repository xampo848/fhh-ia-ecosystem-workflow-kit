# Corporate Contributions Policy

Last updated: 2026-07-20

## Purpose

Define how company-originated changes can be contributed safely to the upstream repository while protecting confidential information and respecting IP ownership.

## Contribution Flow

1. Developer implements change in company branch/fork.
2. Company triage classifies change:
   - `GENERIC`: reusable, no internal secrets/policies.
   - `CORPORATE-CONFIDENTIAL`: internal-only, remains private.
3. Security review checks for secrets, personal data, internal identifiers, and sensitive architecture details.
4. IP authorization confirms contributor and company are allowed to submit the change.
5. Contributor signs off commits using DCO (`Signed-off-by`).
6. Pull request is opened with provenance declaration.
7. CI legal/compliance checks run.
8. Maintainer decides inclusion in portable core or keeps it private.
9. Merge does not imply roadmap control transfer.

## Mandatory Conditions for Corporate PRs

- No credentials, tokens, private endpoints, or customer data.
- No internal-only policy text unless intentionally open-sourced.
- Explicit statement of rights to contribute the submitted material.
- DCO sign-off on all commits.
- Provenance section completed in PR template.

## Classification Guide

Contribute upstream only if all are true:

- The change is generic and reusable.
- No confidentiality obligations are violated.
- The company authorizes publication.
- Third-party dependencies are license-compatible and documented.

Otherwise, keep in private corporate overlay.

## When CLA May Be Needed

Start with DCO. Consider adding individual/corporate CLA if:

- large external corporate participation grows;
- patent grant requirements need stronger explicit language;
- legal team requests assignment/representation clauses beyond DCO.
