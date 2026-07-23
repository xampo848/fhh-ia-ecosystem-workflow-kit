# Runtime Adapters Template Placeholder

This directory contains thin adapter templates for Codex, GitHub Copilot, Claude Code, Antigravity, and future runtimes.

Adapters must point back to neutral `.agents/**` contracts and must not become a second source of workflow truth.
Outside an explicit skill invocation or a trivial direct answer, adapters should
hand control to `.agents/instructions.md` and then `workflow-router` instead of
encoding their own workflow selection rules.
