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

## Usage

```bash
npx -y react-doctor@latest . --verbose --diff
```

## Workflow

Run after making changes to catch issues early. Fix errors first, then re-run to verify the score improved.
