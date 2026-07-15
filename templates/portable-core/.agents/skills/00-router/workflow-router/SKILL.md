---
name: workflow-router
description: Route non-trivial requests to the smallest safe workflow.
---

# Workflow Router

Use this starter router when a request is more than a direct answer.

## Routing rules

1. Read `.agents/instructions.md` first.
2. Choose the smallest workflow that can safely satisfy the request.
3. Use `create-prd` before non-trivial implementation when requirements are not yet explicit.
4. Use `implement-prd` for production code changes that are more than a surgical edit.
5. Record the chosen path, cost posture, and validation expectation.
6. If the request is about extending the workflow itself (router/registry/skills), route to direct workflow-maintenance edits instead of product workflows.

## Workflow extension handling

When the request is "how do I extend this workflow?" or "do this extension for me":

1. Identify whether the user wants explanation-only or actual edits.
2. Use the minimal file set:
	- `.agents/skills/00-router/workflow-router/SKILL.md`
	- `.agents/instructions.md`
	- `.agents/skills/registry.md`
	- the target skill path under `.agents/skills/**/SKILL.md`
3. Keep discovery metadata in `registry.md` and execution rules in each `SKILL.md`.
4. After edits, run relevant validation commands and report pass/fail.

Replace this starter with your project's fuller routing policy as the local workflow matures.
