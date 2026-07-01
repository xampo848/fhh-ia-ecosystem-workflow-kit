# Release Plan

This document records the intended release path. It is not a publishing script.

## Pre-release gates

Before any public release:

1. Safe CLI planner exists with dry-run default.
2. Apply mode requires explicit confirmation.
3. Conflict preview and backup behavior are tested.
4. Template boundaries are validated.
5. Runtime adapters are generated as thin wrappers.
6. README install commands match real commands.
7. CI runs scaffold, CLI, template, and fixture checks.

## Publishing approval

Do not run GitHub repository creation, package publication, release uploads, or push automation without explicit maintainer approval.

## Versioning intent

Use semantic versioning after the first executable package exists. Until then, `0.0.0-scaffold` marks this as non-installable scaffold work.
