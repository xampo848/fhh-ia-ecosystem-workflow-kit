# Triage And Special Rules

Part of [SKILL.md](../SKILL.md). Read it when the PR has many comments, or a comment comes from Sentry, a linter, or a human thread with prior decisions.

### 1.4 Triage For Many Comments

When the PR has many comments (for example 20 or 30 from a bot), classify all
of them first with Phase 2.0 and show one table: comment, verdict, severity,
evidence. Then:

- valid, partially valid, and doubtful comments follow the one-by-one loop;
- obsolete or incorrect **bot** comments may be answered as a batch, after the
  user approves the batch and its reply texts.

## Special Rules

### Sentry Comments

- Prioritize first
- Include severity (HIGH/MEDIUM/LOW)
- Use suggested fix as input, never as auto-apply

### Linter/Style Comments

- Confirm suggestion fits local conventions
- Keep as minor unless behavior is affected

### Human Reviewer Threads

- Read full thread context before proposing options
- Respect prior decisions in-thread

## Integrations

- `react-doctor` for meaningful React correctness/quality concerns
- Pattern docs only when the comment requires those domain specifics

## Definition of Done

- [ ] PR comments fetched and classified
- [ ] Every comment evaluated (Phase 2.0) with a justified verdict before options
- [ ] Reply texts approved by the user before posting; human threads left open on disagreement
- [ ] Initial summary shown to user
- [ ] One-by-one resolution followed
- [ ] Explicit user confirmation before each implementation
- [ ] Validation executed for logic changes
- [ ] Review thread closure attempted for each fixed comment
- [ ] Failures in closure/validation reported with reason
- [ ] Final summary delivered
