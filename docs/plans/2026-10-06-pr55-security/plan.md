# PR 55 dependency security remediation

Status: local remediation validated and QA approved, 2026-10-06; remote CI required before merge.

## Scope and authorization

The user selected option A: repair dependencies before merging PR 55. The PR is
draft; feature commit c2662d7 is already pushed. No risk waiver was granted.
Do not merge or mark production-ready until remediation, validation and CI pass.

On the resumed turn, the user explicitly authorized genuine patches/replacements
with regression tests and documented audit exceptions for the two packages with
no safe published release. This supersedes the blanket requirement that raw
version-based `bun audit` must be empty: any exception must be tied to the exact
advisory, version, patch and installed-code evidence. No unpatched risk was accepted.
All other advisories and invalid/missing audit output still block. User also
authorized push, merge after readiness, and clean local state without lost changes.
No selector changes, unrelated application changes, credentials, protection bypass,
or publication. Use Bun exclusively for package management.

## Baseline and controlling path

GitHub reports 13 development alerts from package-lock.json, including four high
alerts: source-map-js DoS, Vue server-renderer XSS and js-yaml 3/4 DoS. The frozen
Bun tree is also vulnerable, including additional advisory families. These are
not introduced by the model-routing changes, but the user authorized remediation.
CI already installs with bun install --frozen-lockfile. Both lockfiles are tracked.
The current sprintf-js chain is argparse 1 -> js-yaml 3 -> gray-matter 4 -> the
Slidev markdown tooling. Its advisory declares no patched version; do not invent
one or suppress the alert. Existing root overrides are the local remediation
pattern. Prefer compatible updates of parent packages over speculative overrides
or vendor forks. Any necessary patch must be narrowly justified and build-tested.

## Acceptance criteria

- SEC-01: frozen Bun installation and the security gate pass with no uncorrected
  reported vulnerability. Include all advisories in the effective tree, not just
  the stale GitHub inventory. For braces/sprintf-js only, genuine local patches
  must fix the reported DoS, pass bounded attack and compatibility tests, and
  have exact version/advisory/patch/installed-code checks before a visible exception
  can be accepted. No generic dismissal, hidden ignore list or invented version.
- SEC-02: package constraints, overrides and tracked lockfile authority agree.
  Bun is canonical because it is the established package manager and CI installer.
  If removing the stale npm lockfile, preserve npm consumers of the published
  package and explain the single-authority decision; do not merely hide alerts.
- SEC-03: frozen install, all tests and existing workflow/docs/release/legal gates
  pass. Build Slidev because the updates affect markdown/YAML/Vue/math rendering.
  No unnecessary major override or functional regression is acceptable.
- SEC-04: CI enforces the verified dependency audit gate alongside existing gates. Independent QA
  verifies remediation evidence and compatibility. Only then mark PR ready, wait
  for actual CI/review requirements, and merge the expected head without bypass.

## Preflight and ownership

Mode: controlled-implementation, specialized owner plus independent QA. Readiness
GO: authorization is explicit and affected files/gates are known. Discovery is
bounded to package metadata, both lockfiles, CI and the vulnerable dependency
chains. Matcher uses existing root overrides and Bun resolution; no domain pattern
skill applies. One writer owns package.json, bun.lock, package-lock.json disposition,
CI audit step and any indispensable package patch. Parent owns this plan, temporary
coordination, final gates, independent QA and PR operations. Do not touch model
selection code or templates. No new runtime dependency unless genuinely required.

The resumed writer also owns the narrowly required audit verifier, focused security
tests and patch provenance documentation. Build repairs must preserve Slidev
behavior rather than bypass minification or hide invalid CSS. Extend the existing
test file when suitable; a dedicated security test file is permitted when no
existing file owns this behavior. No model-routing changes are authorized here.

## Required checks

First focused validation after dependency edit: install/resolution and bun audit.
Then bun install --frozen-lockfile; bun run test; bun run slides:build;
bun run check; bun run check:workflow; bun run check:docs; bun run check:release;
bun run check:legal; git diff --check. Actual GitHub CI and branch/review requirements
must pass for the last pushed SHA before merge.

## 10. Implementation evidence

Local remediation completed on 2026-10-06 after explicit authorization for real
patches and verified audit exceptions. The original feature commit is
`c2662d7a1e1e38451cb27e63e9c42e6399e117e5`, PR 55. The user authorized push,
merge after readiness, and clean local state. Implementation continued inline
with the same required skill after an expired-token delegation failure, with
explicit user approval. Independent QA subsequently ran successfully.

### Delivered Changes

- Updated actual Bun dependency resolutions to safe published releases where
  available, including source-map-js 1.2.2, Vue 3.5.43, js-yaml 3.15.2/4.3.2,
  DOMPurify 3.4.16+, markdown-it 14.3.2/15.0.2, KaTeX 0.18.11,
  selector-parser 7.1.6, Hono 4.13.13, browserslist 4.29.3, nanoid 3.3.20,
  baseline-browser-mapping 2.11.27 and image-size 2.0.4.
- Reproducible Bun patches correct braces nesting and sprintf numeric precision
  without fake versions. A third patch preserves equivalent Slidev CSS and fixes
  the production build without disabling minification.
- A fail-closed security gate validates patch registrations, patch hashes, every
  discovered installed copy and affected-file hashes before accepting only the
  two exact authorized advisory identities/severities. Unknown advisories, missing
  patches, changed code, malformed reports and audit failures block.
- Removed the stale npm lockfile after correcting the actual Bun tree. Bun is the
  sole development lockfile, matching frozen CI. Original npm CLI consumers remain
  supported; patch artifacts are included in the package file list.
- CI runs the verified security gate, tests and Slidev build, plus all existing
  gates. Patch provenance, limits and retirement criteria are documented in
  docs/security/dependency-patches.md and dependency-patches.json.

### Acceptance Evidence

| Criterion | Local result | Executed evidence |
| --- | --- | --- |
| SEC-01 | COMPLETE | Patched attack regressions, exact integrity verification, negative audit fixtures and real check:security PASS. Raw version-based warnings remain explicitly visible. |
| SEC-02 | COMPLETE | Frozen install, genuine npm lock deletion, isolated clean Bun install and patch verification. |
| SEC-03 | COMPLETE | 202/202 tests, production Slidev build, all existing gates and clean diagnostics. |
| SEC-04 | COMPLETE locally | Mandatory CI gate/build, independent adversarial QA and targeted reentry approved. Remote CI/review requirements on the last pushed SHA remain mandatory before merge. |

Final executed commands: bun install --frozen-lockfile; bun run check:security;
bun run test (202 passed, none failed/skipped); bun run slides:build;
bun run check; bun run check:workflow; bun run check:docs; bun run check:release;
bun run check:legal; git diff --check. Five focused security tests cover ordinary
formatting/globs, bounded attack probes, nested vulnerable copies, absent/tampered
patches, wrong versions/metadata, unexpected advisories and malformed reports.
An isolated temporary installation using only the versioned package manifest,
lockfile, patches and gate inputs also passed frozen install, security gate and
attack probes; it was removed afterwards. Build output is generated and ignored.

### Finding Ledger Summary

| ID | Severity | Final state | Resolution |
| --- | --- | --- | --- |
| SEC-F01 | High | Repaired | Deep brace/parenthesis parsing is bounded before recursive walkers; extreme patterns become literal. Genuine patch is hash-verified for all installed copies. |
| SEC-F02 | Medium | Repaired | Numeric precision is clamped to ECMAScript bounds; ordinary/zero precision and argparse formatting remain compatible. |
| SEC-F03 | Medium | Repaired | Equivalent explicit CSS replaces the two broken UnoCSS directives; production build passes. |
| SEC-F04 | Low | Repaired | Obsolete npm lockfile is removed and frozen Bun installation is authoritative. |
| QA-F01 | High | Repaired | Missing parent metadata no longer skips nested dependencies. A negative fixture proves the gate rejects an unpatched copy below a metadata-less parent. |

Independent QA initially found QA-F01 and correctly blocked closure. After the
focused repair, the reviewer independently reran all five security tests and the
real gate, confirmed hashes, found no new issues, and returned
`ready_to_close: yes`, `blocking_findings_open: no`.

Reviewed content SHA-256:

```text
scripts/validate-dependency-security.mjs 7fa9e507de36253fb9e494b788fc38a616d14c9701dc7218397e510346bef7eb
test/dependency-security.test.mjs 0bc45b44f2acf388b1128b2b8a19221a64c11d78f8a9b0c3c7c5f28f3dba2e6d
```

Patch and installed-file hashes are recorded separately in the security manifest.
The raw audit still reports the two upstream version-based advisories: this is
not represented as an empty audit or generic risk acceptance. Exceptions apply
only to verified local corrections authorized by the user. No other advisory is
allowed. Original package identities/licenses are preserved. Patches intentionally
change pathological behavior and require review/retirement when upstream fixes
arrive. No deployment, advisory dismissal or protection bypass is authorized.

### Integration Gate

Remote CI success and repository review/merge requirements must be checked for
the final pushed SHA, not the earlier feature-only commit. PR 55 records that
integration result. Only after those checks may squash merge and branch cleanup
occur. Temporary coordination is removed after this receipt is validated.