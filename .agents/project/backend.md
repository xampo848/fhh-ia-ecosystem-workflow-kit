# Backend Instructions

<!-- workflow-kit:project-instructions:template -->

Project rules for backend work. Delegates that touch this layer read this file;
runtimes that load instructions from their own folder get a generated copy.
This file is still the template: replace the placeholders. What the code does
not settle is one line `not determined: <reason>`, never a `[TODO`. Remove the
template marker above when no `[TODO` is left. If the project has no backend, do not delete this file: replace its whole content with one line,
`This project has no backend.` Stack-specific rules installed from a stack pack live in
`.agents/project/stack.md`, which exists only when a stack pack was installed
(`--stack`).

## Stack and architecture

- Language and framework: [TODO]
- Layer boundaries: [TODO: controllers, services, repositories]

## Conventions

- [TODO: naming, error handling, data access, state management]

## Tests

- Framework and location: [TODO]
- What every change must cover: [TODO]

## Do not

- [TODO: forbidden shortcuts for this layer]
