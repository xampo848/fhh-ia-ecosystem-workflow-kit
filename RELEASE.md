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
2. Set final semver version.
3. Create release notes from merged PRDs and changelog.
4. Create/push repo only after explicit approval.
5. Publish package only after explicit approval and final dry-run.
