# FHH IA Ecosystem Workflow Kit

An installable workflow kit for AI-driven software development that brings the FHH IA Ecosystem operating model into other repositories.

The purpose of this project is to make a complete product-to-delivery workflow reusable for teams building with AI: not only writing code, but also shaping the right work before implementation and documenting it after delivery. It codifies a practical way of working that connects product discovery, planning, execution, and documentation in a single, repeatable system.

It is designed so people can focus on intent instead of memorizing command names or skill names. A router handles routing and skill selection based on the request, so the workflow remains discoverable and usable even as the ecosystem grows.

At a methodology level, work moves through a full lifecycle:

1. Product discovery
2. Epic definition
3. Ticket/PRD decomposition
4. Implementation
5. Documentation

At a tooling level, this repository combines proven practices with reusable components, including skills, MCP integrations, workflow contracts, and runtime adapters. The result is an opinionated but flexible ecosystem that helps teams execute with consistency while still adapting to their own context.

## What this project is

This is a curated ecosystem assembled from hands-on experience, validated workflows, and selected tools that have proven effective in real software delivery environments.

It is not a single framework and not a rigid template. It is a practical alternative for teams and builders who want a clearer path from idea to shipped and documented software, with explicit structure for discovery, epic-level planning, implementation, and knowledge capture.

It is designed to be adopted as-is or adapted to each team's own way of working.

> Current status: **private GitHub install/export ready**. The package provides a dry-run-first CLI, guided TUI, template export, doctor validation, manifest-validated template packs, release guardrails, and adoption docs. It is intentionally **not published to npm**.

## Install from the private GitHub repository

You need access to the private repository: `xampo848/fhh-ia-ecosystem-workflow-kit`.

Using Bun with SSH:

```bash
bun add -g git+ssh://git@github.com/xampo848/fhh-ia-ecosystem-workflow-kit.git
```

Using Bun with GitHub shorthand and HTTPS auth already configured:

```bash
bun add -g github:xampo848/fhh-ia-ecosystem-workflow-kit
```

Alternative with npm:

```bash
npm install -g github:xampo848/fhh-ia-ecosystem-workflow-kit
```

Then verify:

```bash
workflow-kit --help
```

## Quickstart: install into a repo safely

Always preview first. Dry-run is the default and writes nothing:

```bash
workflow-kit init --target /path/to/repo --runtime codex,copilot
```

By default, the installer uses the complete FHH IA Ecosystem workflow overlay so the target repo gets the full ready-to-use flow.

Apply only after reviewing the plan:

```bash
workflow-kit init --target /path/to/repo --runtime codex,copilot --apply --yes
```

Validate the installed files:

```bash
workflow-kit doctor --target /path/to/repo --runtime codex,copilot
```

## Using the workflow after installation

Once installed, the recommended way to use the ecosystem is to describe your intent in natural language. You do not need to remember skill names: the router selects the right workflow and skills based on your request.

Recommended operating flow:

1. Start from product discovery and clarify the problem.
2. Convert the discovery into epics with clear outcomes.
3. Decompose each epic into tickets or PRDs.
4. Implement the work item with the selected workflow.
5. Document what was built, why, and any important decisions.

### Example prompts you can use

Discovery and framing:

```text
Help me run product discovery for a feature that reduces onboarding drop-off. I need problem framing, assumptions, risks, and success metrics.
```

Epic creation:

```text
Create epics for this initiative and organize them by user value, technical dependencies, and delivery order.
```

PRD or ticket decomposition:

```text
Break Epic 2 into implementation-ready tickets with acceptance criteria, edge cases, and test expectations.
```

Implementation support:

```text
Implement ticket PAY-14 in this repository. Keep changes minimal, add tests, and summarize trade-offs.
```

Documentation pass:

```text
Document what was implemented for PAY-14, including scope, decisions, validation steps, and known limitations.
```

Capability guidance (optional tools):

```text
I want to use Context7 and memory tools in this repo. Guide me through install/attach with confirmation before any install step.
```

### Practical usage notes

- Be explicit about the outcome you want; the router performs better with clear intent and context.
- Reference artifact names when possible (epic IDs, ticket IDs, PRD names) to keep continuity across phases.
- Ask for preview/check steps before apply when working on critical repositories.
- Use the same conversation thread for a full slice (discovery to docs) to preserve context quality.

## Safe updates for already-installed repositories

Use `update` to refresh only workflow-kit managed files.

### Real upgrade flow (update the toolkit binary first)

When you release a new toolkit version, users should update their global install first, then run `workflow-kit update` inside each target repository.

Preview the toolkit binary upgrade command:

```bash
workflow-kit upgrade
```

Apply the toolkit binary upgrade against the latest `main`:

```bash
workflow-kit upgrade --apply --yes
```

Pin to a released tag for a controlled rollout:

```bash
workflow-kit upgrade --ref v0.7.0 --apply --yes
```

Install a specific released tag:

```bash
bun add -g github:xampo848/fhh-ia-ecosystem-workflow-kit#v0.7.0
```

Or track the latest default branch:

```bash
bun add -g github:xampo848/fhh-ia-ecosystem-workflow-kit
```

Verify installed version:

```bash
workflow-kit --help
```

Then run repository update:

```bash
workflow-kit update --target /path/to/repo --apply --yes
```

Preview first:

```bash
workflow-kit update --target /path/to/repo
```

Apply after review:

```bash
workflow-kit update --target /path/to/repo --apply --yes
```

Update behavior:

- Only files tracked in `.agents/workflow-kit/install-state.json` are eligible for overwrite.
- If a tracked file was edited locally, it is skipped as `skip_modified`.
- If an untracked file exists at the same path, it is skipped as `skip_unmanaged`.
- Missing tracked files are recreated.

### One-time bootstrap for legacy installs

Older installs may not have an install state file yet. Bootstrap safely without overwriting current files:

```bash
workflow-kit update --target /path/to/repo --runtime codex,copilot --adopt-existing --apply --yes
```

This records the current baseline in `.agents/workflow-kit/install-state.json` and preserves existing content.

## Export templates without installing into a repo

Preview export:

```bash
workflow-kit export --output /tmp/workflow-kit-export --runtime codex,copilot
```

Apply export:

```bash
workflow-kit export --output /tmp/workflow-kit-export --runtime codex,copilot --apply --yes
```

## Guided TUI

```bash
workflow-kit tui
```

The TUI asks for target path and runtimes, then shows a preview before asking whether to write. The default answer writes nothing.
It now includes separate entrypoints for installing a repository, updating a managed repository, upgrading the globally installed toolkit binary, or handling optional capabilities only.

## Optional alternative tools (post-install)

After `init`/`tui`, you can guide users to add optional external capabilities such as Engram, Context7, or codebase-memory-mcp.

- Follow `.agents/integrations/README` in the target repository.
- Classify intent as `install + attach` or `attach-only`.
- Show confirmation summary before any install command.
- Use official/curated source by default.

See the concrete prompts and guardrails in [docs/quickstart.md](docs/quickstart.md).

## Supported runtimes

- `neutral` — full `.agents` workflow package without runtime adapters.
- `codex` — adds `AGENTS.md` and Codex adapter notes.
- `copilot` — adds GitHub Copilot instruction adapters.
- `claude` — adds `CLAUDE.md`.
- `antigravity` — adds `ANTIGRAVITY.md` and Antigravity adapter notes.

Combine runtimes with commas:

```bash
workflow-kit init --target /path/to/repo --runtime codex,copilot,claude,antigravity
```

## Installation Mode

The normal install path always uses the complete FHH IA Ecosystem workflow surface, including the full `.agents` tree, skills, manifests, and workflow metadata.

The CLI and TUI now treat that full install as the standard path so users do not have to choose between partial or placeholder setups.

## Extending the workflow (AI-assisted or manual)

The installer gives each target repository a full `.agents` tree. You can extend it in two ways:

- AI-assisted: ask the agent to explain or perform the extension.
- Manual: edit the files directly yourself.

Both paths are valid and can be mixed.

### AI-assisted extension flow

Use these prompts when you want the workflow itself to perform the changes.

Ask for guidance only:

```text
Explain how to add a new workflow route named "<workflow-name>" in this repository.
Show exact files to edit and a minimal validation checklist.
Do not edit files yet.
```

Ask the agent to do it:

```text
Implement a new workflow route named "<workflow-name>".
Requirements:
1) Update .agents/skills/00-router/workflow-router/SKILL.md with trigger signals and disambiguation rules.
2) Update .agents/instructions.md if startup/routing contract changes.
3) Keep routing trace format consistent.
4) Do not change unrelated routes.
5) Run relevant validation checks and summarize results.
```

Add a new project skill via AI:

```text
Create a new project skill at .agents/skills/06-patterns/<domain>/<skill-name>/SKILL.md and register it in .agents/skills/registry.md.
Requirements:
1) Include purpose, trigger, required inputs, and expected outputs.
2) Add registry metadata: class, physical path, trigger, loading posture.
3) Update router rules only if this skill should be auto-routed for freeform requests.
4) Keep existing skills unchanged.
5) Run relevant validation checks and summarize results.
```

### Manual extension flow

When editing by hand, keep this order:

1. Update routing behavior in `.agents/skills/00-router/workflow-router/SKILL.md`.
2. Update startup contract in `.agents/instructions.md` if routing/entry behavior changes.
3. Add or update skills under `.agents/skills/06-patterns/<domain>/<skill-name>/SKILL.md`.
4. Register every new skill in `.agents/skills/registry.md`.

For each registry entry, define at least:

- `Skill name`
- `Class`
- `Physical path`
- `Trigger`
- `Loading posture` (`startup-minimal`, `explicit-only`, `just-in-time`, `delegated-only`, `overlay`, `helper/mode`)

### Validation checklist (for both paths)

1. Validate template packs in this toolkit repository:

```bash
npm run check:templates
```

2. In a target repository, preview managed updates before apply:

```bash
workflow-kit update --target /path/to/repo
```

3. Test routing behavior with three prompts:

- one prompt that should trigger `workflow-router` only,
- one prompt that should trigger your new workflow/skill,
- one nearby prompt that should not trigger it.

4. If behavior is wrong, tighten `Trigger` text in `.agents/skills/registry.md` and route selection rules in `.agents/skills/00-router/workflow-router/SKILL.md`.

This keeps discovery (`registry.md`) and execution policy (`workflow-router`) aligned so skills load just in time instead of always-on.

## Safety guarantees

- Dry-run is the default.
- Apply requires `--apply --yes`.
- Existing changed files are backed up before overwrite.
- Runtime adapters stay thin and point back to `.agents/instructions.md`.
- Full workflow package is the default install surface.
- The package remains `private: true` to prevent accidental npm registry publication.

## Project structure

```text
fhh-ia-ecosystem-workflow-kit/
  bin/workflow-kit.mjs
  src/                       # CLI, planner, apply, doctor, TUI
  templates/                 # manifest-validated full workflow pack + runtime adapters
  docs/                      # install, quickstart, migration, troubleshooting
  examples/                  # adoption scenarios
  scripts/                   # validation guardrails
  test/                      # Node test suite
```

## Validation for maintainers

```bash
npm test
npm run check
npm run check:templates
npm run check:release
npm run check:docs
npm pack --dry-run
```

If your local npm cache has permission issues, use a temporary cache:

```bash
npm_config_cache=/tmp/workflow-kit-npm-cache npm pack --dry-run
```

## Documentation

- [Private GitHub install](docs/private-github-install.md)
- [Quickstart](docs/quickstart.md)
- [Adapter authoring](docs/adapter-authoring.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Migration](docs/migration.md)
- [Versioning](docs/versioning.md)
- [Release Checklist](RELEASE.md)

## Examples

- [Fresh Codex repository](examples/fresh-codex/README.md)
- [Existing GitHub Copilot repository](examples/existing-copilot/README.md)
- [Neutral core only](examples/neutral-core/README.md)

## Release/publishing note

This repository is private. Do not run `npm publish`, create public releases, or change repository visibility without explicit maintainer approval.
