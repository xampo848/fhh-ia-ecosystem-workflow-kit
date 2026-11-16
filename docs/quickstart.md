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
- `skip_modified`: managed local edit protected during update
- `skip_unmanaged`: unmanaged collision protected during update
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

### Model profile per runtime (`calidad` / `costo`)

Delegate agents get their model from the project's **model profile**, chosen
by how each runtime is billed:

- `calidad` (default for Claude Code and Codex): subscription. Sonnet or GPT
  Sol by default, Opus or GPT Sol extra-high for implementers, QA, and
  slicing; never small models.
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
project, starting with `.agents/project-context.md`:
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

## 5. Upgrade the toolkit binary before updating repos

Preview the global toolkit upgrade command:

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
workflow-kit upgrade --ref v0.17.0-audit-hardening --apply --yes
```

After that, run `update` in each target repository you manage.

## 6. Guided TUI

```bash
workflow-kit tui
```

The TUI index offers install, update, toolkit-upgrade, and capabilities-only flows. It always shows a preview before asking whether to write. The default confirmation writes nothing.
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

Local edits in tracked files are preserved (`skip_modified`), and untracked path collisions are ignored (`skip_unmanaged`).

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
