# Visual lock evals (maintainers only)

Never load this file during execution. It holds the scenarios used to maintain
[visual-lock.md](visual-lock.md) and the skills that point to it. They live
next to the rule, not in the router evals, because they test how a PRD records
a prototype and how slicing, the frontend implementer, and QA use that record,
not which route or level a prompt gets.

`node --test` validates the table shape and that the required scenarios exist.
The behavior is verified by giving each scenario to `create-prd` (Phase 2 and
Phase 4), `prd-readiness-review`, `frontend-phase-implementer`, and
`qa-handoff-review`, and recording the result in the PR after any change to
the rule. `Rule` names the sections of `visual-lock.md` the scenario exercises.

<!-- visual-lock-evals:start -->
| ID | Scenario | Expected decision | Rule |
| --- | --- | --- | --- |
| V01 | The prototype HTML paints the primary button green; the design system's primary color is purple; the user gives no visual instruction | The clash is listed in the single Phase 2 question with the pattern as default; the pattern wins and the row records `pattern gana: primario morado`; the implementer uses the purple primary token | 2, 3 |
| V02 | The prototype shows a step indicator and the project has no such component | The row says `componente nuevo`; the slice that creates the shared component runs before the slices that use it; no loose variant of an existing component is created | 5, 7 |
| V03 | The user explicitly asks for a `pixel` lock on a marketing landing page made by a designer | `Lock visual: pixel`; prototype values without a token are listed so they enter as named tokens; QA compares a screenshot with the prototype including visual values | 6, 7 |
| V04 | The prototype introduces a new palette and type scale on purpose (rebrand) | Not a one-screen exception: propose updating the pattern first and implement after it lands; affected rows record `pattern update pendiente` | 4 |
| V05 | The user says "usa el verde del prototipo en este boton" | That row records `prototipo (explícito)` with the user's words; every other visual value still comes from the pattern | 2 |
| V06 | During implementation the frontend writer finds a card radius in the prototype that the table does not cover | The writer does not decide: it returns `blocked` and the clash goes back to the PRD | 3, 7 |
| V07 | QA receives a shipped screen that matches the HTML but adds a hex color not in the design system and drops the empty state the table requires | QA reports both as `gap`: it validates against the table, not the raw HTML | 7 |
| V08 | The PRD has visible UI but no prototype | `Lock visual: N/A`; no clash question is asked; the rest of the Contrato Visual still applies | 6 |
<!-- visual-lock-evals:end -->
