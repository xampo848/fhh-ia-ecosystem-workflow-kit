# Third-Party Source Records

This directory carries the license and notice material required to redistribute
the third-party-derived material included in the full overlay.

`provenance.json` is the machine-readable source of truth. It records each
upstream repository, pinned commit or release, local path, and the verification
method used on 2026-07-23. Schema v2 includes deterministic SHA-256 path/content
inventories for each third-party root. The validation gate in
`scripts/validate-legal-readiness.mjs` rejects added, removed, renamed, or
modified files unless the provenance record is deliberately renewed.

Components can be `VERIFIED` or `EXTERNAL_UNVERIFIED`. An unverified component
may be frozen by an integrity inventory for auditability, but it remains a
public-release blocker until its source and license evidence are complete.

The license and notice files here are copied from the upstream snapshots named
in `provenance.json`. They do not change the repository's top-level MIT license.
They preserve the terms and attribution required for the relevant derived or
vendored material.

This is a technical compliance record, not legal advice.