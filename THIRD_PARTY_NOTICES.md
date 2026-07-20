# THIRD PARTY NOTICES

Last updated: 2026-07-20

This file records third-party components and sources identified during provenance audit.
It is a technical compliance artifact and not legal advice.

## Confirmed Third-Party Components

## 1) modern-screenshot (vendored artifact)

- Local path:
  - `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/04-crosscutting/impeccable/scripts/modern-screenshot.umd.js`
- Upstream package: `modern-screenshot`
- Upstream repository: `https://github.com/qq15725/modern-screenshot`
- Evidence: `npm view modern-screenshot license repository.url version dist-tags.latest --json`
- Reported license: `MIT`
- Action taken:
  - Kept component with explicit notice entry.
  - Requires preserving upstream MIT terms when redistributed.

## Components With Pending License Confirmation (Not Cleared)

These are not approved for public redistribution until source license and obligations are confirmed.

## 2) product-studio adapted prompts

- Local paths include:
  - `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/01-product/product-studio/jobs-to-be-done/SKILL.md`
  - `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/01-product/product-studio/jobs-to-be-done/template.md`
  - `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/01-product/product-studio/user-story/SKILL.md`
  - `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/01-product/product-studio/user-story/template.md`
- Declared source in files: `https://github.com/deanpeters/product-manager-prompts`
- License status in this audit: `UNCONFIRMED`
- Action required:
  - Confirm upstream license for exact source content/version.
  - Preserve required attribution/license or rewrite clean-room.

## 3) caveman-related manifests/skills

- Local paths include:
  - `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/capabilities/manifests/caveman.md`
  - `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/05-caveman/**`
- Declared source in files: `https://github.com/JuliusBrussee/caveman`
- License status in this audit: `UNCONFIRMED`
- Action required:
  - Confirm upstream license and redistribution terms.
  - Keep external attribution and include any required notices.

## 4) impeccable-related subtree

- Local paths include:
  - `templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/04-crosscutting/impeccable/**`
- Source indicator in code:
  - `cleanup-deprecated.mjs` references `pbakaus/impeccable` as authoritative source marker.
- License status in this audit: `UNCONFIRMED`
- Action required:
  - Confirm upstream repository, license, and scope of derivation.
  - Do not publish this subtree until verified.

## Distribution Rule

If a component is listed as `UNCONFIRMED`, it must remain private or be removed/rewritten before public release.
