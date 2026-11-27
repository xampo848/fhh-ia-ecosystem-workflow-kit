# Trabajo pendiente del kit (registro de traspaso)

Fecha del registro: 2026-11-25; actualizado el 2026-11-27. Base: `main` en
`328d328` (`0.24.1-pilot-alignment`); este PR lleva `0.24.2-pilot-followup`.

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
| Cierre: la suite ya no deja carpetas temporales | #90 | sin versión (solo tests) |
| Cierre: hallazgos del CLI de la verificación independiente y follow-ups de los PRD F2 y F4 | #91 | 0.23.5-cli-fixes |
| Cierre: guardas de tests y validadores que faltaban | #92 | 0.23.6-ac-guards |
| Piloto: textos del kit que confundían a un agente en un proyecto instalado, respaldos fuera de `.gitignore`, guarda de rutas instaladas | #96 | 0.23.7-pilot-fixes |
| Segundo piloto: `create-prd` leía guías de configuración como estándares y no avisaba de plantillas sin completar, ejemplo y propuesta de N1, lista de principios de `create-prd` | #97 | 0.23.8-pilot-text |
| Tercer piloto: dónde viven los estándares, ruta del Discovery inicial, detección de plantilla por marcador y momento del aviso en `create-prd` | #98 | 0.23.9-pilot-context |
| Decisiones de diseño tras el piloto: sí con ruta única, "Explicit PRD", límite de archivos del N1, definición de contrato, idioma de identificadores, plantilla del PRD neutral, PRD compacto proporcional, `rollback --from-backups`, y tres incoherencias de `create-prd` (secciones sin encabezado, campos del slice, feature flag) | #99 | 0.24.0-pilot-decisions |
| Pilotos de la 0.23.9 y la 0.24.0: capa ausente, una sola plantilla de reglas del proyecto, ruta de contexto con nivel y traza, plantilla del PRD en español y compacto más corto, código de salida y mensajes de `rollback` sin registro, falso positivo de `doctor` con rutas relativas | #100 | 0.24.1-pilot-alignment |
| Piloto de la 0.24.1: línea `Result` en `rollback`, `update` recrea un archivo de proyecto borrado, simulación resumida (`--all`), aviso de lo que deja `--from-backups`, `doctor` en una carpeta sin kit, Estado del PRD, meta real del PRD compacto, tildes en la plantilla del PRD | este PR | 0.24.2-pilot-followup |

Publicado el 2026-11-26, con aprobación del mantenedor:

- Tags `v0.18.0-equilibrado-profile` a `v0.23.6-ac-guards` (15), uno por
  versión, sobre el commit de la tabla de `docs/versioning.md`.
- Rama `plugin`, con el plugin `fhh` en la versión `0.23.6-ac-guards`.

Publicado el 2026-11-27, con aprobación del mantenedor: los tags
`v0.17.4-usage-measurement`, `v0.17.5-slice-checkpoint`,
`v0.17.6-bounded-output`, `v0.23.7-pilot-fixes`, `v0.23.8-pilot-text` y
`v0.23.9-pilot-context`. También `v0.24.0-pilot-decisions` y
`v0.24.1-pilot-alignment`.

Ninguna de las dos verificaciones independientes (2026-11-25 sobre 0.23.3 y
2026-11-26 sobre 0.23.6) encontró pérdida de contenido sin copia de respaldo.

## 2. Trabajo en curso

Ninguno. Al cierre hay dos PR abiertos de Dependabot (#93, una acción de CI;
#94, `@inquirer/prompts`): tocan CI y dependencias, los decide el mantenedor.

## 3. Decisiones del mantenedor

Resueltas:

1. **Rama `plugin`:** publicada (ver sección 1). Cada versión nueva del kit
   llega a quienes usan el plugin solo cuando se vuelve a publicar.
2. **Tags desde 0.18.0:** creados y subidos. `RELEASE.md` sigue pidiendo
   aprobación para cada tag nuevo. El 2026-11-27 se crearon, con aprobación
   del mantenedor, los tags de 0.17.4, 0.17.5, 0.17.6, 0.23.7, 0.23.8 y
   0.23.9, 0.24.0 y 0.24.1; 0.24.2 aún no tiene tag (`docs/versioning.md` dará su commit tras la fusión).
3. **Ramas ya fusionadas:** el remoto solo tiene `main`, `plugin` y las de
   Dependabot; las ramas locales fusionadas se borraron.
4. **Documentos de traspaso:** no se publican. Dos quedaron respaldados fuera
   del repositorio y el tercero se dio por perdido. De ellos solo queda este
   backlog sin comprometer: un tope de llamadas por tarea y un estado de
   traspaso parcial para los delegados; y seis ideas de eficiencia de tokens
   sin PRD. La regla de lecturas del orquestador ya salió en 0.18.1.

Diferida:

5. **Datos privados en la historia.** Commits antiguos de `main` y un PR
   antiguo conservan un nombre de proyecto privado, y la historia lleva
   correos personales en autores, committers y trailers `Co-authored-by`.
   Corregirlo exige reescribir `main`: cambia todos los hashes, invalida los
   tags y la tabla de versiones, rompe clones y forks, y los PR viejos siguen
   mostrando sus commits originales. El mantenedor decidió no hacerlo por
   ahora. Hacia adelante quedó resuelto: la cuenta usa el correo privado de
   GitHub (los squash de #91 y #92 lo confirman) y cada merge fija su cuerpo
   con `gh pr merge --body`.

## 4. Fallas menores

### Cerradas

| Falla | Cierre |
| --- | --- |
| Mensajes de parada sin `--target` | #91: todo comando impreso lleva el destino absoluto |
| Pasos del plugin del TUI sin `cd <destino> &&` | #91 |
| "toolkit" en mensajes y encabezados | #91: dicen `workflow-kit` |
| `tui --help` prometía `rollback` | #91: la ayuda lista lo que el menú ofrece. El mensaje de `tui` sin terminal era correcto |
| Lock: pid sin validar; carpeta en la ruta del lock | #91: el contenido inválido no se imprime; la carpeta detiene con un mensaje y no se borra |
| Lock con pid vivo y sin hora de inicio hace fallar `doctor` | No es falla: sin hora de inicio no se puede descartar otra ejecución. Queda como error, con un test que lo fija |
| `git fetch origin` en un clon de una sola rama | #91: el mensaje imprime el refspec de la rama |
| Instalar desde un checkout local copia archivos ignorados | No se reprodujo así. La falla real era que un `.DS_Store` en `templates/` detenía `init` y `export`; #91 salta `.DS_Store`, `Thumbs.db` y `desktop.ini` |
| Perfiles de modelo para Copilot | No es falla: se aceptan y funcionan (`--profile copilot=<nombre>`). Faltaba en las guías; #91 |
| Ctrl-C en el TUI sale con 0 | #91: sale con 130 |
| La suite deja carpetas temporales | #90, con un test que lo vigila |
| Follow-ups del PRD F2 (errores crudos `EISDIR`/`EACCES`, mensajes "Fix it by hand", índice con comentario sin cerrar, "lacks the header", export que pasaba a `repo`, guías sobre `registry.json` y `skip_unmanaged`) | #91 |
| Follow-ups del PRD F4 (R8 texto de `delegate-skill-matrix.md`, R10 rutas del kit en `context.md`) | #91 |
| Reglas de AC que se podían romper sin que fallara nada (16 mutaciones de la auditoría) | #92 |

### Abiertas

Ninguna bloquea ni pierde contenido. Encontradas por las verificaciones y
revisiones del cierre; reproducir antes de corregir.

CLI y `doctor`:

- `rollback` guarda un solo nivel: al deshacer un apply borra su registro y no
  restaura el del apply anterior. Desde `0.24.0` un segundo `rollback` seguido
  ya no restaura nada: lista los backups y pide `--from-backups`. Guardar más
  niveles sería una función nueva.
- El bloque generado del pre-filtro de los adaptadores no se puede cambiar
  sin quitarle la decisión `split` a una instalación antigua, así que la
  aclaración del N1 de `0.24.0` (el test no cuenta en el límite de archivos)
  no llega a un agente que solo lee ese bloque. Abrirlo pide que el planner
  reconozca también los textos anteriores del bloque, con un test sobre
  `test/fixtures/legacy-0.18.1/**`: es un lote propio de riesgo alto. Decidido
  por el mantenedor: se hace en una versión propia, después de la `0.24.1`.
- `doctor` dice que un lock que es enlace simbólico "será tomado", pero
  `update` y `rollback` lo rechazan; el mensaje de rechazo dice "folder".
- `doctor` muestra `EISDIR` o `EACCES` en `managed/path-unreadable` cuando no
  puede leer el manifest.
- `export --output` con un enlace roto en medio de la ruta nombra otra causa,
  y con un archivo como salida dice "Check --target".
- `--runtime` con un valor repetido y `--yes` sin `--apply` se aceptan en
  silencio. `--version --bogus` y `help <comando>` tampoco son estrictos.
- `ENAMETOOLONG` crudo con un destino muy largo.
- `update --runtime <otro>` reemplaza la lista de runtimes registrada; el
  README dice que `update` reutiliza la registrada.
- Tras la cadena 0.19.2 → 0.22.0 → actual con `keep` en ambos pasos, `doctor`
  falla por un skill propio que 0.22.0 movió y que los catálogos conservados
  siguen nombrando en la ruta vieja; el mensaje no da comando.
- En modo plugin, la simulación de `update` no muestra las líneas "instala el
  plugin" que la aplicación sí imprime.
- Una señal durante el último archivo imprime "Stopping…" y termina con 0.
- Con un registro sin terminar y un lock vivo, también las simulaciones se
  detienen; las guías dicen que un lock no detiene una simulación.
- Una negación del usuario `!*.workflow-kit-backup-*` en `.gitignore` queda
  anulada: `update` agrega la entrada del kit después.
- Con un `.gitignore` que es enlace simbólico, el menú guiado no muestra la
  nota que sí imprime el CLI.
- Los textos corregidos en `.agents/project/*.md` llegan solo a instalaciones
  nuevas: `update` no reescribe archivos del proyecto.
- La guarda de rutas no juzga rutas de otro runtime en texto compartido ni
  nombres de comandos; estos últimos los cubre un test.

Recuperación tras una ejecución muerta (0.23.5):

- Una carpeta vacía que el kit podría crear, creada a mano, se borra si un
  lock viejo la nombra. Una muerte entre quitar el lock y quitar las carpetas
  deja carpetas vacías.
- En modo plugin, `mode/repo-and-plugin` sigue reportando un archivo idéntico
  al del kit en la ruta de un runtime no instalado, y
  `project-context/missing-path` calla cualquier ruta bajo una carpeta del kit.

Menú guiado:

- Esc no hace nada; la ruta del flujo "doctor" no se valida al escribirla.
- Una herramienta opcional que falla después de aplicar la instalación
  termina igual en "SISTEMA LISTO"; si todas se saltan, dice "completado".
- Responder "no" a `adopt-existing` imprime "Armando el plan falló" y un
  mensaje en inglés.
- Textos en inglés: la intro, el bloque de instalación del plugin, el plan de
  `upgrade`, las migraciones y la salida de `doctor`.

`scripts/build-plugin.mjs --publish`:

- En un clon de una sola rama, si se ignora el aviso y se publica antes de
  traer `origin/plugin`, queda una rama `plugin` local con otra historia y el
  rechazo siguiente no nombra `git branch -D plugin`.
- Interrumpido antes del commit no dice que no se commiteó nada.

Tests:

- Siete mutantes sobreviven en lo liberado en 0.23.5: lock sin `kind` o sin
  hora de inicio, filtro de nombres de archivos temporales, lista de carpetas
  de la simulación de `rollback` con un enlace, validación de carpeta en el
  prompter real del menú y el quoting del consejo de `doctor` del menú.

Follow-ups de los PRD que siguen abiertos por decisión: dividir
`src/migration.mjs` y QA-07 (F2); R7, R9, R11 y N5 (F4, límites aceptados).

Ideas sin decidir: Copilot solo descubre skills a un nivel bajo
`.agents/skills`.

Del piloto de la `0.24.1`, anotado por decisión del mantenedor (no se hace en
la `0.24.2`):

- `update` se niega también en simulación cuando hay un apply incompleto, así
  que no se puede ver el plan antes del `rollback`. Es una guarda puesta a
  propósito; relajarla pide decidir qué puede leer una simulación en ese estado.
- El menú guiado está en español y el resto del CLI en inglés. Fue una
  decisión anterior (`0.23.3`); unificar el idioma es un cambio de producto.
- `doctor` no revisa en `.agents/project/context.md` las rutas que empiezan
  con `../`: son relativas a otro archivo y no se pueden resolver desde la raíz.
- El literal `quality gate: no configurado` (español dentro de texto en
  inglés) vive en el contrato de delegados y en texto generado: va en la
  `0.25.0`, junto con la apertura del bloque del pre-filtro.
- El costo de lectura del Discovery inicial y de `create-prd` compacto (unas
  950 líneas de instrucciones para un resultado pequeño) no se abordó.

## 5. Nunca verificado

- Instalación real del plugin: la rama `plugin` está publicada y coincide con
  el marketplace, pero nadie corrió `claude plugin install` contra ella.
- Ejecución con los binarios reales `claude` y `copilot` (CLI y VS Code).
- TUI en una terminal interactiva real (se probó por pseudo-terminal).
- `upgrade --apply` real contra la red.
- Windows, Linux y un corte de energía real.

## 6. Reglas de trabajo para continuar

- Repositorio público: sin nombres de proyectos privados, rutas locales,
  usuarios ni correos en archivos, ramas, commits o PR.
- Squash merge con CI verde; sin `--admin` ni auto-merge. La protección exige la
  rama al día con `main` (`gh pr update-branch <n>`).
- Sin reescribir historia y sin crear tags salvo decisión del mantenedor.
- `build-plugin.mjs --publish` solo dentro de un clon de prueba, salvo una
  publicación aprobada por el mantenedor.
- El fixture `test/fixtures/plugin-mode/repo-mode-plans.json` se regenera en
  cada release con el comando de la cabecera de `repo-mode-plans.mjs`; el PR
  explica su diff.
- No correr la suite en un checkout con worktrees anidados; no detener procesos
  por nombre (`pkill -f`), solo por pid.
- Siguiente id de eval del router: L27.
- En cada release, registrar en `docs/versioning.md` el commit de la versión
  anterior, y regenerar el fixture aunque el comportamiento no cambie: el
  hash de `last-apply.json` depende de la versión.
- Antes de commitear, `git config user.email` debe ser el noreply de GitHub.
  Cada merge: `gh pr merge --squash --match-head-commit <sha> --subject ...
  --body ...`.

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
descuadren); la instalación del plugin, con la rama ya publicada
(`claude plugin install fhh@fhh-ia-ecosystem --scope project` y después
`doctor`); Copilot real; Windows, si alguien del equipo lo usa.
