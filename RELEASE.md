# Release Checklist

The repository is public and installable from GitHub; the package is not
published to npm. Releases are git tags on the public repository.

Do not push tags, upload GitHub releases, or publish packages without explicit maintainer approval.

## Pre-release validation

Run locally (CI runs the same set on every pull request):

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

## Required approvals

Before any release action, confirm all of these explicitly:

- [ ] Maintainer explicitly approves creating and pushing the release tag.
- [ ] Maintainer explicitly approves package publication, if any.
- [ ] License and legal records are current (`bun run check:legal` passes).
- [ ] Release notes (`CHANGELOG.md`) and version are approved.

## Never run without approval

- `gh repo create`
- `git push` of release tags or to a new repository
- `npm publish`
- GitHub release upload commands
- Commands that require publishing credentials or secrets

## Release sequence after approval

1. Confirm the working tree is clean and CI passes on `main`.
2. Confirm `package.json.version` was bumped for any change to `.agents/**`,
   `templates/**`, `src/**`, `bin/**`, `scripts/**`, or CI (`check:release`
   enforces it).
3. Confirm the `CHANGELOG.md` entry for that version.
   When the kit text of an adapter changed (the generated level pre-filter,
   or the block of `CLAUDE.md`, `AGENTS.md` and the others), run
   `node scripts/sync-adapter-kit-texts.mjs --record` once before raising the
   version: it keeps the text it replaces in `src/adapter-kit-texts.json`, so
   an install made before the block markers still gets `split`.
   `check:workflow` fails until it is recorded. Never delete an entry of
   `previous`.
4. Create the tag `v<version>` (for example `v0.17.0-audit-hardening`) and push
   it only after explicit approval. A version released without a tag is still
   valid: it is pinned by commit (see `docs/versioning.md`).
5. When a tag is created, move that version from the "without a tag" table (if
   it is there) to the tag table of `docs/versioning.md` and update the pinning
   examples of `README.md`, `docs/github-install.md` and `docs/quickstart.md`.
   Until the tag exists, add the version and its commit to the "without a tag"
   table after the merge. Today every version from `0.16.0` to `0.24.1` has a
   tag; the latest is `v0.24.1-pilot-alignment`.
6. Publish a package only after explicit approval and a final dry-run.

## Safe rollout sequence for users

1. Upgrade the global toolkit binary first, from `main` (the supported channel
   today):

   ```bash
   workflow-kit upgrade --apply --yes
   ```

2. Or pin to a reviewed ref: a tag, or the full commit hash of a version that
   has no tag yet (the remote has a tag for every version from `0.16.0` to
   `0.24.1`; see `docs/versioning.md`):

   ```bash
   workflow-kit upgrade --ref <tag-or-commit> --apply --yes
   ```

3. Then update each managed repository:

   ```bash
   workflow-kit update --target /path/to/repo --apply --yes
   ```

4. If a repository predates install-state tracking, bootstrap once with
   `--adopt-existing` and continue with normal updates after that.
5. If an update goes wrong, `workflow-kit rollback --target /path/to/repo`
   undoes the last applied run (preview first, then `--apply --yes`).
