# Evidence pack: kit-project-overlay

**Fecha**: 2026-11-21
**Épica**: [kit-project-overlay.md](kit-project-overlay.md)
**Sketch**: [../../design/kit-project-overlay-sketch.md](../../design/kit-project-overlay-sketch.md)

Los PRDs hijos reutilizan este pack. Las citas `archivo:línea` corresponden al commit `f5ddeb0` (0.18.1). Las de `src/planner.mjs`, `src/apply.mjs`, `src/rollback.mjs` y `src/workflow-contract/*` siguen valiendo en `737bd36` (0.19.1), porque 0.19.0 y 0.19.1 no tocaron esos archivos. Si un archivo cambió, hay que volver a verificarlas.

Lo que cambió después de 0.18.1 y afecta a esta épica:
- **0.19.0 (reglas de tests)** editó `.agents/project/quality-gate.md` y `templates/stack-packs/rails-react/stack.md`. Los dos son archivos del proyecto que se preservan o se crean una sola vez, así que los proyectos ya instalados no reciben esos cambios. Es un caso real del problema, y se registra como P10 en la épica.
- **0.19.1 (textos del TUI)** movió los textos del menú a `src/tui.mjs` y `src/tui/view.mjs`.
- **PR #78 (0.19.2, lock visual)** toca solo `create-prd`, slicing, QA, el implementador frontend y `solution-sketch/references/ui-sketch.md`. No se cruza con ninguna fase.

## Archivos que no existen

- `docs/foundations/ARCHITECTURE.md`
- `docs/patterns/README.md`
- `docs/epics/`: esta épica es la primera.

## Instalador y actualizador

| Tema | Hallazgo | Evidencia |
| --- | --- | --- |
| Origen de lo que se copia | Recorre todo `templates/repo-overlay-fhh-ia-ecosystem-full/`. Omite solo `README.md` y `.agents/workflow-kit/**`. No hay manifiesto. | `src/planner.mjs:95-121` |
| Adaptadores por runtime | `runtimeTemplatePaths` agrega directorios de plantillas. Deduplica por ruta y gana el último runtime. | `src/runtime-matrix.mjs:1-8`, `src/planner.mjs:123-139` |
| Archivos generados al planificar | Wrappers de instrucciones de Copilot, bloques de `.gitignore`, `stack.md` (se crea una sola vez) y el mapa de docs legacy. | `src/planner.mjs:208-213`, `:1028-1039` |
| `install-state.json` | Guarda `schemaVersion`, `managedBy`, `toolkitVersion`, `generatedAt`, `runtimes`, `overlay`, `modelProfiles`, `stackPack` y `files: {ruta: sha256}`. No registra dueño, versión ni categoría por archivo. | `src/planner.mjs:611-654` |
| Algoritmo de update | Si el archivo falta, `create`. Si el contenido es igual, `unchanged`. Si el hash difiere del registrado:<br>• con estrategia de merge, hace el merge;<br>• si el archivo está protegido, `skip_modified`;<br>• en otro caso, `skip_modified` o, con `--overwrite-modified`, lo sobrescribe.<br>Si el hash coincide, sobrescribe. Si no hay hash registrado, `skip_unmanaged`. | `src/planner.mjs:249-486`, `:385-439` |
| Archivos que el kit dejó de distribuir | Nunca se borran, y su entrada en el state queda para siempre. | `src/planner.mjs:612` |
| Backups, journal y rollback | Guarda `<archivo>.workflow-kit-backup-<stamp>` y `last-apply.json`. El rollback conserva los archivos editados después del apply. | `src/apply.mjs:81-84`, `:104-117`, `src/rollback.mjs:48-60` |
| Ownership escrito a mano | Hay tres conjuntos:<br>• **Se preservan una vez creados:** `project-context.md`, `project/*.md`, `paths.json`, `skills/index.md`, `06-patterns/index.md`, `registry.md`, `registry.cache.json`.<br>• **Se mezclan filas:** `index.md`, `06-patterns/index.md`, `registry.md`.<br>• **Protegidos completos:** `instructions.md`, `AGENTS.md`, `CLAUDE.md`, `ANTIGRAVITY.md`, Copilot. | `src/planner.mjs:17-47`, `:674-697` |
| `registry.json` | Gana la entrada que ya existe, salvo que el kit traiga la misma clave o ruta. Registra solo los `SKILL.md` que encuentra bajo `.agents/skills` y poda los huérfanos. | `src/planner.mjs:741-786`, `:858-905` |
| Merge por marcadores | Existe solo para `docs/README.md`. El prefiltro de nivel se sincroniza solo dentro de las plantillas del kit. | `src/planner.mjs:956-980`, `scripts/sync-level-prefilter.mjs:18-24` |
| Manifiesto del kit | `.agents/workflow-kit/manifest.json` declara `portable_core`, `repo_overlay`, `runtime_adapters` y `derived_artifacts`, con `"not_an_installer": true`. Ningún código lee esas claves. | `.agents/workflow-kit/manifest.json` |
| Drift check | Exige que el `.agents/` de la plantilla sea idéntico byte a byte al `.agents/` de este repo. | `src/workflow-contract/drift.mjs:20-57` |
| Upgrade del CLI | `bun add -g github:<repo>#<ref>` | `src/upgrade.mjs:37-53` |
| Wrappers de Claude | Una lista fija `claudeSkillKeys` genera 11 wrappers con `disable-model-invocation: true` que apuntan a `.agents/skills/...`. | `scripts/sync-claude-skills.mjs:18-30` |
| Agentes delegados | Se renderizan al instalar desde `delegate-agent-catalog.json`, según el perfil de modelo. | `src/model-profiles.mjs:163-181`, `src/planner.mjs:706-709` |
| Instrucciones de Copilot | Se generan desde `.agents/project/*.md`. | `src/project-instructions.mjs:67-82` |

Conteo de base, medido el 2026-11-21:
- La plantilla del overlay tiene 264 archivos, 253 de ellos bajo `.agents/`.
- El adaptador de Claude agrega 25 archivos.
- `agents-md`, `codex` y `copilot` agregan 30 en total.

Una instalación en modo repo para Claude escribe unos 289 archivos.

## Contratos y documentación

| Tema | Hallazgo | Evidencia |
| --- | --- | --- |
| Portable core y repo overlay | El contrato ya define los dueños de cada capa, pero solo como texto. Nada lo hace cumplir. | `.agents/capabilities/README.md` ("Portable core vs repo overlay"), `docs/project-boundaries.md` |
| Cómo se extiende hoy | La guía indica editar en el lugar el router, `instructions.md`, `registry.md` e `index.md`. | `docs/extending-the-workflow.md:11-60` |
| Patterns del proyecto | `add-project-pattern` crea `.agents/skills/06-patterns/<dominio>/<skill>/SKILL.md` y edita a mano `registry.md`, `registry.json` y `registry.cache.json`. | `.agents/skills/06-patterns/authoring/add-project-pattern/SKILL.md:24-58` |
| Descubrimiento nativo | Copilot y Codex leen `.agents/skills/**` directamente. Claude usa wrappers en `.claude/skills/**`. | `.agents/instructions.md` ("Physical skill ownership") |
| Acción irreversible | Siempre nombra el riesgo y espera un sí explícito. | `.agents/instructions.md` (tabla de niveles y gate), router (fila "Irreversible operational action") |
| Memoria compartida | Debe ser opt-in, curada y sin secretos. Aplica a los runbooks capturados. | `.agents/memory/README.md` |

## Investigación externa (2026-11-21)

Es investigación delegada. Las filas marcadas *sin verificar* se confirman al iniciar el PRD de F4.

| Tema | Hallazgo | Fuente |
| --- | --- | --- |
| Agent Plugins 1.0 | Estándar entre vendors publicado el 2026-08-06 (AWS, Anysphere, Microsoft, OpenAI, Vercel; luego Google). Estandariza `plugin.json` en la raíz, `skills/<nombre>/SKILL.md` y `mcp.json`. El resto va en carpetas de cada vendor. Que el texto siga como "Working Draft" está *sin verificar*. | https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md · https://github.blog/changelog/2026-08-12-agent-plugins-1-0-in-vs-code-copilot-cli-and-the-copilot-app |
| Claude Code | Plugins y marketplaces (`.claude-plugin/`):<br>• **Contenido:** skills, comandos, agentes, hooks, MCP. No carga un `CLAUDE.md` en la raíz.<br>• **Proyecto:** `enabledPlugins` y `extraKnownMarketplaces` en `.claude/settings.json`. Cada persona igual instala una vez; solo los managed settings lo hacen obligatorio.<br>• **Nombres:** las skills quedan como `/plugin:skill`. Las del plugin y las locales cargan las dos.<br>• **Auto-update:** apagado por defecto en marketplaces de terceros. | https://code.claude.com/docs/en/plugins-reference · https://code.claude.com/docs/en/plugin-marketplaces |
| Codex | Lee `plugin.json` portable, `.codex-plugin/` y manifiestos compatibles con Claude. Hay marketplace de repo en `.agents/plugins/marketplace.json`, y el proyecto habilita plugins en `.codex/config.toml`. La precedencia frente a `.agents/skills` está *sin verificar*. | https://developers.openai.com/codex/plugins/build.md |
| GitHub Copilot | Agent plugins (GA) en VS Code, Copilot CLI y la app. Detecta los formatos Agent Plugins, Copilot y `.claude-plugin`. Los defaults de repo van en `.github/copilot/settings.json` o en `.claude/settings.json`, como recomendación. Sin verificar: la precedencia en colisiones y si el agente cloud carga plugins. | https://code.visualstudio.com/docs/copilot/customization/agent-plugins · https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-plugins |
| Cursor | Cursor Plugins y Agent Plugins. Un marketplace de equipo puede marcar un plugin como **Required**. No se documenta una declaración por repo. | https://cursor.com/docs/plugins |
| Gemini CLI / Antigravity | Extensiones con `gemini-extension.json`. Según las docs, Gemini CLI fue reemplazado por Antigravity CLI para los tiers gratuitos el 2026-06-18. Queda fuera de esta épica. | https://geminicli.com/docs/extensions/reference/ |
| MCP como canal | Claude, VS Code y Gemini muestran los prompts MCP como slash commands. No son skills: no tienen carga progresiva ni scripts, y se invocan a mano. Sirven solo como componente de un plugin. | https://code.claude.com/docs/en/mcp |
| Agent Skills | Define solo el formato `SKILL.md`: `name` igual al nombre del directorio, más `description`. No cubre empaquetado. | https://agentskills.io/specification |
