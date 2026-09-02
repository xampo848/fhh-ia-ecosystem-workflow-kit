# Ticket: Enrutar modelos Copilot por tarea de subagente

## Contexto

- El repositorio ya define subagentes por responsabilidad y tiers de razonamiento, pero los perfiles Copilot no seleccionan un modelo por tarea.
- Copilot permite declarar `model` en un perfil `.agent.md`, aunque el catálogo disponible puede variar por cuenta, plan, políticas locales y rollout.
- La configuración actual puede fijar un modelo de subagente, pero no confirma descubrimiento automático del catálogo ni fallback automático.

## Objetivo

Seleccionar para cada subagente Copilot el primer modelo disponible de una cadena ordenada de candidatos, dejando evidencia del tier solicitado y del fallback aplicado.

## Historia de usuario

Como mantenedor del workflow kit, quiero que cada subagente Copilot use modelos adecuados a su responsabilidad y pueda bajar al siguiente candidato disponible, para evitar usar siempre el mismo modelo o fallar cuando una opción esté bloqueada localmente.

## Alcance

- Mantener un catálogo canónico de candidatos Copilot por tier `Liviano`, `Mediano` y `Grande`.
- Asignar cada subagente a un tier según su responsabilidad.
- Resolver el modelo recorriendo candidatos en orden contra la lista local disponible.
- Generar los perfiles Copilot con el candidato preferido y la cadena declarada como metadata operativa.
- Informar si se aplicó fallback o si ningún candidato está disponible.
- Cubrir la política con pruebas y mantener sincronizados los artefactos derivados y templates.

## Fuera de alcance

- Descubrir automáticamente el catálogo interno de Copilot desde el repositorio.
- Prometer que Copilot cambia modelos durante una ejecución sin que el runtime exponga esa capacidad.
- Fallback silencioso que ignore un modelo fijado explícitamente por el usuario.
- Cambiar la resolución de modelos de Codex, Claude o Antigravity.

## Reglas funcionales

- `Liviano`: discovery, revisión acotada, investigación focalizada y validación.
- `Mediano`: implementación backend/frontend, contratos, tests y edición quirúrgica.
- `Grande`: readiness, slicing y QA final.
- La cadena se recorre de izquierda a derecha y se elige el primer nombre presente en `availableModels`.
- El resolver debe recibir `availableModels` desde una fuente local o runtime; no inventa disponibilidad.
- Si se elige un candidato distinto del primero, `fallbackApplied` debe ser `true`.
- Si no hay candidatos disponibles para el tier, la operación falla con un mensaje explícito.
- Los nombres del catálogo son identificadores opacos proporcionados por el usuario y pueden cambiar con el catálogo de Copilot.

## Casos borde y estados

- Lista de modelos vacía: error explícito, sin elegir un modelo arbitrario.
- Modelo preferido bloqueado: seleccionar el siguiente candidato disponible.
- Todos los candidatos bloqueados: error accionable indicando el tier y el subagente.
- Subagente sin tier configurado: error de configuración.
- Catálogo actualizado con nombres nuevos: actualizar la fuente canónica y regenerar adapters.

## Contrato visual

`not-applicable`: el cambio afecta configuración, generación de adapters y validación; no modifica una pantalla.

## Criterios de aceptación

1. El catálogo canónico contiene las cadenas ordenadas para los tres tiers y la asignación de todos los subagentes Copilot.
2. Un subagente `Liviano`, `Mediano` y `Grande` recibe respectivamente el primer candidato disponible de su cadena.
3. Cuando el primer candidato no está disponible, el resolver devuelve el siguiente candidato y marca el fallback.
4. Cuando no existe ningún candidato disponible, el resolver falla explícitamente sin seleccionar otro tier.
5. Los perfiles Copilot generados declaran el candidato preferido y documentan tier y candidatos de fallback.
6. Los artefactos canónicos y sus templates pasan la validación de drift.
7. `node --test test/template-packs.test.mjs` y `bun run check:workflow` pasan.
8. La documentación y los adapters no afirman descubrimiento de catálogo, pinning por tier o fallback automático no confirmado por Copilot.

## Notas para desarrollo

- Fuente de verdad: `scripts/delegate-agent-catalog.json`.
- Generación: `scripts/sync-delegate-runtime-adapters.mjs`.
- Resolución: `scripts/copilot-model-routing.mjs`.
- El resolver es deliberadamente independiente del runtime: Copilot debe proporcionar la lista local de modelos disponibles.
- Los perfiles generados mantienen un `model` preferido para uso directo; el resolver debe ejecutarse cuando se necesite adaptar el perfil al catálogo local.

## Riesgos o dependencias

- Los nombres visibles en el selector Copilot pueden no coincidir con los identificadores aceptados por el runtime.
- El generador no puede comprobar por sí solo permisos, plan, región o rollout del usuario.
- Sin integración runtime que exponga disponibilidad, la selección dinámica requiere alimentar explícitamente `availableModels`.

## Preguntas abiertas

- Pendiente una futura integración con una API/runtime de Copilot que exponga el catálogo local y permita regenerar o seleccionar el perfil automáticamente durante la ejecución.

## Definición de terminado

- Catálogo, resolver y generador implementados.
- Perfiles y templates regenerados desde la fuente canónica.
- Tests enfocados y validación de workflow en verde.
- Fallback y limitaciones de Copilot documentados sin afirmaciones no verificadas.