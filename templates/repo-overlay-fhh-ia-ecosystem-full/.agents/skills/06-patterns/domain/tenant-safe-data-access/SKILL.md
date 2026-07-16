---
name: tenant-safe-data-access
description: "Reusable domain/backend pattern for tenant-scoped data access, organization integrity, and cross-tenant safety."
---

# Tenant-Safe Data Access

## Trigger

Load when a slice reads, writes, validates, or links tenant-scoped backend/domain data.

## Must Read

- `.github/instructions/backend.instructions.md`
- `docs/foundations/ARCHITECTURE.md`

## Procedure

1. Identify organization/tenant boundary.
2. Verify authoritative scoping path.
3. Check for cross-tenant joins, lookups, or writes.
4. Add regression tests for same-tenant valid behavior and cross-tenant denial.
5. Require explicit justification for any exception.

## Validation Hooks

- Tenancy-focused model/service/request tests
- Auth/authorization checks when relevant

## Stop Conditions

- Tenant ownership is ambiguous.
- A cross-tenant query seems necessary without explicit PRD support.
- Authorization and tenancy responsibilities are mixed unclearly.

## Out of Scope

- Full auth redesign
- Organization membership product changes
