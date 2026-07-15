---
name: api-contract-producer
description: "Reusable backend pattern for producer-side API contract changes in controllers, serializers, and service-backed responses."
---

# API Contract Producer

## Trigger

Load when a slice changes backend response shape, serializer fields, controller
payloads, or producer-side contract guarantees.

## Must Read

- `.github/instructions/backend.instructions.md`
- `docs/foundations/ARCHITECTURE.md`
- Relevant files under `docs/patterns/backend/`

## Procedure

1. Identify the producer source of truth.
2. Make field names, nullability, and nesting explicit.
3. Add/update backend contract tests.
4. Flag consumer risk when frontend or another consumer depends on the payload.
5. Keep payload logic out of controllers when a serializer/service owns it.

## Validation Hooks

- Serializer/controller/backend contract tests
- `contract-verifier` when frontend or other consumers are affected

## Stop Conditions

- Canonical payload shape is ambiguous.
- Public contract change exceeds slice scope.
- Consumer impact is unknown.

## Out of Scope

- Frontend consumer implementation
- Provider-side external API negotiation
