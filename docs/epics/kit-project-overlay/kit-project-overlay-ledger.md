# Ledger: kit-project-overlay

**Épica**: [kit-project-overlay.md](kit-project-overlay.md)
**Creado**: 2026-11-21

`document-development` actualiza este ledger cuando cierra cada PRD hijo:
- Las filas de invariantes pasan a `Cumplido` (con el nombre del PRD que lo cierra) o a `Cumplido con excepcion aprobada` (con la referencia al change request).
- Las filas de PRD pasan a `Cerrado`. Registran cualquier desvío del alcance y las postcondiciones del `Contrato entre Fases` del PRD.

La épica no se marca `Completado` mientras quede alguna invariante en `Pendiente`.

**Estado del ledger al 2026-11-25** (`main` en `9d3b917`, `0.23.0-plugin-mode`): las cuatro fases están integradas (PRs #80, #81, #82 y #83) y las 13 invariantes están cerradas. Cada fila cita los tests y validadores que la respaldan. Los pendientes se listan al final. Las tags `v0.18.0` a `v0.23.0` no existen en el remoto (el mantenedor difirió crearlas): una versión se fija por commit (`docs/versioning.md`).


## Invariantes

| ID | Estado | PRD que lo cierra | Notas |
| -- | ------ | ----------------- | ----- |
| INV-OWN-01 | Cumplido con excepcion aprobada | PRD 2 (F2, PR #82) | Excepción CR-F2-01 (usuario, 2026-11-21): solo la migración desde un state v1 escribe bajo `.agents/project/**`, y solo para crear archivos, agregar filas a `index.md` o reemplazar un seed idéntico byte a byte a un default del kit. Con state v2, `update` no toca el overlay. En modo plugin, AC-9 de F4 (`test/plugin-mode.test.mjs`). |
| INV-OWN-02 | Cumplido | PRD 2 (F2, PR #82) | El CLI lee el manifiesto (`src/kit-manifest.mjs`); `test/workflow-contract.test.mjs` ("the planner, migration, doctor, apply and rollback name no kit paths or ownership sets") lo hace cumplir. Desviación aceptada: `legacyPreservedCatalogs` en `src/migration.mjs` lista los catálogos del layout 0.18 para migrarlos; es una lista histórica y cerrada, no el ownership vigente (riesgo 1 de la sección 10 del PRD 2). |
| INV-EXT-01 | Cumplido | PRD 1 (F1, PR #80); F2 en `--edited shadow` | Contrato en `.agents/kit-boundary.md`; `not_shadowable` en el manifiesto; `scripts/validate-kit-boundary.mjs` y `test/kit-boundary.test.mjs`. |
| INV-EXT-02 | Cumplido | PRD 1 (F1) y PRD 2 (F2, PR #82) | El shadow guarda `base_sha256` (F1). `doctor` avisa `boundary/shadow-outdated` (F2, `test/doctor.test.mjs`); en modo plugin compara contra el kit del CLI (AC-17 de F4). |
| INV-PATH-01 | Cumplido | PRD 1 (F1, PR #80) | Reglas de rutas en `scripts/validate-kit-boundary.mjs` dentro de `check:workflow` (AC-4). |
| INV-DIST-01 | Cumplido | PRD 1 (F1), PRD 2 (F2) y PRD 4 (F4, PR #83) | El modo repo no cambió; el modo plugin es opcional y `doctor` marca `mode/repo-and-plugin` como error (AC-15 de F4). Guarda del modo repo: `test/plugin-mode.test.mjs` contra un fixture de `558e9fb`. |
| INV-DIST-02 | Cumplido | PRD 4 (F4, PR #83) | Un solo árbol fuente: `scripts/build-plugin.mjs` genera el plugin desde el árbol del kit, y `check:workflow` falla si lo generado difiere (AC-1 a AC-3, `test/plugin-build.test.mjs`). |
| INV-RUN-01 | Cumplido | PRD 3 (F3, PR #81) | Regla de captura en `.agents/instructions.md` y evals L23 y L26 de `router-evals.md`. La prueba es de contrato y de lectores ciegos de Claude Code; Codex y Copilot no se corrieron. |
| INV-RUN-02 | Cumplido | PRD 3 (F3, PR #81) | Reglas de ejecución en `reference/project-overlay.md`; evals L22 y L25. Mismo alcance de la prueba que INV-RUN-01. El texto de la regla de "no confirmar" no pedía proponer la corrección del runbook (AC-8 del PRD 3, eval L25); el PR de cierre de la épica lo completó. |
| INV-NEUT-01 | Cumplido | PRD 1 (F1), PRD 3 (F3) y PRD 4 (F4) | `validate-stack-neutrality` en `check:workflow`; revisa también `06-patterns/authoring/` (F3). `playwright-testing/SKILL.md` nombraba puertos y un archivo de entorno de un proyecto; el PR de cierre de la épica lo dejó con marcadores neutrales. |
| INV-MIG-01 | Cumplido | PRD 2 (F2, PR #82) | Fixture `test/fixtures/legacy-0.18.1/`, `test/migration.test.mjs`, `test/upgrade-e2e.test.mjs` y `test/rollback-journal.test.mjs`: dry-run, backup, journal, segundo `update` sin escrituras y rollback. |
| INV-SEQ-01 | Cumplido | PRD 1 (F1, PR #80) | Gate verificado en discovery de F1: #6 en 0.19.0 (PR #76, `9901069`), #5 en 0.19.1 (PR #77, `737bd36`) y #4 en 0.19.2 (PR #78, `3e233f4`) están integradas en `main` antes del primer commit de F1. |
| INV-CUT-01 | Cumplido | PRD 1 a 4 | Se respetó F1 → (F2 ∥ F3) → F4. Orden de integración: #80 (F1), #81 (F3), #82 (F2), #83 (F4). El path vivo se mantuvo: `test/upgrade-e2e.test.mjs` sin cambios en F4 (AC-19). |

## PRDs

| Orden | PRD | Estado | Desvíos de alcance | Postcondiciones (Contrato entre Fases) |
| ----- | --- | ------ | ------------------ | -------------------------------------- |
| 1 | PRD: Contrato kit/overlay | Cerrado (PR #80, `0.20.0-kit-overlay-contract`, `7a1f91c`) | Archivos fuera de la lista del PRD: `implementation-skill-matcher/SKILL.md`, `pattern-skill-template.md` e `init-legacy-attachments`. | POST-1 a POST-6 cumplidas (manifiesto v2, 5 adaptadores con bloque, layout, fallback legacy de `project-context.md`, seeds, quality gate dividido). `src/**` y `bin/**` sin cambios. |
| 2 | PRD: Actualizador por manifiesto y migración | Cerrado (PR #82, `0.22.0-manifest-updater`, `558e9fb`) | CR-F2-01 (excepción de INV-OWN-01); `shadow` solo al migrar; el state de `export` guarda `mode: "export"` (amplía POST-2 y AC-3 del PRD). AC-14 acotado a los módulos de ownership. | `install-state` 2.0.0 con `mode`, `delete_with_backup`, journal 2.0.0 y `src/kit-manifest.mjs`: usados por F4. Follow-ups abiertos en la sección 10 del PRD 2. |
| 3 | PRD: Runbooks de proyecto | Cerrado (PR #81, `0.21.0-project-runbooks`, `45e3797`) | Dos celdas de la fila 137 del router cambiaron (el PRD preveía una). N0 y N1 no ofrecen captura (documentado). | Clase `Runbook`, plantilla neutral, reglas de ejecución y captura, evals L21–L26. Codex y Copilot no se corrieron. |
| 4 | PRD: Modo plugin piloto | Cerrado (PR #83, `0.23.0-plugin-mode`, `9d3b917`) | D6 (usuario, 2026-11-22): la métrica de la épica "≤ 5 archivos" cuenta los archivos que el kit posee y actualiza (3 para Claude); los seeds se informan aparte. | `scripts/build-plugin.mjs`, `--mode repo\|plugin`, `doctor` con códigos `mode/*`. **No verificado:** VS Code Copilot sin ejecutar y modelos de Copilot elegidos a mano sin probar. **No publicado:** la rama `plugin` no existe en el remoto hasta el primer `--publish` y su push aprobado, así que la instalación del plugin falla hasta entonces. |

## Pendientes al cierre de la épica

- La épica queda `Completado con pendientes`: las 13 invariantes están cerradas, pero la publicación de la rama `plugin` y las tags de versión no se hicieron (decisión del mantenedor).
- Tres textos del kit que el PR de cierre corrige (`.agents/project/paths.json`, la regla de "no confirmar" de `reference/project-overlay.md` y `playwright-testing/SKILL.md`): cambian texto distribuido, así que necesitan versión y registro legal, que asigna el orquestador del release.
- Los follow-ups de la sección 10 de los PRDs 2 y 4 siguen abiertos; ninguno rompe una invariante.
