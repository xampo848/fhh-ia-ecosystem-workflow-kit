# Verified Local Dependency Corrections

These corrections were explicitly authorized on 2026-10-06 for PR 55 because
the affected upstream packages have no safe published release. They are not
acceptance of unpatched risk, fake package versions or a general audit ignore list.
Original package names, versions and licenses are retained. Only Bun-generated
diffs are stored under patches/. Installation is reproducible from bun.lock.

## Corrections and Compatibility

| Package | Purpose | Verified change |
| --- | --- | --- |
| braces 3.0.3 | GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 | Limit parser nesting before recursive walkers. A pattern reaching 64 stack levels is treated as literal text; ordinary glob expansion and ranges remain unchanged. |
| sprintf-js 1.0.3 | GHSA-hp3w-g68c-fv3c / CVE-2026-97058 | Clamp numeric precision to ECMAScript bounds (0-100 for f/e, 1-100 for g), preserving ordinary and zero precision instead of throwing an uncaught RangeError. |
| @slidev/client 52.20.1 | Build compatibility, no advisory exception | Replace two UnoCSS directives with equivalent CSS for line numbers and inline code. Preserve padding, font weight and light/dark colors; production CSS minification remains enabled. |

The braces correction intentionally changes pathological deep-pattern behavior;
it is not a promise that every arbitrary caller-supplied AST is safe. The sprintf
correction addresses the reported numeric-precision flaw, not every possible
resource-exhaustion concern in a formatting library. Do not expose arbitrary
format strings or patterns to untrusted input without application-level bounds.

Before correction, a nested 8,003-character brace pattern produced
`RangeError: Maximum call stack size exceeded`; `%.1000000000f` produced a numeric
precision RangeError. After correction, the nested pattern remains literal and
numeric precision remains bounded. The focused tests exercise f/e/g, ordinary
formatting, zero precision, ranges, compilation, expansion and stringification.
Attack probes have explicit subprocess time and output limits.

## Fail-Closed Gate

Run `bun run check:security`. It verifies:

- Exact package/version patch registrations and patch-file SHA-256 values.
- Hashes of affected installed files for every discovered instance, including
  nested node_modules and Bun virtual stores.
- A valid report and supported exit status from `bun audit --json`.
- Only the two exact advisory URLs and severities listed in
  dependency-patches.json, and only after installed corrections are verified.

The raw version-based audit still reports those advisories; the gate shows them
as locally corrected rather than claiming the raw report is clean. A new advisory,
changed severity, missing patch, unexpected package version, changed affected
file, malformed report or audit failure blocks CI. Tests and the Slidev production
build run separately in CI. Upstream package and advisory metadata can evolve;
re-review the correction rather than expanding an exception blindly.

## Lockfile and Distribution

Bun is the sole development lockfile authority, matching the established
`bun install --frozen-lockfile` CI workflow. The obsolete npm lockfile is removed
only after the effective Bun tree is corrected. npm users of the packaged CLI
remain supported by its package manifest; these patches affect development
dependencies and do not add a runtime dependency. The patch directory is included
in the package file list so root Bun installs can reproduce the registered diffs.

## Maintenance

When an upstream release fixes a flaw, update the parent dependency, remove its
local patch and advisory exception together, regenerate bun.lock and rerun clean
installation, security tests, audit gate and build. All provenance, versions,
advisory identities and hashes live in dependency-patches.json. Do not regenerate
hashes merely to bless an unexplained source change.