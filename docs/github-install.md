# GitHub Install

This project is a public GitHub repository and can be installed by users or automation directly from GitHub.

Requirements: Node.js 20.17+ or 22.13+ (the `engines` field in `package.json`) and [Bun](https://bun.sh).

## Install with Bun from GitHub

With the GitHub shorthand (HTTPS):

```bash
bun add -g github:xampo848/fhh-ia-ecosystem-workflow-kit
```

Or with the SSH URL:

```bash
bun add -g git+ssh://git@github.com/xampo848/fhh-ia-ecosystem-workflow-kit.git
```

Verify the install:

```bash
workflow-kit --version
workflow-kit --help
```

Then run:

```bash
workflow-kit init --target /path/to/repo --runtime codex
workflow-kit export --output /tmp/workflow-kit-export --runtime codex
```

## Choosing a version

The commands above install the latest merged version from `main`. To pin a
release, append its tag (`v<version>`); tags are listed on the repository's
[Releases page](https://github.com/xampo848/fhh-ia-ecosystem-workflow-kit/releases):

```bash
bun add -g github:xampo848/fhh-ia-ecosystem-workflow-kit#v0.18.0-equilibrado-profile
```

See [Versioning](versioning.md) for the list of tags and how they are named.

## Upgrading

Refresh the toolkit binary, then update managed repositories:

```bash
workflow-kit upgrade --apply --yes
workflow-kit update --target /path/to/repo --apply --yes
```

`upgrade` checks that the ref exists and is reachable before it replaces the
installed version.

## Access requirements

- The installing machine must have network access to GitHub.
- SSH installs require an SSH key registered with GitHub.

## Publishing note

`package.json` intentionally remains `private: true`. That blocks accidental npm registry publication but does not prevent installing from a public GitHub repository.
