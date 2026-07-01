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

Replace this starter with your project's fuller routing policy as the local workflow matures.
