---
name: react-doctor
description: >
  Scan React codebase for security, performance, correctness, and architecture issues. Outputs a 0-100 score.
  Validates hooks rules, component design, and patterns for this project (Vite 7, Vitest, TanStack Query v5).
  Trigger: Use when reviewing code, finishing a feature, or fixing bugs in a React project.
license: MIT
metadata:
	author: fhh-ia-ecosystem
	version: "1.0.0"
---

# React Doctor

Scans your React codebase for security, performance, correctness, and architecture issues. Outputs a 0-100 score with actionable diagnostics.

## Trigger

Load when the task includes meaningful React frontend changes or explicit React quality review.

Examples:

- Review quality after editing React components/hooks.
- Final frontend validation for a React slice.

## Must Read

- `.github/copilot-instructions.md`
- `.agents/instructions.md`
- `.agents/skills/00-router/workflow-router/SKILL.md`

## Applicability Gate (Required)

Run this gate before executing any `react-doctor` command:

1. Confirm React signals exist in the repo or changed scope:
  - `react` or `react-dom` dependency in package manifest, or
  - changed files contain React component/hook patterns (`.jsx`, `.tsx`, React hooks, JSX runtime usage).
2. Confirm the request is not backend-only.
3. If conditions are not met, return:

```text
Status: not-applicable
Reason: React surface not detected for this task.
Next: inline review or another stack-appropriate quality skill.
```

## Usage

```bash
npx -y react-doctor@latest . --verbose --diff
```

## Workflow

Run after making changes to catch issues early. Fix errors first, then re-run to verify the score improved.

## Stop Conditions

- The task is backend-only or has no React surface.
- React tooling is not available and cannot be installed under current policy.
- The user asked for a different quality method and did not request React-specific checks.
