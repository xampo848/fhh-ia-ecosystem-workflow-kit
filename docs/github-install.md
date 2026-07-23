# GitHub Install

This project is public and can be installed by users or automation directly from GitHub.

## Install with Bun from GitHub

Install with GitHub SSH URL:

```bash
bun add -g git+ssh://git@github.com/<owner>/fhh-ia-ecosystem-workflow-kit.git
```

Or use HTTPS with GitHub authentication already configured:

```bash
bun add -g github:<owner>/fhh-ia-ecosystem-workflow-kit
```

You can later refresh the toolkit binary and then update managed repos safely:

```bash
workflow-kit upgrade --apply --yes
workflow-kit update --target /path/to/repo --apply --yes
```

Alternative with npm remains supported:

```bash
npm install -g github:<owner>/fhh-ia-ecosystem-workflow-kit
```

Then run:

```bash
workflow-kit --help
workflow-kit init --target /path/to/repo --runtime codex
workflow-kit export --output /tmp/workflow-kit-export --runtime codex
```

## Access requirements

- The installing machine must have network access to GitHub.
- SSH installs require an SSH key with repository access.
- HTTPS installs require GitHub authentication/token configuration handled outside this tool.

## Publishing note

`package.json` intentionally remains `private: true`. That blocks accidental npm registry publication but does not prevent installing from a public GitHub repository.
