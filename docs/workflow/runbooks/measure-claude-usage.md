# Measure Claude Code token usage

`scripts/measure-claude-usage.mjs` (`npm run measure:usage`) reads local Claude
Code transcripts and reports consumption per agent type. Use it to record a
baseline before a workflow change that aims to save tokens, and to compare
after at least one week of use. Do not claim a saving without that comparison.

The script is a kit maintainer tool: it is not installed in target
repositories and is not part of `check:workflow`, because it depends on data
that only exists on one machine.

## Run

```bash
npm run measure:usage -- --project ../my-app --days 7
```

```bash
npm run measure:usage -- --project ../my-app --days 7 --json > usage-2026-11-20.json
```

| Option | Meaning |
| --- | --- |
| `--project <path>` | repository whose transcripts are measured; default: current directory |
| `--days <n>` | window counted back from now; default: 7 |
| `--json` | stable JSON summary (`schemaVersion: 1`) for comparing two dates |
| `--projects-root <dir>` | transcript root; default: `~/.claude/projects` |

## What it reads

- The project directory under `~/.claude/projects` (the path with every
  non-alphanumeric character replaced by `-`) and its worktrees
  (`<project>--…`, for example `.claude/worktrees/<name>`). A sibling
  repository whose name starts with the same text is excluded.
- `<session>.jsonl` is the main thread (`MAIN`). Each
  `<session>/subagents/agent-*.jsonl` takes its type from `agentType` in the
  matching `.meta.json`; without one it is `unknown-subagent`.
- Each assistant response counts once per `message.id`: transcripts repeat the
  same response once per content block. Responses with zero usage are ignored.

## What it reports

Per agent type: runs, requests, weighted cost share, cost mix (cache read,
cache write, output), share of cost spent above 150k of context, and medians of
initial context, peak context, and requests per run. Also: main-thread cost by
50k context bucket, cost share by model, compactions, and tool-result
characters per tool (a base64 image counts by its encoded length, which
overstates its tokens).

Weights live in `TOKEN_WEIGHTS`: input 1, cache read 0.1, cache write 1.25
(5 min) or 2 (1 h), output 5. They are relative proportions for comparing
shares, not billed USD.

## Privacy

Read-only. It never writes under `~/.claude`, never sends data off the machine,
and prints counts only: no prompt or tool-result content.
