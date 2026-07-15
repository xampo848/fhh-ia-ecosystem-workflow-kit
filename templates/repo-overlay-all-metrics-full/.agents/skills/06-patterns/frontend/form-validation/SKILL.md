---
name: form-validation
description: "Reusable frontend pattern for Formik/Yup form validation, error handling, and localized user feedback."
---

# Form Validation

## Trigger

Load when a slice builds or changes a form with validation, submission errors,
or field-level feedback.

## Must Read

- `.github/instructions/frontend.instructions.md`
- Relevant files under `docs/patterns/frontend/`

## Procedure

1. Prefer Formik + Yup and existing shared form components.
2. Define field validation, submission validation, and server-error mapping.
3. Keep visible strings in i18n.
4. Cover positive, invalid, and error states.
5. Avoid duplicating validation logic across component and hook layers.

## Validation Hooks

- Focused frontend tests for valid/invalid/error states
- i18n and visible-state review

## Stop Conditions

- Validation ownership is unclear.
- API error shape is unknown.
- Required UX/error behavior is ambiguous.

## Out of Scope

- Full form design-system redesign
- Global state architecture changes
