# Trabajo pendiente del kit (registro de traspaso)

Fecha del registro: 2026-11-25. Base: `main` en `718aa4e` (`0.23.4-docs-sync`).

Este documento permite continuar el trabajo desde otra sesión o equipo. Es una
foto: antes de actuar, compruébalo con `git log`, los PR abiertos y el
`CHANGELOG.md`. No se distribuye en el paquete (`docs/plans/`).

## Cómo retomar

En una sesión nueva, desde la raíz del repositorio:

```text
Lee docs/plans/2026-11-25-kit-pending-work.md, compruébalo contra main y los
PR abiertos, y dime qué sigue antes de editar nada.
```

## 1. Estado de lo entregado

| Entrega | PR | Versión |
| --- | --- | --- |
| Seis mejoras del kit y épica kit/overlay (F1 a F4) | #76 a #83 | 0.19.0 a 0.23.0-plugin-mode |
| Auditoría: datos privados fuera de `docs/plans` y del paquete | #85 | sin versión |
| Auditoría: guards de scripts y gates de release | #84 | 0.23.1-script-guards |
| Auditoría: recuperación de `apply` y `rollback` | #86 | 0.23.2-apply-recovery |
| Auditoría: CLI estricto, `doctor`, `upgrade`, TUI en español | #87 | 0.23.3-strict-cli |
| Auditoría: documentación fiel a tags y CLI, cierre de épica y PRD | #88 | 0.23.4-docs-sync |

La auditoría completa del 2026-11-25 no encontró pérdida de datos sin copia de
respaldo.

## 2. Trabajo en curso

Ninguno al momento del registro: los cinco frentes de la auditoría están en
`main` y no hay PR abiertos del lote.

## 3. Decisiones pendientes del mantenedor

Ninguna se ejecuta sin su aprobación explícita.

1. **Publicar la rama `plugin`.** No existe en el remoto, así que instalar el
   plugin falla. Desde `main` limpio: `node scripts/build-plugin.mjs --publish`
   y luego el push de la rama `plugin`.
2. **Tags desde 0.18.0.** El remoto solo tiene tags hasta
   `v0.17.3-contract-gaps`. `RELEASE.md` pide aprobación para cada tag.
3. **Ramas remotas ya fusionadas** y worktrees locales: no se han borrado.
4. **Datos privados en la historia.** Commits antiguos de `main` y un PR
   antiguo conservan un nombre de proyecto privado, y varios squash commits
   llevan un trailer `Co-authored-by` con un correo personal de dominio
   corporativo (GitHub lo agrega cuando los commits de la rama tienen otro
   autor). Corregir la historia exige reescribirla: decisión del mantenedor.
   Para PR nuevos, fijar el cuerpo del squash (`gh pr merge --body`) evita el
   trailer.
5. **Documentos de traspaso sin publicar.** Existen solo en una rama local del
   equipo original (`claude/t06-general-purpose-origin-9cb6bc`, tres archivos
   en `docs/workflow/handoffs/`). Falta decidir si se publican.

## 4. Fallas menores conocidas

Ninguna bloquea. Cada arreglo necesita su test y los pasos de release si toca
superficie distribuida (`docs/versioning.md`).

Comprobadas en `96ec070` por búsqueda en el código:

- Los mensajes de parada de `src/apply.mjs`, `src/planner.mjs` y
  `src/rollback.mjs` imprimen `workflow-kit rollback --apply --yes` sin
  `--target`.
- El TUI imprime los pasos de instalación del plugin sin `cd <destino> &&`
  (`formatPluginInstallSteps` no recibe el destino).
- Mensajes del CLI de `upgrade` y encabezados de planes usan "toolkit" donde el
  resto dice "workflow-kit".
- `tui --help` y el mensaje de `tui` sin terminal nombran `rollback`, pero el
  menú del TUI no tiene esa opción (la documentación ya se corrigió en
  0.23.4; falta `src/`).

Reportadas por las revisiones; reproducir antes de corregir:

- Lock: el mensaje repite un pid sin validar; un directorio en la ruta del lock
  se reporta como lock viejo; un lock con pid vivo y sin hora de inicio hace
  fallar `doctor`.
- La sugerencia `git fetch origin` no sirve en un clon de una sola rama.
- Instalar desde un checkout local copia archivos de plantilla ignorados por
  git.
- Se aceptan perfiles de modelo para Copilot aunque los docs los describen solo
  para Claude y Codex.
- Ctrl-C dentro del TUI sale con código 0.
- Las pruebas de template pack tardan unos 10 s más y la suite deja carpetas
  temporales.

Follow-ups anteriores, en la sección 10 de los PRD de
`docs/prd/kit-project-overlay/` (F2: manifest-updater; F4: plugin-mode-pilot).
Algunos pueden haber quedado resueltos en 0.23.x.

Ideas sin decidir: Copilot solo descubre skills a un nivel bajo
`.agents/skills`.

## 5. Nunca verificado

- Instalación real del plugin desde el marketplace (requiere publicar `plugin`).
- Ejecución con los binarios reales `claude` y `copilot` (CLI y VS Code).
- TUI en una terminal interactiva real.
- `upgrade --apply` real contra la red.
- Windows y un corte de energía real.

## 6. Reglas de trabajo para continuar

- Repositorio público: sin nombres de proyectos privados, rutas locales,
  usuarios ni correos en archivos, ramas, commits o PR.
- Squash merge con CI verde; sin `--admin` ni auto-merge. La protección exige la
  rama al día con `main` (`gh pr update-branch <n>`).
- Sin reescribir historia y sin crear tags salvo decisión del mantenedor.
- `build-plugin.mjs --publish` solo dentro de un clon de prueba, salvo la
  publicación aprobada del punto 1 de la sección 3.
- El fixture `test/fixtures/plugin-mode/repo-mode-plans.json` se regenera en
  cada release con el comando de la cabecera de `repo-mode-plans.mjs`; el PR
  explica su diff.
- No correr la suite en un checkout con worktrees anidados; no detener procesos
  por nombre (`pkill -f`), solo por pid.
- Siguiente id de eval del router: L27.
- En cada release, completar el hash de la versión anterior en la tabla de
  `docs/versioning.md` (la fila de `0.23.4-docs-sync` queda sin hash hasta la
  siguiente versión).

## 7. Prompt de verificación independiente

Para usar en una sesión nueva sobre `main`.

```text
Actúa como verificador independiente del workflow kit de este repositorio.
Objetivo: comprobar, ejecutando, que las mejoras recientes funcionan de punta
a punta para un usuario real, y decirme qué falla. No corrijas nada.

CONTEXTO
- `main` contiene: reglas de generación de tests, claridad del TUI, lock
  visual, la épica kit/overlay (contrato, runbooks, updater con migración,
  modo plugin piloto) y una ronda de correcciones de auditoría (guards de
  scripts, recuperación de apply/rollback, CLI estricto, docs).
- Versión actual: la de `package.json`. Qué cambió en cada versión:
  `CHANGELOG.md`. Requisitos: `docs/prd/kit-project-overlay/` y
  `docs/epics/kit-project-overlay/`.
- Pendientes conocidos, no los reportes como hallazgo: los de
  `docs/plans/2026-11-25-kit-pending-work.md` y los seguimientos anotados en la
  sección 10 de cada PRD.

REGLAS
- Solo lectura sobre este checkout: sin editar, commitear, cambiar de rama,
  tocar git config, push ni red. Nada de `npm install`, `upgrade --apply`
  real, ni los binarios reales `claude` o `copilot`: usa stubs primero en PATH.
- Trabaja en copias temporales: `git clone --local` de este repo en una
  carpeta temporal, con `node_modules` enlazado y agregado a
  `.git/info/exclude`. No corras la suite dentro de este checkout si tiene
  worktrees anidados.
- Para probar actualizaciones reales, obtén el CLI de versiones anteriores con
  `git archive <commit>`; la tabla de `docs/versioning.md` da el commit de
  cada versión.
- Verifica ejecutando. Lo que solo leíste, dilo. Sin opiniones de estilo.
- Usa subagentes con modelos menores para el trabajo y coordínalos tú. Antes
  de reportar un hallazgo importante, reprodúcelo tú mismo.

QUÉ PROBAR
1. Línea base: suite completa y todos los `check:*` en un clon limpio; CI del
   último commit de `main`.
2. Actualizaciones reales: instala con cada versión anterior desde 0.19.2,
   para varias combinaciones de runtime; edita un skill del kit, agrega un
   skill propio y su fila en los catálogos, escribe texto propio en los
   adaptadores; luego actualiza con el CLI actual. Comprueba: la simulación
   dice lo mismo que la aplicación, nada tuyo se pierde, cada archivo
   reemplazado o borrado tiene backup, `doctor` termina limpio o nombra lo
   pendiente con un comando que funciona tal como se imprime, un segundo
   `update` deja `git status` limpio, y `rollback` devuelve el árbol exacto.
3. Instalación nueva con cada runtime, perfil de modelos y stack pack:
   `init`, `doctor`, `update`, `export`, `rollback`.
4. Interrupciones y concurrencia: mata `update`, la migración y `rollback`
   con SIGINT, SIGTERM y SIGKILL en distintos puntos; lanza dos comandos a la
   vez; deja un lock viejo. Siempre debe poder volverse al árbol exacto y
   ningún contenido puede perderse sin copia.
5. CLI: flags que un comando no usa, valores vacíos o repetidos, perfiles
   para runtimes no instalados, `--target` inexistente o que es un archivo,
   rutas con espacios y comillas. Debe salir con error claro y sin escribir.
   Corre desde otra carpeta cada comando que el kit imprime (mensajes de
   stop, `doctor`, resúmenes).
6. Modo plugin: `init --mode plugin`, cambios de modo en ambos sentidos,
   `doctor` con un stub de `claude plugin list`, y `scripts/build-plugin.mjs`
   en modo check, `--write` y `--publish` solo dentro de un clon temporal con
   un `origin` falso.
7. TUI guionado: los mismos flujos que el CLI deben escribir los mismos
   archivos; todo texto propio del TUI en español; cancelar no escribe nada.
8. Documentación: sigue `README.md`, `docs/quickstart.md`,
   `docs/github-install.md`, `docs/migration.md` y `docs/troubleshooting.md`
   comando por comando; cada comando o afirmación que la ejecución contradiga
   es un hallazgo.
9. Repo público: busca en archivos versionados nombres de proyectos privados,
   rutas locales, correos y secretos.
10. Completitud: para cada criterio de aceptación de los PRD, ¿hay un test
    que falle si el comportamiento se rompe? Compruébalo mutando una copia.

ENTREGA
- Hallazgos ordenados: bloqueante / corregir / menor / nota. Cada uno con el
  comando exacto, qué pasó, qué debía pasar, archivo:línea de la causa y si
  lo reprodujiste tú.
- Lista de lo confirmado, con cantidad de escenarios ejecutados por punto.
- Lista de lo que no se pudo verificar.
- No propongas ni apliques arreglos hasta que yo lo pida.
```

Lo que un agente no puede probar y conviene hacer a mano: el TUI en una terminal
real (responder "sí", cancelar con Ctrl-C, revisar que las cajas no se
descuadren); la instalación del plugin una vez publicada la rama
(`claude plugin install fhh@fhh-ia-ecosystem --scope project` y después
`doctor`); Copilot real; Windows, si alguien del equipo lo usa.
