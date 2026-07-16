# Private GitHub Install

This project can stay private and still be installed by users or automation that have access to the private GitHub repository.

## Install with npm from GitHub

After the private repository exists, install with an authenticated GitHub URL:

```bash
npm install -g git+ssh://git@github.com/<owner>/fhh-ia-ecosystem-workflow-kit.git
```

Or use HTTPS with GitHub authentication already configured:

```bash
npm install -g github:<owner>/fhh-ia-ecosystem-workflow-kit
```

Then run:

```bash
workflow-kit --help
workflow-kit init --target /path/to/repo --runtime codex --overlay starter
workflow-kit export --output /tmp/workflow-kit-export --runtime codex --overlay starter
```

## Private access requirements

- The installing machine must have access to the private repository.
- SSH installs require an SSH key with repository access.
- HTTPS installs require GitHub authentication/token configuration handled outside this tool.

## Publishing note

`package.json` intentionally remains `private: true`. That blocks accidental npm registry publication but does not prevent installing from a private Git repository when the user has access.
