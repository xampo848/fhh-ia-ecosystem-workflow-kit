# Versioning Policy

The kit is distributed from its public GitHub repository (not npm) and uses
semantic versioning with a descriptive suffix, for example
`0.16.0-safe-update` or `0.17.0-audit-hardening`. The history is in
[CHANGELOG.md](../CHANGELOG.md).

## Two update surfaces

- the globally installed `workflow-kit` binary on a user's machine;
- the managed workflow files already installed inside target repositories.

Every rollout therefore needs two steps:

1. upgrade the toolkit binary (`workflow-kit upgrade --apply --yes`);
2. update each managed repository (`workflow-kit update --target <repo> --apply --yes`).

If step 1 is skipped, `update` can only apply the templates bundled with the
older binary.

## Rollout channels

- **`main`:** `workflow-kit upgrade --apply --yes` installs the latest merged
  version.
- **Pinned tag:** `workflow-kit upgrade --ref <tag> --apply --yes`. Pinned tags
  are the better choice for coordinated team rollouts.

A tag is the version with a `v` prefix and points at the commit on `main` that
released it. Tags of the current lines:

| Tag | Notes |
| --- | --- |
| `v0.23.1-script-guards` | current |
| `v0.23.0-plugin-mode` | |
| `v0.22.0-manifest-updater` | |
| `v0.21.0-project-runbooks` | |
| `v0.20.0-kit-overlay-contract` | |
| `v0.19.2-visual-lock` | |
| `v0.19.1-tui-option-clarity` | |
| `v0.19.0-test-design` | |
| `v0.18.1-orchestrator-reads` | |
| `v0.18.0-equilibrado-profile` | |
| `v0.17.6-bounded-output` | |
| `v0.17.5-slice-checkpoint` | |
| `v0.17.4-usage-measurement` | |
| `v0.17.3-contract-gaps` | |
| `v0.17.2-catalog-rows` | |
| `v0.17.1-stack-detection` | |
| `v0.17.0-audit-hardening` | |
| `v0.16.2-remove-slidev` | |
| `v0.16.1-roadmap-closure` | |
| `v0.16.0-safe-update` | |
| `v0.10.0-implement-change` | |
| `v0.7.40-contextual-model-selection` | last `0.7.x` |

Versions `0.8.0`, `0.9.0` and `0.11.0`–`0.15.0` were merged inside larger pull
requests and have no commit of their own on `main`, so they have no tag; pin
the next tagged version instead. Older `0.7.x` tags are on the
[Releases page](https://github.com/xampo848/fhh-ia-ecosystem-workflow-kit/releases).

## What requires a version bump

`bun run check:release` fails when `.agents/**`, `templates/**`, `src/**`,
`bin/**`, `scripts/**`, or the CI workflow changed without a
`package.json.version` bump.

- Patch: fixes downstream repos should consume, and documentation-only fixes.
- Minor: a new user-visible command or flow (for example `rollback` or a new
  TUI route), or backward-compatible template additions.
- Major (after `1.0.0`): incompatible changes to install-state contracts,
  installed paths, or overwrite semantics. While on `0.x`, such changes are
  allowed but must be called out in the changelog and `docs/migration.md`.

`1.0.0` requires stable CLI commands, documented template contracts, CI, and
the release checklist.

## Release gates

When you raise `package.json.version`, follow these steps in order:

1. Set the same value as `kit_version` in `.agents/workflow-kit/manifest.json`
   and in its template copy
   (`templates/repo-overlay-fhh-ia-ecosystem-full/.agents/workflow-kit/manifest.json`);
   `check:workflow` fails until both match, and the plugin build refuses a
   shipped manifest whose `kit_version` is not the package version; its
   message names each copy that still differs.
2. Renew the overlay authorship record. Step 1 changes the overlay template, so
   `check:legal` fails ("maintainer-attested overlay file inventory changed" or
   "path/content inventory differs") until `remainingInventory` in
   `docs/legal/overlay-authorship.json` is updated. The check then prints the
   values the record expects, computed from the files on disk (untracked files
   under the template count; files Git ignores, such as `.DS_Store`, do not):

   ```text
   [legal-check] Expected remainingInventory in docs/legal/overlay-authorship.json (copy it only after reviewing the template changes): {"fileCount":178,"pathContentSha256":"…"}
   ```

   After reviewing the template changes, copy both values into
   `remainingInventory`, set the top-level `lastVerified` field of the same
   file to the date of the renewal (by hand: `check:legal` does not check that
   date), then run `bun run check:legal`. Renewing the record is a maintainer
   attestation that the changed template files are authorized for publication;
   any other template change between releases needs the same renewal.
3. Run `node scripts/build-plugin.mjs --write`: the plugin marketplace
   (`.claude-plugin/marketplace.json`) carries the package version, so
   `check:workflow` also fails until it is regenerated. The command also
   rebuilds the plugin folder `dist/plugin/`, which is never committed. It
   validates a fresh build before replacing `dist/plugin/`, so a failed build
   leaves the previous folder and the marketplace as they were. It removes the
   folders an interrupted build left in `dist/` (`.plugin-build-*`); one it
   cannot remove is reported with the commands that remove it.

A template change can also break the repo-mode guard of
`test/plugin-mode.test.mjs`, which compares the repo-mode plans with the
fixture `test/fixtures/plugin-mode/repo-mode-plans.json`, generated from the
release named in the header of `test/fixtures/plugin-mode/repo-mode-plans.mjs`.
When the change to the repo-mode plan is intended, commit it with the version
raise, regenerate the fixture from that commit with the command in that
header, update the release it names, and review the fixture's diff before
committing it.

The marketplace committed in `main` points at the branch `plugin`. That branch
does not exist on the remote until the first publish and its approved push, so
the marketplace cannot install the plugin before then.

To publish the plugin `fhh`, merge the release into `main`, fetch, check out a
commit that `origin/main` contains and run
`node scripts/build-plugin.mjs --publish` from the kit repository itself (its
top level, not a copy inside another repository). It builds from the tracked
content of `HEAD`, written into a temporary folder from Git's raw objects, and
with the build code of that content (its own `scripts/build-plugin.mjs`, run
in a separate `node`): files Git ignores and edits hidden with
`git update-index --skip-worktree` or `--assume-unchanged` never reach the
published plugin through its content or its build code. Attributes
(`.git/info/attributes` included), clean and smudge filters and line-ending
settings such as `core.autocrlf` change no byte on either side: the source is
read and the build is stored as they are. Replacement objects
(`refs/replace/*`) are ignored: every git call reads the objects themselves. The publish steps
themselves (export, run that build, commit) are the `--publish` code of the
working tree's `scripts/build-plugin.mjs`, so run it from a checkout whose
copy of that script matches `HEAD`. It runs the legal check of that
content on it, validates the build as check mode does and commits it to the
local branch `plugin` (moving only that branch, never one it points at)
without touching the current branch; `dist/plugin/` is refreshed with the same
build only after that commit, so a refusal leaves it as it was. It never
fetches, never pushes and never changes the Git configuration. Interrupted
with Ctrl-C or `SIGTERM`, it removes its temporary folder and ends with exit
status 130 or 143: before the commit it commits nothing; after it, it names the
commit the branch holds and leaves `dist/plugin/` for `--write`.
It stops, without committing, when:

- the branch `plugin` is a symbolic reference (for example to `main`): a
  commit to it would move the branch it points at;
- the branch `plugin` is checked out in any worktree of the repository;
- Git has no `user.name` or `user.email` for the repository: publishing reads
  them with `git config` and ignores the inherited `GIT_*` variables
  (`GIT_AUTHOR_*` and `GIT_CONFIG_GLOBAL` included); it always prints the
  identity it commits with;
- a file the build reads has uncommitted changes (staged, unstaged or
  untracked); the message names them;
- `origin/main` is not present locally (fetch it first), or it does not
  contain `HEAD`: only a commit already on `main` is published;
- the legal check (`node scripts/validate-legal-readiness.mjs`) fails on the
  source commit; the message quotes its failures (after a version raise, step 2
  above);
- the build does not validate, or the marketplace is out of sync;
- the local branch `plugin` does not contain `origin/plugin` (it is behind or
  diverged): bring it up to date first;
- the local branch `plugin` holds a commit `--publish` did not write (its
  message does not start with `Publish plugin fhh `), so its history would be
  pushed with the plugin, or its history cannot be read;
- the source commit has two paths this file system cannot tell apart, or a
  link that would carry a write outside the temporary folder;
- the build holds a path outside printable ASCII, which git could store under
  another name;
- the content changed but the version is the one already published on the
  branch `plugin`. People who installed the plugin see a kit change only when
  the published version changes, because Claude Code pins a plugin to its
  `version`: raise the version first. `--same-version` publishes anyway.

A clone without a local branch `plugin` publishes on top of `origin/plugin`,
so the commit stays a fast-forward of the remote. That remote-tracking branch
must be present locally: whoever publishes fetches it first. The commit
message names the version and the source commit
(`Publish plugin fhh <version> from <commit>`). Then push the branch with
explicit approval: `git push origin plugin`.

Every version must pass (CI runs the same set; there `check:templates` runs
inside `check:workflow`):

```bash
bun run check:security
bun run test
bun run check
bun run check:workflow
bun run check:templates
bun run check:docs
bun run check:legal
bun run check:release
```

Publishing a tag or release remains approval-gated even when all checks pass;
see [RELEASE.md](../RELEASE.md).
