---
name: pr-comments-resolution
description: Guide to resolve Pull Request comments in an orderly, step-by-step way, asking the user before implementing changes. Use it when asked to resolve or review PR comments.
---

# PR Comments Resolution

Guided, one-comment-at-a-time workflow to resolve Pull Request feedback safely.

## When To Use

- User asks to resolve PR comments/review comments
- User asks to process Copilot/Sentry/human review feedback
- User wants a guided workflow instead of bulk fixes

## Non-Negotiable Rules (Read First)

1. Start by loading PR context with `github-pull-request_activePullRequest`.
2. Never implement before user choice. Present options and stop.
2a. Never accept a comment by default, whether it comes from a human, Copilot, Sentry, or a linter. Evaluate it first (Phase 2.0) with `.agents/skills/01-product/shared/critical-stance.md` ("Evaluating external claims").
3. Resolve one unresolved comment at a time.
4. After each implemented fix, run relevant validation (tests/lint/check command).
5. After each validated fix, close the related PR review thread with `github-pull-request_resolveReviewThread`.
6. If thread closure fails (permission/thread id/already closed), report clearly and continue.
7. Use simple language: explain what is wrong, why it matters, and what will change.

## Execution Contract

- Prefer runtime-available editing tools; do not hardcode unavailable tool names.
- Prefer repo-standard validation commands when logic changes.
- If user asks only to review comments list, do not implement anything.

## Phase 0: Preconditions and Fallback

Before analysis, verify the PR context is available.

- If no active PR is found: ask user to open/select PR, then stop.
- If comments are inaccessible: explain permission/tooling blocker, then stop.
- If there are no unresolved comments: report clean status and offer final verification.

## Phase 1: Analyze and Prioritize

### 1.1 Fetch PR Comments

Always run:

```text
github-pull-request_activePullRequest
```

Collect:

- Unresolved and resolved comments
- Author (human/Copilot/Sentry)
- File path and line context
- CI/check status

### 1.2 Classify

Priority buckets:

- CRITICAL: security, data integrity, production risk, Sentry defects
- IMPORTANT: behavior-safe refactor, maintainability, correctness improvements
- MINOR: style/doc/naming with no behavior impact

Status buckets:

- Unresolved: process now
- Resolved: mention briefly, do not rework

### 1.3 Present Initial Summary

Provide a compact list of unresolved comments ordered by priority and ask to start with the first critical item.

## Phase 2: Resolve Each Comment (Loop)

Apply this loop for each unresolved comment.

### 2.0 Evaluate Before Explaining (mandatory)

For each comment, before presenting options:

1. Interpret the concrete technical claim.
2. Check it against the **current** code (the comment may refer to an old
   diff), the full thread, the PRD or contract, and the tests.
3. Classify it:
   - **valid**: the claim holds and should be fixed;
   - **partially valid**: part holds, part does not;
   - **obsolete**: already resolved, or the line changed;
   - **not applicable**: out of scope, or it contradicts a PRD decision;
   - **incorrect**: the claim is wrong.
4. Assign a severity and cite the evidence (file and line, test, document).

Symmetry rule: "incorrect" needs evidence as solid as a fix would need. Do not
reject a comment to save work, and do not accept one to avoid friction.

### 2.1 Explain the Comment

For each comment, present:

- File and location
- What the comment claims
- Verdict (valid, partially valid, obsolete, not applicable, incorrect) and its evidence
- Why it matters, and the risk if unchanged, when the verdict is valid or partially valid

### 2.2 Propose Options and Stop

Do not implement yet.

Option count policy:

- 2 options for low-risk style-only decisions
- 3 options for standard implementation decisions
- 4 options for high-impact decisions (security, migrations, data integrity)

Options depend on the verdict:

- **valid**: fix it (and optionally reply);
- **partially valid**: fix the valid part and reply to the rest;
- **obsolete**: reply citing the commit or change that resolved it;
- **not applicable**: reply with the grounds (for example, the PRD decision)
  and, when worthwhile, propose it as future scope;
- **incorrect**: reply with evidence; do not change code.

Always include:

- One conservative option
- One recommended option with rationale

Then stop and wait for user selection.

Replies are outward actions: show the exact reply text and wait for the user's
approval before posting it (templates in `reference/comment-response-templates.md`).

### 2.3 Implement User-Selected Option

After explicit user choice:

1. Read impacted files
2. Apply minimal change set
3. Confirm what changed

### 2.4 Validate

If behavior/logic changed, run targeted validation.

- If validation fails: fix, rerun, then continue only on pass or explicit user approval
- If validation is not applicable: state why

### 2.5 Close PR Thread

After code + validation success:

```text
github-pull-request_resolveReviewThread
```

For a verdict that changes no code, post the approved reply first. A bot thread
may then be closed. When you disagree with a **human** reviewer, reply but do
not close their thread: the reviewer resolves it.

If closure fails:

- Report exact reason (missing thread id, no permission, already resolved, tool error)
- Continue with next comment
- Include this partial result in final summary

### 2.6 Move to Next Comment

Proceed until all unresolved comments are handled.

## Phase 3: Final Summary

After all unresolved comments:

- List each comment with its verdict (valid, partially valid, obsolete, not applicable, incorrect), and what changed or what was replied
- List files modified
- List validation results (pass/fail/not-run + reason)
- List thread closure status (closed/failed reason)
- Ask whether to run a full-suite check

## References

Load a reference only when its condition holds:

- [reference/triage-and-special-rules.md](reference/triage-and-special-rules.md) — read it when the PR has many comments, or a comment comes from Sentry, a linter, or a human thread with prior decisions
- [reference/triage-and-special-rules.md](reference/triage-and-special-rules.md) — read it x

## Templates

Reusable response templates are moved to:

- `reference/comment-response-templates.md`

Load templates only when drafting the actual user-facing message for a comment.
