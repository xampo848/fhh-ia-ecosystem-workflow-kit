---
name: importer-implementation
description: "Reusable backend pattern for implementing importers and ingestion slices safely in FHH IA Ecosystem."
---

# Importer Implementation

## Trigger

Load when a slice implements or changes importer-style backend behavior:

- row or payload normalization;
- ingestion services;
- importer orchestration;
- import-specific retries, batching, or row validation.

## Must Read

- `.github/instructions/backend.instructions.md`
- `docs/foundations/ARCHITECTURE.md`
- Relevant files under `docs/patterns/backend/`

## Procedure

1. Identify canonical input, normalization step, persistence step, and error/reporting step.
2. Keep orchestration in services, not controllers or models.
3. Preserve idempotency assumptions explicitly.
4. Record invalid-row / partial-failure behavior.
5. Add focused tests for happy path and malformed input path.

## Validation Hooks

- Focused backend tests for importer service/entry point
- Contract or smoke check when imported data feeds downstream consumers

## Stop Conditions

- Import identity or idempotency key is ambiguous.
- Partial failure behavior is undefined.
- Credentials or external rate limits are involved but not modeled.

## Out of Scope

- External capability install/attach
- Cross-layer UI work
