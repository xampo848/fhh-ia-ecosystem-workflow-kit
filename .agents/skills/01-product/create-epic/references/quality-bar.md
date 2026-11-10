# Epic Output Quality Bar

Part of [SKILL.md](../SKILL.md). Read it before delivering the epic.

## Checklist

The epic is ready when another agent can run `create-prd` on the first slice without rediscovering the whole project context.

The epic is not ready if it:

- Lacks codebase evidence
- Omits web/source evidence when a vendor, regulation, or other external constraint matters
- Runs web research by default when local code/docs already answer the epic
- Treats assumptions as facts
- Ignores the stated appetite or treats scope as fixed when the investment boundary is fixed
- Mixes multiple unrelated products into one PRD queue
- Fails to name the first PRD and its strict scope
- Omits stable IDs for non-negotiable inherited requirements
- Fails to define how each phase moves through `create-prd`, `implement-prd`, and `document-development`
- Fails to create the companion ledger file or leaves it without one row per invariant and per queued PRD
- Fails to persist the reusable evidence pack for child PRDs
- Writes a PRD queue before locking the live path and phase cut when the step 6 trigger applies
- Asks the user to pick named strategies instead of choosing between two concrete sequences
- Commits phases that do not converge to a usable replacement, or that leave empty implementations on the live path
