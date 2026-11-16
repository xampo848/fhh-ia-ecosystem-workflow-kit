# Codex Adapter Notes

This is a thin Codex runtime adapter; keep it thin. `.agents/instructions.md`
is the source of truth: if this file conflicts with it, `.agents/instructions.md`
wins. Route selection and route-specific safeguards belong to `workflow-router`.

The root `AGENTS.md` comes from the shared `agents-md` adapter and carries the
generated level pre-filter; apply it first.

Shared bootstrap for every new user prompt:

- Classify every new prompt with the level pre-filter. If it continues the
  active workflow, apply the continuation fast-path from
  `.agents/instructions.md`; re-route only on a break signal.
- For non-trivial (N2/N3) work that does not continue the active workflow, read
  `.agents/instructions.md`, then use `.agents/skills/index.md` for discovery
  (`.agents/skills/registry.md` only for full inventory or fallback). If the
  user explicitly invokes a skill, load it directly; otherwise load
  `workflow-router` and emit its routing decision trace before loading the
  selected skill. Only trivial informational direct answers may skip the trace.
  The selected workflow/skill is binding for the next non-trivial action; if
  workflow changes, emit a new trace first.
- Execution authorization: for routes that write (code, PRDs, tickets,
  installs), intent-only phrasing ("quiero", "necesito") is
  not implementation authorization; until the user authorizes the route, do not
  inspect product implementation files, do not plan implementation tasks, and
  do not edit code.
  Exceptions: N0 acts on intent, N1 needs a short "yes", and read-only routes
  or an explicit imperative naming the work ("revisa este PR") need no extra
  confirmation.

Runtime notes:

- `.codex/agents/*.toml` are generated delegate adapters; never edit them by
  hand. Codex reads `.agents/skills/**` directly.
