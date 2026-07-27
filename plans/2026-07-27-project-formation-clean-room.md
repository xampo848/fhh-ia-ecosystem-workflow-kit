# Project Formation Clean-Room Plan

Date: 2026-07-27
Owner: FHH IA Ecosystem maintainers

## Objective

Create a new product workflow package under 01-product that covers discovery, alternative exploration, roadmap planning, GTM definition, and final dossier assembly without reusing copyrighted expression from removed Product Studio content.

## Legal posture

- Clean-room implementation only.
- No copy or near-paraphrase of removed Product Studio or external restricted text.
- Functional inspiration is allowed; expression must be original.
- Overlay provenance inventory must be renewed whenever installable content changes.

## Scope

In scope:

- New workflow skill: project-formation.
- Five supporting skills:
  - project-formation-discovery
  - project-formation-solution-lab
  - project-formation-roadmap
  - project-formation-gtm
  - project-formation-dossier
- Registration in canonical and installable skill registries.
- Inclusion in startup compact direct-routing index.

Out of scope:

- Reintroduction of old Product Studio files.
- Copying text from external PM skill repositories.
- Runtime-specific behavior changes in router policy.

## Design principles

1. Evidence-first decisions.
2. Traceable rationale for major choices.
3. Explicit scope boundaries and non-goals.
4. Small iterative phase outputs.
5. Complete implementation handoff dossier.

## Deliverables

- New skill folders in .agents/skills/01-product and mirrored installable overlay.
- Updated registry files:
  - .agents/skills/registry.md
  - .agents/skills/registry.json
  - .agents/skills/registry.cache.json
  - templates/repo-overlay-fhh-ia-ecosystem-full/.agents/skills/* equivalents
- Updated compact index to expose project-formation as a direct routing option.
- Renewed legal inventory hash in docs/legal/overlay-authorship.json.

## Validation gates

- bun run check:templates
- bun run check:legal
- bun run test

## Follow-up recommendations

1. Pilot run the workflow with one real initiative and capture friction points.
2. Add one PM output example per new skill in a docs/workflow/project-formation section.
3. If needed, add a dedicated router hard trigger for requests that ask to form a project end-to-end.
