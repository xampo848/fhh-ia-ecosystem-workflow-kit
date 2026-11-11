# UI sketch (optional)

Read this file only when the sketch involves a user-facing screen and the user
accepted one of the UI paths. Nothing here starts on its own: teams work
differently and many have their own designers.

## Offer on entry

When the sketch involves UI (calibration `visible_ui: yes`, or the user talks
about a screen), offer these paths when entering `solution-sketch` and wait for
the user's choice:

- **a) Design a new view** with `impeccable shape` (a short interview, no code).
- **b) Critique an existing view** the user picks, with `impeccable critique`.
- **c) Use the team's design** (Figma, mockup, or the designer's notes):
  `impeccable` is not loaded; the sketch only translates that design into the
  Contrato Visual fields and cites the source.
- **d) No visual part**: the classic architecture sketch.

Record the choice in the sketch as `ui-path: shape | critique | team-design | skipped`.
When the problem mixes architecture and UI, lock the architecture first and put
the visual part in its own section of the same sketch.

Project preference: a `ui_sketch` line in `.agents/project-context.md` sets the
default (`offer`, `team-design`, or `no-impeccable`). Without it, offer the four
paths with none preselected. The user can change it at any time.

## Paths a and b

- **a) New view:** load `impeccable` with its `shape` reference. Its interview
  replaces turn 1 of the sketch; one round unless real gaps remain.
- **b) Existing view:** resolve the view to a concrete file or URL and run
  `impeccable critique`. Browser inspection is optional: without a running
  server, critique the code only and mark it "degradada". Deliver concrete
  problems with evidence (file, element, heuristic). Its two assessments run as
  subagents with the tier the model profile assigns to review; when subagents
  are unavailable they run in sequence and "independencia degradada" is noted.
- Never use `craft`, `live`, or any `impeccable` command that edits files.
- If `PRODUCT.md` is missing, offer `impeccable teach` once. If the user
  declines, continue without it and note it; it does not block.

## Comparable proposals

Present 2 or 3 proposals in one table with the Contrato Visual columns:
hierarchy, density, primary action, required states, and accessibility.

## Mockups and prototypes (offered, recommended)

So a person (the user, a designer, a PM) can open, look at, and comment on the
sketch. The user may decline and keep the table plus an ASCII wireframe. Two
stages, to avoid paying for fidelity on options that get discarded:

1. **Compare:** each proposal is a low-fidelity HTML mockup (greys, no brand
   styling), one file without a build step, plus an `index.html` that shows the
   options side by side.
2. **Iterate the chosen one:** the winner becomes a navigable mid-fidelity
   prototype that uses the tokens in `DESIGN.md` or the design system
   primitives when they exist, and lets the viewer switch between the required
   states of the Contrato Visual (empty, loading, error, no permission,
   success).

Rules:

- **Location:** `docs/design/<slug>-mockups/`, versioned in the repository
  (`opcion-a.html`, `prototipo-v1.html`, `prototipo-v2.html`...), so anyone on
  the team can open them in a browser without the AI session.
- **Iteration:** the person comments, a new version is generated and the
  previous one is kept, and each round is added to a "Registro de feedback" in
  the sketch. Visual rounds are counted apart from the three sketch turns, with
  a **maximum of 3**. Without agreement after 3, accept the current version or
  hand it to a designer.
- **Fake data only.** Never real customer data.
- **Not product code:** the application never imports the mockups.
  `implement-change` uses them as visual reference next to the Contrato Visual,
  which remains the contract.
- **Path c:** no mockups are generated; cite the designer's.
- **Runtime-neutral:** they are local HTML files. Open them in the runtime's
  browser preview when it has one; otherwise the user opens them.

## Bridge to the PRD

Write the chosen proposal (or the team's design in path c) with the Contrato
Visual fields already filled: surface, density or composition, primary action,
required states, visual thesis, design-system primitives to reuse, and optional
evidence. `create-prd` inherits it as an anchor, exactly as it inherits class
names: inverting it requires an explicit critical-stance challenge.

The sketch limits still apply: at most three turns, never auto-start, no
product code, no acceptance criteria or slices.
