---
name: pr-comments-resolution
description: Guide to resolve Pull Request comments in an orderly, step-by-step way, asking the user before implementing changes. Use it when asked to resolve or review PR comments.
---

# PR Comments Resolution - Guided Comment Resolution

This skill explains how to resolve Pull Request comments in an orderly, interactive, and effective way, following a step-by-step process that keeps the user informed and supports collaborative decisions.

## When To Use This Skill

- The user asks to resolve PR comments
- The user mentions "PR comments" or "review comments"
- You are asked to review/fix code review feedback
- There are pending comments from Copilot, Sentry, or human reviewers
- The user wants to work through a PR in a guided way

## 🎯 Skill Philosophy

### Core Principles

1. **Guided and Collaborative**: Do not assume solutions, ask first
2. **Step by Step**: Resolve one comment at a time
3. **Prioritization**: Start with critical issues (bugs, data integrity)
4. **Transparency**: Explain what will be done before doing it
5. **Verification**: Run tests after each important change directly in the terminal.

### Language Clarity Add-on (Simple for Everyone + Tech)

Use simple, plain language that both non-technical and technical people can follow.

- Prefer short sentences and direct words
- Explain technical terms in one line when first used
- Keep the same technical precision, but avoid unnecessary complexity
- For each issue, describe:
   - What is wrong
   - Why it matters
   - What will be changed
- Avoid dense paragraphs; use clear bullets and small sections
- Keep examples practical and tied to the real file/comment context

Quick style guide:

- Instead of: "This introduces a potential regression in the validation flow due to a missing guard clause"
- Use: "There is a missing check. Without it, invalid data can pass and break the flow."

## 📋 Resolution Protocol

### Phase 1: Analysis and Organization

#### 1.1 Fetch PR Comments

**ALWAYS** start by running:

```
github-pull-request_activePullRequest
```

This tool provides:

- All comments (resolved and unresolved)
- PR context (title, description, changes)
- Status checks (tests, linters, etc.)
- Comments from Sentry, Copilot, and reviewers

#### 1.2 Classify Comments

Organize comments by:

**Priority:**

- 🔴 **CRITICAL**: Sentry bugs, data integrity, security
- 🟡 **IMPORTANT**: Suggested refactors, code improvements
- 🟢 **MINOR**: Style, documentation, optional suggestions

**Status:**

- ❌ **Unresolved**: Require attention
- ✅ **Resolved**: Already addressed (briefly mention to the user)

#### 1.3 Present Summary to the User

Show a structured summary:

```markdown
## 📋 Summary of Pending Comments:

1. **🔴 CRITICAL - [Descriptive title]**
   - File: `path/to/file.rb`
   - Problem: [Short description, clear and easy to understand]
   - Author: [francisco/sentry/copilot]

2. **🟡 [Descriptive title]**
   - File: `path/to/file.rb`
   - Suggestion: [Short description, clear and easy to understand]

---

## 🎯 Let’s start with the first one (the most critical):
```

### Phase 2: Guided Resolution (Per Comment)

For EACH comment, follow this process:

#### 2.1 Present the Problem

```markdown
### **Comment X: [Title]**

**File:** [path/to/file.rb](path/to/file.rb)

**Problem:** [Clear explanation of the detected issue, easy to understand for a non-expert person, while keeping technical precision]

**Context:** [Why it matters, what can happen if it is not fixed]
```

#### 2.2 Propose Options (DO NOT Implement Yet)

**NEVER** implement directly without confirming with the user.

Present options using this criterion:

- 2 options for low-risk/style-only decisions (minor wording, formatting, RuboCop-only)
- 3 options for standard code decisions (most refactors and behavior-preserving changes)
- 4 options only for high-impact decisions (data integrity, migrations, architecture, security)

Always include:

- One conservative option
- One recommended option (with rationale)

Present options as:

```markdown
**Question:** How do you want to resolve this?

**A)** [Conservative/simple option]

- ✅ Pros: [advantages]
- ❌ Cons: [downsides]

**B)** [Recommended/ideal option]

- ✅ Pros: [advantages]
- ❌ Cons: [downsides]

**C)** [Alternative option, if applicable]

- ✅ Pros: [advantages]
- ❌ Cons: [downsides]

What do you prefer, or do you have another idea? 🤔
```

**IMPORTANT**:

- You may use emojis whenever they improve readability
- DO NOT use emojis in code or technical explanations
- Keep a professional but friendly tone
- Mark one option as recommended if it is clearly best, but always leave the final decision to the user, and explain why it is recommended.

#### 2.3 Wait for User Response

🛑 **STOP here**. Do not continue until the user chooses.

#### 2.4 Implement the Chosen Solution

Once the user responds (e.g., "B" or "option B"):

1. **Read relevant files** if needed
2. **Implement changes** using the appropriate tools:
   - `replace_string_in_file` para ediciones simples
   - `multi_replace_string_in_file` para múltiples cambios relacionados
3. **Confirm the change** briefly:

```markdown
✅ **Comment X resolved**. [Brief description of what was done]
```

#### 2.5 Verify with Tests (If Applicable)

If the change affects logic:

```
Running tests to verify...
```

Use `runTests` with relevant files.

If they fail:

- Fix immediately
- Re-run tests
- Continue only when they pass

#### 2.6 Move to the Next One

```markdown
---
## 🎯 Next comment:

### **Comment Y: [Title]**
...
```

Repeat Phase 2 for each comment.

### Phase 2.7: Mark the Resolved Comment as Closed in GitHub

After implementing and validating each resolved comment, also close its review thread in the PR.

1. Ensure the comment is actually fixed in code
2. Resolve the thread in GitHub using:

```
github-pull-request_resolveReviewThread
```

3. Confirm closure to the user, for example:

```markdown
✅ **Comment X resolved in code and closed in GitHub thread.**
```

If the thread cannot be closed (permissions, already resolved, or missing thread id), report it clearly and continue with the next comment.

### Phase 3: Final Summary

After finishing ALL comments:

```markdown
---

## 🎉 Final Result:

All PR comments have been resolved:

1. ✅ **[Comment title 1]** - [What was done]
2. ✅ **[Comment title 2]** - [What was done]
3. ✅ **[Comment title 3]** - [What was done]

### 📊 Changes Applied:

- [Modified file 1] - [What changed]
- [Modified file 2] - [What changed]

### ✅ Tests:

- [x] Model tests passing
- [x] Controller tests passing
- [x] [Component] tests passing

Do you want me to run all tests to confirm everything works correctly? 🤔
```

## 🚦 Special Rules

### Sentry Comments

Sentry comments usually identify critical bugs:

- **ALWAYS prioritize first**
- Include "Severity: HIGH/MEDIUM/LOW" in the presentation
- Read the "Suggested Fix" but DO NOT implement it automatically
- Propose options based on the suggestion but adapted to the context

### RuboCop/Linter Comments

- Verify the suggestion is valid in context
- If it is style-only, mention it is minor
- If it affects behavior, explain why

### Human Reviewer Comments

- Read the full discussion thread
- If there is a conversation between reviewers, include that context
- Respect decisions already made in the thread

### Resolved Comments

- Briefly mention: "This comment was already resolved: [short description]"
- Do not spend time on comments already addressed
- Focus only on unresolved comments

## 📝 Question Templates

### For Critical Bugs

```markdown
### **Comment X: [Critical Bug]**

**🔴 CRITICAL - [Description]**

**File:** [file.rb](file.rb#LX)

**Problem:** [What is wrong and what can happen]

**Question:** How do you want to resolve this critical bug?

**A)** [Safest/most conservative option]

**B)** [Ideal but more complex option]

**C)** [Middle-ground option]

Which one do you prefer? 🤔
```

### For Refactors

```markdown
### **Comment X: [Suggested Refactor]**

**File:** [file.rb](file.rb)

**Suggestion from [author]:** [What the reviewer suggests]

**Question:** Do you want to apply this refactor?

**A)** Yes, apply the full suggestion

**B)** Apply a simplified version: [description]

**C)** Keep as is, add a comment with justification

What do you prefer? 🤔
```

### For Validations/Migrations

```markdown
### **Comment X: [Data Integrity Issue]**

**Problem:** [Issue with data/validations]

**Question:** How should we handle existing data?

**A)** Data migration + strict validation

**B)** Frontend validation only, flexible backend (legacy-compatible)

**C)** Conditional validation (new records only)

**D)** Check DB first and decide based on real data

What do you prefer? 🤔
```

## ✅ Skill Checklist

When using this skill, ensure:

- [ ] Run `github-pull-request_activePullRequest` first
- [ ] Classify comments by priority (🔴🟡🟢)
- [ ] Present an organized summary at the start
- [ ] Resolve one comment at a time
- [ ] ALWAYS ask before implementing
- [ ] Propose options using the 2/3/4-option criterion
- [ ] Wait for user response
- [ ] Implement only what was chosen
- [ ] Verify with tests when applicable
- [ ] Confirm resolution with ✅
- [ ] Resolve the corresponding GitHub review thread after each fixed comment
- [ ] Move to the next comment
- [ ] Provide a final summary at the end

## ➕ Supplemental Checklist (Do Not Replace Original)

- [ ] Use simple language understandable by non-technical and technical stakeholders
- [ ] Explain each issue with: what, why, and change
- [ ] Keep technical accuracy while minimizing jargon
- [ ] For every fixed comment, close its PR review thread in GitHub

## 🎓 Usage Examples

### Example 1: User asks to resolve comments

**User:** "I want to resolve PR comments"

**Copilot:**

1. Runs `github-pull-request_activePullRequest`
2. Analyzes and classifies comments
3. Presents an organized summary
4. Starts with the first critical comment
5. Asks options, waits for response
6. Implements, verifies, and proceeds

### Example 2: User asks for a guided flow

**User:** "Help me resolve PR comments in a guided way"

**Copilot:**

1. Same process as Example 1
2. Emphasizes explaining each step
3. Asks even for minor decisions
4. Educational and detailed

### Example 3: User wants to review comments first

**User:** "Show me what comments exist in the PR"

**Copilot:**

1. Runs `github-pull-request_activePullRequest`
2. Presents only the organized summary
3. Does NOT implement anything
4. Asks: "Do you want us to start resolving them one by one?"

## 🔗 Integration with Other Skills

This skill works well with:

- **docs/patterns/frontend/formik-forms.md**: If comments touch forms or frontend validations
- **docs/patterns/backend/service-object-pattern.md**: If feedback asks to move controller logic into services
- **react-doctor**: If the review touches React correctness/quality

## 📚 References

- GitHub PR Review Best Practices
- Project Copilot instructions
- Team testing guidelines
- Project SOLID principles
