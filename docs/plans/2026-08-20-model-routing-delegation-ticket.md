# Ticket: Recalibrar y declarar el model routing de implement-prd

## Contexto

- `implement-prd` define tiers `Liviano`, `Mediano` y `Grande`, además de las posturas `lean`, `balanced` y `premium`.
- La matriz actual agrupa readiness y slicing con validación como tareas `lean`/`Liviano`.
- Readiness y slicing deciden alcance, ownership, orden y evidencia; un error en esas fases se propaga a toda la implementación.
- Los adapters de Codex, GitHub Copilot y Claude Code no declaran sus capacidades de catálogo, pinning o fallback, aunque la política neutral exige esa información.

## Objetivo

Hacer que la política de model routing sea más coherente y auditable sin implementar todavía selección dinámica de modelos ni telemetría.

## Alcance

- Recalibrar la matriz de routing para distinguir readiness/slicing de discovery/validación.
- Declarar en la configuración canónica las capacidades de model routing conocidas para cada runtime.
- Regenerar adapters y copias de templates desde sus fuentes canónicas.
- Añadir o ajustar pruebas para detectar drift y validar las nuevas declaraciones.

## Fuera de alcance

- Selección automática de un modelo exacto en tiempo de ejecución.
- Telemetría de tokens, latencia, coste o calidad.
- Cambios en la orquestación de subagentes o en los contratos de handoff.
- Cambiar `model: inherit` u otros defaults runtime sin evidencia de que el runtime soporte el pinning.

## Reglas funcionales

- Readiness y slicing deben usar como mínimo posture `balanced` y tier `Grande`, salvo que una regla posterior de hazard justifique un tier superior.
- Discovery, revisión y validación permanecen en `lean`/`Liviano` cuando su trabajo sea acotado y de fallo ruidoso.
- Las capacidades runtime deben declararse explícitamente como booleanos o estados verificables, sin afirmar soporte que el adapter no pueda confirmar.
- Los adapters generados y los overlays de templates deben permanecer idénticos a la salida del generador.
- La documentación debe diferenciar política declarada de selección efectivamente ejecutada.

## Criterios de aceptación

1. La matriz de model routing asigna readiness y slicing a `balanced`/`Grande` y conserva discovery/validación en `lean`/`Liviano` cuando corresponda.
2. El catálogo canónico contiene una declaración de capacidades de model routing por runtime.
3. La salida generada para Codex, Copilot, Claude y sus templates incluye esas declaraciones sin editar archivos generados manualmente.
4. Una prueba falla si las declaraciones canónicas y los adapters o templates divergen.
5. `bun run check:workflow` y `bun test` pasan.
6. No se introduce ninguna afirmación de cambio automático de modelo que el runtime no confirme.

## Notas para desarrollo

- Superficies principales: `scripts/delegate-agent-catalog.json`, `scripts/sync-delegate-runtime-adapters.mjs`, `.agents/model-routing/README.md` y los tests de templates/workflow.
- El catálogo es la fuente de verdad de agentes y adapters; la matriz Markdown es un artefacto generado.
- La declaración de capacidades puede vivir en un bloque de metadata del adapter o en un artefacto común generado, siempre que sea consumible y testeable por runtime.

## Riesgos o dependencias

- Las capacidades exactas dependen de lo que el runtime exponga al usuario; no deben inferirse solo por la existencia de un archivo adapter.
- Cambiar la matriz sin conectar una futura resolución de modelo sigue siendo una mejora de política, no ejecución dinámica.

## Preguntas abiertas

- Ninguna bloqueante para este ticket.

## Definición de terminado

- Fuentes canónicas actualizadas.
- Artefactos generados sincronizados.
- Tests enfocados y suite completa en verde.
- Diff revisado para confirmar que no se tocaron superficies no incluidas.
