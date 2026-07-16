# Propuestas de Mejora — FHH IA Ecosystem Workflow Kit

**Fecha:** 2026-07-15
**Alcance de la revisión:** CLI (`src/cli.mjs`), planner (`src/planner.mjs`), aplicación de cambios (`src/apply.mjs`), doctor (`src/doctor.mjs`), TUI (`src/tui.mjs`), scripts de validación (`scripts/`), manifests de plantillas (`templates/`), configuración de CI (`.github/workflows/ci.yml`), empaquetado (`package.json`) y documentación (`README.md`, `docs/`).
**Estado general:** El proyecto está bien estructurado, con una filosofía sólida de *dry-run por defecto*, backups antes de sobrescribir, seguimiento de estado de instalación por checksums y una buena batería de tests y guardas de release. Las propuestas siguientes buscan cerrar inconsistencias, reforzar la robustez y elevar la calidad de mantenimiento.

---

## Resumen de prioridades

| Prioridad | Tema | Impacto | Esfuerzo |
|-----------|------|---------|----------|
| P0 | Inconsistencia de versión entre `package.json` y `README` | Alto | Bajo |
| P0 | Comando `export` no aparece en la ayuda del CLI | Alto | Bajo |
| P1 | Lógica redundante en `selectedTemplateFiles` | Medio | Bajo |
| P1 | Inconsistencia de gestor de paquetes (npm vs bun) | Medio | Medio |
| P1 | `check:docs` no se ejecuta en CI | Medio | Bajo |
| P1 | Escritura no transaccional en `applyInstallPlan` | Alto | Medio |
| P2 | Falta de matriz de versiones de Node en CI | Medio | Bajo |
| P2 | Ausencia de linter/formatter | Medio | Medio |
| P2 | Overlay `none`/`starter` sin documentar ni cubrir | Bajo | Bajo |
| P3 | Falta de `CHANGELOG.md`, `.editorconfig`, `.nvmrc` | Bajo | Bajo |
| P3 | Animación de la TUI sin bandera de desactivación en CLI | Bajo | Bajo |

---

## P0 — Crítico (corregir de inmediato)

### P0.1 — Inconsistencia de versión entre `package.json` y la documentación
- **Observación:** `package.json` declara `"version": "0.6.0-private-install-export"`, mientras que el `README.md` instruye a instalar `#v0.7.0` (`bun add -g github:xampo848/fhh-ia-ecosystem-workflow-kit#v0.7.0`).
- **Riesgo:** Los usuarios instalan un tag que no corresponde a la versión publicada del código; confusión en soporte y en el flujo de release.
- **Propuesta:**
  1. Definir la versión canónica y alinear ambos artefactos.
  2. Añadir una guarda en `scripts/validate-release-readiness.mjs` que verifique que el tag citado en el `README` coincide con `package.json.version` (o eliminar la referencia a versión concreta del README y remitir a un tag dinámico).

### P0.2 — El comando `export` no se documenta en la ayuda del CLI
- **Observación:** `src/cli.mjs` implementa por completo el comando `export`, pero `printHelp()` solo lista `init`, `update`, `doctor` y `tui`. El usuario no puede descubrir `export` desde `workflow-kit --help`.
- **Riesgo:** Funcionalidad soportada pero invisible; percepción de característica incompleta.
- **Propuesta:** Añadir la línea de uso de `export` a `printHelp()`:
  ```text
  workflow-kit export [--output <path>] [--dry-run] [--apply --yes] [--runtime <list>] [--overlay <name>]
  ```
  Complementariamente, considerar generar la ayuda a partir de una única fuente de verdad (tabla de comandos) para evitar futuras divergencias.


---

## P1 — Alta prioridad

### P1.1 — Lógica redundante en `selectedTemplateFiles`
- **Observación:** En `src/planner.mjs`, cuando `overlay === 'fhh-ia-ecosystem-full'` la carpeta `repo-overlay-fhh-ia-ecosystem-full` se recolecta **dos veces**: una en la selección inicial y otra en el bloque `else if (overlay === 'fhh-ia-ecosystem-full')`. La deduplicación posterior enmascara el problema, pero el código realiza trabajo de E/S duplicado y es confuso de mantener.
- **Propuesta:** Simplificar la selección a una sola pasada por overlay:
  - `none` → solo `portable-core`.
  - `starter` → `portable-core` + `repo-overlay`.
  - `fhh-ia-ecosystem-full` → `repo-overlay-fhh-ia-ecosystem-full` (una sola vez).
  Añadir un test que verifique que ninguna ruta se lee dos veces del disco.

### P1.2 — Inconsistencia de gestor de paquetes (npm vs bun)
- **Observación:** El `README` mezcla `npm install -g …` y `bun add -g …`; los scripts de `package.json` y el CI usan `npm`/`npm ci`; el repositorio versiona `package-lock.json`. La preferencia del equipo es **bun**.
- **Riesgo:** Divergencia entre lockfiles, instrucciones contradictorias y builds no reproducibles.
- **Propuesta:**
  1. Elegir un gestor canónico (bun, según preferencia del equipo) y unificar todas las instrucciones del `README` y de `docs/`.
  2. Alinear el lockfile versionado con el gestor elegido.
  3. Actualizar el job de CI para usar el mismo gestor (`bun install --frozen-lockfile`, `bun run …`) o, si se mantiene npm por compatibilidad de consumidores, documentar explícitamente la razón.

### P1.3 — `check:docs` no se ejecuta en CI
- **Observación:** Existe el script `check:docs` (`scripts/validate-docs.mjs`) pero el workflow `ci.yml` solo ejecuta `test`, `check`, `check:templates` y `check:release`.
- **Riesgo:** Regresiones en documentación no detectadas en CI.
- **Propuesta:** Añadir un paso `npm run check:docs` (o su equivalente con bun) al workflow y, opcionalmente, exigirlo desde `validate-release-readiness.mjs` como los demás checks.

### P1.4 — Escritura no transaccional en `applyInstallPlan`
- **Observación:** `src/apply.mjs` itera y escribe archivos secuencialmente y solo al final persiste `install-state.json`. Si una escritura falla a mitad de camino, el repositorio destino queda con un estado parcial y **sin** archivo de estado actualizado, dejando el árbol en un punto intermedio difícil de auditar.
- **Riesgo:** Instalaciones/actualizaciones corruptas ante errores de E/S, permisos o interrupción.
- **Propuesta:**
  1. Escribir cada archivo de forma atómica (escribir a `*.tmp` y `rename`).
  2. Persistir el `install-state.json` de forma incremental o registrar las operaciones ya aplicadas para permitir reanudar/limpiar.
  3. Ante fallo, emitir un resumen claro de qué se escribió y qué backups existen para revertir manualmente.

---

## P2 — Prioridad media

### P2.1 — Matriz de versiones de Node en CI
- **Observación:** `package.json` declara `"engines": { "node": ">=20" }`, pero CI valida únicamente Node 20. El uso de *import attributes* (`with { type: 'json' }`) es sensible a la versión de Node.
- **Propuesta:** Ejecutar la matriz `node-version: [20, 22]` (y la próxima LTS cuando aplique) para garantizar compatibilidad con el rango declarado.

### P2.2 — Ausencia de linter y formateador
- **Observación:** No hay configuración de ESLint ni Prettier; el estilo se mantiene por convención manual.
- **Riesgo:** Deriva de estilo y errores evitables (variables sin usar, p. ej. `active`/`scriptedMode` en la TUI) no detectados automáticamente.
- **Propuesta:** Incorporar ESLint (config recomendada + reglas para módulos ES) y Prettier, añadir script `lint`/`format:check` e integrarlo en CI.

### P2.3 — Overlays `none` y `starter` sin documentar ni cubrir
- **Observación:** `normalizeOverlay` acepta `none`, `starter` y `fhh-ia-ecosystem-full`, pero el `README` solo describe el flujo *full install*. El comportamiento de `none` (que degrada a `portable-core`) no está documentado y su cobertura de test es parcial.
- **Propuesta:** Documentar explícitamente los tres overlays con su alcance exacto, o marcar `none`/`starter` como internos/experimentales; añadir tests que fijen su comportamiento.

### P2.4 — Robustez del recorrido de plantillas
- **Observación:** `collectTemplateFiles` recorre el árbol siguiendo entradas de directorio sin control explícito de symlinks. Aunque las plantillas son de confianza, un enlace simbólico accidental podría desviar la lectura fuera del árbol esperado.
- **Propuesta:** Ignorar symlinks explícitamente (o resolver y validar que permanezcan dentro de `templatesRoot`), reforzando la garantía de límites del proyecto que ya declara la documentación.

---

## P3 — Prioridad baja (pulido y mantenibilidad)

### P3.1 — Archivos de proyecto ausentes
- **Propuesta:** Añadir:
  - `CHANGELOG.md` (formato *Keep a Changelog*) alineado con el flujo de versionado descrito en `docs/versioning.md`.
  - `.editorconfig` para consistencia de estilo entre editores.
  - `.nvmrc` fijando la versión de Node de desarrollo.

### P3.2 — Control de la animación de la TUI desde el CLI
- **Observación:** La TUI ejecuta una intro animada con `sleep` de duración fija. No hay una bandera de línea de comandos para desactivarla (`--no-animate`), aunque el código ya soporta `animate: false` internamente.
- **Propuesta:** Exponer `--no-animate` (y respetar `CI`/`NO_COLOR`) para entornos no interactivos y demos rápidas.

### P3.3 — Ayuda del CLI como fuente única
- **Observación:** El texto de ayuda, el `README` y el manifest describen comandos y opciones por separado.
- **Propuesta:** Definir la especificación de comandos/opciones en una estructura de datos única y derivar de ella la ayuda y (opcionalmente) parte de la documentación, reduciendo divergencias futuras como la de P0.2.

### P3.4 — Cobertura de código
- **Propuesta:** Habilitar cobertura con el runner nativo (`node --test --experimental-test-coverage`) y publicar un umbral mínimo en CI para proteger las rutas críticas de `planner`/`apply`.

---

## Plan de ejecución sugerido

1. **Iteración 1 (rápida, alto valor):** P0.1, P0.2, P0.3, P1.1, P1.3.
2. **Iteración 2 (robustez):** P1.2, P1.4, P2.1.
3. **Iteración 3 (calidad de mantenimiento):** P2.2, P2.3, P2.4.
4. **Iteración 4 (pulido):** todos los puntos P3.

Cada iteración debe acompañarse de: actualización de tests, ejecución de `test` + `check*` y verificación con `workflow-kit --help` / `tui` en un repositorio de prueba antes de cerrar.
