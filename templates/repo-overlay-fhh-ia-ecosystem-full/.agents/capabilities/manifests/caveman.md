# Capability manifest: caveman

## Identity

| Field | Value |
| --- | --- |
| `name` | `caveman` |
| `type` | Token-saving communication/helper capability |
| `source` | `https://github.com/JuliusBrussee/caveman` |
| `source_policy` | User-requested explicit GitHub source |
| `availability` | installable / repo-local skill mirror already present |
| `scope` | hybrid: global install per runtime, repo/project attach policy |
| `install_mode` | conditional: install only after explicit confirmation; attach-only if already available |
| `owner_layer` | repo-overlay capability manifest; external tool owns installer and runtime files |
| `status` | optional / attachable |

## Official-doc summary

The official README describes `caveman` as a skill/plugin for Claude Code and
many other coding agents, including Codex, Gemini, Cursor, Windsurf, Cline, and
Copilot. Its goal is output-token reduction while preserving technical accuracy.
The docs describe `/caveman`, `/caveman-commit`, `/caveman-review`,
`/caveman-stats`, `/caveman-compress`, `caveman-shrink`, and `cavecrew-*`
helpers.

The official install guide distinguishes runtime behavior:

- unified installer: official shell/PowerShell installer;
- preview: `--dry-run` before writing;
- per-agent install: e.g. Codex CLI through `npx skills add JuliusBrussee/caveman -a codex`;
- always-on rule files for some agents through `--with-init`;
- Copilot support as a soft-probe path with `--only copilot --with-init`;
- uninstall through the official installer, with some per-repo rule files removed manually.

Do not run install commands silently. Follow `.agents/integrations/README.md`.

## Attach points

| Attach point | Usage |
| --- | --- |
| `startup-discovery` | Detect whether runtime has caveman installed/available. |
| `workflow-routing` | Prefer token-saving posture for low-ambiguity tasks when active. |
| `skill-execution` | Use compressed responses only when quality/clarity are preserved. |
| `delegation` | Prefer `cavecrew-*`-style compressed handoffs for narrow helper/delegate work. |
| `documentation` | Record source, install mode, and activation rules. |
| `runtime-adapter` | Runtime wrappers may expose availability or init-rule metadata, but must point back to this manifest. |

## Activation rules

Use `caveman` only when all are true:

1. Runtime confirms it is installed/available or repo skill mirror is intentionally loaded.
2. It is attached to the neutral workflow through this registry/manifest.
3. Compression does not reduce correctness, safety, traceability, or user understanding.
4. The output is low-ambiguity enough for terse prose.

Prefer normal concise prose when:

- warning about security, destructive, or irreversible actions;
- giving ordered multi-step instructions where fragments could confuse order;
- explaining architecture trade-offs or nuanced product decisions;
- the user is confused, asks for clarification, or repeats a question;
- exact legal, financial, or safety wording matters.

Implementation note:

- during implementation, `caveman` is active only when compression still preserves
  phase boundaries, wait barriers, evidence, and stop conditions;
- prefer stronger compressed use in helper/delegate handoffs than in user-facing
  explanations.

## Replacement rule

`caveman` is the current preferred token-saving capability, not a core dependency.
To replace it, add another manifest and update `.agents/capabilities/registry.md`.
Do not edit `.agents/instructions.md` for a tool swap unless the generic
capability semantics change.
