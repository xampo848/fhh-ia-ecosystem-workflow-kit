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
`--target` must be an existing folder (`init` does not create it; create it
first, for example with `git init`). `export` creates its output folder.

`init` always installs the complete FHH IA Ecosystem workflow overlay (the full
`.agents` tree, skills, manifests, and workflow metadata); there is no partial
or placeholder mode.

Operation meanings in preview:

- `create`: new file
- `unchanged`: no write
- `overwrite_with_backup`: write with backup first
- `merge_with_backup`: in-place composition with backup first (an adapter's managed block, the `docs/README.md` block, plugin settings JSON); never `.agents/skills/registry.json`
- `overwrite_no_backup` / `merge_no_backup`: same, with `--backup-mode none`
- `skip_modified`: pending during update: a kit file you edited, or your own file at a kit path the install never recorded
- `skip_unmanaged`: a project file the kit only seeds (`project-owned; left as it is`) or an adapter with broken markers, left as it is
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

- docs hub non-destructive insertion (the kit adds its marker block to `docs/README.md`),
- replacement, with a backup, of an existing `.agents/skills/registry.json` (it is a kit file, not merged),
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

The guided menu asks once per Claude Code or Codex runtime (an
`ANTHROPIC_API_KEY` or `OPENAI_API_KEY` only preselects `costo`); it does not
ask for Copilot, which keeps its default `costo` unless you pass `--profile`.
Commands never ask: they use the default of each runtime unless you pass
`--profile`. Copilot accepts all three profiles
(`--profile copilot=equilibrado`; the form is `<runtime>=<profile>`, a colon
is rejected). The profile is stored in `install-state.json` and rewrites the
generated `.github/agents/*.agent.md` files: their `model:` list and their
`Model profile: … · tier: …` line follow the profile (for example
`escriba-doc` and `lint-ranger` are Liviano in `costo` and Mediano in
`equilibrado`; `qa-relampago` and `arquitecta-fases` are Mediano in `costo`
and Grande in `equilibrado`). Copilot still picks the model per call from the
list, so the profile fixes the tier, not the exact model. Set or change it any time, naming only runtimes the install has (the
examples above install `codex` and `copilot`):

```bash
workflow-kit update --target /path/to/repo --profile codex=costo --apply --yes
```

A profile for a runtime that the install does not record (for example
`claude=costo` on a `codex,copilot` install) is an error: the command stops
before writing and names the runtime. Add the runtime with `--runtime`, or drop
it from `--profile`.

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

`upgrade` needs `git` and `bun` on your `PATH`. It checks the ref before it
removes the installed version (a branch or tag by name; a full 40-character
commit hash by fetching it; a short hash only when it is the tip of a branch or
tag), so a mistyped ref, a network failure or a missing `git` changes nothing.
To pin a version, pass a tag or, for versions without a tag, a full commit hash
(the remote has a tag for every version from `0.16.0` to `0.25.0`; see
[Versioning](versioning.md)):

```bash
workflow-kit upgrade --ref v0.25.0-open-prefilter --apply --yes
workflow-kit upgrade --ref ee48a2f22d5f7875084dc7bc5f052454a68aa0f6 --apply --yes   # same version, by commit
```

After that, run `update` in each project you manage to bring its workflow to
the new version.

## 6. Guided TUI

```bash
workflow-kit tui
```

The menu is in Spanish. It offers install, update, export, doctor, upgrade
and optional tools; it has no `rollback` option (run that command). It needs an
interactive terminal: without one (a pipe, a script, CI) it exits with code 2
and writes nothing, so use the commands there. Ctrl-C leaves the menu with exit
code 130; answering no at a confirmation is a decline and exits 0. Yes/no questions accept `sí`, `si`, `s` or `no`, `n` (also `yes`, `y`),
and ask again on any other answer.

The first screen, `¿Qué quieres hacer?`, offers these options:

| Option | What it acts on | CLI equivalent |
| --- | --- | --- |
| `Instalar el workflow en un proyecto` | the project you choose | `init` |
| `Actualizar el workflow de un proyecto` | the project you choose | `update` |
| `Exportar el workflow a una carpeta` | an output folder, no project | `export` |
| `Revisar el workflow de un proyecto (doctor)` | the project you choose, read-only | `doctor` |
| `Actualizar workflow-kit (esta herramienta)` | `workflow-kit` on this machine, no project | `upgrade` |
| `Instalar solo herramientas opcionales (MCP)` | optional MCP tools, no workflow files | — |

After the first screen the flow asks, in order and only when it applies:
the project path (`Elegir el proyecto`; a folder is checked when you type it,
and a missing path or a file is explained in Spanish and asked again, except
for an export folder, which is created when missing); the runtimes (`Adaptadores de
runtime`); the install mode (repo or plugin; asked on `Instalar`, only when
every chosen runtime has a plugin); the model profile (on install and export,
once per Claude Code or Codex runtime; `Actualizar` keeps the stored one); the
stack pack (on install, or on an update whose install predates stack packs; the
detected stack is preselected); the backup mode (`Backups al escribir`) and
which files to change (`Elige los archivos a modificar`); and finally the apply
confirmation (`Confirmar`). Choosing `Exportar`, `Revisar` or `Actualizar
workflow-kit` skips the questions that do not apply to it.

Updating the tool and updating a project are separate: after
`Actualizar workflow-kit (esta herramienta)`, launch the TUI again and choose
`Actualizar el workflow de un proyecto` in each project.

Every flow that writes shows a preview before asking whether to write. The default confirmation writes nothing.
It can also open an optional capability guide (Context7, Engram, codebase-memory-mcp) with a confirmation and official install commands. The menu does not ask for a scope: it installs these tools globally on your machine, and says so. If a tool command fails, the menu says the flow ended with failed commands and exits with code 2 instead of the ready banner.
The install package is fixed to `FHH IA Ecosystem completo`.

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
: State them in `.agents/project/backend.md` and `.agents/project/frontend.md`, which is what agents read. `docs/workflow/standards/setup-and-migration.md`, `docs/workflow/standards/backend.md`, and `docs/workflow/standards/frontend.md` in the target repository are the setup guides.

- "How do I recover from a wrong apply?"
: Run `workflow-kit rollback --target /path/to/repo --dry-run`, then `--apply --yes`. It undoes the last applied `init`/`update`. When the project has no record of an apply, it restores nothing and lists the backups it found; `--from-backups` restores the newest backup of each managed file. As a fallback, restore from the `*.workflow-kit-backup-<timestamp>` files and re-run dry-run before applying again.

- "What else is needed besides install (agents, skills, hooks)?"
: Run `docs/workflow/runbooks/runtime-native-readiness-checklist.md` and complete adapter, skill-registry, and project instruction-hook checks.

## 11. Plugin mode (pilot)

> **Published, not yet verified end to end.** The plugin marketplace in `main`
> points at the public branch `plugin`, which is published and serves the
> version in its `plugin.json` (`0.25.0-open-prefilter` at the time of writing).
> Nobody has yet run a real `claude plugin install` against it, so treat the
> install path as unverified. See
> [Versions and publishing](#versions-and-publishing).

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

The kit prints these commands after an apply (the guided menu prints the
project-scoped one as `cd <repo> && claude plugin install … --scope project`,
so it works from any folder), and `workflow-kit` never
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
- A runtime you leave out of the switch keeps its adapters as project files.
  When the install ends in plugin mode, `doctor` lists them
  (`mode/adapter-not-tracked`). When it ends in repo mode, those adapters get
  the repo-mode block back and `doctor` stays silent, as for any runtime
  dropped in repo mode. Dropping a runtime in the same command as the switch
  or in a separate `update` before it leaves the same files.

### Settings files

A settings file that repeats a key (two `enabledPlugins` objects, for example)
is left as it is: rewriting it would keep only the last one. The plan lists it
as `skip_unmanaged` with the reason `duplicate_settings_key`, and `doctor`
names the repeated key in `mode/plugin-not-declared`. Remove the repeated key,
then run `init` or `update` again. An empty or blank settings file is not an
error: the plan fills it (`merge_with_backup`).

For plugin mode the kit adds two entries to `.claude/settings.json` and
`.github/copilot/settings.json`: `extraKnownMarketplaces["fhh-ia-ecosystem"]`
and `enabledPlugins["fhh@fhh-ia-ecosystem"]`. Switching to repo mode removes
only those two entries; the file is never deleted. The kit respects a
project that turned the plugin off (`false`) or points the marketplace entry
somewhere else, such as a fork: it leaves that as it is, the plan says so,
and `doctor` names it. The merge rewrites the JSON with normalized
formatting (the file's indentation, LF line endings) and rewrites numbers as
JavaScript reads them: `1.0` becomes `1`, and an integer beyond 2^53 loses
precision (`12345678901234567890` becomes `12345678901234567000`). The
original is in the backup.

### Versions and publishing

The marketplace in `main` points at the branch `plugin`, which is published
and serves the version in its `plugin.json`. After an apply, the CLI prints the
install steps and says that the marketplace serves the version published on
that branch, which may be older than the CLI until the maintainer publishes
again; `workflow-kit doctor --target <path>` shows the difference. Claude Code pins a plugin to its version, so people see a kit change
only when the maintainer publishes a new version, never by following `main`. The release
steps are in [Versioning](versioning.md).

Everyone who runs `workflow-kit` on a plugin-mode repository needs a CLI with
plugin mode (`0.23.0-plugin-mode` or later; run
`workflow-kit upgrade --apply --yes` first). An older CLI reads the state as a
repo-mode install, and its `update` reinstalls the kit files in the
repository; `doctor` then reports `mode/repo-and-plugin`, and
`workflow-kit update --mode plugin` with a current CLI repairs it.

### `doctor` in plugin mode

`doctor` expects only the plugin-mode files. It runs
`claude plugin list --json` (read-only, bounded to 5 seconds) only in plugin
mode with Claude Code chosen, and prints `Install mode: plugin`.

| Code | Severity | Meaning |
| --- | --- | --- |
| `mode/repo-and-plugin` | error | the kit would load twice: kit files in a plugin-mode repository, or the plugin enabled in a repo-mode one. A file counts as a kit copy only when the install recorded it, an installed runtime ships that path, or its content is identical to the kit's file; your own file at the path of a runtime that is not installed (for example `.codex/README.md` without Codex) is not reported |
| `mode/plugin-not-declared` | warning | a settings file lacks the declaration, is not valid JSON, or repeats a key (see below) |
| `mode/kit-location-missing` | error | an adapter of a plugin-mode install lost its `kit-location` block, so the agent is never told where the kit is; `update` restores it with a backup |
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
  `.agents/instructions.md`), `doctor` in plugin mode does not warn
  `project-context/missing-path`: the plugin delivers kit paths, so the
  repository does not hold them. A path of your own that is missing is still
  reported.
- `--profile` writes the project's own agents in the repository, also in plugin
  mode. A kept edited agent is pending after you return to the default profile.
- Runtime support and what is verified: see the
  [capability matrix](workflow/cross-runtime-capability-matrix.md#plugin-mode).

