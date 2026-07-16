# Runtime parity checklist

Use this checklist after substantial neutral-contract or wrapper changes.

Parity means semantic equivalence across runtimes, not identical syntax.

## Supported runtime surfaces

| Runtime | Wrapper / adapter surface |
| --- | --- |
| Codex | `AGENTS.md`, `.codex/config.toml`, `.codex/agents/**` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/agents/**` |
| Claude Code | `CLAUDE.md` |

## Checklist

| Area | Expected parity evidence | Status vocabulary |
| --- | --- | --- |
| Startup contract | Runtime points to `.agents/instructions.md` as neutral source of truth | `aligned`, `drift`, `justified-difference`, `pending` |
| Skill discovery | Runtime points to `.agents/skills/registry.md` and just-in-time loading | `aligned`, `drift`, `justified-difference`, `pending` |
| Integrations/capabilities | Runtime points to `.agents/integrations/README.md` and `.agents/capabilities/README.md` | `aligned`, `drift`, `justified-difference`, `pending` |
| Routing/model policy | Runtime points to `.agents/model-routing/README.md` and preserves tier/posture/override meaning | `aligned`, `drift`, `justified-difference`, `pending` |
| Memory governance | Runtime points to `.agents/memory/README.md` and preserves scope/shareability/exclusion rules | `aligned`, `drift`, `justified-difference`, `pending` |
| Closure/reporting | Runtime preserves substantial-work expectations: validation, traceability, summaries, and durable documentation when useful | `aligned`, `drift`, `justified-difference`, `pending` |

## Review rules

1. A runtime may have different syntax or tooling and still be aligned.
2. A runtime is in drift when it redefines a neutral semantic rule locally.
3. A justified difference must name the runtime limitation and fallback.
4. Pending work must name the file or wrapper that still needs alignment.

## Minimal review record

Record:

- date;
- reviewer/runtime;
- changed neutral files;
- changed wrapper files;
- checklist rows with status;
- any justified differences or follow-up owners.
