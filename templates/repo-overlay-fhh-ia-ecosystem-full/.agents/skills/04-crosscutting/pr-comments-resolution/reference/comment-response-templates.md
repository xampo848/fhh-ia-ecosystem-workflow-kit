# PR Comment Response Templates

Read it only when drafting the user-facing message or reply for a comment.

Use these templates only when you are drafting a concrete response for the current comment.

## Initial Pending Summary

```markdown
## Summary of Pending PR Comments

1. **[PRIORITY] [Title]**
   - File: [path/to/file]
   - Problem: [short explanation]
   - Author: [reviewer/copilot/sentry]

2. **[PRIORITY] [Title]**
   - File: [path/to/file]
   - Problem: [short explanation]
   - Author: [reviewer/copilot/sentry]

Would you like to start with comment 1?
```

## Per-Comment Explanation

```markdown
### Comment [N]: [Title]

**File:** [path/to/file]
**Claim:** [what the comment says]
**Verdict:** valid | partially valid | obsolete | not applicable | incorrect
**Evidence:** [file:line, test, PRD decision, or commit]
**Impact:** [why it matters, when valid or partially valid]
**Risk if unchanged:** [risk, when valid or partially valid]
```

## Grounded Replies (no code change)

Show the reply to the user and post it only after approval. Be respectful and
specific; cite evidence, not opinion.

```markdown
<!-- obsolete -->
Thanks for flagging this. It is already addressed in [commit/PR]: [what changed]. The line this comment points to no longer exists in the current diff.

<!-- not applicable -->
Thanks. This is intentional: [PRD decision or contract reference]. Changing it is outside this PR's scope; I can open a follow-up for [future scope] if you think it is worth it.

<!-- incorrect -->
I checked this against the current code: [file:line] does [actual behavior], and [test name] covers it. So [claim] does not hold here. Happy to look again if I am missing a case.

<!-- partially valid -->
Good catch on [valid part]: fixed in [commit]. On [the rest]: [evidence why it does not apply].
```

## Options (2/3/4 Model)

```markdown
How do you want to resolve this?

**A) [Conservative option]**
- Pros: [pros]
- Cons: [cons]

**B) [Recommended option]**
- Pros: [pros]
- Cons: [cons]
- Why recommended: [short reason]

**C) [Alternative option]**
- Pros: [pros]
- Cons: [cons]

What do you prefer?
```

## Critical Bug Variant

```markdown
### Comment [N]: [Critical Bug]

**Severity:** [HIGH/MEDIUM/LOW]
**File:** [path/to/file]
**Issue:** [what fails]
**Impact:** [production/data/security effect]

How do you want to resolve this?

**A)** [safer short-term path]
**B)** [recommended durable path]
**C)** [middle-ground path]

Which option should I implement?
```

## Resolution Confirmation

```markdown
Comment [N] resolved in code.

- Change applied: [summary]
- Files: [list]
- Validation: [command/result]
- PR thread: [closed or reason if not closed]
```

## Final Summary

```markdown
## Final Result

Resolved comments:

1. [title] - [what changed]
2. [title] - [what changed]
3. [title] - [what changed]

Files modified:
- [path] - [change]
- [path] - [change]

Validation:
- [check] [pass/fail/not-run] - [reason if needed]

Thread closure:
- [comment/thread] [closed/failed] - [reason if failed]

Would you like me to run a full validation pass now?
```
