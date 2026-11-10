# Input types

Read only the section of the detected input type. The type decides the
evidence; the level (`../SKILL.md`) decides the ceremony.

## PRD

Recognized by a PRD path or "implementa este PRD".

1. Read the PRD completely before planning.
2. If `docs/design/<slug>-sketch.md` exists — path declared in the PRD or slug derived from the PRD directory — read that locked sketch. Do not invert it without an explicit critical-stance challenge. Missing sketch does not block historical PRDs.
3. If the PRD changes visible user-facing UI, read the Contrato Visual (UI
   lock). Treat `UI lock: locked` as an anchor: do not invent density,
   hierarchy, primary action, or required UI states. If the lock is missing,
   `not-applicable` without a reason, or would still force Pixel Ninja to
   invent the screen, stop and return to `create-prd` or the user. A mockup or
   photo cited by the lock is evidence, not permission to ignore its fields.
4. Evidence: the acceptance-criteria coverage matrix (each criterion linked to
   code, tests, validation output, or an accepted residual risk), plus the
   closure of the confirmed level.

## Bug

Recognized when observed behavior differs from expected behavior.

1. Reproduce first: steps, input, and observed versus expected result.
2. Write a test that fails before the fix, fix, and show it passing.
3. Record a one-line root cause.
4. **No reproduction possible** (for example, the environment cannot reproduce
   it): do not fix blindly. Stop and say so. Continue without a failing test
   only when the user explicitly authorizes it, and record the reason. An
   environment that cannot reproduce is an environment failure, not a reason
   to retry in loops.

## Ticket

Recognized by a ticket id or short acceptance criteria. Evidence: each
acceptance criterion covered by a test or a named check. If the criteria are
ambiguous enough to produce different implementations, stop and ask instead of
choosing one.

## Iteration

Recognized when the change modifies something already implemented from a PRD.
The ceremony drops; the quality does not.

1. **The map is the PRD and its `## 10. Evidencia de Implementacion`**, not a
   new Discovery. Read only the files the evidence names and the delta touches.
2. **Freshness is measured by changes, not time.** With the change reference
   in section 10 (commit or PR), check what changed since closure in the
   delivered files (`git log` or `git diff <ref>..HEAD` on those files):
   - no changes: the map is current, go straight to the delta;
   - changes in a few files: reread only those;
   - moved or deleted files, or broad changes: Discovery bounded to that area.

   Age is only a warning (for example, more than 90 days).
3. **Questions only about the delta**: its edge cases and uncertainties. If an
   external API is involved, propose an exploratory read-only probe.
4. **The level of the delta** comes from the pre-filter, usually N1. Always
   propose it and wait for the user's "yes".
5. **Old PRD without section 10**: ask the user for the PR or commit of the
   implementation; without it, run Discovery bounded to the area.
6. **Always kept**: tests of the delta (a failing-first test for a bug);
   regression of the original feature by running the existing tests that
   section 10 lists for this PRD, not only the new ones; lint, types, and
   project standards on the touched files; escalation to N3 when the delta
   touches a `criticalConcern`; at N2, QA focused on the delta.
7. **Dropped**: Discovery of unchanged code, re-validating untouched
   acceptance criteria one by one, full-feature QA, and the tracker at N1.
8. **Proportional closure**: add an "Iteración N" subsection to the PRD's
   section 10 with the delta, the acceptance criteria added or changed, the
   tests executed (new and regression), and the change reference, so the map
   stays current for the next iteration.
