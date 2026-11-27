# Filling in the project instruction files

Use this guide when onboarding workflow-kit into a real product repository.

Goal: make backend and frontend implementation skills load project-specific rules instead of guessing conventions.

## The files

`init` creates these files as templates. They are runtime-neutral: every runtime reads them, and runtimes that load instructions from their own folder get a generated copy.

- `.agents/project/backend.md`
- `.agents/project/frontend.md`
- `.agents/project/context.md`
- `.agents/project/quality-gate.md`

There is one template for each, the one `init` installs. This guide does not carry a second copy: edit the installed files.

A template carries a marker line: `<!-- workflow-kit:project-instructions:template -->` in `backend.md` and `frontend.md`, `<!-- workflow-kit:project-context:template -->` in `context.md`. While the marker is there, the workflow treats the file as not filled in and `workflow-kit doctor` reports it for `context.md`.

## How to fill them in

The quickest way is to ask your agent for the initial Discovery of the project: the router handles it as project context setup, fills the files from a bounded read of the code, and shows you the diff.

By hand, per file:

- Replace every `[TODO` placeholder with a decision of this project. What nobody can settle yet is one line, `not determined: <reason>`, never a leftover `[TODO`.
- `backend.md` and `frontend.md`: the stack and its layer boundaries, naming and error-handling conventions, the test framework and what every change must cover, and the shortcuts that are forbidden in that layer.
- `context.md`: the structure map, the validation commands with their cost, the test conventions, the environment quirks, and pointers to longer documents.
- Remove the marker line when no `[TODO` is left.
- Longer human-facing standards may live in `docs/workflow/standards/` or elsewhere. Agents reach them only through a pointer in the project file.

## A layer the project does not have

Do not delete the file. Replace its whole content with one line that says so, for example `This project has no frontend.` A deleted file is reported by `workflow-kit doctor` as missing.

## Fast adoption checklist

1. Fill in both instruction files, or leave the one-line note for a layer that does not exist.
2. Check that no `[TODO` is left and that the marker lines are gone.
3. Run each validation command locally and make sure it works.
4. Add the same commands to CI for enforcement.
5. Link these files from your onboarding and contribution docs.
