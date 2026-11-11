# Verified Local Dependency Corrections

**Current state (2026-11-10): no local correction is registered.** The package
has one runtime dependency (`@inquirer/prompts`) and one development dependency
(`yaml`), no `overrides` and no `patchedDependencies`. `bun audit` reports no
advisory.

A local correction is a Bun-generated patch for a dependency whose upstream has
no safe published release. It is not acceptance of unpatched risk, a fake
package version or a general audit ignore list. Each one needs the maintainer's
explicit authorization and an entry in `dependency-patches.json`.

## Fail-Closed Gate

Run `bun run check:security`. It verifies:

- Every patch registered in `package.json` (`patchedDependencies`) has an entry
  in `dependency-patches.json`, and every entry has its registration and the
  SHA-256 of its patch file.
- Hashes of affected installed files for every discovered instance, including
  nested node_modules and Bun virtual stores.
- A valid report and supported exit status from `bun audit --json`.
- Only the exact advisory URLs and severities listed in
  `dependency-patches.json`, and only after installed corrections are verified.

With an empty inventory the gate accepts a clean audit only: any advisory
blocks CI. A new advisory, changed severity, missing or undocumented patch,
unexpected package version, changed affected file, malformed report or audit
failure also blocks CI.

## Lockfile and Distribution

Bun is the sole development lockfile authority, matching the
`bun install --frozen-lockfile` CI workflow. npm users of the packaged CLI
remain supported by its package manifest.

## Adding a Correction

Prefer updating or removing the parent dependency. If a correction is still
needed:

1. Get the maintainer's explicit authorization for that package and advisory.
2. Generate the patch with Bun and store only that diff under `patches/`; add
   `patches/` back to the package file list so root installs reproduce it.
3. Record the package, version, patch hash, affected file hashes, advisory and
   reason in `dependency-patches.json`.
4. Add focused tests that prove the corrected behavior and that ordinary
   behavior is preserved.

When an upstream release fixes the flaw, update the parent dependency and
remove the patch and its advisory exception together, regenerate `bun.lock`,
and rerun a clean installation, the security tests and the audit gate. Do not
regenerate hashes merely to bless an unexplained source change.

## History

- **2026-10-06 (PR 55):** three corrections were authorized: `braces` 3.0.3
  (GHSA-vfj7-8cjw-p6xm), `sprintf-js` 1.0.3 (GHSA-hp3w-g68c-fv3c) and a build
  compatibility patch for `@slidev/client` 52.20.1. All three packages were
  development dependencies pulled in only by the Slidev presentation tooling.
- **2026-11-10:** the Slidev presentation and its tooling were removed from the
  repository. `braces`, `sprintf-js` and `@slidev/client` left the dependency
  tree, so the three patches and the seven version overrides that existed for
  that tree (`@hono/node-server`, `dompurify`, `hono`, `image-size`, `katex`,
  `postcss`, `zod`) were removed with them.
