# Release Checklist

This project is not published yet. Do not create repositories, push branches, upload releases, or publish packages without explicit maintainer approval.

## Pre-release validation

Run locally:

```bash
npm test
npm run check
npm run check:templates
npm run check:release
```

## Required approvals

Before any release action, confirm all of these explicitly:

- [ ] Repository owner/name is final.
- [ ] License and package name are approved.
- [ ] Maintainer explicitly approves creating or pushing a GitHub repository.
- [ ] Maintainer explicitly approves package publication, if any.
- [ ] Release notes and version are approved.

## Non-goals before approval

Do not run:

- `gh repo create`
- `git push` to a new public repository
- `npm publish`
- GitHub release upload commands
- Commands that require publishing credentials or secrets

## Draft release sequence after approval

1. Confirm working tree is clean and CI passes.
2. If merged changes affect the portable core, template packs, runtime adapters, planner/update logic, doctor semantics, or TUI update surface, bump `package.json.version` before distributing the new toolkit.
3. Set final semver version or approved private prerelease-like version.
4. Create release notes from merged PRDs and changelog.
5. Create/push repo only after explicit approval.
6. Publish package only after explicit approval and final dry-run.

## Safe rollout sequence for users

1. Upgrade the global toolkit binary first:

```bash
workflow-kit upgrade --ref main --apply --yes
```

2. Or pin to a reviewed tag:

```bash
workflow-kit upgrade --ref vX.Y.Z --apply --yes
```

3. Then update each managed repository:

```bash
workflow-kit update --target /path/to/repo --apply --yes
```

4. If a repository predates install-state tracking, bootstrap once with `--adopt-existing` and continue with normal updates after that.
