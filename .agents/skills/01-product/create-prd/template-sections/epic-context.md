# PRD template section: parent epic context

Conditional section of [PRD_TEMPLATE.md](../PRD_TEMPLATE.md). Insert it under "1. Contexto y Objetivo" only when the PRD has a parent epic.

### Contexto de Epica Padre _(si aplica)_

**parent_epic**: `[path/to/epic.md]`

| Invariante heredada | AC hijo | Estado | Change request aprobado |
| ------------------- | -------- | ------ | ----------------------- |
| INV-[AREA]-01 | AC-[N] | Mapeada | No aplica |

Una contradiccion exige un change request aprobado por el usuario con ID de invariante, motivo y aprobador antes de continuar.

**Path vivo heredado**: [Debe seguir en el sistema nuevo | Se puede cortar | No aplica]
**Secuencia de corte heredada**: [fase 1 -> ... | No aplica]
**Este PRD respeta el corte**: Si | Change request `INV-CUT-NN`

### Contrato entre Fases _(si aplica)_

**Ledger leido**: `docs/epics/<feature-or-project>/<slug>-ledger.md`
**PRD anterior en la cola**: `[path/to/previous-prd.md]` (`No aplica` si es el primer PRD de la epica)

**Precondiciones (que asume que ya existe de fases previas)**:

| ID | Precondicion | Origen (PRD/ledger) | Verificado en discovery |
| -- | ------------- | -------------------- | ------------------------ |
| PRE-[N] | [Lo que este PRD asume que ya esta implementado o decidido] | [PRD/ledger row] | Si/No |

Si una precondicion no se verifica contra el codigo real durante el calibration, este PRD no puede continuar sin resolver la discrepancia con el usuario.

**Postcondiciones (que garantiza para fases siguientes)**:

| ID | Postcondicion | Como se prueba |
| -- | -------------- | --------------- |
| POST-[N] | [Lo que este PRD deja garantizado para que el proximo PRD lo pueda asumir] | [Test/evidencia] |

`document-development` copia estas postcondiciones al ledger de la epica al cerrar este PRD.
