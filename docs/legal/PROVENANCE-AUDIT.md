# PROVENANCE AUDIT

Last updated: 2026-07-23
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

Historical/high-risk provenance classifications still referenced by validation and audit history include `REQUIRES_AUTHOR_PERMISSION`, `UNKNOWN_PROVENANCE`, `EMPLOYMENT_OWNERSHIP_RISK`, and `EXTERNAL_PERMISSIVE`.

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
- `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/**`

3. Runtime adapters
- `templates/runtime-adapters/codex/**`
- `templates/runtime-adapters/copilot/**`
- `templates/runtime-adapters/claude/**`
- `templates/runtime-adapters/antigravity/**`

4. Templates and overlay packs
- `templates/template-manifest.json`
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
| P-001 | `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/01-product/product-studio/jobs-to-be-done/**` | `deanpeters/product-manager-prompts` | `https://github.com/deanpeters/product-manager-prompts` | `ddcd8b00deafe9f3a3f770df6b70a76692d8e0f1` (2026-07-08); local entry `e4f860e` on 2026-07-15, before the 2026-07-17 relicense | Texto adaptado (declarado) | MIT for the pinned pre-v2.3.0 copy | Dean Peters | Sí | `EXTERNAL_PERMISSIVE` | High | LOW | Conservar atribución, snapshot y MIT | No es blocker autónomo mientras se conserve la evidencia | Source path `prompts/jobs-to-be-done.md`, MIT copy, and timing record in `docs/legal/third-party/provenance.json` |
| P-002 | `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/01-product/product-studio/user-story/**` | `deanpeters/product-manager-prompts` | `https://github.com/deanpeters/product-manager-prompts` | `ddcd8b00deafe9f3a3f770df6b70a76692d8e0f1` (2026-07-08); local entry `e4f860e` on 2026-07-15, before the 2026-07-17 relicense | Texto adaptado (declarado) | MIT for the pinned pre-v2.3.0 copy | Dean Peters | Sí | `EXTERNAL_PERMISSIVE` | High | LOW | Igual P-001 | No es blocker autónomo mientras se conserve la evidencia | Source path `prompts/user-story-prompt-template.md`, MIT copy, and timing record in `docs/legal/third-party/provenance.json` |
| P-003 | `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/capabilities/manifests/caveman.md` y skill family `05-caveman/**` | `JuliusBrussee/caveman` | `https://github.com/JuliusBrussee/caveman` | `0d95a81d35a9f2d123a5e9430d1cfc43d55f1bb0` (2026-07-03) | Adaptación/port de skills y manifiestos | MIT | Julius Brussee | Sí | `EXTERNAL_PERMISSIVE` | High | LOW | Conservar MIT y el pin | No es blocker autónomo mientras se conserve la evidencia | Comparación: 11 exactos, 11 adaptados, 9 locales; evidencia y licencia en `docs/legal/third-party/` |
| P-004 | `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/04-crosscutting/impeccable/**` | `pbakaus/impeccable` | `https://github.com/pbakaus/impeccable` | `e587004ee42883dad40d14cd0f5e1b21ae1933df` (2026-05-04) | Código y docs derivados/portados | Apache-2.0 | Paul Bakaus and contributors | Sí (nombres/rutas adaptadas) | `EXTERNAL_PERMISSIVE` | High | LOW | Conservar Apache-2.0 y NOTICE aplicable | No es blocker autónomo mientras se conserve la evidencia | Comparación: 39 exactos, 19 adaptados, 4 locales; Apache y NOTICE en `docs/legal/third-party/` |
| P-005 | `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/04-crosscutting/impeccable/scripts/modern-screenshot.umd.js` | paquete npm `modern-screenshot` | `https://github.com/qq15725/modern-screenshot` | `v4.7.0` / `792d6db7411839c62940a6e930161f8e376e817f` | Vendorizado/minificado | MIT | wxm and contributors | No detectadas | `EXTERNAL_PERMISSIVE` | High | LOW | Conservar MIT y checksum | No es blocker autónomo mientras se conserve la evidencia | SHA-256 verificado por CI y licencia en `docs/legal/third-party/` |
| P-006 | Resto del overlay fuera de P-001 a P-005 y P-010 | Material interno autorizado por declaración del mantenedor | N/A (interno repo) | Revisión del inventario de rutas/contenidos el 2026-07-23 | Configuración, patrones y adaptadores internos | MIT del repositorio, sujeto a la declaración de autorización | FHH/publicador según mantenedor | Sí | `MAINTAINER_ATTESTED_INTERNAL` | Medium | MEDIUM | Renovar atestación al cambiar el inventario; mantener revisión legal final | No es blocker técnico autónomo, pero no sustituye asesoría legal ni prueba independiente de autoría | `docs/legal/overlay-authorship.json` y su validación de inventario |
| P-007 | Núcleo `src/**`, `bin/**`, `scripts/**`, tests | Desarrollo local propio (sin indicios externos directos) | N/A | commits recientes | Implementación original aparente | MIT repo actual | contribuyentes repo | Sí | `ORIGINAL_CONFIRMED` (parcial) | Medium | LOW | Mantener licencia principal; continuar revisiones puntuales | Puede permanecer en core, con revisión incremental | Sin marcadores de copia directa detectados en barrido legal |
| P-008 | Archivos con contenido empresarial específico (`FHH IA Ecosystem`, tenancy/políticas) en overlay full | Material propio del publicador según declaración del mantenedor | N/A | introducidos en `5aeec67` y siguientes | Configuración/patrones específicos de organización | Titularidad/autorización afirmada por el mantenedor | Sí | Sí | `ORIGINAL_CONFIRMED` (maintainer-attested) | Medium | LOW | Mantener registro de la afirmación del mantenedor en la auditoría | No requiere segregación por autorización externa según la información actual | Declaración del mantenedor en sesión del 2026-07-23: "FHH somos nosotros" |
| P-009 | Referencias a fuente externa en documentación y plantillas (no código) | Libros/frameworks y repositorios externos | varias | N/A | Referencias bibliográficas | Generalmente no restrictivo para referencia | terceros | N/A | `AI_GENERATED_LOW_RISK` o `EXTERNAL_PERMISSIVE` según caso | Low | LOW | Atribución editorial recomendada | Mantener referencias, sin copiar texto sustancial sin licencia | Menciones en skills y docs |
| P-010 | Árbol completo `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/01-product/product-studio/**` | Derivación parcial verificada desde `deanpeters/Product-Manager-Skills` (`skills`) y cobertura histórica limitada de P-001/P-002 | `https://github.com/deanpeters/Product-Manager-Skills/tree/main/skills` y `https://github.com/deanpeters/product-manager-prompts` | `99710188c134acf590a02c0e4ee1f431e60004cf` para `Product-Manager-Skills` + snapshot MIT de P-001/P-002 | Habilidad y plantillas externas con mezcla de copias exactas y adaptaciones | `CC-BY-NC-SA-4.0` en el snapshot upstream actual; base completa de redistribución local no cerrada | Dean Peters and contributors (upstream) + adaptaciones locales | Sí | `EXTERNAL_UNVERIFIED` | High | HIGH | No redistribuir públicamente sin decisión legal explícita sobre términos NC/SA y alcance de adaptaciones | Mantener bloqueo de release público y completar dictamen legal o retirar el árbol completo de ambas copias | Comparación directa: 9/19 archivos byte-identical, 9 con misma ruta pero contenido distinto, 1 sin contraparte por ruta; inventario SHA-256 en `docs/legal/third-party/provenance.json` |

## Distinción: idea vs expresión

### Confirmado como expresión potencialmente protegida (no solo idea)

- Bloques textuales declarados como “Adapted from ...” (P-001/P-002).
- Árbol extenso de `impeccable` con heurísticas internas de identificación upstream (P-004).
- Árbol `product-studio` completo, salvo los dos subárboles con evidencia limitada (P-010).
- Código vendorizado/minificado (`modern-screenshot.umd.js`) (P-005).

### Más cercano a idea/concepto general

- Arquitectura de router de workflows, separación core/overlay, adapters delgados (requiere revisar archivo por archivo, pero no hay evidencia directa de copia literal externa en `src/**`).
- Arquitectura de router de workflows, paquetes full + adapters delgados (requiere revisar archivo por archivo, pero no hay evidencia directa de copia literal externa en `src/**`).

## Contenido IA (clasificación de riesgo)

Dado el contexto declarado, y sin bitácora exhaustiva de prompts:

- Tipo A/B probable: partes de `src/**`, docs operativas y tests (riesgo bajo, pendiente muestreo).
- Tipo C/D probable: componentes con proveniencia declarada o fuerte inferencia (`caveman`, `impeccable`, `frontend-design`) y el árbol `product-studio` no verificado (riesgo alto).
- Tipo E: cualquier sección sin historial de prompt/cita y sin evidencia upstream verificable (riesgo medio-alto por incertidumbre).

## Riesgos de titularidad laboral/corporativa

Riesgo detectado en overlay completo orientado a FHH IA Ecosystem:

- Posible creación durante actividad laboral o con recursos corporativos.
- Inclusión de patrones/estándares internos (`tenant`, rutas de documentación interna, lenguaje organizacional).

Estado: declaración explícita del mantenedor indica que el material FHH pertenece al publicador y está autorizado para publicación; no se identificó evidencia contradictoria en esta auditoría.

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

1. P-010 bloquea la publicación: el árbol Product Studio completo sigue `EXTERNAL_UNVERIFIED`; aunque hay derivación técnica parcial comprobada desde `Product-Manager-Skills/skills` (9/19 exactos), faltan cierre jurídico y decisión de redistribución para el conjunto adaptado.
2. P-006 sigue siendo una atestación del mantenedor, no una prueba independiente de autoría; la decisión final de publicarlo requiere revisión jurídica.

## Hallazgos P1 (obligatorio antes de público)

1. Mantener DCO, política de contribuciones corporativas, gobernanza, seguridad y trademarks como controles obligatorios para colaboración externa.
2. Renovar la atestación de overlay al cambiar su inventario y la proveniencia de terceros al importar o actualizar material externo.
3. Obtener aprobación de asesoría legal antes de publicar o relicenciar.

## Nota de prudencia legal

Este documento es técnico y de cumplimiento operativo; no constituye asesoría legal. Los casos `CRITICAL/HIGH` requieren revisión por abogado especializado en PI/open source antes de publicar o relicenciar.
