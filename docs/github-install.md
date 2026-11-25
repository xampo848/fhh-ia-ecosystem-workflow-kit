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
version, append a ref: a tag, or the full commit hash of a version that has no
tag. The remote has tags only up to `v0.17.3-contract-gaps`; later versions
(`0.18.0` to `0.23.4`) are on `main` without a tag until the maintainer
creates them. Examples:

```bash
# a version that has a tag
bun add -g github:xampo848/fhh-ia-ecosystem-workflow-kit#v0.17.3-contract-gaps
# a version without a tag: use its commit (here 0.23.3-strict-cli)
bun add -g github:xampo848/fhh-ia-ecosystem-workflow-kit#96ec070136314053080535e3c40ce73c874268d7
```

See [Versioning](versioning.md) for the tags and the commit of each later
version.

## Upgrading

Refresh the toolkit binary, then update managed repositories:

```bash
workflow-kit upgrade --apply --yes
workflow-kit update --target /path/to/repo --apply --yes
```

`upgrade` needs `git` and `bun` on your `PATH`. It checks the ref before it
removes the installed version: a branch or tag by name, and a full
40-character commit hash by fetching that commit. A short commit hash is
accepted only when it is the tip of a branch or tag, so use the full hash.

## Plugin mode (pilot)

For Claude Code and GitHub Copilot the kit can also run as the plugin `fhh`
from the marketplace `fhh-ia-ecosystem`, which lives in this repository:

```bash
workflow-kit init --mode plugin --runtime claude --target /path/to/repo
```

The repository then holds only the adapters, the plugin declaration and the
project overlay; each person installs the plugin once per clone
(`claude plugin install fhh@fhh-ia-ecosystem --scope project`, or
`copilot plugin install fhh@fhh-ia-ecosystem`). The marketplace in `main`
points at the branch `plugin`, which exists only after the first publish and
its approved push, so plugin installs fail before that. Claude Code pins a
plugin to its version: a kit change reaches people only when a new version is
published, never by following `main`. Release steps: [Versioning](versioning.md).
Commands, stops and `doctor` codes: [Quickstart, plugin mode](quickstart.md#11-plugin-mode-pilot).

## Access requirements

- The installing machine must have network access to GitHub.
- SSH installs require an SSH key registered with GitHub.

## Publishing note

`package.json` intentionally remains `private: true`. That blocks accidental npm registry publication but does not prevent installing from a public GitHub repository.
