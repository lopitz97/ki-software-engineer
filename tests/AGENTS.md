# Browser test instructions

These instructions supplement the [root instructions](../AGENTS.md) for `tests/`. Configuration lives in [playwright.config.ts](../playwright.config.ts).

## Test scope and execution

- Add BookMonkey browser coverage in `tests/`, the configured test directory. `tests-examples/` is outside the default run and contains external TodoMVC examples.
- `book-details.spec.ts` is the current application-specific suite. `example.spec.ts` tests `playwright.dev` and is starter content, not application regression coverage.
- Run a focused suite with `npx playwright test tests/book-details.spec.ts`. For a quick Chromium check, append `--project=chromium`; report that narrower scope. The configured full run covers Chromium, Firefox, and WebKit.
- Playwright starts or reuses the Angular server at `http://localhost:4200`. No `baseURL` is configured, so use explicit application URLs unless intentionally updating the configuration.

## Reliable application coverage

- Mock API and cover requests before navigation using Playwright routing, following the existing details suite. Keep normal regression tests independent of the live Bookmonkey API and external assets.
- Use realistic fixtures matching the `Book` interface. Preserve the distinction between frontend ID routes and the backend's ID-filtered collection response (an array, even for one result).
- Keep mocks and fixtures isolated per test: the configuration enables fully parallel execution. Avoid shared mutable state and assumptions about test order.
- Prefer role, label, and accessible-name locators and observable user outcomes. Use Playwright's waiting assertions or controlled response promises rather than fixed sleeps.
- Cover relevant success and failure behavior: direct URLs/refresh, loading, empty or 404 results, errors and retry, navigation, and missing content. Preserve existing keyboard, literal-text rendering, encoded-ID, and responsive-layout checks when changing details.
- Do not weaken assertions or add retries to hide a failure. If a test cannot run because browsers or another prerequisite are missing, state that explicitly in the handoff.
