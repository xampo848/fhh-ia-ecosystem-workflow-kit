# PROVENANCE AUDIT

Last updated: 2026-07-20
Auditor: GitHub Copilot (GPT-5.3-Codex)
Scope: Full tracked repository (`git ls-files`), including templates and history signals.

## Method and Evidence Standard

This audit uses:

- Repository inventory (`git ls-files`, `rg --files`)
- Legal marker scans (`rg` for provenance/license markers)
- Git history analysis (`git log --all --stat`, `git log --name-status`, `git log --follow`)
- Line-level custody (`git blame`)
- Upstream license spot checks where feasible (`npm view` for vendored package candidates)

Evidence labels used in this file:

- `CONFIRMED`: direct, verifiable evidence in-repo or from upstream metadata.
- `INFERRED`: strong technical inference from history/structure, but missing upstream legal proof.
- `SUSPECTED`: plausible risk indicator requiring additional evidence.
- `MISSING`: required legal/source evidence not found yet.

## Repository Inventory (Categorized)

Tracked files: `271`
Top-level distribution (tracked):

- `templates`: `220`
- `test`: `14`
- `src`: `12`
- `docs`: `9`
- `scripts`: `4`
- `examples`: `3`
- root/config/legal/meta: remainder

### Category Inventory

1. Executable code
- `bin/workflow-kit.mjs`
- `src/*.mjs`
- `src/cli/*.mjs`
- `src/tui/*.mjs`

2. Skills, prompts, agent contracts
- `templates/portable-core/.agents/**`
- `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/**`

3. Runtime adapters
- `templates/runtime-adapters/codex/**`
- `templates/runtime-adapters/copilot/**`
- `templates/runtime-adapters/claude/**`
- `templates/runtime-adapters/antigravity/**`

4. Templates and overlay packs
- `templates/template-manifest.json`
- `templates/portable-core/**`
- `templates/repo-overlay/**`
- `templates/repo-overlay-fhh-ia-ecosystem-full/**`

5. Documentation
- `README.md`, `RELEASE.md`, `CONTRIBUTING.md`
- `docs/*.md`
- `examples/*/README.md`

6. Tests and validations
- `test/*.test.mjs`
- `scripts/validate-*.mjs`

7. Distribution/configuration
- `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `.gitignore`

8. Legal/notice baseline found before remediation
- `LICENSE` only
- No `NOTICE`, no `THIRD_PARTY_NOTICES.md`, no per-component `LICENSE.upstream`

### Additional Structural Findings

- Symlinks: none detected.
- Most content is template-based; highest concentration of potential third-party risk is in `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/**`.
- Largest tracked files are in `impeccable` scripts/docs, including vendored/minified JS and long workflow references.

## Provenance Matrix

| ID | Archivo/componente | Fuente probable | URL | Commit/tag (fuente usada) | Tipo de uso | Licencia origen | Copyright titular | Modificaciones locales | Clasificación | Confianza | Riesgo | Obligaciones aplicables | Acción recomendada | Evidencia |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P-001 | `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/01-product/product-studio/jobs-to-be-done/SKILL.md` | `deanpeters/product-manager-prompts` | `https://github.com/deanpeters/product-manager-prompts` | `MISSING` | Texto adaptado (declarado) | `MISSING` | `MISSING` | Sí, integrado al skill local | `REQUIRES_AUTHOR_PERMISSION` | High | HIGH | Mantener atribución; verificar licencia upstream; posible permiso explícito | No publicar este componente hasta confirmar licencia o reescribir clean-room | Línea de proveniencia explícita en archivo (`Adapted from ...`) |
| P-002 | `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/01-product/product-studio/user-story/SKILL.md` y `template.md` | `deanpeters/product-manager-prompts` | `https://github.com/deanpeters/product-manager-prompts` | `MISSING` | Texto adaptado (declarado) | `MISSING` | `MISSING` | Sí | `REQUIRES_AUTHOR_PERMISSION` | High | HIGH | Igual P-001 | Igual P-001 | Provenance explícita en líneas finales |
| P-003 | `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/capabilities/manifests/caveman.md` y skill family `05-caveman/**` | `JuliusBrussee/caveman` | `https://github.com/JuliusBrussee/caveman` | `MISSING` | Adaptación/port de skills y manifiestos | `MISSING` (no confirmado en auditoría local) | `MISSING` | Sí | `UNKNOWN_PROVENANCE` | Medium | HIGH | Confirmar licencia exacta de la versión usada; respetar avisos y términos | Mantener en overlay privado hasta evidencia de licencia compatible | Manifest declara `source` explícito a repo externo |
| P-004 | `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/04-crosscutting/impeccable/**` | `pbakaus/impeccable` (indicios internos) | `https://github.com/pbakaus/impeccable` (inferido) | `MISSING` | Código y docs derivados/portados | `MISSING` | `MISSING` | Sí (nombres/rutas adaptadas) | `UNKNOWN_PROVENANCE` | Medium | CRITICAL | Verificar licencia y condiciones; potencial obra derivada extensa | Bloquear publicación hasta confirmar derechos/licencia o extraer/reescribir | `cleanup-deprecated.mjs` referencia fuente lock `pbakaus/impeccable`; historial muestra renombres masivos R100 |
| P-005 | `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/04-crosscutting/impeccable/scripts/modern-screenshot.umd.js` | paquete npm `modern-screenshot` | `https://github.com/qq15725/modern-screenshot` | npm `4.7.0` | Vendorizado/minificado | MIT (confirmado por npm metadata) | según upstream | Desconocidas | `EXTERNAL_PERMISSIVE` | High | MEDIUM | Conservar aviso/licencia y atribución para redistribución | Incluir en THIRD_PARTY_NOTICES y agregar LICENSE.upstream para trazabilidad | `npm view modern-screenshot` => MIT + repo URL |
| P-006 | Overlay completo actual | Historial interno previo `repo-overlay-all-metrics-full` | N/A (interno repo) | `5aeec67` introducción; `e4f860e` rename | Renombrado casi total | N/A (interno, pero origen final no demostrado) | `MISSING` | R100/R9x en múltiples archivos | `UNKNOWN_PROVENANCE` | High | HIGH | Verificar que el overlay anterior no ya incluía material externo no autorizado | Tratar como procedencia pendiente, no asumir originalidad | `git log --name-status` muestra renombres masivos desde `repo-overlay-all-metrics-full` |
| P-007 | Núcleo `src/**`, `bin/**`, `scripts/**`, tests | Desarrollo local propio (sin indicios externos directos) | N/A | commits recientes | Implementación original aparente | MIT repo actual | contribuyentes repo | Sí | `ORIGINAL_CONFIRMED` (parcial) | Medium | LOW | Mantener licencia principal; continuar revisiones puntuales | Puede permanecer en core, con revisión incremental | Sin marcadores de copia directa detectados en barrido legal |
| P-008 | Archivos con contenido empresarial específico (`FHH IA Ecosystem`, tenancy/políticas) en overlay full | Material interno/corporativo potencial | N/A | introducidos en `5aeec67` y siguientes | Configuración/patrones específicos de organización | Propiedad laboral potencial | `MISSING` (según contratos) | Sí | `EMPLOYMENT_OWNERSHIP_RISK` | Medium | HIGH | Confirmar autorización corporativa para open source | Mantener privado o segregar hasta autorización formal | Múltiples descripciones orientadas a dominio FHH/tenant/internal docs |
| P-009 | Referencias a fuente externa en documentación y plantillas (no código) | Libros/frameworks y repositorios externos | varias | N/A | Referencias bibliográficas | Generalmente no restrictivo para referencia | terceros | N/A | `AI_GENERATED_LOW_RISK` o `EXTERNAL_PERMISSIVE` según caso | Low | LOW | Atribución editorial recomendada | Mantener referencias, sin copiar texto sustancial sin licencia | Menciones en skills y docs |

## Distinción: idea vs expresión

### Confirmado como expresión potencialmente protegida (no solo idea)

- Bloques textuales declarados como “Adapted from ...” (P-001/P-002).
- Árbol extenso de `impeccable` con heurísticas internas de identificación upstream (P-004).
- Código vendorizado/minificado (`modern-screenshot.umd.js`) (P-005).

### Más cercano a idea/concepto general

- Arquitectura de router de workflows, separación core/overlay, adapters delgados (requiere revisar archivo por archivo, pero no hay evidencia directa de copia literal externa en `src/**`).

## Contenido IA (clasificación de riesgo)

Dado el contexto declarado, y sin bitácora exhaustiva de prompts:

- Tipo A/B probable: partes de `src/**`, docs operativas y tests (riesgo bajo, pendiente muestreo).
- Tipo C/D probable: componentes con proveniencia declarada o fuerte inferencia (`product-studio`, `caveman`, `impeccable`) (riesgo alto).
- Tipo E: cualquier sección sin historial de prompt/cita y sin evidencia upstream verificable (riesgo medio-alto por incertidumbre).

## Riesgos de titularidad laboral/corporativa

Riesgo detectado en overlay completo orientado a FHH IA Ecosystem:

- Posible creación durante actividad laboral o con recursos corporativos.
- Inclusión de patrones/estándares internos (`tenant`, rutas de documentación interna, lenguaje organizacional).

Estado: `MISSING` autorización documental explícita del titular corporativo.

## Matriz de licencias y compatibilidad (preliminar)

| Familia de licencia | Compatible con núcleo Apache-2.0 | Condiciones clave | Estado en este repo |
|---|---|---|---|
| Apache-2.0 | Sí | Mantener NOTICE y licencias de terceros | Objetivo propuesto, aún no aplicable globalmente |
| MIT / BSD / ISC | Sí | Mantener copyright+license notices | MIT actual del repo; terceros pendientes |
| MPL-2.0 | Condicional | Copyleft por archivo | No confirmado |
| LGPL | Condicional | Reglas de enlace/distribución | No confirmado |
| GPLv2/v3 | Generalmente incompatible para núcleo Apache empresarial cerrado | Copyleft fuerte | No confirmado |
| AGPL | Alto riesgo para modelo corporativo privado | Cláusula de red | No confirmado |
| CC (texto/media) | Depende variante | NC/SA pueden ser incompatibles | No confirmado |
| Sin licencia | No compatible por defecto | Sin permiso de redistribución | Casos con fuente no confirmada |
| Propietaria/custom | Riesgo alto | Permiso expreso requerido | Posible en material externo no verificado |

## Hallazgos P0 (bloquea publicación)

1. Procedencia/licencia no confirmada de `impeccable` y `caveman` (árboles extensos).
2. Material explícitamente “adapted from” repositorio externo sin licencia verificada en la evidencia local.
3. Vendorización de librería externa sin archivo local de licencia/notice de tercero.
4. Riesgo de titularidad corporativa no resuelta para overlay específico FHH.

## Hallazgos P1 (obligatorio antes de público)

1. Falta de `THIRD_PARTY_NOTICES.md` y `NOTICE` operativos.
2. Falta de política formal de contribuciones corporativas y DCO.
3. Falta de gobernanza/seguridad/trademarks explícitos para colaboración externa.
4. Falta de trazabilidad legal por componente (`LICENSE.upstream` o equivalente) en subárboles externos.

## Nota de prudencia legal

Este documento es técnico y de cumplimiento operativo; no constituye asesoría legal. Los casos `CRITICAL/HIGH` requieren revisión por abogado especializado en PI/open source antes de publicar o relicenciar.
