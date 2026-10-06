# U-02: Reliable Copilot delegate tier routing

Status: implemented and independently reviewed on 2026-10-06.

## Scope

Implement the user-approved six-phase plan: exact identities, runtime-compatible
model selection, generated native fallback lists, explicit invocation with bounded
repair, correlated execution evidence, and focused rollout validation.
No UI, dependency installation, organization policy changes, or changes to Claude
and Codex model selection are authorized.

## Diagnostic baseline

VS Code 1.140.0 and Copilot Chat 0.68.0 executed the unoverridden Copilot alias and
Claude slug with gpt-6.1-sol. Explicit qualified selections executed
gemini-3.8-flash, claude-sonnet-5.5, and mai-code-1.1-flash. The manufacturer-prefixed
MAI name was rejected. A live error offered models absent from the initial snapshot.
Configuration tests alone did not expose these failures.

## Acceptance criteria

- AC-01: resolve exact Copilot identities and qualified model identifiers from
  observed availability; unknown or ambiguous values must not be invented.
- AC-02: choose an ordered candidate in the task's tier, including an explicit
  Grande escalation. No silent tier downgrade or unconfirmed pinned-model fallback.
- AC-03: generate native Copilot model arrays and explicit identity guidance;
  preserve other runtimes and template parity.
- AC-04: orchestrators pass both agentName and model explicitly. One repair is
  allowed only for a pre-execution model/identity rejection, never after work may
  have started. Availability and billing constraints remain runtime-owned.
- AC-05: distinguish selected from executed models. A reproducible evidence check
  correlates exact requests to successful runtime model records; missing evidence,
  conflicting models, and wrong models cannot pass.
- AC-06: focused tests, workflow/template checks, documentation checks, independent
  QA, and live read-only probes pass; unavailable tiers remain explicitly blocked.

## Slices and ownership

1. Routing: one specialized writer owns catalog, resolver, generator, focused
   tests, generated adapters, and their corresponding template copies. These
   files are atomic because candidate names are shared by resolver and generator.
   Validate the resolver before expanding to adapter generation.
2. Invocation and evidence: same writer owns the Copilot invocation protocol,
   neutral routing policy, corresponding overlay copies, runtime evidence helper
   and tests, and an operational smoke guide. Validate each adjacent edit.
3. QA and rollout: orchestrator runs real probes and a fresh reviewer checks the
   diff, evidence, empty/error/boundary cases, and multi-runtime regression risks.

## Required checks

- bun run test -- --test-name-pattern='Copilot|delegate' test/template-packs.test.mjs
- bun run check:workflow
- bun run check:docs
- bun run test -- test/template-packs.test.mjs test/workflow-contract.test.mjs test/turn-routing-contract.test.mjs
- Live runSubagent read-only smoke with explicit exact agent and qualified model;
  correlate runtime request IDs, not delegate self-reported identity.

## Decisions and limits

The AI chooses task risk and tier; a deterministic resolver validates observed
identifiers. A Node script cannot invoke VS Code's runSubagent by itself. Integration
must therefore wire the executable orchestration instructions to the tool that
this runtime actually exposes. Catalog snapshots are not live discovery APIs.
Technical tiers do not imply billing levels. Native fallback lists do not prove
execution, and unavailable Grande or cost escalation must be reported honestly.

## 10. Implementation evidence

Version: `0.7.39-copilot-tier-routing`. Run: `u02-20261006`.
Base commit: `090f5499a48cdae1e5c1c0556cae8b17a61c35c1`.
At the implementation handoff, the work was uncommitted; no branch or
commit had been created. Specialized implementation and independent QA used explicit
Copilot identities. Routing and invocation locks were `u02-routing` and
`u02-invocation`; their temporary coordination files are retired after this receipt.

### Delivered changes

- Exact aliases come from the delegate catalog; explicit qualified model names
  replace manufacturer-prefixed guesses. Selection consumes observed availability.
- Task tiers support Grande escalation without a permanent Grande role, silent
  downgrade, or fallback from a pinned model without explicit boolean consent.
- Generated Copilot frontmatter contains ordered native model arrays. Claude
  inheritance and Codex behavior are unchanged.
- The parent invocation protocol passes both `agentName` and `model`, permits
  one correction only for a clear pre-execution rejection, and prohibits replay
  after execution may have begun. Children cannot change their running model.
- Selection reports `selectedModel`; actual execution remains unknown until
  correlated runtime evidence verifies it. The verifier has separate success,
  missing-evidence, usage-error, and mismatch exits.
- Generated neutral-overlay helpers work in a consumer installation without the
  source checkout, including symlink invocation. Catalog/log IO errors, malformed
  input, and malformed catalog JSON produce controlled CLI errors.
- The operational guide explains checkout/installed commands, evidence handling,
  provider confirmation, request attribution, model aliases, and log rotation.

### Acceptance evidence

| Criterion | Result | Evidence |
| --- | --- | --- |
| AC-01 | COMPLETE | Resolver tests cover exact identities, qualified/bare confirmed-Copilot names, unknown values, near misses, ambiguity, and malformed inputs. |
| AC-02 | COMPLETE | Tier override, ordered priorities, unavailable-tier blocks, no downgrade, and strict pinned-fallback consent tests. |
| AC-03 | COMPLETE | Generated-array and multi-runtime preservation tests; 86 artifacts synchronized and six template packs valid. |
| AC-04 | COMPLETE | Mirrored invocation-protocol contract test plus live explicit alias/model probes below. Diagnosis also observed a rejected manufacturer-prefixed name followed by a successful qualified correction. |
| AC-05 | COMPLETE | Verifier tests for missing, failed, conflicting, wrong-model, duplicate, interval, and concurrent-request evidence; seven real requests verified and preserved. |
| AC-06 | COMPLETE | Final 183/183 tests, required gates, editor diagnostics, consumer-install QA, and targeted independent reentries passed. |

Final checks after the last code repair: `bun run test` (183 passed, zero skipped
or failed), `bun run check`, `bun run check:workflow`, `bun run check:docs`,
`bun run check:release`, `bun run check:legal`, and `git diff --check` all passed.
Focused Copilot tests ran after each affected repair. Editor diagnostics found
no errors in the manual scripts, focused tests, or operational guide.

### Actual runtime smoke

Read-only probes returned the package name and current version without editing
files. Environment: VS Code `1.140.0`, Copilot Chat `0.68.0`, Node `20.19.6`.
Interval: `2026-10-06 13:12:12` through `13:15:00`, runtime-log local time.

| Task tier / exact agent | Selected model | Actual runtime model IDs | Request IDs | Verdict |
| --- | --- | --- | --- | --- |
| Liviano / Cavecrew Investigator | MAI-Code-1.1-Flash (copilot) | mai-code-1.1-flash | 942b1f6e, ace4b2b1 | VERIFIED (2/2) |
| Mediano / Turbo Backend | Claude Sonnet 5.5 (copilot) | claude-sonnet-5.5 -> claude-sonnet-5-5 | 3fe5dda3, 743c3a40 | VERIFIED (2/2) |
| Grande task escalation / Cavecrew Reviewer | GPT-6.1 Sol (copilot) | gpt-6.1-sol | 78fa960d, eed81f5f, ef0bcf34 | VERIFIED (3/3) |

The active Copilot log rotated during closure and correctly produced
`NOT_VERIFIED` when the requests were absent. The same seven requests were found
in rotated runtime logs and verified again. Only their sanitized successful
request lines are preserved in [runtime-smoke.txt](runtime-smoke.txt), with no
prompts, transcripts, secrets, or private filesystem paths. The final portable
verifier also verified all seven against this saved evidence. For example:

```sh
node .agents/model-routing/verify-copilot-model-evidence.mjs \
  --log docs/plans/2026-10-06-u02-copilot-tier-routing/runtime-smoke.txt \
  --agent 'Turbo Backend' \
  --model-id claude-sonnet-5.5 --model-id claude-sonnet-5-5 \
  --request-id 3fe5dda3 --request-id 743c3a40 \
  --since '2026-10-06 13:12:12' --until '2026-10-06 13:15:00'
```

This reproduces historical evidence, not a fresh availability check. Explicit
invocation is runtime-proven here; generated native fallback arrays are checked
as configuration, not claimed to prove unoverridden fallback in every VS Code build.

### Independent QA and finding ledger

`QA Relampago` reviewed the implementation read-only, including an actual
consumer `init --runtime copilot --apply --yes` and installed-helper execution.
Two bounded reentries checked only subsequent repairs. Final decision:
`blocking_findings_open: no`, `ready_to_close: yes`; acceptance, regressions,
standards, tests, and edge-case gates passed. No repeated full-suite execution
was required from the reviewer; it checked the parent's fresh evidence.

| Finding | Severity | Resolution | Final state |
| --- | --- | --- | --- |
| U02-QA-01 | Low | Safe IO classification and missing-catalog/ENOTDIR API tests, without stack traces. | Resolved |
| U02-QA-02 | Low | Valid structured file, stdin, and positional-legacy CLI coverage. | Resolved |
| U02-QA-03 | Low | Explicit-root loader and CLI tested with an isolated catalog. | Resolved |
| U02-QA-04 | Low | Bare names require confirmed Copilot provider; unknown/other providers require exact qualified IDs. Alias and attribution trust limits documented. | Resolved |
| U02-QA-05 | Low | Malformed catalog JSON classified as usage exit 2 and covered in the existing API test. | Resolved |

### Content references and residual limits

SHA-256 references identify the final reviewed code independently of this receipt:

```text
scripts/copilot-model-routing.mjs 90a60a1c9022b363dcca914dba8d4275236d1298f90721153f3ad6fb32097a41
scripts/verify-copilot-model-evidence.mjs 2b1388d57f65a8d7e3d37ed349fbb2ebf03081438dbb226678facef5c713b85b
scripts/sync-delegate-runtime-adapters.mjs c0b0ee0e0e8dc65327160c0c1e8ba8da07700d16570decd5cce7faf8e2c43164
test/template-packs.test.mjs d9bee93b23bd80fed10f6179f9dd86cdad13d6ae9b9abc01026c9e285346f306
```

Legal inventory: 131 files, digest
`24859778677528ab1ed6b8f4976da2637e0bd972b5a2d6cb59ad5e1169bff47e`.
Existing authorship classification and authorization statements were preserved.

There is no confirmed live catalog API or Node interception of VS Code
`runSubagent`: the integration is the authoritative parent tool protocol plus
portable validation utilities. Availability, billing, and organizational policy
remain runtime-owned. The verifier trusts operator-confirmed aliases of one model
and attributable request IDs; it cannot establish those facts itself. Full recipe
documentation is in the workflow-kit package/repository, while installed overlay
instructions and helpers carry the execution contract. Future runtimes require a
fresh smoke; this evidence is not a promise that today's catalog is universal.