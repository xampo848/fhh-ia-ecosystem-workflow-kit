# Neutral capability packaging and attachment blueprint

This directory defines the neutral contract for packaging attachable AI
capabilities and wiring them into the workflow without making any runtime
wrapper the canonical owner.

## Purpose

The capability layer answers these questions:

Capability inventory lives in `.agents/capabilities/registry.md`. Concrete, swappable tool declarations live under `.agents/capabilities/manifests/**`.

1. what belongs in a portable AI workflow core vs a repo-specific overlay;
2. how an attachable capability declares itself;
3. how install, attach, and active lifecycle states differ;
4. where a capability is allowed to attach to the workflow;
5. what runtime wrappers may expose without redefining the contract.

## Portable core vs repo overlay

| Layer | Owns | Must not own |
| --- | --- | --- |
| Portable core | neutral startup contract, capability taxonomy, manifest contract, attach-point vocabulary, lifecycle semantics, runtime parity expectations | repo-specific workflow choices, product/domain rules, local standards, local activation policy |
| Repo overlay | local capability adoption, local docs/config, repo-owned capabilities, repo-specific wrapper references, project defaults | portable-core ownership, generic lifecycle semantics, cross-runtime meaning |
| Runtime wrappers | runtime-specific access metadata, adapter syntax, availability notes | canonical lifecycle meaning, canonical attach points, portable-core ownership |

Rules:

- The portable core defines semantics.
- The repo overlay declares local adoption.
- Runtime wrappers stay thin.
- A capability may be global, repo-local, or hybrid, but that scope must be explicit.

## Relationship to skills and integrations

- `.agents/skills/registry.md` indexes AI-executable skills.
- `.agents/integrations/README.md` owns install/attach request flow, source
  policy, confirmation policy, and success criteria.
- `.agents/memory/README.md` owns memory shareability and runtime parity
  governance.
- This capability blueprint owns packaging boundary, manifest shape, lifecycle,
  attach points, and runtime wiring minimum.

Use the integrations contract when the user asks to install, attach, list, or
recommend a capability. Use this blueprint when the repo must define **how that
capability fits the system structurally**.

## Capability classes

| Class | Examples |
| --- | --- |
| Runtime capability already available | Context7, Engram, existing MCP tools |
| Repo-owned capability | Caveman-style helper layer |
| Installable skill package | curated/imported skill packs |
| Plugin / connector / MCP package | future external bundles |
| Knowledge/authoring helper | memory, docs, testing, browser-style helpers when governed as capabilities |
| Token-saving communication/helper capability | swappable external tools declared in `.agents/capabilities/registry.md` and `manifests/**` |

This contract is class-based, not tool-specific.

## Manifest contract

The minimum neutral manifest fields are:

| Field | Meaning |
| --- | --- |
| `name` | Stable capability name |
| `type` | Capability class |
| `availability` | already available, installable, or repo-local |
| `scope` | `user/global`, `repo/project`, or `hybrid` |
| `attach_points` | Supported workflow/runtime attach points |
| `install_mode` | `install-required`, `attach-only`, or `conditional` |
| `runtime_support` | Supported runtimes such as Codex, GitHub Copilot, Claude Code |
| `source_policy` | default source expectation |
| `activation_notes` | Conditions required before the capability counts as active |
| `owner_layer` | `portable-core`, `repo-overlay`, or runtime adapter note |
| `status` | current lifecycle state |

Requirements:

- Keep the manifest human-readable.
- Keep the manifest stable enough for future YAML/JSON/TOML automation.
- Do not duplicate full install commands here when the integrations contract
  already owns that behavior.


## Token-saving capability activation

A token-saving capability is `active` only when the runtime confirms it is
installed/available and attached. Once active, FHH IA Ecosystem uses it as a
quality-preserving default posture: attempt to save tokens first, then fall back
to normal concise prose whenever compression risks ambiguity, safety, or user
understanding.

This activation is external to workflow sequencing. It must not replace
`workflow-router`, `create-prd`, `implement-prd`, validation gates, or runtime
adapter rules.

## Lifecycle states

| State | Meaning |
| --- | --- |
| `known` | Capability recognized by taxonomy |
| `available` | Already present in runtime/user environment |
| `installable` | Can be installed but is not yet available |
| `installed` | Installation succeeded, attachment may still be missing |
| `attached` | Neutral workflow is wired to recognize/use it |
| `active` | Attached and ready in the intended scope |
| `optional` | Attached but not mandatory for normal workflow execution |
| `unavailable` | Runtime or scope cannot currently use it |

Rules:

- Install does not imply attach.
- Attach does not imply active until activation notes are satisfied.
- Already-available capabilities may take the attach-only path.
- Repo-owned capabilities may skip install and still require attachment.

## Stable attach points

| Attach point | Purpose |
| --- | --- |
| `startup-discovery` | visible during startup/routing/availability checks |
| `workflow-routing` | influences workflow selection or capability lookup |
| `skill-execution` | used by a loaded skill during execution |
| `delegation` | affects subagent/delegate flows |
| `memory` | stores or retrieves durable context |
| `documentation` | affects docs, artifacts, or durable knowledge outputs |
| `validation` | participates in audits, checks, or verification |
| `runtime-adapter` | needs wrapper/runtime metadata to be reachable |

Rules:

- Every capability manifest must declare at least one attach point.
- Attach points are stable vocabulary, not ad hoc hidden hooks.
- New attach-point categories require a neutral contract update.

## Runtime wiring minimum

| Layer | Responsibility |
| --- | --- |
| Portable core docs/contracts | define semantics and parity expectations |
| Repo overlay docs/config | declare local usage and role |
| Runtime wrappers | expose access metadata and point back to the neutral contract |
| Runtime-specific install syntax | stay runtime-specific and non-canonical |

Runtime rule:

- Codex, GitHub Copilot, and Claude Code may consume the same capability
  contract through different adapters.
- This does **not** mean a one-click universal installer exists today.
- Portability means equivalent contract and attach semantics across runtimes,
  not identical installation mechanics.

## Out of scope for this phase

- marketplace/distribution UX;
- full installers for every capability/tool;
- automatic multi-repo rollout;
- trust scoring or telemetry;
- deep memory-governance policy beyond attachment semantics;
- backend/frontend product code.
