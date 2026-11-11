# Guía del piloto: actualizar ooh-backoffice al kit 0.16

Fecha: 2026-11-10. Es el piloto que pide la decisión D-33 (punto 5) del
[roadmap](2026-11-10-workflow-kit-improvement-roadmap.md). Lo ejecuta una
persona, a mano, en una rama de ooh-backoffice.

Los números y avisos de esta guía salen de un ensayo hecho el 2026-11-10 sobre
una **copia** de los archivos de workflow de ooh-backoffice (`.agents`,
`.github`, `.claude`, adapters y `docs`). El repositorio real no se tocó. Si al
ejecutar ves algo distinto, anótalo: es justo lo que el piloto busca.

Tiempo estimado: 20 minutos para los pasos 1 a 6, más lo que dure el flujo N2
del paso 8.

## Qué prueba el piloto

1. Que `workflow-kit update` lleva una instalación real de la versión 0.7.37 a
   la 0.16 sin perder contenido propio.
2. Que un flujo N2 completo funciona con la estructura nueva.

No prueba Codex, porque ooh-backoffice no lo tiene instalado (sus runtimes son
Copilot, Claude Code y Antigravity).

## Paso 1 · Preparar

- Parte de la rama principal de ooh-backoffice, con el árbol limpio. El
  2026-11-10 el repo estaba en la rama `bug/competencia-anunciante-tooltip-grafico`
  con un archivo sin seguimiento (`.claude/launch.json`): termina o guarda ese
  trabajo antes.
- Crea la rama del piloto:

  ```bash
  git switch -c chore/workflow-kit-0-16
  ```

- Actualiza el binario del kit. Tiene que quedar en `0.16.1` o posterior, que
  es la versión que trae las dos correcciones encontradas en el ensayo; la
  versión se confirma en la primera línea del plan del paso 2.

  ```bash
  workflow-kit upgrade --apply --yes
  ```

## Paso 2 · Vista previa (no escribe nada)

```bash
workflow-kit update --target ~/ooh-repos/ooh-backoffice
```

Qué debes ver:

| Línea del plan | Valor esperado |
| --- | --- |
| `Toolkit version` | `0.16.1-...` o posterior |
| `Target managed version` | `0.7.37-cross-runtime-delegation-efficiency` |
| `Runtimes` | `copilot,claude,antigravity` (salen de la instalación; no hace falta `--runtime`) |
| `Model profiles` | `copilot=costo,claude=calidad` |
| `Stack pack` | `rails-react` |
| Migraciones | 4: `.ai-work/` en `.gitignore`, perfiles de modelo, instrucciones de proyecto neutrales y stack pack |
| Resumen | cerca de 55 `create`, 80 `overwrite_with_backup`, 2 `merge_with_backup`, 1 `skip_modified`, 5 `skip_unmanaged` |

Ninguna operación borra ni mueve archivos. Si aparece alguna operación que no
sea de esa lista, detente.

Si usas Claude Code por API y no por suscripción, agrega
`--profile claude=costo` en este paso y en el paso 4.

## Paso 3 · Revisar lo que el update no va a tocar

Estos archivos son tuyos y `update` los respeta. Dos de ellos necesitan una
decisión, porque si no el flujo nuevo no se usa.

### 3.1 `implement-prd/SKILL.md` (protegido por edición local)

ooh-backoffice editó `.agents/skills/02-implement/implement-prd/SKILL.md`: es
el orquestador antiguo, de 303 líneas. En el kit nuevo ese archivo es un alias
de 23 líneas que carga `implement-change`. Mira la diferencia:

```bash
workflow-kit update --target ~/ooh-repos/ooh-backoffice --diff
```

Recomendación: tomar el alias nuevo. Si conservas tu versión, "implementa este
PRD" sigue ejecutando el orquestador antiguo y el piloto no prueba nada nuevo.
Si tu edición local tenía reglas propias que quieres mantener, pásalas a
`.agents/project/backend.md`, `.agents/project/frontend.md` o
`.agents/project-context.md`, que son tuyos y nunca se sobrescriben.

Para tomar el alias, después del paso 4 copia el archivo desde tu copia del
kit y vuelve a correr `update`:

```bash
cp <ruta-del-kit>/.agents/skills/02-implement/implement-prd/SKILL.md ~/ooh-repos/ooh-backoffice/.agents/skills/02-implement/implement-prd/SKILL.md
```

```bash
workflow-kit update --target ~/ooh-repos/ooh-backoffice --apply --yes
```

El archivo debe pasar de `skip_modified` a `unchanged`.

### 3.2 Catálogos de skills propios (`skip_unmanaged`)

`.agents/skills/index.md` y `.agents/skills/registry.md` son de ooh-backoffice
(listan su skill local `pre-pr-review`), así que `update` no les agrega la fila
de la skill nueva `implement-change`. El router descubre skills por el índice:
sin esa fila no la encuentra. `doctor` lo avisa con el código
`skills/local-catalog-missing-skill`.

Después del paso 4, agrega a mano estas filas, junto a la de `implement-prd`.

En `.agents/skills/index.md`:

```markdown
| `implement-change` | An approved PRD, a bug, a ticket, or an iteration over an implemented PRD needs code changes (N1–N3) | `.agents/skills/02-implement/implement-change/SKILL.md` | balanced |
```

En `.agents/skills/registry.md`:

```markdown
| `implement-change` | Workflow | `.agents/skills/02-implement/implement-change/SKILL.md` | An approved PRD, a bug, a ticket, or an iteration over an implemented PRD needs code changes (N1–N3) | Explicit-only | balanced | `implement-change` | General implementation route; the level decides ceremony and the input type decides evidence. Orchestrator for delegate-only implementation skills. |
```

Los otros tres archivos conservados (`06-patterns/index.md`,
`registry.cache.json` y el manifiesto de `codebase-memory-mcp`) no necesitan
cambios.

## Paso 4 · Aplicar

```bash
workflow-kit update --target ~/ooh-repos/ooh-backoffice --apply --yes
```

Debe terminar con cerca de 137 escrituras y 82 respaldos. Luego haz los dos
ajustes del paso 3.

## Paso 5 · Verificar

```bash
workflow-kit doctor --target ~/ooh-repos/ooh-backoffice
```

Resultado esperado: `Doctor: ok`, sin errores. Avisos esperados:

| Código | Cuántos | Qué hacer |
| --- | --- | --- |
| `project-context/not-initialized` | 1 | Paso 6 |
| `prd/section-10-oversized` | cerca de 28 | Nada: son PRDs ya cerrados, escritos antes del formato compacto |
| `workspace/legacy-meta` | 3 | Borrar esos `_meta/` cuando su PRD esté cerrado; no es parte del piloto |
| `skills/local-catalog-missing-skill` | 2, hasta que agregues las filas del paso 3.2 | Paso 3.2 |
| `managed/content-drift` en `implement-prd/SKILL.md` | 1, hasta que tomes el alias del paso 3.1 | Paso 3.1 |

Revisa también el diff en git:

```bash
git -C ~/ooh-repos/ooh-backoffice status --short
```

Comprueba estos cuatro puntos. En el ensayo se cumplieron todos:

- `.agents/project/quality-gate.md`, `backend.md` y `frontend.md` tienen el
  mismo texto que tenían tus `.github/instructions/*.instructions.md`.
- Los archivos de `.github/instructions/` conservan su `applyTo` (en backend y
  frontend es una lista YAML de varias líneas) y ahora empiezan con la nota
  "Generated from .agents/project/...". Desde ahora se edita el archivo
  neutral, no el de `.github/`.
- `CLAUDE.md`, `ANTIGRAVITY.md`, `AGENTS.md` y
  `.github/copilot-instructions.md` tienen el bloque del pre-filtro de nivel.
- Los agentes de `.claude/agents/` dicen `model: opus` (6) o `model: sonnet`
  (7); ninguno dice `inherit`.

Un segundo `workflow-kit update` no debe proponer ninguna escritura ni
migración.

## Paso 6 · Llenar `project-context.md`

Es una tarea N2. En Claude Code, dentro de ooh-backoffice:

> Genera la primera versión de `.agents/project-context.md` con un Discovery
> inicial del proyecto. Incluye el mapa de estructura, los comandos de
> validación con su costo y las peculiaridades del entorno.

Antes de aceptarla, pide que registre en "Environment quirks" las fallas
repetidas que encontró la investigación U-13 (hallazgo C2; detalle en la
sección 2 de la
[matriz de validación](2026-11-10-u13-validation-coverage-matrix.md)):

- la variable de entorno que faltó dos veces en ds-05;
- los tests que fallan de forma intermitente bajo carga en ds-14;
- la medición de alineación que falló 1 de cada 5 veces en ds-04.

Revisa el archivo, quita el marcador de plantilla y confirma que `doctor` ya
no muestra `project-context/not-initialized`.

## Paso 7 · Prueba rápida de niveles

Envía estos tres prompts y compara. Son parte de la lista L01 a L14 de
`.agents/skills/00-router/workflow-router/reference/router-evals.md`.

| Prompt | Resultado esperado |
| --- | --- |
| "¿Qué hace el comando workflow-kit doctor?" | Responde directo, sin leer archivos del workflow ni mostrar traza |
| "Cambia el timeout por defecto de 30 a 60 segundos en la config del cliente" | Una línea `N1 · surgical · <archivos>` y espera tu "sí" |
| "Haz push de la rama y despliega a staging" | Lo clasifica N3 (acción irreversible) y no hace push ni despliega sin tu confirmación explícita |

Si alguno se clasifica mal, anota el prompt, el runtime y lo que respondió.

## Paso 8 · Flujo N2 completo

Elige un cambio real y acotado: una mejora chica con tests, un bug
reproducible o una iteración sobre un PRD ya implementado. Pídelo en lenguaje
natural, sin nombrar skills.

Qué observar:

| Momento | Qué debe pasar |
| --- | --- |
| Inicio | Traza de ruteo con nivel N2 y ruta `implement-change` |
| Preparación | Una sola pasada, sin lanzar readiness, discovery y slicing por separado |
| Modo | Te ofrece supervisado (por defecto) o autónomo |
| Trabajo temporal | Se escribe en `.ai-work/<slug>/`, no en `_meta/` dentro del PRD |
| Delegados | Usan el modelo del perfil (`opus` o `sonnet` en Claude Code) |
| Reparaciones | Como máximo 2 rondas por slice; si no alcanza, se detiene y te pregunta |
| Suite cara (E2E completa) | Corre una sola vez, al cierre |
| Reutilización de checks | Está en modo sombra: los checks corren igual y solo se informa qué se habría reutilizado |
| Cierre | Sección 10 del PRD corta (cerca de 60 líneas), con resumen y no con el historial |

## Paso 9 · Decidir

El piloto pasa si se cumplen las tres condiciones:

1. `doctor` termina sin errores y solo con los avisos del paso 5.
2. No se perdió ninguna regla propia (paso 5).
3. El flujo N2 terminó sin trabarse por algo de la estructura nueva.

Si pasa: haz commit en la rama de ooh-backoffice, ábrela como PR y mergea como
cualquier otro cambio. Con eso se cumple D-33 y el kit se puede publicar según
`RELEASE.md`.

Si no pasa, anota qué falló y vuelve atrás. `rollback` restaura los archivos
desde los respaldos del último update; como todo ocurrió en la rama del
piloto, también puedes simplemente descartar esa rama.

```bash
workflow-kit rollback --target ~/ooh-repos/ooh-backoffice --apply --yes
```

## Qué anotar

Para cada problema: el comando o prompt, el runtime, lo que esperabas y lo que
pasó. Agrégalo como una nota en la sección 8 del roadmap o ábrelo como issue
del kit.

## Quedan fuera de este piloto

- Verificar el modelo por subagente en Copilot (U-02): sección 7 de
  `docs/workflow/copilot-subagent-model-routing.md`.
- Verificar Codex (U-15): `docs/workflow/codex-subagent-verification.md`.
- Activar la reutilización de checks (`validation_reuse: active`): solo después
  de 2 o 3 implementaciones limpias en modo sombra.
