# Changelog

Versions follow `docs/versioning.md`. While the package is `0.x`, installed
paths may change between versions; every change below is applied by
`workflow-kit update`. Since `0.22.0`, update can delete kit files a version
no longer ships and move project content to `.agents/project/`, always with a
backup and `workflow-kit rollback`. Migration details are in
`docs/migration.md`.

## 0.22.0-manifest-updater

`workflow-kit update` now follows the kit manifest: it replaces what the kit
owns, never touches the project overlay `.agents/project/`, deletes the kit
files a version stops shipping, and migrates repositories installed before
this version to the kit/project overlay layout once, with a dry run, backups,
and rollback. This is the updater and migration phase (F2) of the kit/project
overlay epic.

- Update by manifest: every path takes its class from
  `.agents/workflow-kit/manifest.json` (`kit`, `derived`, `adapter`, `seed`,
  `state`), and `src/` keeps no hand-written list of kit paths. Kit and
  derived files are replaced when unedited; an edited one stays pending, and
  so does your own file at a kit path the install never recorded
  (`unrecorded_kit_file`, for example `.codex/README.md` when you add the
  Codex runtime). Adapters get only their `workflow-kit:managed` block
  regenerated, so your text outside the markers is never changed. Seeds are
  created once. The skill catalogs belong to the kit and are replaced whole;
  project rows live in `.agents/project/index.md`. The manifest is now
  installed in the target.
- install-state `2.0.0`: `{ sha256, class }` per path and `mode: "repo"`; an
  adapter records the hash of its block. A `1.0.0` state is still read.
- Retired files: a kit file that no runtime of the new version ships is
  deleted when unedited, always with a backup next to it; an edited one stays
  and `doctor` names it. The apply journal moves to `2.0.0` with a `deleted`
  action, and `rollback` restores deleted files.
- Backups: no write replaces content without a backup unless that content
  matches the hash the kit recorded, whatever `--backup-mode` says. Every
  write planned without a backup is checked again right before it happens: a
  file that changed or appeared since the plan is kept as a backup first.
- Layout migration from `1.0.0` (id `0.22.0-kit-overlay-layout`): own skills
  under `.agents/skills/` move to `.agents/project/skills/<name>/` (file modes
  kept) with a row in `.agents/project/index.md`; own catalog rows move there
  with your trigger and cost; `.agents/project-context.md` moves to
  `.agents/project/context.md`; an unedited 0.18/0.19 project quality gate
  becomes the project-additions stub. Every write keeps a backup, the
  migration is one block in a partial selection, a second update writes
  nothing, and `rollback` restores the previous tree and the `1.0.0` state.
  Items it cannot move safely (a symbolic link, a name collision, a file that
  is not UTF-8 text) stay pending. When `.agents/project/index.md` already
  exists with a `## Skills` or `## Shadows` table the migration cannot extend,
  the migration stops before writing anything and names the fix, so own rows
  never end up only in backups.
- `--edited <path>=keep|discard|shadow|split` (and `all=`) decides each
  pending file: `discard` takes the kit version, `shadow` (only while
  migrating, for a leaf skill) keeps your version in
  `.agents/project/shadows/<skill>/` with its `shadow.json`, `split` keeps
  your own text outside the new block of an unmarked adapter. Every decision
  keeps a backup; an invalid one exits 2 before writing. `keep` is not
  remembered: the file stays as it is, and every `update` and `doctor` list it
  again until you choose another decision.
- `init` stops over an existing install (`1.0.0` or `2.0.0`) and points to
  `update` (with `--runtime`, `--stack` or `--profile` to change those
  choices), so recorded choices and pending files are never reset. The TUI
  Install stops the same way right after you choose the target. `init` and
  `update` also stop before planning when a file stands where they need a
  folder, or a folder where they write a file.
- `export` records `mode: "export"` in the exported `install-state.json` and
  refreshes only a folder an export wrote. Over an install (`1.0.0` or
  `2.0.0`) it stops before writing anything. An export written before
  `0.22.0` recorded `mode: "repo"`, so it is not refreshed in place: export to
  an empty folder, or remove its `.agents/workflow-kit/install-state.json`
  and export again.
- `rollback` without its journal restores the newest backup of each managed
  file and first keeps the current content as a
  `.workflow-kit-backup-<timestamp>-before-rollback` copy, which no rollback
  restores; running it again restores nothing more. It names the copies and
  advises a dry-run `update` with a decision per pending file.
- TUI: with edited files it offers keep my edits, replace all with the kit
  version, or decide file by file (only the valid decisions, with a short
  diff). Replace all splits an unmarked adapter where `split` applies and
  leaves it pending where it does not (for example Windows line endings). The
  preview groups the layout migration with its pending items.
- `doctor`: new `managed/legacy-layout`, `managed/apply-incomplete`,
  `managed/apply-journal-unusable`, `managed/path-unreadable` (a path it
  cannot read, instead of a crash), `boundary/pending-<reason>` (one per
  pending reason, with the command that resolves it),
  `boundary/adapter-block-edited`, `boundary/shadow-outdated`,
  `boundary/shadow-invalid`, `boundary/ignored-state-key`,
  `boundary/unowned-path` and `project-context/both-paths`.
  `skills/unregistered-file` is now a warning in a target repository and
  points to the project overlay. Retired: `managed/content-drift`,
  `skills/local-catalog-missing-skill` and
  `project-instructions/quality-gate-missing`. `stack-pack/missing` now asks
  to restore the file from Git. The kit repository's overlay drift check
  compares only manifest paths.
- Docs: `docs/migration.md` (flow, groups, decisions, rollback without a
  journal, export) and `docs/troubleshooting.md` (every `doctor` code with its
  action).

Upgrade: run `workflow-kit update --target <repo>` without `--apply` first and
read the migration and its pending files; add `--diff` to see the content.
If an apply stops halfway, `init` and `update` refuse to run until
`workflow-kit rollback --apply --yes` undoes it. Decide pending files in the
same apply as the migration if you may want to roll back, since `rollback`
undoes only the last apply. CLIs older than this version cannot read a
`2.0.0` install-state; upgrade the CLI on every machine that updates the
repository.

## 0.21.0-project-runbooks

A project can now keep its operational procedures (promoting a build to an
environment, a release, a hotfix, a rollback) as runbooks, and the agent runs
them without ever skipping the confirmation of an irreversible step. This is
the runbooks phase (F3) of the kit/project overlay epic. Runbooks live only in
the project overlay, the kit ships none, and a repository without runbooks
routes exactly as before.

- Runbook class: a project skill of class `Runbook` at
  `.agents/project/skills/runbooks/<name>/SKILL.md`, with a `Runbook` row in
  the `Skills` table of `.agents/project/index.md`. Required headings:
  `## Trigger`, `## Owner` (with `last_verified`), `## Preconditions`,
  `## Steps`, `## Verification`, and `## Rollback`. Irreversible steps (push,
  deploy, delete, data migration, publish) carry `confirm: required` and
  `risk:`. Secrets appear only as variable or secret-store names. The
  contract is the `Runbooks` section of `.agents/kit-boundary.md`.
- Template: `.agents/skills/06-patterns/authoring/runbook-template.md`.
  `add-project-pattern` gains a runbook variant that writes there and
  registers the row.
- Running a runbook: an operational request that matches a runbook trigger
  loads it after the hard triggers; when two runbooks match, the agent asks
  which one. Every precondition is checked before the first step, and a failed
  one stops the run, even if the user asks to skip it. Each irreversible step
  names its risk and waits for its own yes, even when the runbook does not
  mark it or says not to ask. A step that changes code goes through the
  normal kit route (the N1 rule or `implement-change`). The rules live in the
  router reference `reference/project-overlay.md`, and no runbook text can
  weaken them.
- Capture: when you teach or correct a procedure during N2/N3 work, the agent
  proposes once to save it as a runbook (the full file, or a diff of an
  existing one) and writes nothing without your explicit yes. It replaces any
  secret value with a placeholder first. The rule is in
  `.agents/instructions.md` (`## Project runbooks`).
- Checks: `validate-kit-boundary` checks the class, path, folder name, and
  required headings of project runbooks. The kit registry rejects the
  `Runbook` class, `registry.schema.json` lists the six kit classes, and the
  stack-neutrality check now covers `06-patterns/authoring/`. The
  implementation matcher reads only `Pattern` rows. Router evals L21–L26
  cover runbooks.

## 0.20.0-kit-overlay-contract

The boundary between the kit and the project that installs it is now written
down and checked. This is the contract phase (F1) of the kit/project overlay
epic: the updater does not use it yet, so `workflow-kit update` behaves as
before, and a repository installed with an earlier version keeps working
without any change.

- Contract: `.agents/kit-boundary.md` (for agents) and
  `docs/project-boundaries.md` (for people). Everything under
  `.agents/project/` belongs to the project. The project extends the kit only
  from there, in three levels: **add** (a new project skill under
  `.agents/project/skills/<name>/SKILL.md`, registered in
  `.agents/project/index.md`), **extend** (a declared extension point such as
  `.agents/project/routing.md` or `.agents/project/quality-gate.md`), and
  **shadow** (`.agents/project/shadows/<skill>/` with a `shadow.json` that
  stores the kit file's hash). The router and `.agents/instructions.md` accept
  only extend. A shadow of a delegated role reaches the delegate through the
  slice lock's `role_skill`.
- Manifest v2: `.agents/workflow-kit/manifest.json` is now the closed, classed
  list of the paths the kit owns (`kit`, `derived`, `adapter`, `seed`, `state`),
  with its schema in `manifest.schema.json`. The old `portable_core` and
  `repo_overlay` keys are gone; nothing read them.
- Adapters: `CLAUDE.md`, `AGENTS.md`, `ANTIGRAVITY.md`,
  `.github/copilot-instructions.md`, and
  `.github/instructions/ai-workflow.instructions.md` wrap the kit's text in
  `<!-- workflow-kit:managed:start -->` / `<!-- workflow-kit:managed:end -->`.
  Project notes go below the end marker. An adapter you edited is still
  skipped by `update`, as before.
- Router: after the kit catalog, `workflow-router` reads
  `.agents/project/index.md` and `.agents/project/routing.md` when they exist
  (new reference `reference/project-overlay.md`). A project skill that reuses a
  kit skill name is ignored, and a project rule can never remove a hard
  trigger, the authorization gate, or the confirmation of an irreversible
  action. The implementation matcher also reads the project catalog. Router
  evals L16–L20 cover the overlay.
- Project skills: Codex, GitHub Copilot, and Cursor only discover skills in
  fixed folders, so `.agents/project/skills/**` is reached through the router.
  `add-project-pattern` now writes there and registers the skill in
  `.agents/project/index.md`; it no longer edits the kit registries.
- Quality gate: the default rules move to the kit file
  `.agents/delegation/quality-gate.md`, which every reader loads first, so
  installed projects now receive the test-design rules of 0.19.0.
  `.agents/project/quality-gate.md` becomes project additions only (tighten,
  never relax); an existing copy keeps working.
- Project context: the target path is `.agents/project/context.md`; the kit
  reads `.agents/project-context.md` while the new file does not exist. The
  installer still creates the old path until the updater phase moves it.
- Check: `node scripts/validate-kit-boundary.mjs`, now part of
  `npm run check:workflow`, fails when an installable file has no manifest
  class, an adapter loses its block or drifts from its template, a path
  reference breaks the rules (kit to kit inside the kit tree, kit to project
  only through the overlay layout, project to kit by name), or the template
  ships project files.

## 0.19.2-visual-lock

A prototype attached to a PRD (an HTML file or an image) is now followed
without losing details, and it never overrides the project's design system.
The rule has one source,
`.agents/skills/01-product/create-prd/reference/visual-lock.md`, and each
owning skill points to it.

- Ownership: the prototype locks structure and content (layout, hierarchy,
  sections and their order, texts, fields, states, interactions); the project
  patterns or design system own the visual language (colors, typography,
  spacing, radii, shadows, existing components). By default the pattern wins
  on visuals; the prototype wins on a visual aspect only when the user says so
  explicitly.
- Clashes are resolved in the PRD, never during implementation: `create-prd`
  compares the prototype with the patterns in Phase 2, lists every clash, asks
  once, and records each decision. An intentional new style (rebrand, new
  palette) is proposed as a pattern update first.
- The Contrato Visual gains a minimal `Lock visual` block: source, level
  (`estructura` by default, `pixel` only on explicit request), and the table
  `Elemento | Fuente | Componente | Decision`. Every element maps to an
  existing component or is marked `componente nuevo`; loose variants are not
  allowed. Without a prototype the block is `Lock visual: N/A`.
- `prd-readiness-review` stops on a prototype with an unresolved clash;
  `implementation-slicing` assigns every table row to one frontend slice;
  `frontend-phase-implementer` and the Pixel Ninja card implement the rows as
  written and return `blocked` on an undecided clash; `qa-handoff-review`
  validates against the table, not the raw prototype, and compares with a
  screenshot when `playwright-testing` is available.
- React examples go to the `rails-react` stack pack; the core stays
  stack-neutral. Eight maintainer evals and contract tests are added.

## 0.19.1-tui-option-clarity

The TUI and the CLI help now tell updating `workflow-kit` itself apart from
updating the workflow installed in a project.

- The six main-menu options say what they act on: `Instalar el workflow en un
  proyecto`, `Actualizar el workflow de un proyecto`, `Exportar el workflow a
  una carpeta`, `Revisar el workflow de un proyecto (doctor)`, `Actualizar
  workflow-kit (esta herramienta)`, and `Instalar solo herramientas opcionales
  (MCP)`. The first screen asks `¿Qué quieres hacer?`.
- The flows use "workflow-kit" for the tool and "project workflow" for the
  installed files instead of "toolkit" for both. The local-edits choice reads
  `Keep my edits` / `Replace with the new version`; capability scope and mode
  read `This project only`, `Install and connect`, and similar.
- `Mission control` shows `workflow-kit version` and `Project workflow
  version`. Doctor's version-mismatch hint names the `update` command to run.
- `--help` gains a `Commands:` block with one line per command; `upgrade`
  says it updates workflow-kit itself and changes no project.
- `docs/quickstart.md` lists the TUI menu with its CLI equivalent, and the
  README explains the two update steps.

Commands, flags, mode ids, menu order, option values, CLI plan titles, and the
`Refusing...` guards are unchanged, so scripts keep working. Nothing changes
in installed projects.

## 0.19.0-test-design

Agents stop writing redundant and expensive tests. The rules have one source,
`.agents/skills/02-implement/implement-prd/reference/test-design-rules.md`,
and each owning skill points to it.

- Owning layer: each business rule is tested in one layer only, the lowest
  one that contains it. Entry points cover authentication, authorization,
  tenancy, parameters, status, and response shape, plus one wiring case per
  rule. Jobs cover their own selection, batching, retries, and errors, not the
  service they call. Tenancy and authorization are always tested at the entry
  point too.
- The per-method coverage gate ("one test plus an edge-case assertion per new
  file or method") becomes "every new or changed branch in its owning layer"
  in `validation-and-stop-conditions.md`, `orchestration-flow-execution.md`,
  `level-n3.md`, and `qa-handoff-review`. A method that only delegates needs
  no test of its own.
- The PRD edge-case matrix gains a `Capa duena` column that slicing and QA
  validate. Section 2.9 `Que queda obsoleto` also lists the tests a change
  makes meaningless, and the owning slice deletes them.
- Agents search existing tests by name and by rule before writing and extend
  them; same-branch variants become one table-driven test.
- Migration up/down and backfill tests are temporary and are deleted once the
  migration is on the main branch; live database rules are tested next to the
  model or database tests without loading migration classes.
- Tests prove behavior, not implementation (no signature, console-output, or
  internal-state assertions; exact query counts only in marked performance
  tests), with cheap setup by default: transactional, minimal data, and no
  instrumentation or threads unless the test verifies them.
- `qa-handoff-review` flags cross-layer duplicates; the implementer
  checklists and validation anti-patterns carry the same rules. The default
  quality gate adds a test DRY rule (new installs; the project owns its copy).
- Rails examples go to the `rails-react` stack pack ("Test design in Rails");
  the core stays stack-neutral. Nine maintainer evals live in
  `test-design-evals.md`, and contract tests guard the rules.
- Existing project tests are not pruned by this version.

## 0.18.1-orchestrator-reads

At N2/N3 the orchestrator keeps decisions and evidence in its context, not raw
code, screenshots, or browser sessions.

- `implement-change` gains one rule, "Orchestrator reads (N2/N3)": the
  orchestrator reads the tracker, locks, handoffs, the input, and specific
  snippets. A bounded search (exact symbol, short output) may stay inline;
  broad exploration and whole-file reads are delegated to
  `cavecrew-investigator` or `sherlock-estructura`.
- Visual verification belongs to the role that performs it (frontend writer,
  QA, or a visual verifier): it opens the browser, reads the screenshots, and
  returns a verdict per criterion, the screenshot path, and findings. The
  orchestrator does not read images or drive the browser unless the user asks
  directly, with two exceptions: it may spot-check one screenshot or snippet
  when a criterion is critical or a verdict conflicts with other evidence,
  and it verifies inline, recording why, when the verifier returns `blocked`
  with `blocked_reason: no_browser_tools`.
- Level exception: N0 and N1 do not delegate, so the rule applies to N2 and N3
  only. A locator or visual-verifier call is not a stage delegate and does not
  change the N2 `avoided` default.
- `subagent-prompts.md` adds a Visual Verification Delegate template with its
  return format (`blocked_reason`, `criteria[N]{id,verdict,screenshot,finding}`).
  `qa-handoff-review`, `frontend-phase-implementer`, `level-n2.md`, and the
  "Compressed delegation preference" of `.agents/instructions.md` point to the
  rule.
- From a usage analysis of `general-purpose` runs: the same section of
  `.agents/instructions.md` now says that at N2/N3 a delegation picks a
  catalog delegate by role (`sherlock-estructura`, `turbo-backend`,
  `pixel-ninja`, `testinator-5000`, `lint-ranger`, `qa-relampago`) or a
  `cavecrew-*` helper for a narrow locate, edit, or review task, and uses
  `general-purpose` only when no catalog delegate fits, stating why. A test
  checks that every delegate the rule names exists in
  `scripts/delegate-agent-catalog.json`.
- No saving is claimed yet: it must be measured against the baseline before
  and after this change.

## 0.18.0-equilibrado-profile

New model profile `equilibrado`, between `calidad` and `costo`, for
subscriptions that often hit their weekly usage limits.

- `equilibrado` keeps `arquitecta-fases` and `qa-relampago` on Grande (Opus in
  Claude Code, `xhigh` in Codex) and moves `turbo-backend`, `pixel-ninja`,
  `testinator-5000` and `guardia-contrato` to Mediano (Sonnet, `medium`). Every
  other role stays Mediano; it never uses Liviano. `criticalConcerns` still
  escalate any role to Grande.
- Claude Code now applies that escalation: generated agents pin the profile
  model, so for a slice with a `criticalConcern` the orchestrator launches a
  role below Grande with `model: opus` and records it
  (`implement-change/reference/level-n3.md`, `.agents/model-routing/README.md`).
  Before, nothing told it to, which mattered once writers could be Sonnet.
- Choose it with `workflow-kit update --profile claude=equilibrado` (or
  `codex=equilibrado`), or in the TUI billing question. It is opt-in: no
  runtime defaults to it, and `update` keeps the stored profile, so existing
  installs do not change models.
- Trade-off: hard slices may need more repair rounds. If they rise steadily,
  go back to `calidad`.
- `doctor` checks `equilibrado` agents like the other profiles. All generated
  agent files are regenerated because their profile line now lists the three
  profiles; their models do not change.
- `.agents/model-routing/README.md` documents the profile and recommends it
  over `costo` when a subscription hits its limits.
- Downgrading: toolkits older than 0.18.0 do not know `equilibrado`; switch
  back to `calidad` first (`docs/migration.md`).

## 0.17.6-bounded-output

Delegates must keep tool output small. Measured on a downstream project, Bash
made up most of what entered a delegate's context.

- New delegate contract rule 16, bounded command output: tests and linters run
  in quiet mode so only failures print, long output goes to a file under the
  tracker's `logs/` with only its last lines read, large files are read by
  range or symbol, and images are read only by roles that do visual
  verification. The summary carries it and all runtime adapters are
  regenerated.
- `validation-runner` runs commands in quiet mode and sends long output to the
  tracker's `logs/`.
- `validate-delegate-contract.mjs` also checks an optional `summaryPattern`
  against the contract summary embedded in runtime adapters: removing the new
  rule from the rules or from the summary fails `check:workflow`.
- No token saving is claimed yet; that needs a usage comparison after real use.

## 0.17.5-slice-checkpoint

Long N2/N3 implementations no longer have to carry closed slices in one
session.

- `implement-change` (and its alias `implement-prd`) names a session cut
  point: a slice `VERIFIED` from its terminal handoff with no delegate
  pending. There the orchestrator writes a checkpoint and proposes continuing
  in a new session. The rule lives in one new reference,
  `implement-change/reference/session-checkpoint.md`; other files only point
  to it.
- The checkpoint is a `checkpoint` block in the existing tracker, not a new
  file: the routing trace, closed slices, next slice and its lock, open
  decisions, branch, commit, and working tree.
- A resumed session reads the tracker, the next slice's lock and its required
  reads; it takes the continuation fast-path and does not rerun the router,
  readiness, discovery, or validation of slices with fresh evidence.
- Size brake: propose a cut at about 150k tokens when the runtime shows the
  context size; otherwise after 4 terminal handoffs or 60 orchestrator tool
  calls since the last cut, naming the substitute used.
- The cut is proposed, never imposed, and never interrupts a wait for
  delegates. A new router eval (L15) covers the resumed session.
- No saving is claimed yet: it must be measured against the baseline before
  and after this change.

## 0.17.4-usage-measurement

- New maintainer script `scripts/measure-claude-usage.mjs`
  (`npm run measure:usage`): reads local Claude Code transcripts and reports
  token consumption per agent type (cost share, context medians, share of cost
  above 150k, cost by model, compactions, tool-result size per tool). It counts
  each response once per `message.id`, is read-only, prints counts only, and is
  not part of `check:workflow`. It is the baseline for the token-saving items
  that follow. See `docs/workflow/runbooks/measure-claude-usage.md`.
- Nothing installed in target repositories changes.

## 0.17.3-contract-gaps

Fixes from a Copilot review of a project updated to 0.17.2; every item was a
contradiction between kit files.

- Broken links: `create-prd` pointed its self-audit hard gate and the
  critical-stance rule at missing paths. A test now checks every relative link
  inside skills.
- `acceptance-test-engineer`: only unit and component tests must mock every
  request; integration and E2E tests (Playwright) may call the local app under
  test. E2E results are never reused between stages, as `evidence-reuse.md`
  already said.
- PRD scripts count ids with a letter suffix or no dash (`AC-1a`, `AC1`,
  `P2-S2b`), so `verify-prd-index.mjs` no longer passes an index that misses
  one. `prd-size-signals.mjs --open-blocking` raises the signal when blocking
  questions stay open after the last allowed round; before, it never fired.
- Delegate contract summary: delegates may read their owned source and test
  files, direct callers and contracts, the PRD index entries for the slice, and
  selected patterns. All runtime adapters are regenerated.
- PRD index (N3): Capitana returns it in its handoff and the orchestrator
  writes and verifies it, since Capitana does not edit files. A bug or ticket
  at N3 without a PRD has no index; Capitana returns a readiness brief instead.
- N2: a delegated coding slice always gets its execution lock, even when it is
  the only slice, because `VERIFIED` requires it.
- N1 pre-filter: when behavior changes, the focused check is the touched
  tests; lint or build alone is not enough. For a bug, the test fails before
  the fix and passes after it.
- `validation-runner` looks for a layer's command in `project-context.md`, the
  stack rules, the quality gate, and then the layer instructions before
  reporting that none is declared.
- Iterations resolve the section 10 reference to a commit and compare with
  `git diff <ref> -- <files>`, which includes uncommitted changes.
- `pr-comments-resolution` paginates review threads.

## 0.17.2-catalog-rows

- `update` adds the rows of newly shipped skills to the skill catalogs your
  repository keeps (`.agents/skills/index.md`, `.agents/skills/registry.md`,
  `.agents/skills/06-patterns/index.md`). Before, it preserved them untouched,
  so `implement-change` stayed invisible to the router after updating. Rows go
  next to the related skills inside the table under the same heading; your
  rows are never changed and the files stay yours (not in install-state).
- `registry.json` keeps the entry you or the kit registered for a skill. A
  skill found on disk only fills a gap; before, an entry whose `SKILL.md`
  frontmatter used another name was renamed to that name.
- Install and update add `.agents/workflow-kit/last-apply.json` (the local
  rollback journal) to `.gitignore`. If it was committed earlier, run
  `git rm --cached .agents/workflow-kit/last-apply.json`.
- Model routing: when subscription limits are hit in `calidad`, lower
  `guardia-contrato` and `testinator-5000` to Mediano first and keep
  `arquitecta-fases` and `qa-relampago` on Grande.

## 0.17.1-stack-detection

- `update` no longer installs the `rails-react` stack pack in every repository
  installed before stack packs. With no recorded or requested stack, it
  installs the pack only when the repository looks like Rails + React (a
  `Gemfile` and `react` in a `package.json` at the root or one folder down),
  and records `none` otherwise.
- The interactive TUI asks for the stack in that case too, with the detected
  one preselected; scripted runs keep using detection without prompting. The
  install question also preselects the detected stack.
- The TUI plan preview now shows the stack pack and the one-time migrations
  before you decide to apply.
- A repository that already received the pack by mistake keeps it, because the
  file is yours: run `workflow-kit update --stack none --apply --yes` and
  delete `.agents/project/stack.md`.

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
