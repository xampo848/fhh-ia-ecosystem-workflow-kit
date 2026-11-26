# Lock Live Path And Phase Cut

Part of [SKILL.md](../SKILL.md), step 6 of the Discovery Workflow. Read it when you reach that step; it is mandatory.

## Procedure

Before locking the cut or writing the PRD queue, offer `solution-sketch` once when the epic introduces an architecture or model shared by several child PRDs. Do not auto-start the skill. If the user declines, record `sketch: skipped` in the epic and continue. If `docs/design/<slug>-sketch.md` already exists, reuse it. Do not write the queue until the offer is skipped or a sketch is locked.

Do this before writing any phase table or PRD queue when the epic changes a live production path, replaces or adds a provider or source, or introduces an architecture that must coexist with current behavior. If none of those apply, record `No aplica` in the epic and continue.

Do not ask the user to pick a named strategy. Infer first. Ask only what would change the cut.

Resolve, in this order:

1. Must the current production path keep working during this appetite?
2. Does the committed scope fit one cycle, or must it be split?
3. If it must be split: show two concrete phase sequences for this epic — not labels — and wait for an explicit choice.
4. If an unresolved business rule would change which sequence is correct, ask that rule before writing the queue. Do not invent the rule. A domain example from a prior conversation is not a standing rule.

Default when the user does not override:

- One cycle, and the current path can be cut so the whole increment can be tested together: one PRD, single cutover.
- Multiple cycles, or the current path cannot be turned off: phase 1 already runs the live path on the new system; unfinished replacements may stay empty if they are not the live path.
- Do not encode a personal preference for single cutover. Challenge it when a new dependency or unresolved business rule would stay hidden until the last week.

After the cut is locked:

- Each committed phase must leave the live path usable.
- Empty implementations are allowed only when they are not the live path.
- The committed epic as a whole must end as a usable replacement. Permanent empty implementations and indefinitely dual live paths fail the epic Definition of Done.
- Record the chosen sequence, the discarded sequence, and why as an epic invariant (`INV-CUT-01` or the next free `INV-CUT-NN`) so child PRDs cannot invert it.

Use this prompt when a choice is still blocking:

```markdown
Antes de escribir la cola de PRDs:

1. **[Path vivo]** El path actual [debe seguir / se puede cortar] porque [hecho del discovery]. ¿Es correcto?
2. **[Corte]** Propongo esta secuencia: [fase 1 -> ...]. La alternativa es: [fase 1 -> ...]. La primera gana porque [consecuencia concreta]. ¿Cual cerramos?
```
