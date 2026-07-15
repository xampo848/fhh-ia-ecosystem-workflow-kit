---
name: external-data-source-integration
description: "Reusable backend pattern for integrating external sources with explicit safety, reliability, and observability rules."
---

# External Data Source Integration

## Trigger

Load when a slice integrates or changes behavior that calls external APIs,
webhooks, or provider-backed sync/import flows.

## Must Read

- `.github/instructions/backend.instructions.md`
- `docs/foundations/ARCHITECTURE.md`
- Relevant files under `docs/patterns/backend/`

## Procedure

1. Identify credentials boundary and ensure no secret is hardcoded.
2. Record rate-limit, retry, timeout, and idempotency expectations.
3. Define observability/error capture path.
4. Verify tenant scoping around provider data.
5. Add tests for provider failure or degraded-response path when practical.

## Validation Hooks

- Focused backend tests on failure/retry behavior
- Data-quality or contract verification when provider payloads feed product behavior

## Stop Conditions

- Credential handling is undefined.
- Retry/idempotency behavior is ambiguous.
- Cross-tenant mapping rules are unclear.

## Out of Scope

- Installing external tooling
- UI onboarding or UX flows
