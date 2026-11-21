# Quality Gate (kit default)

Apply this gate before closing any code-writing or code-review slice. It is
the kit default and is updated with the kit. After it, read the project
additions in `.agents/project/quality-gate.md` when that file exists: they may
tighten these rules, never relax them (`.agents/kit-boundary.md`).

1. Reuse the established local pattern, or record why a divergence is necessary.
2. Map every acceptance criterion to executable evidence: a focused test,
   validation command, smoke check, or an explicit user-accepted risk.
3. Check adjacent regressions and relevant empty, error, and boundary states.
4. Do not duplicate authoritative rules, contract mappings, permissions,
   validation, or data transformations.
5. Do not duplicate tests either: prove each rule once, in the lowest layer
   that owns it; extend an existing test of the same behavior before adding a
   new one; keep setup minimal; and test behavior, not implementation
   (`.agents/skills/02-implement/implement-prd/reference/test-design-rules.md`).
6. Keep the change simple: no speculative abstraction, unnecessary dependency,
   or hardcoded value that belongs in configuration, constants, types, tokens,
   fixtures, or i18n.
7. Report the quality result with the executed checks, their scope, and any
   remaining risk. A passing command alone is not sufficient evidence.

For visible UI work, also apply the required frontend instructions and the
locked visual contract before considering the slice complete.