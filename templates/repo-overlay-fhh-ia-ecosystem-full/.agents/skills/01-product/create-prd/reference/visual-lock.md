# Visual Lock (prototype)

Read it in Phase 2 when the request brings a prototype of the screen (an HTML
file, an image, or a screenshot), and again in Phase 4 when filling the
`Lock visual` block of the Contrato Visual. Slicing, the frontend implementer,
QA, and readiness read only "7. Consumers".

The prototype says **what** the screen contains; the project's patterns say
**how it looks**. The Contrato Visual stays the contract: the prototype feeds
its fields (density, primary action, required states), it does not replace
them.

## 1. Who owns what

| Aspect | Owner | Covers |
| --- | --- | --- |
| Structure and content | Prototype (locked) | layout, hierarchy, sections and their order, texts, fields, states, interactions |
| Visual language | Project patterns | colors, typography, spacing, radii, shadows, existing components |

"Project patterns" are, in this order: the design system tokens and
primitives, `.agents/project/frontend.md`, `DESIGN.md` when it exists,
`docs/patterns/frontend/` when present, and sibling screens in the repository.

## 2. Default

The pattern wins on visual language and the prototype wins on structure. The
prototype wins on a visual aspect only when the user says so explicitly for
that element; record the decision as `prototipo (explícito)` with the user's
words. Never infer it from how polished the prototype looks.

## 3. Conflicts are resolved in the PRD, never in implementation

1. In Phase 2, compare the prototype with the project patterns aspect by
   aspect (color, typography, spacing, radius, shadow, component).
2. List every clash on one line: `elemento: prototipo <valor> vs pattern
   <valor>`, for example "boton primario: verde en el prototipo vs primario
   morado en el pattern".
3. Ask once: all clashes go in one grouped question inside the Phase 2 round,
   each with the default (pattern wins) already proposed, so the user only
   confirms or corrects. No clash, no question.
4. Record every answer in the `Lock visual` table. A clash without a decision
   is blocking ambiguity: the PRD is not ready for implementation.
5. The implementer never resolves a clash. A clash found during
   implementation that the table does not cover stops the slice (`blocked`)
   and goes back to the PRD or the user.

## 4. Intentional new style

When the prototype's visual differences are intentional and reach beyond one
element (a rebrand, a new palette, a new type scale, a new spacing base), it is
not a one-screen exception. Propose updating the pattern or design system
first, as its own change, and implement the screen after that update lands.
Record `pattern update pendiente: <referencia>` in the affected rows. The user
may instead choose to ship the screen with the current pattern; record that
choice as the decision.

## 5. Map every element to a component

Every prototype element maps to an existing component or design system
primitive, named in the `Componente` column. When none exists, write
`componente nuevo`: the frontend slice builds it as a shared component from the
pattern's tokens. Never create a loose variant to match the prototype (a new
color or size option, a copy of an existing component with tweaks, an inline
style override). When an existing component needs a variant it does not have,
record `componente nuevo: variante <nombre> de <Componente>` so the PRD decides
it, not the implementer.

## 6. Lock levels and the PRD block

- `estructura` (default): structure and content are locked; every visual value
  comes from the patterns.
- `pixel`: only when the user asks for it explicitly, for example a marketing
  landing page made by a designer. The prototype also locks visual values
  (spacing, sizes, colors, typography). Values without an existing token are
  listed in the table so they enter as named tokens, never as raw literals
  scattered in components.

The block lives inside the Contrato Visual (`template-sections/visual-contract.md`):

- `Lock visual`: `N/A` (no prototype), `estructura`, or `pixel`.
- `Fuente`: the path of the HTML file or image, versioned in the repository
  (for example `docs/design/<slug>-mockups/prototipo-v2.html`).
- Table `Elemento | Fuente | Componente | Decisión`, one row per section,
  field, state, and interaction of the prototype, plus the required states the
  prototype does not draw (empty, loading, error, no permission):
  - `Fuente`: `prototipo` when the row locks structure or content, `pattern`
    when it locks a visual value;
  - `Componente`: an existing component, `componente nuevo`, or
    `componente nuevo: variante ...`;
  - `Decisión`: `default`, `pattern gana: <valor>`, `prototipo (explícito):
    <palabras del usuario>`, `prototipo (pixel)`, or
    `pattern update pendiente: <referencia>`.

Without a prototype the block is `Lock visual: N/A` and nothing else.

## 7. Consumers

- `prd-readiness-review`: STOP when a prototype is cited and the table is
  missing, a clash has no decision, or an element has no component.
- `implementation-slicing`: assign every table row to exactly one frontend
  slice; rows marked `componente nuevo` go to the slice that creates the shared
  component, before the slices that use it.
- `frontend-phase-implementer`: implement the assigned rows as written. No
  structural deviation (missing, reordered, or extra sections, fields, texts,
  or states) and no visual value outside the system. A clash the table does
  not cover returns `blocked`.
- `qa-handoff-review`: validate against the table, not against the raw HTML.
  Every element and state of the table is present, and no color, typography,
  spacing, radius, shadow, or one-off variant falls outside the system. A
  missing row or an off-system style is a `gap`. When `playwright-testing` is
  available, compare a screenshot of the shipped screen with the prototype:
  for `estructura` the comparison checks layout and content only; for `pixel`
  it also checks visual values.
