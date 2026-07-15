---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Use for early visual direction, aesthetic differentiation, typography, palette, layout thesis, and design intent before or during frontend implementation. Prefer this when the main need is choosing a stronger visual direction; prefer `impeccable` for full design-system-heavy craft, critique, audit, live iteration, or broad UI refinement.
user-invocable: true
license: Complete terms in LICENSE.txt
---

# Frontend Design

Approach this as the design lead at a small studio known for giving every client a visual identity that could not be mistaken for anyone else's. This repository already uses `impeccable`, so this skill must **complement it rather than compete with it**: use `frontend-design` to set the visual thesis and distinctive direction early, then hand off to `impeccable` only when the work expands into craft, polish, audit, or live iteration.

Use this skill as a **lightweight visual-direction layer** for frontend work in All Metrics.

Best fit:

- new frontend surfaces that still feel visually undefined
- redesigns where the UX exists but the visual identity feels generic
- moments before implementing visible UI, when the main risk is shipping a templated look
- design critiques focused on palette, typography, hierarchy, and signature visual moves

Prefer `impeccable` instead when the task needs:

- full end-to-end design craft flows
- deep design-system extraction or alignment
- live browser iteration / variants
- technical UI audit, polish, or broad UX hardening
- sub-commands like critique, polish, onboard, animate, clarify, etc.

Recommended sequence when both are useful:

1. `frontend-design` → define subject, audience, page job, palette, typography, layout thesis, and one justified aesthetic risk.
2. implementation / `frontend-phase-implementer` → translate that direction into production code using repo primitives and tokens.
3. `impeccable` → refine, audit, polish, critique, or iterate live once the direction already exists.

## Ground it in the subject

If the brief does not pin down what the product or subject is, pin it yourself before designing: name one concrete subject, its audience, and the page's single job, and state your choice. If there's any information in your memory about the human's preferences, context about what they're building, or designs you've made before, use that as a hint. The subject's own world, its materials, instruments, artifacts, and vernacular, is where distinctive choices come from. Build with the brief's real content and subject matter throughout.

## Design principles

For web designs, the hero is a thesis. Open with the most characteristic thing in the subject's world, in whatever form makes sense for it: a headline, an image, an animation, a live demo, an interactive moment. Be deliberate with your choice: a big number with a small label, supporting stats, and a gradient accent is the template answer, only use if that's truly the best option.

Typography carries the personality of the page. Pair the display and body faces deliberately, not the same families you would reach for on any other project, and set a clear type scale with intentional weights, widths, and spacing. Make the type treatment itself a memorable part of the design, not a neutral delivery vehicle for the content.

Structure is information. Structural devices, numbering, eyebrows, dividers, labels, should encode something true about the content, not decorate it. Many generic designs use numbered markers (01 / 02 / 03), but that's only appropriate if the content actually is a sequence, like a real process or a typed timeline where order carries information the reader needs. Question if choices like numbered markers actually make sense before incorporating them.

Leverage motion deliberately. Think about where and if animation can serve the subject: a page-load sequence, a scroll-triggered reveal, hover micro-interactions, ambient atmosphere. An orchestrated moment usually lands harder than scattered effects, choose what the direction calls for. However, sometimes less is more, and extra animation contributes to the feeling that the design is AI-generated.

Match complexity to the vision. Maximalist directions need elaborate execution; minimal directions need precision in spacing, type, and detail. Elegance is executing the chosen vision well.

Consider written content carefully. Often a design brief may not contain real content, and it's up to you to come up with copy. Copy can make a design feel as templated as the design itself. See the below section on writing for more guidance.

## Process: brainstorm, explore, plan, critique, build, critique again

For calibration: AI-generated design right now clusters around three looks: (1) a warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta accent; (2) a near-black background with a single bright acid-green or vermilion accent; (3) a broadsheet-style layout with hairline rules, zero border-radius, and dense newspaper-like columns. All three are legitimate for some briefs, but they are defaults rather than choices, and they appear regardless of subject. Where the brief pins down a visual direction, follow it exactly — the brief's own words win. Where it leaves an axis free, don't spend that freedom on one of these defaults.

Work in two passes.

### Pass 1 — Design plan

Create a compact plan with:

- **Color**: 4–6 named hex values.
- **Type**: typefaces for 2+ roles (display, body, optional utility/data).
- **Layout**: a one-sentence layout concept plus small ASCII wireframes when useful.
- **Signature**: the single memorable visual element that embodies the brief.

### Pass 2 — Uniqueness review

Review the plan against the brief before building. If any part reads like the generic default you would produce for any similar page rather than a choice made for this specific brief, revise that part, state what changed, and why.

Only after that should implementation begin. When implementation is requested, follow the revised plan exactly and derive every color and type decision from it.

When writing code, be careful with CSS selector specificity. Avoid class and element selectors that accidentally cancel each other out, especially around section spacing, CTA treatments, or shared layout wrappers.

## Restraint and self-critique

Spend your boldness in one place. Let the signature element be the one memorable thing, keep everything around it quiet and disciplined, and cut any decoration that does not serve the brief. Build to a quality floor without announcing it: responsive down to mobile, visible keyboard focus, reduced motion respected. Before declaring victory, mentally remove one accessory: if a decorative move can disappear without weakening the concept, cut it.

When the environment supports visual verification, inspect the result and critique it honestly before declaring it done. A screenshot is often worth more than a long explanation.

## More on writing in design

Words appear in a design for one reason: to make it easier to understand, and therefore easier to use. They are design material, not decoration. Bring the same intentionality to copy that you would bring to spacing and color.

Write from the end user's side of the screen. Name things by what people control and recognize, never by how the system is built. A person manages notifications, not webhook config. Describe what something does in plain terms rather than selling it. Being specific is always better than being clever.

Use active voice as default. A control should say exactly what happens when it's used: "Save changes," not "Submit." An action keeps the same name through the whole flow, so the button that says "Publish" produces a toast that says "Published."

Treat failure and emptiness as moments for direction, not mood. Explain what went wrong and how to fix it, in the interface's voice rather than a person's. Errors don't apologize, and they are never vague about what happened. An empty screen is an invitation to act.

Keep the register conversational and tuned: plain verbs, sentence case, no filler, with tone matched to the brand and the audience. Let each element do exactly one job. A label labels, an example demonstrates, and nothing quietly does double duty.

## Operating rule inside this repository

For All Metrics, use this skill to establish or sharpen **visual direction**. Then:

- hand off to `implement-prd` / `frontend-phase-implementer` for production code changes
- hand off to `impeccable` when the work expands into full craft, live iteration, or broader design QA
- keep all final implementation aligned with repo frontend rules: design system first, no hardcoded visible strings, no hardcoded hex colors in JSX, and proper i18n/token usage
