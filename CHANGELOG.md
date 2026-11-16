# Changelog

Versions follow `docs/versioning.md`. While the package is `0.x`, installed
paths may change between versions; every change below is applied by
`workflow-kit update` without deleting or moving files in your repository.
Migration details are in `docs/migration.md`.

## 0.17.0-audit-hardening

Fixes from a full audit of the CLI, the validators, the agent contract and the
docs. Run `workflow-kit update` to receive the contract changes.

CLI safety:

- `--dry-run` together with `--apply` is now an error; before, the run wrote.
- `rollback` undoes the last apply: it restores the backups, removes the files
  that apply created, restores `.gitignore` and puts the previous
  `install-state.json` back. A file edited after the apply is kept. The record
  of the last apply lives in `.agents/workflow-kit/last-apply.json`. Installs
  made by older versions fall back to the newest backup of each file.
- `init` and `update` refuse to write through a symbolic link (for example
  `CLAUDE.md -> AGENTS.md` or a linked `.agents/`), and `doctor` reports it as
  `managed/symlink`. Writes are atomic.
- `upgrade` checks that the ref exists before removing the installed toolkit,
  and rejects a malformed `--ref`.
- `update --adopt-existing` no longer turns a hand-written instruction file
  into a baseline that the next update overwrites.
- An unreadable `install-state.json` is reported (`doctor`:
  `managed/install-state-unusable`) instead of being treated as "not installed".
- `workflow-kit --help`, `--version`; a flag without its value is an error;
  usage errors exit with code 2.
- TUI: update and doctor start from the installed runtimes instead of
  `neutral`; the stack-pack question is asked again on install; a missing
  installer skips that optional capability instead of failing the run.
- A deleted local skill leaves `registry.json` on the next update. Plan paths
  use `/` on every platform. CRLF frontmatter is read.

Contract:

- Adapters carry one shared bootstrap block. They no longer forbid the
  continuation fast-path, and the authorization gate applies only to routes
  that write: read-only work and an explicit imperative need no extra
  confirmation. `doctor` accepts the previous adapter wording with a warning.
- "Session memory" is the routing trace visible in the conversation. One N1
  procedure, one N2 default (inline, no delegates), one cost-posture rule, and
  a route for irreversible operational actions.
- `pr-comments-resolution` works with the `gh` CLI when the Copilot tools are
  absent. Cavecrew helpers follow the delegate contract.
- References to documents of another project were removed from the skills.

Validation and CI:

- The version-bump gate now runs in CI (it was skipped on every pull request)
  and rejects a lower version.
- `check:templates` compares the whole `.agents/` tree and every runtime
  adapter with the installable templates, instead of a fixed list.
- CI runs on Node 20.17, 22 and 24 with a pinned bun. `engines.node` states
  the real minimum (`^20.17.0 || ^22.13.0 || >=23.5.0`). Dependabot uses the
  `bun` ecosystem.
- Validators fail on missing targets, orphaned generated files and stale
  allowlist entries instead of skipping them.
- A new `OSV-Scanner` workflow checks `bun.lock` against OSV.dev on every pull
  request, on `main` and weekly, next to the existing `bun audit` gate.

Docs: README reduced to the essentials, `rollback` and all flags documented,
no reference to a tag that does not exist, private vulnerability reporting in
`SECURITY.md`, stale phase descriptions rewritten.

## 0.16.2-remove-slidev

- Removed the Slidev presentation (`slides.md`), its `slides:*` scripts and its
  CI build step. Nothing installed in target repositories changes.
- Removed the Slidev development dependencies, the three local dependency
  patches and the seven version overrides that existed only for that tree. The
  package now has one runtime and one development dependency.
- `check:security` accepts an empty patch inventory (then any advisory fails)
  and rejects a patch registered in `package.json` that the inventory does not
  document.

## 0.16.1-roadmap-closure

- A protected file whose content already equals the new version is reported as
  `unchanged` and stops being protected, so taking the new version by hand
  ends the `skip_modified` and `managed/content-drift` reports.
- `doctor` reports `skills/local-catalog-missing-skill` when a repository's own
  skill index or registry does not list an installed workflow-kit skill.
- `create-prd` proposes interaction-order edge cases for visible UI (first
  interaction after load, interaction while another is in progress, touch).
- README section "Per-project setup after installing".

## 0.16.0-safe-update

- `update` and `init` list the one-time migrations a plan carries, and
  `--diff` prints the line diff of every file that would change.
- The TUI asks for a stack pack on install and runs `doctor` after applying.
- End-to-end upgrade tests from the legacy layout for every runtime.

## 0.15.0-neutral-structure

- Project rules live in `.agents/project/` (quality gate, backend, frontend);
  Copilot gets generated copies that keep your `applyTo` frontmatter.
- Rails and React rules moved from the skills to the `rails-react` stack pack
  (`.agents/project/stack.md`); existing installs receive it by default.
- No own skill file exceeds 200 lines. Claude Code gets `.claude/skills/`
  wrappers. `opencode` is accepted as a runtime. Teaching notes are selective.

## 0.14.0-prd-pr-quality

- PRDs gain "Supuestos e integraciones" and "Que queda obsoleto"; `create-prd`
  asks edge cases by confirmation and measures PRD size signals.
- `solution-sketch` offers optional UI paths with HTML mockups.
- `pr-comments-resolution` evaluates every comment before offering options.

## 0.13.0-validation-reuse

- Expensive deterministic checks can reuse a result when a script-computed
  fingerprint proves nothing changed (starts in shadow mode). QA re-entries
  are focused on the repair.

## 0.12.0-cheaper-preparation

- `.agents/project-context.md` is the project's fixed knowledge base.
- Delegates read `.agents/delegation/delegate-contract.md` instead of the
  routing contract. N3 uses a verified PRD index.

## 0.11.0-execution-brakes

- At most 2 repair rounds per slice, one recovery attempt for an environment
  failure, one rerun for a flaky test. Temporary AI state moved to the
  Git-ignored `.ai-work/<prd-slug>/`.

## 0.10.0-implement-change

- `implement-change` is the general implementation route for PRDs, bugs,
  tickets, and iterations; `implement-prd` stays as a permanent alias.

## 0.9.0-model-profiles

- Delegate agents get their model from a per-project profile: `calidad`
  (subscription) or `costo` (Copilot and per-token APIs).

## 0.8.0-proportional-loading

- Task levels N0–N3 with a generated pre-filter in every runtime adapter; the
  router was split into a small core plus references.
