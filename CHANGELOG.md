# Changelog

Versions follow `docs/versioning.md`. While the package is `0.x`, installed
paths may change between versions; every change below is applied by
`workflow-kit update`. Since `0.22.0`, update can delete kit files a version
no longer ships and move project content to `.agents/project/`, always with a
backup and `workflow-kit rollback`. Migration details are in
`docs/migration.md`.

## 0.23.7-pilot-fixes

Fixes from a pilot that installed the kit in a fresh project and had an agent
follow the workflow. In your projects, `workflow-kit update` changes
`kit_version`, adds one line to `.gitignore`, and updates the kit text listed
below. Adapters (`CLAUDE.md`, `AGENTS.md` and the others) do not change.

- `.gitignore` gains `*.workflow-kit-backup-*`, so `git add -A` no longer
  versions the copies the kit leaves next to a replaced file. `doctor` warns
  with `workspace/backups-not-ignored` when an install lacks the line. A
  backup that is already committed stays tracked until you run
  `git rm --cached` on it. When `.gitignore` is a symbolic link the kit does
  not write it: the plan says which line to add by hand and goes on.
- The plugin install steps and the `mode/plugin-not-installed` finding no
  longer say the commands fail until the `plugin` branch is published. They
  say the marketplace serves the version published on that branch and point
  to `workflow-kit doctor`.
- Kit text no longer sends an agent to things an installed project lacks:
  the kit repository's `scripts/` and `check:workflow`, `docs/foundations` and
  `docs/standards` (now the `docs/workflow/standards` files the kit installs
  and the project files under `.agents/project/`), and two maintainer
  documents. `.agents/project/stack.md` is described as present only with a
  stack pack, and the kit quality gate as the file it is, not a skill.
- The N1 trace has one format everywhere, `N1 · surgical · <files>`.
- `create-prd`: Phase 5 has its own entry in the skill; the PRD template no
  longer breaks its open-questions table; the calibration step names no tool
  of a particular runtime; `pattern-locking` gives examples from a product
  codebase. Spanish text is neutral.
- `check:workflow` runs a new validator, `validate-installed-paths.mjs`: it
  fails when installed kit text cites a path that no install provides, or
  names a document of the project without saying it is optional.

## 0.23.6-ac-guards

No change to what the CLI does or to the kit files; in your projects,
`workflow-kit update` changes only `kit_version`.

- `check:docs` now requires the plugin-mode content of the guides (the
  `--mode plugin` commands, the plugin install commands, the `mode/*` doctor
  codes) and the "Rollback" and "Deciding edited files" sections of
  `docs/migration.md`.
- New tests defend acceptance rules that could be broken without a failure:
  retiring kit files on a switch to plugin mode, the exit code and the wait of
  `claude plugin list` in `doctor`, the validators `check:workflow` runs,
  seed drift, the manifest against its schema, the sections and the template
  of runbooks, paths inside adapter blocks, router evals and the wording of
  the delegate contract.

## 0.23.5-cli-fixes

Fixes from the independent verification of 0.23.3. In your projects,
`workflow-kit update` changes `kit_version` and one kit file,
`delegate-skill-matrix.md` of `implement-prd`.

- Every command a stop or `doctor` prints carries the absolute `--target`,
  quoted for a shell, so it runs as printed from any folder. Before, a pasted
  `workflow-kit rollback --apply --yes` acted on the folder it was pasted in.
- After a run killed before it wrote its record, or a rollback killed at its
  end, `workflow-kit rollback` removes what that run left (the lock, temporary
  files, empty folders it created), lists it in the dry run, and leaves an
  earlier finished apply alone. It refuses when the lock path goes through a
  symbolic link.
- The apply lock: a folder at the lock path stops `doctor`, `init`, `update`
  and `rollback` with one message and is never deleted; a lock whose content is
  not valid is reported as unreadable and its raw content is not printed.
- A folder or an unreadable file where the install state, the journal or the
  manifest goes, a read-only kit folder, and `export --output` through a broken
  symbolic link stop with a message that names the path and the way out,
  instead of a raw `EISDIR`, `EACCES` or `ENOTDIR`. Journal and install-state
  messages say how to recover.
- `upgrade --package-manager` with an unsupported value is rejected in the dry
  run too. Printed text says `workflow-kit` where it said "toolkit" (the plan
  header is now `workflow-kit version:`).
- A kit file reached through a symbolic link offers only `keep`;
  `--edited all=discard` leaves it and discards the rest. `update` on an
  exported folder keeps `mode: "export"`. `.DS_Store`, `Thumbs.db` and
  `desktop.ini` inside the templates of a local checkout are skipped.
- `doctor` in plugin mode no longer reports an own file at the path of a
  runtime that is not installed as a kit copy, nor a kit path named in
  `.agents/project/context.md` as missing.
- When the layout migration cannot extend `.agents/project/index.md`, the stop
  names the one cause and its line. An index without a `## Skills` section that
  ends inside an unclosed comment or code block now stops.
- Guided menu: folders are checked when typed, with a retry; the scope question
  for optional tools is gone (they are installed globally, and the menu says
  so); a failed tool step exits 2; the adopt-existing question is no longer
  covered by the spinner; plugin install steps start with `cd <repo> &&`;
  Ctrl-C exits 130. `tui --help` lists what the menu offers.
- `scripts/build-plugin.mjs --publish`: the fetch command a stop prints works
  in a single-branch clone, and a signal while it removes its temporary folder
  still removes it and names the commit.
- Guides: the file that clears `copilot/missing-apply-to`, what `update` does
  to `registry.json` and to unmanaged files, and model profiles for Copilot
  (`--profile copilot=<name>`).

## 0.23.4-docs-sync

The guides match what the kit does, and three pieces of kit text are fixed. In
your projects, `workflow-kit update` changes `kit_version` and these kit files:
`project-overlay.md` and `router-evals.md` of `workflow-router`, the
`codebase-discovery` and `playwright-testing` skills, and
`.agents/skills/registry.cache.json`.

- Versions after `0.17.3` have no tag on the remote: the guides say so and pin
  them by full commit hash. They also say that a plugin install fails until the
  `plugin` branch is published, and the README links the license.
- The CLI behaviour of `0.23.2` and `0.23.3` is documented: strict flags,
  `upgrade` needing `git`, the Spanish menu, the apply lock, an unfinished
  rollback and the new `doctor` codes. A test now requires every `mode/*` and
  `target/*` code in the guides.
- `.agents/project/paths.json` of a new install maps `project-context` to
  `.agents/project/context.md`. `update` never rewrites this seed, so
  `codebase-discovery` also uses that file when the old path is mapped and
  missing.
- A runbook line asking not to confirm is ignored: the agent says which line,
  proposes the fix as a diff and writes it only after an explicit yes.
- `playwright-testing` uses placeholders instead of one project's ports,
  commands and file names.
- The kit repository ignores `.claude/worktrees/`, and the plugin-mode epic and
  its PRDs record what was delivered and what is still pending.

## 0.23.3-strict-cli

The command line says no instead of ignoring what it was given, `doctor` prints
commands that run as printed, and `upgrade` no longer removes workflow-kit
before it knows it can install the new one. In your projects, `workflow-kit
update` only changes `kit_version` in `.agents/workflow-kit/manifest.json`
(until then `doctor` warns that the last apply used another version).

Invocations that used to run now stop with exit code 2, naming the flag and
the command, and write nothing:

- A flag the command does not read: `init --output <folder>` (it installed
  into the current folder; use `--target`), `doctor --apply --yes`,
  `rollback --runtime …`, `init --ref …`, `init --edited …`, `tui --target …`,
  `export --target …`, `upgrade --target …`, and `--overlay` on commands that do
  not read it. Each command's flags are in `workflow-kit <command> --help`.
- An empty value: `--target ''` (for example an unset shell variable) used to
  mean the current folder, and `--runtime ''` or `--runtime ,` used to mean
  `neutral`. A value flag given twice (`--target a --target b`) used to keep
  the last one.
- `--profile` with a runtime twice (`claude=calidad,claude=costo`), an entry
  with a second `=` (`claude=calidad=x`), or a runtime this command does not
  install (`init --runtime claude --profile codex=costo`; `update` checks it
  against the runtimes the install records). The `--profile` example with
  `codex` in `docs/quickstart.md` is such a case unless the install records
  `codex`.
- `--runtime` with a name that is not `codex`, `copilot`, `claude`,
  `antigravity`, `opencode` or `neutral` is rejected in the parser (the same
  runtimes as before).

`--help` lists the valid `--runtime` values, and `workflow-kit <command> --help`
prints that command only. Plans, summaries and every valid invocation print
what they printed before, except where listed here.

`doctor`:

- Every command it prints carries the absolute, quoted `--target` (and the
  `claude` plugin commands start with `cd <target> &&`), so pasting it from
  another folder acts on the project, not on that folder. The `--edited
  <path>=<decision>` advice is one command per decision instead of
  `<decision>`.
- The fix for `model-profile/agent-mismatch` adds `--edited <agent>=discard`
  when the agent is an edited kit file; before, `update --profile … --apply
  --yes` left it as it was and `doctor` failed again.
- New findings: `mode/kit-location-missing` (error: a plugin-mode adapter lost
  its `workflow-kit:kit-location` block, so the agent is never told where the
  kit is; `update` restores it), `target/not-found` (the path does not exist or
  is not a folder; before it listed about 250 missing files), `managed/file-empty`
  (error: an emptied kit file or adapter, with the command that takes the kit
  version back), `managed/apply-lock-held` (error) and `managed/apply-lock-stale`
  (warning) for `.agents/workflow-kit/apply.lock`. An interrupted rollback keeps
  its own wording, and the rollback command in the journal messages names the
  target.
- Missing files come after a line that explains them: no install here, or an
  install last applied with another workflow-kit version (run `update` first).
- Plugin settings: an `enabledPlugins` entry set to `null` or a string next to
  the project's own marketplace is reported as not enabled; a plugin with the
  same version number and another suffix no longer gets `claude plugin update`
  as the only advice.

Plugin mode settings: an empty or blank settings file is filled with the
declaration (with a backup) instead of being reported as invalid; a settings
file with a repeated key is never rewritten (the plan and `doctor` name the
key, so no earlier entry is dropped silently); `claude plugin list` output
above 1 MB is read. The install steps printed after `init --mode plugin
--apply` say they fail until the `plugin` branch is published.

`upgrade`:

- It verifies the ref before removing anything: a branch or tag by name, a full
  40-character commit by fetching it, and a short commit only when it is a
  branch or tag tip (give the full commit otherwise). A mistyped commit used
  to pass the check, then remove the installed workflow-kit and fail.
- It needs `git` on the PATH: without it the upgrade stops before the removal
  (before, it skipped the check and removed). `git` runs without prompting for
  credentials and with a 30-second limit, and an unwritable temporary folder is
  a message, not a stack trace.
- If the install fails after the removal, the message says workflow-kit is not
  installed now and names a command that can work.

`tui`:

- Every prompt, option, description and message of the guided menu is in
  Spanish; command, flag, runtime and profile names and file paths are not
  translated, and the plan, `doctor` and migration text it prints stays in
  English. The menu needs a terminal: with stdin at end of file or a pipe it
  exits 2 with an error in English (it printed "Canceled by user" and exited 0).
- The yes/no questions accept `sí`, `si`, `s`, `y` and `yes`, and `no` or `n`
  (anything else is asked again), show `(s/N)` and answer `Sí` or `No`; the key
  hints are in Spanish. After an update the summary lists the project-owned
  files left as they are and the deletes not done because the file changed
  since the plan, and project-owned seeds no longer count as unmanaged files.

## 0.23.2-apply-recovery

An interrupted or concurrent apply can always be undone exactly, and a run
with nothing to change writes nothing. `.gitignore` gets two more ignore
entries on the next `update` (with a backup).

- An apply records its run before its first write: the journal
  `.agents/workflow-kit/last-apply.json` lists every file the run is about to
  touch, with the checksum it had before, and is marked finished only at the
  end. A run stopped at any point (an error, Ctrl-C, `SIGTERM`, a killed
  process) makes the next `init` and `update` stop with "The last
  workflow-kit apply did not finish", and `workflow-kit rollback --apply
  --yes` undoes exactly that run: files it never reached stay as they are,
  and the folders it created go (a folder you had before stays, even empty).
  Before, a run stopped by a signal left the previous journal, so rollback
  could undo the wrong run, and the layout migration left none.
- Ctrl-C or `SIGTERM` during `init`, `update`, `export` or `rollback` lets the
  file being written finish and stops (exit code 130, or 143 for `SIGTERM`); a
  second signal stops at once.
- One run at a time per repository: an apply or rollback holds
  `.agents/workflow-kit/apply.lock` and a second one stops with "Another
  workflow-kit run is changing this repository". A run that planned before
  another one applied stops with "changed after this plan was made" instead
  of replacing that run's journal; run it again. A dry run and `doctor` are
  not stopped by the lock. A lock whose process is gone, whose process id now
  belongs to another process, or that is empty is taken over; one that cannot
  be proved stale (it has no start time, or the system cannot tell it) says
  to remove it only if you are sure no workflow-kit command is running. The lock and the temporary files of a write
  (`.workflow-kit-tmp-*`) are new ignore entries, and the next run removes
  the ones a killed run left. Backups are never overwritten.
- `rollback` restores each file through a temporary copy, so a file is never
  left half-restored. A rollback stopped at any point (even a killed one) is
  recorded in the journal: `init` and `update` stop with "A workflow-kit
  rollback … did not finish" and `doctor` reports it until `rollback --apply
  --yes` runs again and finishes it. A rollback planned before another run
  applied stops ("changed after this plan was made") instead of undoing the
  wrong run. Rolling back an unfinished run whose files were already
  removed by hand now clears its journal (before, it said "Nothing to roll
  back" and `update` kept asking for a rollback). The plan names the run it
  undoes (`init` or `update`, when, which version), and for an `init` says the
  install itself goes. An `install-state.json` edited after the run is kept
  as a `-before-rollback` copy first; a file removed by hand after the run is
  reported as removed.
- A second `update` with nothing to change writes nothing, `install-state.json`
  included (before, its `generatedAt` changed). Exporting twice to the same
  folder writes nothing the second time: the kit's own `docs/README.md` is no
  longer listed in `legacy-docs-map.md`, and the seeds an export recorded stay
  recorded.
- `update` stops when `install-state.json` was written by a newer
  workflow-kit, and asks you to run `workflow-kit upgrade --apply --yes`
  first, instead of deleting the files the newer kit ships and replacing
  newer content with older. A damaged `runtimes`, `stackPack` or
  `modelProfiles` value is named with the state file instead of being read
  as a default.
- The migration from a pre-0.22 install replaces the skill catalogs
  (`.agents/skills/index.md`, `registry.md`, `registry.json`) also when the
  old state recorded them and the team then added its own rows by hand, as
  the `add-project-pattern` skill of `0.19.x` told it to: the own rows move to
  `.agents/project/index.md` first, and your version of each catalog stays in
  its `.workflow-kit-backup-*` file. Before, the catalogs stayed pending and
  still listed the old path, so `doctor` reported `skills/missing-file`. A
  byte order mark before `## Skills` in an existing project index no longer
  adds a second section.
- `init`, `update` and `rollback` say plainly when `--target` is a file or does
  not exist; `init` no longer creates a missing target folder (create it
  first, for example with `git init`); `export` still creates its output
  folder.
- A path whose name, or whose backup name (37 more characters), is longer
  than the file system allows is listed in the plan, dry run included,
  instead of failing halfway with `ENAMETOOLONG`.
- Output changes: the update dry run marks a seed the project owns as
  `skip_unmanaged: <path> (project-owned; left as it is)`; the update summary
  adds "Project-owned files left as they are" (no longer counted as unmanaged
  files) and, when it happens, "Not deleted (changed since the plan, kept as
  they are)"; the plugin-mode stops add `--apply --yes` to a step that has to
  run before the next one and no longer repeat that a runtime is left out;
  the edited-file stop of a switch to plugin mode no longer offers another
  decision where only `discard` applies; `upgrade` as a dry run without bun
  prints the plan and a note instead of exiting 2, and after an upgrade
  says "workflow-kit upgraded" and names `update` as a dry run first; the
  plugin install step after `init --mode plugin` changes to the target
  first (`cd <target> && claude plugin install …`).

## 0.23.1-script-guards

Kit checks that passed without checking. No CLI command, flag or output
changes.

- The kit scripts and the shipped skill scripts (`verify-prd-index.mjs`,
  `validation-fingerprint.mjs`, `prd-size-signals.mjs`) run when called
  through a symbolic link (macOS `/tmp` and `/var` are ones); before, they
  exited 0 without doing anything. The kit scripts share
  `scripts/is-main-module.mjs`; the shipped ones carry the same check.
- `check:release` compares with `origin/main` when it exists (what CI
  compares with), so a stale local `main` no longer passes; a moved file and
  an untracked file under a distributable folder count as changes, and
  changing only the version suffix is not a bump: `X.Y.Z` must rise.
- `check:templates` skips other checkouts under `.claude/worktrees/` and
  reports a runtime folder it cannot read; `check:legal` leaves files Git
  ignores (such as `.DS_Store`) out of the overlay inventory and, when the
  inventory differs, prints the `remainingInventory` values the record
  expects.
- `check` and the tests work in a checkout whose path holds a space.
- `scripts/build-plugin.mjs --publish`: a missing `origin/main` suggests
  `git fetch origin`, which also brings `origin/plugin`, and a publish with
  neither a local branch `plugin` nor `origin/plugin` says it starts a new
  history and how to build on the remote branch instead.

## 0.23.0-plugin-mode

Plugin mode (pilot): for Claude Code and GitHub Copilot, the kit can run as
the plugin `fhh` from the marketplace `fhh-ia-ecosystem` instead of being
committed in the repository. The kit is the same in both modes; the project
overlay `.agents/project/` stays in the repository. This is the plugin mode
phase (F4) of the kit/project overlay epic. Repo mode, the default, behaves
as in `0.22.0`: its plans are checked against a fixture generated from the
previous release.

- `init --mode repo|plugin` and `update --mode repo|plugin` (runtimes
  `claude` and `copilot` for plugin). A plugin-mode install keeps in the
  repository only the adapters (with a `workflow-kit:kit-location` block that
  names the skill `fhh:kit-root` in Claude Code and `kit-root` in Copilot),
  the plugin declaration in `.claude/settings.json` and
  `.github/copilot/settings.json`, `install-state.json` (`mode: "plugin"`),
  the overlay seeds and `.gitignore`: 3 kit-owned files for Claude Code, 6
  for Copilot, 8 for both. A non-default `--profile` still writes the
  project's own agents. `update` keeps the recorded mode unless `--mode` is
  given. Each person installs the plugin once per clone
  (`claude plugin install fhh@fhh-ia-ecosystem --scope project`,
  `copilot plugin install fhh@fhh-ia-ecosystem`); the kit prints these
  commands and never installs the plugin.
- Mode switches both ways with `update --mode plugin` and `update --mode repo`,
  undone by `rollback`. The switch to plugin is all or nothing: an edited kit
  file stops it and is listed, and only `--edited <path>=discard` (or
  `all=discard`) settles it in the same command. Repo to plugin deletes the
  recorded kit files with a backup next to each one. Every refused
  combination stops before writing and names the command to run next: a
  runtime without a plugin, `init --mode plugin` over an install, an older
  install-state (`1.0.0`), an exported folder, `export --mode`,
  `update --adopt-existing --mode plugin`, `update --runtime` with a runtime
  without a plugin in plugin mode, and `export --output` into a plugin-mode
  repository. A wrong `--mode` value never picks a mode.
- Settings merge: plugin mode adds only
  `extraKnownMarketplaces["fhh-ia-ecosystem"]` and
  `enabledPlugins["fhh@fhh-ia-ecosystem"]`, and repo mode removes only those
  two entries; the file is never deleted. A project that turned the plugin
  off (`false`) or points the marketplace entry elsewhere, such as a fork,
  keeps its choice: the plan says so and `doctor` names it. The merge writes
  normalized JSON (LF line endings; numbers as JavaScript reads them, so `1.0`
  becomes `1` and an integer beyond 2^53 loses precision); the original is in
  the backup.
- `doctor` prints `Install mode: plugin` and expects only the plugin-mode
  files. New codes: `mode/repo-and-plugin` (error: the kit would load twice),
  and the warnings `mode/plugin-not-declared`, `mode/plugin-not-installed`,
  `mode/plugin-version-mismatch`, `mode/plugin-install-unverified`,
  `mode/plugin-disabled`, `mode/plugin-disabled-by-project`,
  `mode/marketplace-customized` and `mode/adapter-not-tracked`. It runs
  `claude plugin list --json` (read-only, 5 seconds at most) only in plugin
  mode with Claude Code; for Copilot it prints the commands to check instead.
- Build and publish: `node scripts/build-plugin.mjs` checks and `--write`
  rebuilds the plugin into the git-ignored `dist/plugin/` and the marketplace
  `.claude-plugin/marketplace.json` (now part of `check:workflow`).
  `--publish` builds from the tracked content of `HEAD` (read from Git's raw
  objects, so attributes, filters, `core.autocrlf` and replacement objects
  change nothing) with
  that commit's own build code, and commits it to the local branch `plugin`;
  it never fetches, pushes or changes Git configuration, refreshes
  `dist/plugin/` only after the commit, and cleans up when interrupted. It
  refuses when `plugin` is a symbolic reference or is checked out, Git has no
  identity for the repository, a build input has uncommitted changes,
  `origin/main` is missing or does not contain `HEAD`, the legal check or the
  build fails, the local `plugin` does not contain `origin/plugin` or holds
  commits `--publish` did not write (or its history cannot be read), a path
  is outside printable ASCII or would be written outside its folder, or the
  content changed under an already
  published version (`--same-version` overrides only that). The marketplace in `main` points at
  the branch `plugin`, which exists only after the first approved publish and
  push; plugin installs fail until then.
- TUI: Install asks for the mode only when every chosen runtime has a plugin;
  switching mode is done from the CLI.
- Verified: Claude Code loads the plugin, its skills are `fhh:*` and
  `fhh:kit-root` gives the kit root while the overlay is read from the
  repository; Copilot CLI 1.0.115 loads it with `--plugin-dir` and the model
  follows the adapter, but only with the model choice `auto` (the explicit
  models tried were not available to the test account). Not verified: VS Code
  Copilot, the Copilot cloud agent, a real install from the GitHub
  marketplace (the branch `plugin` is not published yet), and Windows. See
  the capability matrix in `docs/workflow/cross-runtime-capability-matrix.md`.
- Upgrade the CLI before using plugin mode: an older CLI reads a plugin-mode
  state as a repo-mode install and its `update` reinstalls the kit files;
  `doctor` then reports `mode/repo-and-plugin`, and `update --mode plugin`
  with a current CLI repairs it.

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
