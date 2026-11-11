# Modifiers: autonomous and resume

Read only when a modifier applies. Modifiers change pauses or starting point,
never the level's gates.

## Autonomous (former `autonomous-safe`)

1. **Offered, never assumed.** When authorizing an N2 or N3 implementation,
   offer two options with the route trace:
   - **Supervised** (default): review pause between phases;
   - **Autonomous**: no routine pauses; runs until done or until a brake fires.

   N1 does not offer it (it has no pauses to remove). Offer it again on resume.
2. **The user can switch at any time.** "Pausa" or "sigue supervisado" stops
   autonomy at the end of the current step; "sigue autónomo" enables it from
   there. The choice applies to this run only and is never stored as a project
   preference.
3. **Never removed by autonomy:** stop conditions; the repair-round limits in
   `../../implement-prd/reference/validation-and-stop-conditions.md`;
   environment-failure handling; the model fallback rules in
   `.agents/model-routing/README.md`; installation confirmations; and any
   irreversible or outward action (push, deploy, publish, delete). Autonomy
   removes pauses, not brakes.
4. **Large PRD the user chose not to split:** phase-by-phase execution with a
   review pause is recommended. If the user still chooses autonomous:
   - state in one line which size signals hold and the risk before starting;
   - at the end of each phase, write a short checkpoint summary in section 10
     without stopping, so the user can review it at any time;
   - if a phase exhausts its repair rounds, stop there; do not start the next
     phase.
5. **Subagents are stated, never assumed.** In the same question, when the
   runtime needs an explicit request to launch subagents (Codex spawns agents
   after a direct request or an applicable project or skill instruction), ask
   once whether to delegate to the generated agents. If the user declines, or
   the runtime exposes no way to spawn them, say so in the trace
   (`ejecución inline: subagentes no autorizados o no disponibles`) and apply
   the smallest context load for the level. Never fall back to inline
   execution silently: a silent fallback piles every stage into the
   orchestrator's context window.
6. **Visibility:** the trace shows the active mode (`· autónomo` or
   `· supervisado`), and the closure records which mode was used.

## Resume

When implementation already started: reconstruct progress from the PRD, the
current diff, relevant tests, the tracker if present, and the first incomplete
acceptance criterion. Revalidate only the changed delta and its dependencies;
never re-implement validated work. Re-confirm the level, and offer supervised or
autonomous again.
