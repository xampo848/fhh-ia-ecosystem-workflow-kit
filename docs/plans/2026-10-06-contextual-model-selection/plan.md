# Contextual delegate model selection

Status: implemented and independently reviewed, 2026-10-06.

## Approved scope

The user approved reevaluating all thirteen delegate roles and assigning runtime
selection ownership to the orchestrator. Extend the existing portable Copilot
resolver and canonical delegate catalog; do not create a mandatory selector agent,
an SDK interceptor, a live catalog API, or an automatic switch for running agents.
Preserve U-02 exact identities, explicit invocation, user pins, same-tier fallback,
bounded pre-execution correction, and selected-versus-executed evidence semantics.
No new dependencies, product UI, organizational policy changes, commits, or branches.

## Role defaults

Mediano: Capitana Alcance, Arquitecta Fases, Turbo Backend, Pixel Ninja,
Guardia Contrato, Testinator 5000, QA Relampago, Cavecrew Builder, Cavecrew Reviewer.
Liviano: Sherlock Estructura, Lint Ranger, Escriba Doc, Cavecrew Investigator.
No permanent Grande role. Task-specific selection may escalate or identify a
clearly mechanical Liviano task; uncertainty must not silently cheapen a role.

Luna is an economical candidate, not a role-quality benchmark winner. Keep MAI
as an available alternative. Sonnet 5.5 and GPT-6.1 Sol are normal development
candidates; GPT-6.1 Sol may also serve a critical task. Price does not imply
capability. High-price models are not automatic upgrades without a risk rationale.

## Acceptance criteria

- AC-01: canonical defaults match the complete approved matrix; generated native
  adapters and overlay copies remain synchronized. Preserve each runtime's tool,
  sandbox, identity, and model-inheritance semantics.
- AC-02: contextual decisions derive from explicit task signals: objective,
  work kind, ambiguity, risk, context completeness, and named critical concerns.
  Defaults remain conservative. Unsupported, malformed, or contradictory inputs
  do not authorize a low-risk route. Mechanical exceptions require explicit
  bounded and complete low-risk context. Unknown context never implies safety.
- AC-03: deterministic resolution validates observed exact model identities,
  optional task/pin constraints and budget. No silent tier downgrade or override
  of a user pin; contextual disagreement is visible. Missing safe candidates block.
  Legacy calls without task context remain supported and identified as legacy.
- AC-04: optional cost estimation uses caller-supplied token counts, catalog
  pricing provenance/date, cache read/write charges where applicable, and long
  context thresholds. Budget without sufficient estimates blocks rather than
  inventing telemetry. Unknown prices or unsupported cache pricing cannot pass a
  budget check. Estimates are not billing receipts; legacy annual request billing
  must not be treated as token billing. Promotions expire explicitly.
- AC-05: output records contextual tier/posture, decision reasons, estimated-cost
  basis when available, selection versus actual execution, and unbenchmarked
  suitability. Parent owns context interpretation and model selection before
  each new invocation. No autonomous child switching or uncertain-work replay.
- AC-06: protocol/policy/guide and portable distribution work together. Contextual
  API and structured CLI tests, installed-consumer checks, regression suite,
  quality gates, independent QA, and correlated live probes validate the slice.
  Real invocation proves runtime identity, not comparative quality by role.

## Preflight and ownership

Mode: standard with autonomous routine progression and compact completed preflight. Listed
hazards: none (no product API/data/UI changes). One atomic specialized writer owns
resolver, catalog, generator adjustments if needed, existing focused test file,
policy/protocol and mirror updates; the shared catalog couples role defaults,
selection and adapter output. The parent owns this receipt, coordination metadata,
release/legal metadata refresh, final validation and independent QA. Do not edit
generated helpers by hand. Do not revert the existing uncommitted U-02 changes.

Readiness: GO; the approved chat matrix and selector ownership are behaviorally
specific. Discovery: scripts/copilot-model-routing.mjs owns model selection and
currently chooses the first observed candidate in the supplied/default tier.
scripts/delegate-agent-catalog.json owns aliases, tiers and candidate order.
Existing scripts/sync-delegate-runtime-adapters.mjs copies standalone helpers;
test/template-packs.test.mjs contains resolver, CLI, portable and evidence tests.
No full codebase mapping is necessary. Matching must complete before coding.

## Required checks

- Focused contextual/default/budget/legacy tests in test/template-packs.test.mjs,
  first immediately after the writer's first substantive edit.
- Generated portable-helper parity and installed-consumer structured input.
- bun run test; bun run check; bun run check:workflow; bun run check:docs;
  bun run check:release; bun run check:legal; git diff --check.
- Live explicit invocation from contextual resolver output; correlate actual
  requests to runtime logs and retain sanitized evidence, not private transcripts.
- Independent QA, with targeted reentry for any repairs.

## 10. Implementation evidence

Completed on 2026-10-06, version `0.7.40-contextual-model-selection`.
Base commit: `090f5499a48cdae1e5c1c0556cae8b17a61c35c1`. Changes remain
uncommitted at the implementation handoff; no branch, commit, installation
dependency, or publication had been made at that point.
The prior U-02 working-tree changes were preserved.

### Delivered behavior

- Canonical defaults now cover nine Mediano and four Liviano roles. Capitana,
  Arquitecta, Testinator and Cavecrew Reviewer moved to Mediano. Defaults are
  conservative legacy fallbacks, not permanent model locks or capability scores.
- The orchestrator owns task interpretation before each new non-trivial call.
  The existing resolver validates explicit context and produces a reasoned tier,
  routing intent, exact model and invocation. No mandatory selector subagent or
  second routing engine was introduced.
- Liviano is allowed only for bounded, complete, low-risk, low-ambiguity lookup,
  mechanical validation or synthesis of already validated evidence, without
  critical concerns. Other work has a Mediano floor. High risk, high ambiguity,
  or named critical concerns require Grande. Incomplete context requests
  clarification; the invocation protocol prohibits proceeding until resolved.
- Task-tier conflicts block. User model pins retain explicit control with a
  visible mismatch warning; unavailable pins require strict boolean fallback
  consent. No silent tier changes or replay of possibly started work is allowed.
- Luna is first among economical Liviano candidates; MAI remains an alternative.
  Sonnet 5.5 and GPT-6.1 Sol are normal Mediano candidates. Sol remains eligible
  for Grande without implying that a critical task needs a more expensive model.
- Optional list-rate estimation supports explicit uncached input, cached input,
  cache-write and output counts, provenance/date, and standard/long thresholds.
  A budget requires complete estimates and token billing; unknown prices,
  unsupported cache charges, expired promotions, and insufficient budget cannot
  pass. Budget limits accept at most six decimal places and never round up.
- Legacy no-context API/flags/positional calls remain available and identified
  as legacy. New structured input rejects unsupported keys and null context,
  cost or budget objects rather than silently discarding constraints.
- Pure exports `decideContextualTier` and `estimateModelCost` are exercised with
  direct and integration tests. Generated helpers remain standalone Node ESM and
  function in installed consumers and through symlinks without the source repo.
- Native artifacts were regenerated rather than manually edited. Claude
  inheritance and Codex sandbox/tool behavior remain intact; neutral role-tier
  hints changed where required by the approved matrix. Policy, protocol and
  overlay copies are synchronized.

### Acceptance and validation

| Criterion | Final result | Executed evidence |
| --- | --- | --- |
| AC-01 | COMPLETE | All thirteen role defaults, candidate membership, native adapters and exact generated-helper parity tests. |
| AC-02 | COMPLETE | Direct contextual-helper tests; lookup/readiness/critical cases; uncertain, unbounded, malformed, unsupported, null and inherited-key inputs. |
| AC-03 | COMPLETE | Tier-conflict, user-pin mismatch, strict fallback consent, no downgrade, exact identifiers and legacy API/CLI regressions. |
| AC-04 | COMPLETE | Threshold 272000/272001; exclusive cache/input/output sums; safe count totals; explicit dates; unknown/expired rates; legacy billing; exact budget boundaries and same-tier exclusions. |
| AC-05 | COMPLETE | Context/protocol parity, recorded reasons and routing intent, unbenchmarked suitability, selected-versus-executed output and verified actual requests below. |
| AC-06 | COMPLETE | Portable structured-input/symlink tests, final 197/197 suite, all gates, independent QA and eight attributed runtime requests. |

Final commands on the last repaired code: `bun run test` passed 197/197 tests with
zero failures or skips; `bun run check`, `bun run check:workflow`,
`bun run check:docs`, `bun run check:release`, `bun run check:legal`, and
`git diff --check` passed. The focused test file contains 50 passing tests;
focused checks ran immediately after substantive edits. Workflow validation
confirmed 86 synchronized artifacts and six valid packs. Editor diagnostics found
no errors in manual code, catalog, focused tests, skill or guide.

Quality result: existing pure ESM/catalog/node:test/generator patterns reused,
without dependencies, speculative selector infrastructure or duplicated rule
authorities. Boundary, empty/error and compatibility cases are executable. The
pricing catalog deliberately covers six essential model identities; other
candidates remain unpriceable for budget enforcement, never assumed free.

### Contextual runtime evidence

The portable resolver produced the exact tool arguments before the probes:

| Task / agent | Context-derived tier / intent | Selected model | Actual model IDs | Requests | Result |
| --- | --- | --- | --- | --- | --- |
| Metadata lookup / Cavecrew Investigator | Liviano / lean | GPT-6 Luna (copilot) | gpt-6-luna | 939a9ff5, ac7caf6e | VERIFIED (2/2); correct name/version |
| Approved-scope readiness / Capitana Alcance | Mediano / balanced | Claude Sonnet 5.5 (copilot) | claude-sonnet-5.5 -> claude-sonnet-5-5 | c25d193e, 14a7a33e | VERIFIED (2/2); READINESS=GO |
| Critical budget/tier contract review / Cavecrew Reviewer | Grande / premium | GPT-6.1 Sol (copilot) | gpt-6.1-sol | e1fb5b21, b8ff47b4, fdc602f6, c4bcf4c8 | VERIFIED (4/4); CONTRACT_PROBE=PASS |

Environment: VS Code `1.140.0`, Copilot Chat `0.68.0`, Node `20.19.6`.
Probe interval: `2026-10-06 15:29:24` through `15:30:51`, UTC-03:00.
All probes were read-only and independent; no validation rejection or corrective
retry occurred. The saved [runtime-smoke.txt](runtime-smoke.txt) includes only
the eight attributed request lines, no prompts, transcripts, private paths or
secrets. The portable verifier also returned VERIFIED for all saved records.
For example, run from the repository root:

```sh
node .agents/model-routing/verify-copilot-model-evidence.mjs \
  --log docs/plans/2026-10-06-contextual-model-selection/runtime-smoke.txt \
  --agent 'Capitana Alcance' \
  --model-id claude-sonnet-5.5 --model-id claude-sonnet-5-5 \
  --request-id c25d193e --request-id 14a7a33e \
  --since '2026-10-06 15:29:24' --until '2026-10-06 15:30:51'
```

This reproduces historical execution evidence, not fresh availability or a
quality/cost benchmark. The last repair only validates the exported helper's
default-tier input; valid canonical selections and the probe identities are
unchanged. Native frontmatter arrays remain configuration evidence, not proof of
unoverridden runtime behavior on every installation.

### Independent QA and finding ledger

QA Relampago reviewed the final acceptance criteria, new-method coverage,
adjacent regressions, malformed/boundary states, portable consumers and mirrors.
It confirmed the actual hashes and read the ledger first. Final targeted reentry
verified the direct API guard/test and corrected guide wording, including its own
execution of the new focused test. Final outcome: `ready_to_close: yes`,
`blocking_findings_open: no`; no new findings and all gates passed.

| Finding | Severity | Final state | Resolution in selection slice |
| --- | --- | --- | --- |
| SEL-01 | Medium | Repaired | Non-qualifying/uncertain lookup now has a Mediano floor, including normally lightweight roles. |
| SEL-02 | Medium | Repaired | Limits finer than six decimals are rejected; budget is never rounded upward. |
| SEL-03 | Low | Repaired | Unknown structured fields, null constraint objects/concerns and unsafe aggregate counts fail validation. |
| SEL-04 | Low | Repaired | Bounded validated-evidence synthesis can use Liviano; ambiguous or incomplete work escalates. |
| SEL-05 | Low | Repaired | Exported contextual helper validates the default tier; direct tests cover bad tiers, normalization and clarification. |
| SEL-06 | Low | Repaired | Guide distinguishes malformed input rejection from conservative precedence of critical/incomplete signals. |

No waivers or unresolved implementation findings remain. Coordination metadata
is retired only after this durable receipt and its executable example are checked.

### Reviewed content and limits

Final SHA-256 references:

```text
scripts/copilot-model-routing.mjs 91af2b3fa0f456567c476b70bd770884d1354974a4c73e61278a7fb8f3b84c8f
scripts/delegate-agent-catalog.json 06c8934ba8aaf86a442add139187b10e7cf01d12d99f66c3bcf94928133a21c4
test/template-packs.test.mjs 5e498a6a794ffcee5037f91767756c015a01e1dc92d87ac498c321f83a5987de
```

Legal inventory: 131 files, digest
`9eafa6fa0bea78277eadf3f6624721a3f37b48b41deb9eaa1d87d04557f549d6`.
Existing authorship classification and authorization statements were preserved.

The orchestrator remains responsible for honest task signals, actual validation
of evidence and obeying `clarificationRequired`. The helper is deterministic
validation, not a semantic interpreter or runtime interception hook. Availability
and billing policy remain external; no live catalog API, actual-token telemetry,
or independent verification of supplied token counts is claimed. Suitability
remains unbenchmarked; real comparative role-quality cases are future evaluation,
not an implemented adaptive scoring engine. Log attribution and model-alias
equivalence require operator-confirmed inputs. See the
[operational guide](../../workflow/copilot-subagent-model-routing.md) for the
context schema, executable input and failure contracts.