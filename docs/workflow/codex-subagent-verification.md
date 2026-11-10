# Codex Subagents: Verification Recipe

Procedure to confirm that the workflow delegates correctly in Codex (roadmap
U-15, D-28). It mirrors the Copilot recipe in
`copilot-subagent-model-routing.md`: a controlled smoke first, then a real run.
The maintainer runs it; an AI session in another runtime cannot.

## What the kit configures

- `.codex/agents/<slug>.toml` (generated; do not edit) defines each delegate
  with `sandbox_mode`, `model_reasoning_effort`, and the delegate contract
  summary. The effort comes from the project's model profile: `xhigh` for
  Grande roles and `medium` for Mediano in `calidad`; `low` exists only in
  `costo`.
- The model is inherited from the session, because Codex model identifiers
  change between releases. To pin one, add `model = "<id>"` in a project copy
  of the agent file and record it in `.agents/project-context.md`.
- Codex resolves `model` and `model_reasoning_effort` in this order: an
  explicit spawn value, the agent file, then the parent session. Codex spawns
  agents after a direct request or an applicable project or skill instruction;
  `implement-change` is that instruction.

## A. Controlled smoke

1. In the repository, start Codex with the model you normally use.
2. Ask: "Usa el agente `sherlock-estructura` para leer `package.json` y
   responder solo con el nombre y la versión. No edites nada."
3. Repeat with `turbo-backend` (Grande) and `capitana-alcance` (Mediano).
4. Pass criteria: each answer comes from a spawned agent (Codex shows the agent
   thread), no file changed (`git status --short` is empty), and the session
   record shows the reasoning effort of each agent's tier.

## B. Real run

In the next N2 or N3 implementation with Codex:

1. Choose supervised or autonomous when `implement-change` offers it, and
   answer the subagent question.
2. At closure, check section 10 of the PRD: it must say, per delegation,
   whether it ran as a subagent or inline, and the trace must not show an
   unexplained inline fallback.
3. Compare the orchestrator's context use with a previous run: readiness,
   discovery, slicing, implementation, validation, and QA should each have run
   in their own agent.

## Reading the result

- **A and B pass:** U-15 is done for Codex.
- **A passes, B falls back to inline:** the orchestrator did not spawn the
  agents in a long run. Report it with the trace line; the fix is in the
  invocation rules of `implement-change/reference/level-n3.md`.
- **A fails:** record the Codex version, the message, and what the session
  showed, and run the role skills inline until it is resolved.

## Parity

Run the level test prompts in
`.agents/skills/00-router/workflow-router/reference/router-evals.md` in Codex.
They must produce the same level and route as in Claude Code and Copilot.
