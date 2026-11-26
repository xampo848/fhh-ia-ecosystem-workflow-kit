# Route menus and guidance texts

Read this file only when the router must present route options and stop in
`awaiting-user-choice`. The decision rules live in `../SKILL.md`.

## Mandatory route-options block

- When route selection includes product-shaping choices, present a compact menu with up to four options in plain language.
- Each option must include: user-facing label, underlying skill name, expected artifact, and scope hint.
- Mark exactly one option as "Recommended" and explain why in one short sentence.
- End with an explicit selection prompt and stop in `awaiting-user-choice`.

Example format:

```text
Puedo llevarlo por estas rutas:
1) Formación integral del proyecto (`project-formation`) -> discovery + shaping + roadmap + GTM + dossier.
2) PRD de una feature (`create-prd`) -> especificación implementable de una capacidad.
3) Ticket acotado (`generate-pm-ticket`) -> backlog item pequeño con AC.
4) Épica multi-fase (`create-epic`) -> investigación + fases + cola de PRDs.

Recomendación: [opción] porque [razón breve].
Elige una opción por número o por nombre de skill.
```

`solution-sketch` is never a fifth standing option; it is offered only through
its hard trigger in `../SKILL.md`.

## Production change without a PRD

Do not silently code. Offer the smallest predecessor and let the user choose.
When the N1 criteria in `route-gates.md` hold, include the N1 surgical option.

```text
Antes de implementar necesito tu decisión de formato. Puedo seguir como [project-formation], [create-prd], [generate-pm-ticket] o [create-epic] según alcance. Elige una opción y la ejecuto.
```

If the user says they do not want a PRD, epic, or ticket, ask for explicit
authorization of an alternative route; do not move into implementation by
default.

## Epic or PRD

When it is unclear whether the work is one feature or a multi-phase initiative:

```text
Puedo tomar esto como PRD acotado o como épica completa. ¿Prefieres una especificación pequeña para implementar o una investigación con fases?
```

When autonomy is preferred and the request still fits one feature spec,
recommend `create-prd`, but wait for explicit user choice.

## Plain-language guidance

When the user is unsure, do not dump the skill catalog. Offer at most four
options:

```text
Puedo tomar esto de 4 formas:
1. Respuesta rápida / análisis sin crear archivos.
2. Formación integral de proyecto (discovery -> roadmap -> GTM -> dossier).
3. Ticket o PRD acotado para implementar.
4. Épica completa con investigación y fases.

Mi recomendación: [opción], porque [razón breve].
```

If the user says "no sé" or gives no preference, offer one recommended option
and ask for explicit confirmation before loading that workflow.
