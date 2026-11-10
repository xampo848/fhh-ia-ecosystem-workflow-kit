# Use Cases, Test Strategy, and Edge-Case Matrix

Part of [SKILL.md](../SKILL.md). Read it in Phase 4, when filling the three mandatory traceability tables.

### Casos de Uso (mandatory)

Every PRD must declare a canonical, verifiable use-case ledger before it can be considered ready to implement.

- Format: `ID | Actor | Precondiciones | Flujo principal | Resultado observable (falsable) | AC vinculado`.
- Every use case states at least one falsifiable observable result — not a vague intention.
- Every use case links to one or more acceptance criteria; every acceptance criterion for a core behavior links to at least one use case.
- Cover every actor/flow the PRD scope introduces or changes, including secondary actors (admin, background job, external system) when they participate in the flow.

### Estrategia de Tests (mandatory)

Tests are part of the design, not a follow-up activity.

- Format: `Nivel (unidad/integración/contrato/smoke/e2e) | Objetivo | Caso de uso vinculado | Cobertura esperada | Comando o mecanismo de validación`.
- Every use case links to at least one row in this table.
- Each slice in the implementation plan must inherit its relevant rows from this table (see Section 4 slice fields).

### Matriz de Edge Cases (mandatory)

Edge cases must be classified and traceable, not merely narrated in prose.

- Mandatory categories: **datos vacíos**, **límites**, **errores**, **permisos/tenancy**, **concurrencia/orden**, **rollout/rollback**.
- Format: `Categoría | Descripción | Caso de uso vinculado | Validación (test/contrato/smoke/evidencia manual justificada) | Estado`.
- Every row maps to at least one validation mechanism. A category with no applicable case must say `No aplica` plus a one-line reason grounded in the actual scope — never a silent omission.
