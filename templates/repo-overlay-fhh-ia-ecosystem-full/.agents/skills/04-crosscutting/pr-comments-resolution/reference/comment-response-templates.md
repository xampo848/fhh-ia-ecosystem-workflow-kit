# PR Comment Response Templates

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
**Issue:** [what is wrong]
**Impact:** [why it matters]
**Risk if unchanged:** [risk]
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
