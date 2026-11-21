# FHH IA Ecosystem Workflow Kit

`workflow-kit` installs a workflow for developing software with AI agents
correctly into any repository. It gives Claude Code, Codex, GitHub Copilot,
Antigravity, and opencode the same contract, so every agent sizes the work
before acting, picks the right workflow, and leaves evidence behind.

What the installed workflow does:

- **Levels N0–N3.** Every prompt gets a level before any workflow file is
  loaded, so a typo fix stays cheap and a migration gets full gates.
- **Routing.** You describe intent in natural language; `workflow-router`
  selects the skill. You do not need to remember skill names.
- **PRD → implementation → QA → documentation.** Non-trivial work goes through
  a PRD (`create-prd`), an implementation route with repair limits
  (`implement-change`), independent QA, and durable documentation.
- **Model profiles.** Delegate agents take their model from a profile chosen by
  billing: `calidad` (subscription), `equilibrado` (subscription that often
  hits its weekly limits), or `costo` (per-token).

One neutral source of truth lives in `.agents/`; runtime files such as
`CLAUDE.md` or `AGENTS.md` are thin adapters that point back to it.

> Status: public GitHub install, version `0.19.1-tui-option-clarity`. The CLI and
> TUI install, update, export, check, and roll back the workflow, with dry-run
> by default and backups before every overwrite. The package is intentionally
> **not published to npm**.

## GitHub install

Requirements: Node.js 20.17+ or 22.13+ (the `engines` field in `package.json`), [Bun](https://bun.sh), and network
access to GitHub.

```bash
bun add -g github:xampo848/fhh-ia-ecosystem-workflow-kit
```

Verify:

```bash
workflow-kit --version
workflow-kit --help
```

`main` installs the latest merged version. To pin a release instead, append
`#<tag>`, for example `#v0.19.1-tui-option-clarity`; every released version has a
`v<version>` tag, listed on the repository's
[Releases page](https://github.com/xampo848/fhh-ia-ecosystem-workflow-kit/releases).
SSH install and access details:
[docs/github-install.md](docs/github-install.md).

From a clone of this repository, run the same commands as
`node bin/workflow-kit.mjs <command>`.

## Quickstart

Dry-run is the default and writes nothing. Preview, apply, then check:

```bash
workflow-kit init --target /path/to/repo --runtime claude,codex
workflow-kit init --target /path/to/repo --runtime claude,codex --apply --yes
workflow-kit doctor --target /path/to/repo
```

The plan lists one operation per file (`create`, `unchanged`,
`overwrite_with_backup`, `merge_with_backup`, …). Existing skill registries and
docs hubs are merged, not replaced.

- New repository: [Quickstart](docs/quickstart.md).
- Repository that already has docs, skills, or adapters:
  [Get Started for Existing Repositories](docs/get-started-existing-repo.md).
- Something looks wrong: [Troubleshooting](docs/troubleshooting.md).

### Per-project setup after installing

The installer cannot know your project, so a few things are yours to complete, once per repository. The workflow runs without them, but it explores more, costs more, and applies fewer of your rules until they are done. `workflow-kit doctor` reminds you about the ones it can detect.

| # | What to do | Why | Done when |
| --- | --- | --- | --- |
| 1 | Fill `.agents/project-context.md`. Ask your agent: "Genera la primera versión de `.agents/project-context.md` con un Discovery inicial del proyecto", review the result, and remove the template marker. | Discovery reads this file first and then explores only what is specific to a change. Record the validation commands with their cost and the known environment quirks (flaky tests, required environment variables). | `doctor` no longer reports `project-context/not-initialized` |
| 2 | Review `.agents/project/quality-gate.md` and fill `.agents/project/backend.md` and `.agents/project/frontend.md` for the surfaces that exist. | These are your project rules for every runtime. Edit these files, never the generated copies in `.github/instructions/`. | The files no longer carry the template marker; `doctor` reports no `project-instructions/*` warning |
| 3 | Check the model profile shown by `doctor`: `calidad` when the runtime is paid by subscription, `equilibrado` when that subscription often hits its weekly limits (planning and final QA keep Opus; implementation, tests, and contract checks move to Sonnet), `costo` when it is billed per token. Change it with `workflow-kit update --profile claude=equilibrado` (or `=costo`). | Delegate agents take their model from the profile. | `doctor` prints the profile you expect |
| 4 | If your repository keeps its own `.agents/skills/index.md` or `.agents/skills/registry.md`, check after each update that the new workflow-kit skills are listed. If a script of your own regenerates them, add the new skills to it too. | `update` adds the missing rows next to the related skills and keeps yours, but only inside the table it recognizes; the router discovers skills through the index. | `doctor` reports no `skills/local-catalog-missing-skill` |
| 5 | Leave validation reuse in shadow mode for the first 2 or 3 implementations. If the shadow results never differed, add `validation_reuse: active` to `.agents/project-context.md`. | Reuse skips an expensive check only when the content is proven identical; shadow mode shows what it would have skipped before you trust it. | Section 10 of a PRD lists reused checks |
| 6 | In the first implementation that has a QA re-entry, let it run both the focused and the full review and compare them (the workflow asks for this once). | Calibrates the focused QA re-entry for your project. | The comparison is recorded in that PRD |

Updating an existing installation? Follow the same table after `workflow-kit update`; steps 1 and 4 are the ones older installations usually miss.

## Using the workflow

Describe what you want in your agent runtime. The level decides how much
process the request gets:

| Level | Example | What happens |
| --- | --- | --- |
| N0 operational | a question, a typo, formatting | answered or applied directly, no workflow files read |
| N1 surgical | a behavior change in 1–2 clear files | one line (`N1 · surgical · <files>`), a short "yes", one focused check |
| N2 standard | a bounded feature, bug, or ticket | routed through `workflow-router` and `implement-change` |
| N3 high risk | contracts, migrations, auth or tenancy, anything irreversible | full gates, delegates, and independent QA |

`implement-change` (alias `implement-prd`) implements PRDs, bugs, tickets, and
iterations over an implemented PRD. For N2 and N3 it offers supervised
(default) or autonomous execution; brakes such as the 2-round repair limit
apply in both. Example prompts for each phase are in
[docs/quickstart.md](docs/quickstart.md#example-prompts).

## Commands

| Command | What it does |
| --- | --- |
| `init` | Plans or applies a first install of the workflow into `--target`. |
| `update` | Updates the workflow installed in a project (`--target`) to this workflow-kit version. Refreshes only the files workflow-kit manages; protects your local edits. |
| `upgrade` | Updates `workflow-kit` itself (this tool) on your machine; it does not change any project (it checks that the ref exists and is reachable before replacing the installed version). |
| `export` | Writes the templates to `--output` without treating it as an install. |
| `doctor` | Checks installed files and workflow semantics; prints stable diagnostic codes. |
| `rollback` | Undoes the last applied `init`/`update`: restores changed files from their backups, removes files that run created, and restores the previous install state. |
| `tui` | Guided menu for every command above plus optional capabilities; see [Guided TUI](docs/quickstart.md#6-guided-tui). |

`workflow-kit --help` prints the full usage. Main flags:

| Flag | Meaning |
| --- | --- |
| `--dry-run` | Preview only (the default). |
| `--apply --yes` | Write. Both are required; combining `--apply` with `--dry-run` is an error. |
| `--target <path>` / `--output <path>` | Repository to install into / export folder. |
| `--runtime <list>` | Comma-separated runtimes, see [Supported runtimes](#supported-runtimes). |
| `--profile <runtime>=<calidad\|equilibrado\|costo>` | Model profile per runtime, for example `claude=costo,codex=calidad`. |
| `--stack none\|rails-react` | Install the Rails + React stack rules as `.agents/project/stack.md`. |
| `--diff` | Show the line diff of every file that would change. |
| `--adopt-existing` | `update` only: record an install made before state tracking. |
| `--backup-mode required\|none` | `required` (default) backs up every file before overwrite or merge; `none` skips backups, and `rollback` cannot restore those files. |
| `--ref <git-ref>` / `--package-manager bun` | `upgrade` only: version to install (default `main`) and the package manager to use. |

## Updating

Updating has two separate steps: first update `workflow-kit` itself on your
machine (`upgrade`), then update the workflow installed in each project
(`update`):

```bash
workflow-kit upgrade --apply --yes
workflow-kit update --target /path/to/repo          # preview
workflow-kit update --target /path/to/repo --apply --yes
```

`update` only overwrites files recorded in
`.agents/workflow-kit/install-state.json`. A managed file you edited is kept as
`skip_modified`; a file workflow-kit never installed is kept as
`skip_unmanaged`. The plan lists one-time migrations, `--diff` shows every
change, and `update` never deletes or moves your files. It reuses the runtimes
and model profile recorded at install time. Installs older than state tracking
need one bootstrap with `--adopt-existing`; see
[Migration](docs/migration.md).

## Rollback

```bash
workflow-kit rollback --target /path/to/repo --dry-run
workflow-kit rollback --target /path/to/repo --apply --yes
```

`rollback` undoes only the last applied `init` or `update`. Files written with
`--backup-mode none` have no backup to restore. Manual restore from
`*.workflow-kit-backup-<timestamp>` files remains possible; see
[Troubleshooting](docs/troubleshooting.md#i-accidentally-applied-over-a-file).

## Supported runtimes

- `neutral` — full `.agents` workflow package without runtime adapters.
- `codex` — adds `AGENTS.md`, Codex adapter notes, and delegate agents.
- `copilot` — adds GitHub Copilot instruction adapters and delegate agents.
- `claude` — adds `CLAUDE.md`, delegate agents, and `.claude/skills/` slash-command wrappers.
- `antigravity` — adds `ANTIGRAVITY.md` and Antigravity adapter notes.
- `opencode` — uses the shared `AGENTS.md` bootstrap.

## Safety guarantees

- Dry-run is the default; writing requires `--apply --yes`.
- Existing files are backed up before overwrite or merge unless you pass `--backup-mode none`.
- The last applied run can be undone with `rollback`.
- The kit refuses to write through a symlinked `.agents` directory or adapter file.
- Runtime adapters stay thin and point back to `.agents/instructions.md`.
- The package stays `private: true` to prevent accidental npm publication.

## Optional tools

After installing, the agent can install or attach optional capabilities
(Context7, Engram, codebase-memory-mcp) following
`.agents/integrations/README.md` in the target repository, always with a
confirmation before any install command. Prompts and guardrails:
[docs/quickstart.md](docs/quickstart.md#9-optional-alternative-tools-engram-context7-codebase-memory-mcp).

## Extending the workflow

Add routes or project skills with the agent's help or by hand:
[docs/extending-the-workflow.md](docs/extending-the-workflow.md). New runtime
adapters: [docs/adapter-authoring.md](docs/adapter-authoring.md).

## Project structure

```text
fhh-ia-ecosystem-workflow-kit/
  bin/workflow-kit.mjs       # CLI entry point
  src/                       # CLI, planner, apply, rollback, doctor, TUI
  .agents/                   # canonical workflow contract (dogfooded here)
  AGENTS.md, CLAUDE.md, ANTIGRAVITY.md
  .github/, .claude/, .codex/, .antigravity/
                             # this repo's own runtime adapters
  templates/                 # full workflow overlay, runtime adapters, stack packs
  docs/                      # user guides, PRDs, plans, legal records
  examples/                  # adoption scenarios
  scripts/                   # validation guardrails and sync scripts
  test/                      # Node test suite
```

## Validation for maintainers

```bash
bun run check:security && bun run test && bun run check && bun run check:workflow
bun run check:templates && bun run check:docs && bun run check:legal && bun run check:release
```

`check:workflow` also verifies generated artifacts (skill registry, delegate
adapters, level pre-filter copies, Claude skill wrappers) and the structural
rules; regenerate with the matching `node scripts/sync-*.mjs --write`. See
[CONTRIBUTING.md](CONTRIBUTING.md) and the [Release Checklist](RELEASE.md).

## Documentation

- [GitHub install](docs/github-install.md)
- [Quickstart](docs/quickstart.md)
- [Get Started for Existing Repositories](docs/get-started-existing-repo.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Migration](docs/migration.md)
- [Extending the workflow](docs/extending-the-workflow.md)
- [Adapter authoring](docs/adapter-authoring.md)
- [Versioning](docs/versioning.md)
- [Release Checklist](RELEASE.md)
- [Changelog](CHANGELOG.md)
- [Security policy](SECURITY.md)

Examples: [fresh Codex repository](examples/fresh-codex/README.md),
[existing GitHub Copilot repository](examples/existing-copilot/README.md),
[neutral core only](examples/neutral-core/README.md).

## Acknowledgments and tool references

This project references and/or integrates ideas, components, or optional capabilities from the following external repositories:

### Optional capabilities and integrations

- [upstash/context7](https://github.com/upstash/context7) (Context7 docs MCP)
- [gentleman-programming/engram](https://github.com/gentleman-programming/engram) (durable memory MCP)
- [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) (code graph and structural search MCP)
- [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (token-saving communication helpers)

### Upstream components and attribution chain

- [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (frontend craft overlay upstream)
- [anthropics/skills](https://github.com/anthropics/skills) (frontend-design upstream reference)
- [qq15725/modern-screenshot](https://github.com/qq15725/modern-screenshot) (vendored artifact source)
- [ehmo/typecraft-guide-skill](https://github.com/ehmo/typecraft-guide-skill) (upstream attribution chain)

### Historical provenance references

- [deanpeters/product-manager-prompts](https://github.com/deanpeters/product-manager-prompts) (historical provenance reference)
- [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills) (historical comparison reference)

### Additional referenced tooling repositories

- [unjs/fontaine](https://github.com/unjs/fontaine) (font metric overrides tooling referenced in design guidance)

Legal provenance details for distributed contents are tracked in [docs/legal/third-party/provenance.json](docs/legal/third-party/provenance.json), [docs/legal/PROVENANCE-AUDIT.md](docs/legal/PROVENANCE-AUDIT.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Release/publishing note

This repository is public. Keep `package.json` as `private: true` to prevent accidental npm registry publication, and do not run `npm publish` or create package releases without explicit maintainer approval.
