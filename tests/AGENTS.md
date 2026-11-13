# Browser test instructions

These instructions supplement the [root instructions](../AGENTS.md) for `tests/`. Configuration lives in [playwright.config.ts](../playwright.config.ts).

## Test scope and execution

- Add BookMonkey browser coverage in `tests/`, the configured test directory. `tests-examples/` is outside the default run and contains external TodoMVC examples.
- All `*.spec.ts` files in `tests/` are application suites. The external TodoMVC example is outside the default test directory.
- Run a focused suite with `npx playwright test tests/book-details.spec.ts --project=chromium`. The current configuration runs Chromium only.
- Playwright starts a dedicated Angular server at `http://localhost:4202`, configures `baseURL`, and does not reuse an existing server. Use relative routes or the shared URLs in `tests/support/books.ts`.

## Reliable application coverage

- Mock API and cover requests before navigation using Playwright routing. Keep normal regression tests independent of the live Bookmonkey API and external assets.
- Write behavior scenarios with Playwright's native `test.step` through `given`, `when`, and `then` from `tests/support/bdd.ts`. Keep steps focused on setup/context, user actions, and observable outcomes; no Cucumber dependency or Gherkin parser is used.
- Use concise, behavior-focused scenario titles without Given / When / Then prefixes; those keywords belong only to the named steps inside the test. Parameterized titles must retain meaningful field, viewport, preference, or state values.
- Keep each action and its expected outcome in separate phases. Use additional When / Then pairs for retries, corrections, navigation, and reloads. Return setup values from `given` when later steps need them; keep response gates and browser contexts protected by `finally` cleanup.
- Use realistic fixtures matching the `Book` interface. Preserve the distinction between frontend ID routes and the backend's ID-filtered collection response (an array, even for one result).
- Keep mocks and fixtures isolated per test: the configuration enables fully parallel execution. Avoid shared mutable state and assumptions about test order.
- Prefer role, label, and accessible-name locators and observable user outcomes. Use Playwright's waiting assertions or controlled response promises rather than fixed sleeps.
- Cover relevant success and failure behavior: direct URLs/refresh, loading, empty or 404 results, errors and retry, navigation, and missing content. Preserve existing keyboard, literal-text rendering, encoded-ID, and responsive-layout checks when changing details.
- Do not weaken assertions or add retries to hide a failure. If a test cannot run because browsers or another prerequisite are missing, state that explicitly in the handoff.
