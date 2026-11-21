---
name: implement-prd
description: "Permanent alias of implement-change, kept so existing PRDs, docs, and habits keep working (\"implementa este PRD\"). Load .agents/skills/02-implement/implement-change/SKILL.md and follow it."
argument-hint: "Path to the PRD file, for example docs/prd/<area>/<date>-<slug>/<slug>.md"
license: MIT
metadata:
  author: fhh-ia-ecosystem
  version: "3.0"
---

# Implement PRD (alias)

`implement-prd` is a permanent alias of `implement-change`, the general
implementation route for PRDs, bugs, tickets, and iterations.

Load [../implement-change/SKILL.md](../implement-change/SKILL.md) and follow
it. A PRD path is the `PRD` input type there; the task level (N1/N2/N3) decides
the ceremony.

The shared references used by `implement-change` at N2/N3 stay in this
directory: [reference/](reference/) (orchestration flow, delegate matrix,
subagent prompts, handoff schemas, task tracker template, validation and stop
conditions, test design rules) and the per-alias prompt cards in [agents/](agents/).

Session cut point: at N2/N3, when a slice is `VERIFIED` from its terminal
handoff and no delegate is pending, or the size brake fires, the orchestrator
writes a checkpoint and proposes a new session, as
[../implement-change/reference/session-checkpoint.md](../implement-change/reference/session-checkpoint.md)
defines; it is the only checkpoint reference.
