# Ledger: kit-project-overlay

**Épica**: [kit-project-overlay.md](kit-project-overlay.md)
**Creado**: 2026-11-21

`document-development` actualiza este ledger cuando cierra cada PRD hijo:
- Las filas de invariantes pasan a `Cumplido` (con el nombre del PRD que lo cierra) o a `Cumplido con excepcion aprobada` (con la referencia al change request).
- Las filas de PRD pasan a `Cerrado`. Registran cualquier desvío del alcance y las postcondiciones del `Contrato entre Fases` del PRD.

La épica no se marca `Completado` mientras quede alguna invariante en `Pendiente`.

## Invariantes

| ID | Estado | PRD que lo cierra | Notas |
| -- | ------ | ----------------- | ----- |
| INV-OWN-01 | Pendiente | | |
| INV-OWN-02 | Pendiente | | |
| INV-EXT-01 | Pendiente | | |
| INV-EXT-02 | Pendiente | | |
| INV-PATH-01 | Pendiente | | |
| INV-DIST-01 | Pendiente | | |
| INV-DIST-02 | Pendiente | | |
| INV-RUN-01 | Pendiente | | |
| INV-RUN-02 | Pendiente | | |
| INV-NEUT-01 | Pendiente | | |
| INV-MIG-01 | Pendiente | | |
| INV-SEQ-01 | Pendiente | | Gate: #6, #4 y #5 integradas en `main` |
| INV-CUT-01 | Pendiente | | |

## PRDs

| Orden | PRD | Estado | Desvíos de alcance | Postcondiciones (Contrato entre Fases) |
| ----- | --- | ------ | ------------------ | -------------------------------------- |
| 1 | PRD: Contrato kit/overlay | Pendiente | | |
| 2 | PRD: Actualizador por manifiesto y migración | Pendiente | | |
| 3 | PRD: Runbooks de proyecto | Pendiente | | |
| 4 | PRD: Modo plugin piloto | Pendiente | | |
