# THIRD PARTY NOTICES

Last updated: 2026-07-23

This file summarizes third-party components identified during the provenance
audit. The pinned source records, copied license texts, applicable notices, and
integrity records are in `docs/legal/third-party/`. It is a technical compliance
artifact and not legal advice.

## Confirmed Components

## 1) modern-screenshot (vendored artifact)

- Local path:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/04-crosscutting/impeccable/scripts/modern-screenshot.umd.js`
- Upstream repository: `https://github.com/qq15725/modern-screenshot`
- Pinned source: `v4.7.0` / `792d6db7411839c62940a6e930161f8e376e817f`
- License: `MIT` (copyright `2021-present wxm`)
- The MIT text and artifact checksum are recorded in
  `docs/legal/third-party/` and verified by the legal gate.

## 2) caveman-related manifests and skills

- Local paths:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/capabilities/manifests/caveman.md`
  and `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/05-caveman/**`
- Upstream repository: `https://github.com/JuliusBrussee/caveman`
- Pinned source: `0d95a81d35a9f2d123a5e9430d1cfc43d55f1bb0`
- License: `MIT`; the applicable text is
  `docs/legal/third-party/licenses/MIT-caveman.txt`.
- The complete local component is pinned by a SHA-256 path/content inventory.

## 3) impeccable-related subtree

- Local path:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/04-crosscutting/impeccable/**`
- Upstream repository: `https://github.com/pbakaus/impeccable`
- Pinned source: `e587004ee42883dad40d14cd0f5e1b21ae1933df`
- License: `Apache-2.0`; the applicable text and carried-forward NOTICE are in
  `docs/legal/third-party/licenses/Apache-2.0-impeccable.txt` and
  `docs/legal/third-party/notices/impeccable-NOTICE.md`.
- Locally modified files carry an explicit Apache modification notice and the
  complete tree is controlled by a SHA-256 path/content inventory.

## 4) frontend-design is an independent Apache component

- Local path:
  `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/04-crosscutting/frontend-design/SKILL.md`
- Upstream repository: `https://github.com/anthropics/skills`, source path
  `skills/frontend-design`, pinned at
  `d230a6dd6eb1a0dbee9fec55e2f00a96e28dff81`.
- License: `Apache-2.0`; the standard terms are in
  `docs/legal/third-party/licenses/Apache-2.0-impeccable.txt`.
- This is a separate component from `impeccable`. Its local adaptation has its
  own modification notice and integrity inventory.

## 5) product-manager-prompts source evidence

- Confirmed source paths cover only the Product Studio `jobs-to-be-done` and
  `user-story` prompts: `https://github.com/deanpeters/product-manager-prompts`
  at `ddcd8b00deafe9f3a3f770df6b70a76692d8e0f1`.
- That pre-relicense snapshot was MIT; the applicable text is
  `docs/legal/third-party/licenses/MIT-product-manager-prompts.txt`.
- Product Studio content was removed from canonical and installable overlays;
  this record is retained as historical provenance evidence.

## 6) Product Studio historical note

- Product Studio was previously classified as `EXTERNAL_UNVERIFIED`.
- On 2026-07-23, the complete Product Studio tree was removed from both
  canonical and installable overlays.
- As a result, Product Studio is removed from distribution scope and no longer
  blocks public release readiness for the shipped package contents.

## Distribution Rule

If a component lacks an exact or date-bounded upstream snapshot, required notice
carry-forward, or clear corporate authorization, it must remain non-distributable or be
excluded from the public release even when the top-level upstream license is
known. Product Studio was removed from distribution scope under this rule. The legal gate validates the
records above, but does not replace the publication decision in
`docs/legal/OPEN-SOURCE-READINESS.md`.

The internally attested overlay is covered by `docs/legal/overlay-authorship.json`.
That record excludes every third-party coverage root and must be renewed whenever its path/content inventory
changes.
