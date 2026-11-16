# Runtime Adapter Templates

Thin adapter templates that `workflow-kit` installs for each `--runtime`: `agents-md/` (the shared `AGENTS.md`, used by Codex, Copilot, and opencode), `codex/`, `copilot/`, `claude/`, and `antigravity/`. The mapping lives in `src/runtime-matrix.mjs`.

Adapters must point back to neutral `.agents/**` contracts and must not become a second source of workflow truth.
Outside an explicit skill invocation or a trivial direct answer, adapters should
hand control to `.agents/instructions.md` and then `workflow-router` instead of
encoding their own workflow selection rules.
