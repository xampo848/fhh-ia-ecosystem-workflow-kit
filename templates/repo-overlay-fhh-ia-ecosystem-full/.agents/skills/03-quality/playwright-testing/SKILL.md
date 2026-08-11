---
name: playwright-testing
description: Guide for generating Playwright tests using the Playwright MCP tools. Use this when asked to create, generate, or write Playwright tests for the application.

---

# Playwright Test Generator

This skill enables automated generation of Playwright tests by exploring the application and creating robust test files.

## Trigger

Load when Playwright/E2E is explicitly requested, or by default for most user-facing navigable UI changes when tooling is available.

Examples:

- "crea tests e2e con Playwright"
- "valida este flujo crítico de UI con tests navegables"

## Must Read

- `.github/copilot-instructions.md`
- `.agents/instructions.md`
- `.agents/skills/00-router/workflow-router/SKILL.md`

## Applicability Gate (Required)

Run this gate before generating tests:

1. Confirm there is a navigable UI/web flow to validate (not backend-only work).
2. Determine whether this change falls in the default-required bucket: user-facing behavior/state transitions in a navigable UI flow.
3. Confirm Playwright tooling/runtime is available or can be used per current policy.
4. Allow skip only when one of these explicit exceptions applies and is documented in evidence:
  - backend-only task;
  - no navigable UI surface;
  - purely cosmetic/static UI edits with no behavior/state impact;
  - user explicitly constrains scope to non-E2E checks.
4. If conditions are not met, return:

```text
Status: not-applicable
Reason: No navigable UI surface or explicit documented exception for default E2E policy.
Next: inline review, contract checks, or stack-appropriate validation.
```

5. If E2E is required by default but tooling is unavailable, return:

```text
Status: blocked
Reason: Default E2E policy applies but Playwright/browser tooling is unavailable.
Next: Enable tooling or get explicit user waiver with risk acceptance.
```

## When to Use This Skill

- User asks to generate Playwright tests
- User requests E2E tests for a feature
- User wants to test a specific user flow
- User mentions "playwright test" or "E2E test"

## 🎯 Test Generation Protocol

### Core Principles

1. **Explore First, Code Later**: DO NOT generate test code based on the scenario alone
2. **Interactive Exploration**: DO run steps one by one using the tools provided by the Playwright MCP
3. **Best Practices**: Use Playwright's recommended patterns (role-based locators, auto-retrying assertions)
4. **Iterate to Success**: Execute tests and fix until they pass

### Exploration Workflow

When asked to explore a website or generate tests:

1. **Navigate** to the specified URL
2. **Explore** 1 key functionality of the site
3. **Close** the browser when finished
4. **Implement** a Playwright TypeScript test based on message history

### Test Structure Guidelines

Generated tests MUST follow these practices:

- ✅ Use `@playwright/test` framework
- ✅ Use **role-based locators** (e.g., `page.getByRole('button', { name: 'Submit' })`)
- ✅ Use **auto-retrying assertions** (e.g., `await expect(element).toBeVisible()`)
- ✅ **NO added timeouts** unless absolutely necessary (Playwright has built-in retries and auto-waiting)
- ✅ **Descriptive test titles** that explain what is being tested
- ✅ **Comments** explaining complex interactions
- ✅ Proper test structure with `test.describe` blocks when appropriate

### File Management

- Save generated test files in the `playwright/tests/` directory
- Use descriptive filenames (e.g., `login-flow.spec.ts`, `create-quotation.spec.ts`)
- Follow TypeScript conventions

### Port Configuration

**Important**: The application runs on different ports depending on the environment:

- **Development (local)**: `http://localhost:3002` (configured in `.env.development.local`)
- **Playwright tests (local)**: `http://localhost:3004` (configured in `playwright.config.js`)

When generating tests, tests automatically use the `PW_BASE_URL` environment variable or default to `http://localhost:3004/` as defined in the Playwright config.

### Execution & Iteration

1. Execute the test file after generation with `npx playwright test playwright/tests/your-test.spec.ts` (Playwright will start a Rails test server via the `webServer` configuration, using `RAILS_ENV=test` on port 3004 by default)
2. Do not start `rails s` manually for Playwright tests unless you are explicitly debugging with `reuseExistingServer: true` in `playwright.config.js`
3. When debugging with `reuseExistingServer: true`, start the Rails server in test mode on port 3004, for example: `RAILS_ENV=test bin/rails s -p 3004`
4. If tests fail, analyze the failure
5. Update the test based on actual application behavior
6. Repeat until all tests pass

### Example Test Pattern

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should perform specific action', async ({ page }) => {
    // Navigate to relative path (baseURL from playwright.config.js will be prepended)
    // In local development, this will become: http://localhost:3004/path/to/page
    await page.goto('/path/to/page');

    // Interact using role-based locators
    await page.getByRole('button', { name: 'Submit' }).click();

    // Assert with auto-retry
    await expect(page.getByRole('heading', { name: 'Success' })).toBeVisible();
  });
});
```

## 🚫 Anti-Patterns to Avoid

- ❌ Writing test code without exploring the application first
- ❌ Using CSS selectors or XPath instead of role-based locators
- ❌ Adding arbitrary `page.waitForTimeout()` calls
- ❌ Not running tests to verify they work
- ❌ Generating tests with no assertions
- ❌ Using hardcoded localhost:3002 URLs in tests (use relative paths instead)

## 🖥️ Local Environment Setup

To run Playwright tests locally with the correct port configuration:

```bash
# 1. Start the Rails development server (runs on port 3002)
rails s

# 2. In a separate terminal, start the test server on port 3004
# Option A: Using PORT environment variable
PORT=3004 rails s

# Option B: Using foreman/Procfile (if configured for test server)
# Add a new entry in Procfile.dev for test server if needed

# 3. Run Playwright tests (will connect to http://localhost:3004)
npx playwright test playwright/tests/your-test.spec.ts

# Or run all tests with UI mode for development
npx playwright test playwright/tests/ --ui
```

**Alternative**: You can also set the `PW_BASE_URL` environment variable to override the default port:

```bash
PW_BASE_URL=http://localhost:3000/ npx playwright test  # Uses port 3000 instead
```

## ✅ Success Criteria

A successfully generated test must:

1. Be based on actual application exploration
2. Use semantic locators (roles, labels, text)
3. Include meaningful assertions
4. Pass when executed
5. Be maintainable and readable

## Stop Conditions

- Task is backend-only or has no user-facing navigable UI.
- The user requested unit/integration testing only (no E2E objective).
- Playwright runtime is unavailable and cannot be enabled under current policy.
