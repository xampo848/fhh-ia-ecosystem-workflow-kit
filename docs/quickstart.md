# Quickstart

This guide shows the safe adoption path. Start with dry-run, inspect the plan, then apply only when ready.

If your repository already exists (has docs/skills/runtime conventions), start here first:

- [Get Started for Existing Repositories](get-started-existing-repo.md)

Commands assume the global install from [GitHub install](github-install.md).
From a clone of this repository, replace `workflow-kit` with
`node bin/workflow-kit.mjs`.

## 1. Preview an install

```bash
workflow-kit init --target /path/to/repo
```

Default behavior is dry-run. It prints planned files and writes nothing.

`init` always installs the complete FHH IA Ecosystem workflow overlay (the full
`.agents` tree, skills, manifests, and workflow metadata); there is no partial
or placeholder mode.

Operation meanings in preview:

- `create`: new file
- `unchanged`: no write
- `overwrite_with_backup`: write with backup first
- `merge_with_backup`: intelligent merge with backup first
- `overwrite_no_backup` / `merge_no_backup`: same, with `--backup-mode none`
- `skip_modified`: pending during update: a kit file you edited, or your own file at a kit path the install never recorded
- `skip_unmanaged`: a project file the kit only seeds (or an adapter with broken markers), left as it is
- `adopt_existing`: baseline captured during update bootstrap

## 2. Preview selected runtime adapters

```bash
workflow-kit init \
  --target /path/to/repo \
  --runtime codex,copilot
```

## 3. Apply after review

```bash
workflow-kit init \
  --target /path/to/repo \
  --runtime codex,copilot \
  --apply --yes
```

Apply requires both `--apply` and `--yes`; passing `--dry-run` together with
`--apply` is an error. Changed existing files are backed up before overwrite
unless you pass `--backup-mode none` (then `rollback` cannot restore them).

For existing repositories, this apply step also enables:

- skills registry JSON merge,
- docs hub non-destructive insertion,
- one-time legacy docs migration map generation when legacy docs are detected.

### Model profile per runtime (`calidad` / `equilibrado` / `costo`)

Delegate agents get their model from the project's **model profile**, chosen
by how each runtime is billed:

- `calidad` (default for Claude Code and Codex): subscription. Sonnet or GPT
  Sol by default, Opus or GPT Sol extra-high for implementers, QA, and
  slicing; never small models.
- `equilibrado` (opt-in): a subscription that often hits its weekly limits.
  Opus or GPT Sol extra-high only for slicing and final QA; implementers,
  tests, and contract checks on Sonnet or GPT Sol medium; never small models.
- `costo` (default for Copilot, and any per-token API): small models for
  reading, validation, and docs; Grande only for critical concerns.

`init` asks once per Claude Code or Codex runtime (an `ANTHROPIC_API_KEY` or
`OPENAI_API_KEY` only preselects `costo`). Non-interactive runs use the
default. Set or change it any time:

```bash
workflow-kit update --target /path/to/repo --profile claude=costo,codex=calidad --apply --yes
```

`update` keeps the stored profile; `doctor` prints it and fails if an agent's
model does not match. Details: `.agents/model-routing/README.md`.

## 4. Validate installed files

```bash
workflow-kit doctor \
  --target /path/to/repo \
  --runtime codex,copilot
```

`doctor` validates both installed files and workflow semantics. It reports
stable diagnostic codes for adapter coverage, per-turn intake, skill and
capability registries, and managed-file drift.

Supported runtimes are `codex`, `copilot`, `claude`, `antigravity`, and
`opencode` (which uses the shared `AGENTS.md`). The neutral workflow contract
is always installed; `--runtime neutral` installs it without adapters.

If doctor reports issues, go directly to [Troubleshooting](troubleshooting.md).

After the first install, complete the one-time steps that belong to your
project, starting with `.agents/project/context.md`:
[Per-project setup after installing](../README.md#per-project-setup-after-installing).

### 5-minute operational checklist

1. Run dry-run once and confirm operation types are expected (`create`, `merge_with_backup`, `overwrite_with_backup`).
2. Apply with `--apply --yes` and confirm backups exist for any overwritten or merged file.
3. Run `workflow-kit doctor --target /path/to/repo --runtime <your-runtimes>` and confirm no blocking errors.
4. In the target repo, verify these files exist:
   - `.agents/instructions.md`
   - `.agents/skills/00-router/workflow-router/SKILL.md`
   - `.agents/skills/registry.json`
   - `.agents/project/backend.md` and `.agents/project/frontend.md` (or an explicit N/A decision for missing surfaces)
5. Send one natural-language prompt in your agent runtime (for example, "Implementa una mejora pequeña con tests") and confirm routing starts from the installed workflow.

## 5. Update workflow-kit itself before updating projects

`upgrade` updates the `workflow-kit` tool on your machine; it never changes a
project. Preview the command it will run:

```bash
workflow-kit upgrade
```

Apply the latest `main` version to your machine:

```bash
workflow-kit upgrade --apply --yes
```

`upgrade` checks that the ref exists and is reachable before it replaces the
installed version, so a mistyped ref or a network failure changes nothing. To
pin a release, pass its tag (see [Versioning](versioning.md)):

```bash
workflow-kit upgrade --ref v0.22.0-manifest-updater --apply --yes
```

After that, run `update` in each project you manage to bring its workflow to
the new version.

## 6. Guided TUI

```bash
workflow-kit tui
```

The first screen, `¿Qué quieres hacer?`, offers these options:

| Option | What it acts on | CLI equivalent |
| --- | --- | --- |
| `Instalar el workflow en un proyecto` | the project you choose | `init` |
| `Actualizar el workflow de un proyecto` | the project you choose | `update` |
| `Exportar el workflow a una carpeta` | an output folder, no project | `export` |
| `Revisar el workflow de un proyecto (doctor)` | the project you choose, read-only | `doctor` |
| `Actualizar workflow-kit (esta herramienta)` | `workflow-kit` on this machine, no project | `upgrade` |
| `Instalar solo herramientas opcionales (MCP)` | optional MCP tools, no workflow files | — |

Updating the tool and updating a project are separate: after
`Actualizar workflow-kit (esta herramienta)`, launch the TUI again and choose
`Actualizar el workflow de un proyecto` in each project.

Every flow that writes shows a preview before asking whether to write. The default confirmation writes nothing.
It can also open an optional capability guide (Context7, Engram, codebase-memory-mcp) with source/scope/mode confirmation and official install commands.
The install package is fixed to `Full FHH IA Ecosystem`.

## 7. Export templates without treating the output as a repo install

Preview export:

```bash
workflow-kit export --output /tmp/workflow-kit-export --runtime codex,copilot
```

Apply export after review:

```bash
workflow-kit export --output /tmp/workflow-kit-export --runtime codex,copilot --apply --yes
```

`export` uses the same dry-run-first planner and backup behavior as `init`.

## 8. Update an already-installed repo safely

Preview update:

```bash
workflow-kit update --target /path/to/repo
```

Apply update:

```bash
workflow-kit update --target /path/to/repo --apply --yes
```

Local edits in tracked files, and your own files at kit paths the install never recorded, stay pending (`skip_modified`) until you decide them with `--edited`; project files the kit only seeds are left as they are (`skip_unmanaged`).

When an update includes a smart composition, it appears as `merge_with_backup`.

Legacy bootstrap when `.agents/workflow-kit/install-state.json` does not exist yet:

```bash
workflow-kit update \
  --target /path/to/repo \
  --runtime codex,copilot \
  --adopt-existing \
  --apply --yes
```

## 9. Optional alternative tools (Engram, Context7, codebase-memory-mcp)

After `init`, you can guide users to install or attach external capabilities.
Use the neutral integrations contract in `.agents/integrations/README.md`.

Recommended prompts in the target repo:

```text
Instala Context7 para este proyecto y adjuntalo al flujo neutral.
Antes de instalar, muestrame un resumen de confirmacion con fuente, scope y efecto esperado.
```

```text
Engram ya esta disponible globalmente. Haz solo attach en este repo y documenta el estado final.
```

```text
Quiero codebase-memory-mcp. Primero dime si es install+attach o attach-only y espera mi aprobacion antes de ejecutar comandos.
```

Minimum guardrails:

- Never install silently; require explicit approval first.
- Classify the intent as `install + attach` or `attach-only`.
- Default to official/curated source unless user requests another source.
- Record selected scope (`user/global`, `repo/project`, or `hybrid`).
- A capability is complete only when it is attached and documented in the repo.

## Example prompts

Describe intent; you do not need skill names. A typical slice moves from
discovery to epics, tickets or PRDs, implementation, and documentation.

```text
Help me run product discovery for a feature that reduces onboarding drop-off. I need problem framing, assumptions, risks, and success metrics.
```

```text
Create epics for this initiative and organize them by user value, technical dependencies, and delivery order.
```

```text
Break Epic 2 into implementation-ready tickets with acceptance criteria, edge cases, and test expectations.
```

```text
Implement ticket PAY-14 in this repository. Keep changes minimal, add tests, and summarize trade-offs.
```

```text
Document what was implemented for PAY-14, including scope, decisions, validation steps, and known limitations.
```

```text
I want to use Context7 and memory tools in this repo. Guide me through install/attach with confirmation before any install step.
```

Practical notes:

- Be explicit about the outcome you want; the router performs better with clear intent and context.
- Reference artifact names (epic IDs, ticket IDs, PRD names) to keep continuity across phases.
- Ask for preview/check steps before apply when working on critical repositories.
- Use the same conversation thread for a full slice (discovery to docs) to preserve context quality.

## 10. Common adoption doubts

- "How do I migrate docs I already had?"
: Use `docs/workflow/migration/legacy-docs-map.md` if generated. It includes suggested destinations and `git mv` commands.

- "Where do I configure backend/frontend standards?"
: Use `docs/workflow/standards/setup-and-migration.md`, `docs/workflow/standards/backend.md`, and `docs/workflow/standards/frontend.md` in the target repository.

- "How do I recover from a wrong apply?"
: Run `workflow-kit rollback --target /path/to/repo --dry-run`, then `--apply --yes`. It undoes the last applied `init`/`update`. As a fallback, restore from the `*.workflow-kit-backup-<timestamp>` files and re-run dry-run before applying again.

- "What else is needed besides install (agents, skills, hooks)?"
: Run `docs/workflow/runbooks/runtime-native-readiness-checklist.md` and complete adapter, skill-registry, and project instruction-hook checks.

## 11. Plugin mode (pilot)

The kit installs in one of two modes. The kit itself is the same in both.

| | Repo mode (default) | Plugin mode (pilot) |
| --- | --- | --- |
| Runtimes | all | Claude Code and GitHub Copilot only |
| Where the kit runs from | files committed in the repository | the plugin `fhh` from the marketplace `fhh-ia-ecosystem` |
| What the repository holds | the whole kit (`.agents`, skills, `docs/workflow`) | the adapters (with a kit-location block), the plugin declaration, `install-state.json`, and the overlay seeds in `.agents/project/` |

Plugin mode keeps few files the kit owns and updates: 3 for Claude Code
(`CLAUDE.md`, `.claude/settings.json`, `install-state.json`), 6 for Copilot, 8
for both. The seeds (`.agents/project/*.md` and `paths.json`) and `.gitignore`
come on top; they are yours to edit. A non-default model profile
(`--profile`) writes the project's own agents in the repository, 13 per
runtime, in plugin mode too.

### Install and switch

```bash
workflow-kit init --mode plugin --runtime claude --target /path/to/repo
workflow-kit init --mode plugin --runtime claude,copilot --target /path/to/repo
```

Both are dry runs until you add `--apply --yes`. `update` keeps the mode the
install records. To change mode:

```bash
workflow-kit update --mode plugin --target /path/to/repo   # repo -> plugin
workflow-kit update --mode repo --target /path/to/repo     # plugin -> repo
workflow-kit rollback --target /path/to/repo               # undo the switch
```

The switch to plugin is all or nothing. If you edited a kit file, the command
stops and lists it. Settle each one in the same command with
`--edited <path>=discard` (repeat the flag per file), or `--edited all=discard`
for all of them. `keep`, `shadow` and `split` are rejected for these files. To
keep an edit, move it to a project shadow first (see
`.agents/kit-boundary.md` in the kit), then switch. The TUI asks for the mode
on install, only when every chosen runtime has a plugin; switching mode is
done from the CLI.

### Every person installs the plugin

Declaring the plugin in the repository only enables it: it does not download
it. Each person installs it once per clone:

```bash
claude plugin install fhh@fhh-ia-ecosystem --scope project
copilot plugin install fhh@fhh-ia-ecosystem
```

The kit prints these commands after an apply, and `workflow-kit` never
installs the plugin for anyone; `doctor` only reports it. A team that must
enforce the kit uses repo mode, or its organization's managed settings, which
the kit does not manage.

### Commands that stop

These stop without writing and name the command to run next:

| Situation | The stop names |
| --- | --- |
| `init --mode plugin` with a runtime that has no plugin (codex, antigravity, opencode, neutral) | `--runtime claude,copilot`, or `init --mode repo` (T3) |
| `init --mode plugin` in a repository that already has an install | `update --mode plugin` (T4) |
| `init --mode plugin` in a repository with an older install-state (1.0.0) | `update` first, then `update --mode plugin` (T5) |
| `update --mode plugin` on an older install-state (1.0.0) | `update` first (migration), then `update --mode plugin` (T10) |
| `update --mode plugin` on an exported folder | `init --mode plugin --target <repo>` (T11) |
| `export --mode <x>` | `export --output <path>` without `--mode` (T12) |
| `update --adopt-existing --mode plugin` | `update --adopt-existing --runtime <list>` first (T13) |
| `update --runtime` with a runtime that has no plugin, in plugin mode | `update --mode repo --runtime <list>` (T14) |
| `export --output` pointing at a plugin-mode repository | export to another folder (T17) |

### What a switch leaves behind

- Repo to plugin deletes the kit files the install recorded, with a backup next
  to each one: about 290 `*.workflow-kit-backup-<stamp>` files for a Claude
  install. Git shows them as untracked. `rollback` needs them.
- Once the switch is verified and you do not want a rollback, list them and
  then remove them. Run this only after verifying, from the repository root:

  ```bash
  find . -type f -name '*.workflow-kit-backup-*' -not -path './.git/*' -not -path './node_modules/*'
  find . -type f -name '*.workflow-kit-backup-*' -not -path './.git/*' -not -path './node_modules/*' -delete
  ```

  The pattern also matches backups of earlier applies, so read the list first.
- `docs/README.md` keeps its docs-workflow block; its links resolve under the
  kit root, where the plugin carries `docs/workflow/`.
- A runtime you leave out of the switch keeps its adapters as project files,
  and `doctor` lists them (`mode/adapter-not-tracked`). Drop a runtime in a
  separate `update`, before the switch, not in the same command.

### Settings files

For plugin mode the kit adds two entries to `.claude/settings.json` and
`.github/copilot/settings.json`: `extraKnownMarketplaces["fhh-ia-ecosystem"]`
and `enabledPlugins["fhh@fhh-ia-ecosystem"]`. Switching to repo mode removes
only those two entries; the file is never deleted. The kit respects a
project that turned the plugin off (`false`) or points the marketplace entry
somewhere else, such as a fork: it leaves that as it is, the plan says so,
and `doctor` names it. The merge rewrites the JSON with normalized
formatting (the file's indentation, LF line endings); the original is in the
backup.

### Versions and publishing

The marketplace in `main` points at the branch `plugin`, which exists only
after the first publish and its approved push. Until then, plugin installs
fail. Claude Code pins a plugin to its version, so people see a kit change
only when a new version is published, never by following `main`. The release
steps are in [Versioning](versioning.md).

### `doctor` in plugin mode

`doctor` expects only the plugin-mode files. It runs
`claude plugin list --json` (read-only, bounded to 5 seconds) only in plugin
mode with Claude Code chosen, and prints `Install mode: plugin`.

| Code | Severity | Meaning |
| --- | --- | --- |
| `mode/repo-and-plugin` | error | the kit would load twice: kit files in a plugin-mode repository, or the plugin enabled in a repo-mode one |
| `mode/plugin-not-declared` | warning | a settings file lacks the declaration, or is not valid JSON |
| `mode/plugin-not-installed` | warning | Claude Code does not list `fhh@fhh-ia-ecosystem` |
| `mode/plugin-version-mismatch` | warning | the installed plugin version differs from this CLI's |
| `mode/plugin-install-unverified` | warning | the check could not run (no `claude`, timeout, bad output) |
| `mode/plugin-disabled` | warning | Claude Code lists the plugin as installed but disabled |
| `mode/plugin-disabled-by-project` | warning | the project's settings turn the plugin off |
| `mode/marketplace-customized` | warning | the marketplace entry is not the kit's |
| `mode/adapter-not-tracked` | warning | an adapter with a kit block whose runtime is not recorded |

For Copilot, `doctor` has no documented way to read installed plugins, so it
prints an informational line with `copilot plugin list` and the install
command instead of a diagnostic.

### Known limits

- Some kit files name repo-mode agent paths (`.claude/agents/*`); in plugin mode
  those agents come from the plugin and are launched by name (`fhh:<slug>`).
- If `.agents/project/context.md` names a kit path in backticks (for example
  `.agents/instructions.md`), `doctor` warns `project-context/missing-path`,
  because it looks for it in the repository. It is a warning only.
- `--profile` writes the project's own agents in the repository, also in plugin
  mode. A kept edited agent is pending after you return to the default profile.
- Runtime support and what is verified: see the
  [capability matrix](workflow/cross-runtime-capability-matrix.md#plugin-mode).

