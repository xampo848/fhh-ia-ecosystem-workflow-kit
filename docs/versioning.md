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
  version. This is the supported channel for every version after `0.17.3`.
- **Pinned ref:** `workflow-kit upgrade --ref <ref> --apply --yes`. `<ref>` is a
  tag, a branch or a commit of the toolkit repository. Pinning is the better
  choice for coordinated team rollouts; use a tag when the version has one and
  the full 40-character commit hash when it does not.

A tag is the version with a `v` prefix and points at the commit on `main` that
released it. **Tags are created only when the maintainer approves them**
([RELEASE.md](../RELEASE.md)), and the remote has none after `0.17.3`. A pin
such as `--ref v0.23.0-plugin-mode` fails today because that tag does not
exist; use the commit in the second table instead.

### Versions that have a tag

| Tag | Notes |
| --- | --- |
| `v0.17.3-contract-gaps` | latest tag |
| `v0.17.2-catalog-rows` | |
| `v0.17.1-stack-detection` | |
| `v0.17.0-audit-hardening` | |
| `v0.16.2-remove-slidev` | |
| `v0.16.1-roadmap-closure` | |
| `v0.16.0-safe-update` | |
| `v0.10.0-implement-change` | |
| `v0.7.40-contextual-model-selection` | last `0.7.x` |
| `v0.7.33-create-prd-cost-efficiency` | |
| `v0.7.26-runtime-native-agents` | |
| `v0.7.19-tui-selective-apply` | |
| `v0.7.4-public-install-export` | |

Versions `0.8.0`, `0.9.0` and `0.11.0`–`0.15.0` were merged inside larger pull
requests and have no commit of their own on `main`, so they have no tag; pin
the next tagged version instead.

### Versions without a tag yet

These versions are merged on `main`; each commit is the squash merge that
released it. Pin one with its full hash, for example
`workflow-kit upgrade --ref 558e9fb96792ae962bac1e3886c83dc0f3923cb8 --apply --yes`
or `bun add -g github:xampo848/fhh-ia-ecosystem-workflow-kit#<hash>`.
`upgrade` checks the ref before it removes the installed version: a branch or tag by name, and a full
40-character commit hash by fetching that commit. A short commit hash is
accepted only when it is the tip of a branch or tag, so use the full hash.

| Version | Commit on `main` |
| --- | --- |
| `0.23.6-ac-guards` | the squash merge of this release; its hash is added after the merge |
| `0.23.5-cli-fixes` | `4fe9ac788a0057b9b15f539abf135596ca9af865` |
| `0.23.4-docs-sync` | `718aa4eb181b63b9049c064215e1553865f7a472` |
| `0.23.3-strict-cli` | `96ec070136314053080535e3c40ce73c874268d7` |
| `0.23.2-apply-recovery` | `0699ed2ec7e45ad0937a2f315b31aabc2938951d` |
| `0.23.1-script-guards` | `f0bfc61123e866d9b258212f3224f4a8a6bff229` |
| `0.23.0-plugin-mode` | `9d3b917dfda54b7494d3d2a18dd1eb479e4bdb6d` |
| `0.22.0-manifest-updater` | `558e9fb96792ae962bac1e3886c83dc0f3923cb8` |
| `0.21.0-project-runbooks` | `45e37975a133e1cfc76b93a0e0047e4536ccf2dc` |
| `0.20.0-kit-overlay-contract` | `7a1f91c5fc65b7406b0161c284bf7c01b4f722ab` |
| `0.19.2-visual-lock` | `3e233f4ea641f5101d820ad02abc43a1f6bfd5be` |
| `0.19.1-tui-option-clarity` | `737bd36000dd71d008636481acbd3e75dfb22c46` |
| `0.19.0-test-design` | `9901069873bb910141139b7c4504ca6b4de2f78a` |
| `0.18.1-orchestrator-reads` | `f5ddeb070c846d0c599b2443dcbe4c1e0da45460` |
| `0.18.0-equilibrado-profile` | `ad1d9b882826f88347a6d03d31c17b754e56719e` |
| `0.17.6-bounded-output` | `e4a660db57a85b939483caa31604f9cc5df2ed56` |
| `0.17.5-slice-checkpoint` | `1c766cd4b6a7693ad133ff5611146118b216717f` |
| `0.17.4-usage-measurement` | `fd1d055c7c58991d29b20bc1b156c0b2c9dbc2ef` |

When the maintainer creates tags for these versions, they take the names in the
first column with a `v` prefix, and the release steps in
[RELEASE.md](../RELEASE.md) update this page.

## What requires a version bump

`bun run check:release` fails when `.agents/**`, `templates/**`, `src/**`,
`bin/**`, `scripts/**`, or the CI workflow changed without a
`package.json.version` bump.

The gate compares your branch with a base: it finds the merge base of `HEAD`
and `RELEASE_BASE_REF`, lists the files changed since then (committed, staged,
unstaged and untracked; a file moved out of those paths counts), and reads
`package.json` at that merge base. It fails when one of those paths changed and
the `X.Y.Z` part of the version does not rise above the base's: a lower
`X.Y.Z` fails, and so does the same `X.Y.Z` with a different suffix, because
changing only the suffix is not a bump.

- `RELEASE_BASE_REF` chooses the base. Locally it defaults to `origin/main`
  when that ref exists (what CI compares with), and to `main` otherwise, so a
  stale local `main` cannot pass a change that CI rejects; set it to another
  ref when you branch from something else, for example
  `RELEASE_BASE_REF=origin/release bun run check:release`. CI sets it to
  `origin/<target branch>` on a pull request, and to the previous tip of `main`
  on a push (`.github/workflows/ci.yml`).
- Where the base cannot be resolved (not a git repository, no merge base, an
  unreadable `package.json`), the check is skipped with a notice when you run
  it locally. In CI (`CI` set) the same situation fails the check, which is why
  CI checks out the full history (`fetch-depth: 0`).
- It is skipped with a notice when the base is the null commit of a first push
  of a branch.

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
   file to the date of the renewal, then run `bun run check:legal`. Only the
   two `remainingInventory` values are enforced: `check:legal` passes with an
   old `lastVerified`, so that date is a convention kept by hand, not a gate.
   Renewing the record is a maintainer attestation that the changed template
   files are authorized for publication; any other template change between
   releases needs the same renewal.
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
- `origin/main` is not present locally (run `git fetch origin +refs/heads/main:refs/remotes/origin/main` first), or it
  does not contain `HEAD`: only a commit already on `main` is published;
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
must be present locally: whoever publishes fetches it first with
`git fetch origin +refs/heads/plugin:refs/remotes/origin/plugin` (a plain
`git fetch origin` misses it in a single-branch clone). The commit
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
see [RELEASE.md](../RELEASE.md). A version can be released on `main` without a
tag (see "Rollout channels").
