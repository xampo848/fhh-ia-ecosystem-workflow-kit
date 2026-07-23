# Workflow Docs Map

This folder is reserved for documents that support the installed AI workflow.

## Structure

- `decisions/`: durable decisions about workflow rules, routing, and architecture.
- `runbooks/`: procedural documents for recurring operations.
- `handoffs/`: implementation summaries and ownership transfers.
- `standards/`: backend/frontend standards and setup-migration guidance.
- `migration/`: one-time adoption artifacts for recovering and reordering legacy docs.

## Ordering rules

1. Keep one concern per document.
2. Prefer append-only history for decisions; supersede by adding a newer file.
3. Link each runbook to the commands/files it touches.
4. For handoffs, include scope, validation evidence, and next steps.

## Recommended first documents

- `decisions/2026-01-01-workflow-adoption-baseline.md`
- `runbooks/update-skill-registry.md`
- `handoffs/template-installation.md`
- `standards/setup-and-migration.md`
