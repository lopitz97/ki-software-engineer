# Project instructions

## Scope and starting points

These instructions apply throughout the repository. More specific `AGENTS.md` files add instructions for their directory and descendants:

- [Book feature instructions](src/app/books/AGENTS.md)
- [Browser test instructions](tests/AGENTS.md)

Before changing the application, read [README.md](README.md) for setup and [ARCHITECTURE.md](ARCHITECTURE.md) for structure, data flow, and current limitations. Check the relevant source and configuration as well; if behavior has changed, update the affected documentation to match.

## Architecture and change scope

- This is BookMonkey, a single Angular 21 standalone browser application for an Angular workshop. The Bookmonkey API runs separately and is not implemented here.
- Keep the root `App` focused on the persistent layout and router outlet. Put routes in `src/app/app.routes.ts` and application-wide providers in `src/app/app.config.ts`. Keep the wildcard route last.
- Group domain-specific components, models, and services by feature. Use `src/app/shared/` for functionality actually reused across features; keep book-specific behavior in `books/`.
- Use standalone components with explicit template dependencies. Preserve strict TypeScript and Angular template checks; do not weaken compiler settings to bypass an error.
- Keep state local unless a requirement calls for shared state. NgRx, Angular Query, SSR, and Express are installed but not wired into the current app; do not introduce them merely because they are available.
- Keep changes focused on the requested behavior. Avoid unrelated migrations, dependency upgrades, formatting changes, or extra abstraction layers. Preserve existing work in the working tree.
- Do not edit generated content in `node_modules/`, `.angular/`, build output, or Playwright reports. Change dependency declarations and the lockfile together only when a dependency change is needed.

## UI and code conventions

- Follow `.prettierrc`: two spaces, single quotes, semicolons, no trailing commas, and a 120-character print width. Format only the files you change.
- Use Tailwind utilities for application styling. Global Tailwind styles live in `src/styles.css`; Material overrides live in `src/material-theme.scss`.
- Match the surrounding component conventions. Both older structural directives and built-in template control flow exist; a feature change does not require rewriting unrelated templates.
- Provide semantic headings, accessible names, keyboard-operable links and buttons, visible focus indicators, and meaningful image alternatives. Preserve responsive layouts.
- Render API text through Angular bindings. Do not introduce raw HTML rendering for book content. Handle asynchronous loading, empty/not-found, and error states as appropriate to the screen.
- Keep subscriptions and timers tied to component lifetime, and prevent stale requests from overwriting newer state when changing asynchronous flows. The collection's existing search limitations are documented in `ARCHITECTURE.md`.

## Development commands

Run commands from the repository root:

| Command                                                             | Purpose                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm install`                                                       | Install dependencies when needed                                                |
| `npm start`                                                         | Start Angular at `http://localhost:4200`                                        |
| `npx bookmonkey-api`                                                | Start the separate API at `http://localhost:4730` for manual integration checks |
| `npm run build`                                                     | Run the production build and configured bundle budgets                          |
| `npx playwright test tests/book-details.spec.ts --project=chromium` | Run a focused browser suite                                                     |
| `npx prettier --check <changed-files>`                              | Check formatting for explicit changed file paths                                |

On Windows PowerShell, use `npm.cmd` or `npx.cmd` if script execution policy blocks the `.ps1` wrappers. Do not change machine execution policy to run these commands.

## Validation and handoff

- For application or build configuration changes, run `npm run build`. Run the relevant Playwright tests for changes to behavior covered by them; add focused regression coverage for new behavior or bug fixes.
- Browser suites mock backend responses. Playwright starts a dedicated frontend server on port 4202; it does not start the API. The current configuration runs Chromium. Browser binaries must be installed separately if missing.
- Use the Playwright-native `given` / `when` / `then` helpers in `tests/support/bdd.ts` for behavior-driven scenarios. There is no Angular unit-test runner; see `ARCHITECTURE.md` for the testing scope and limitations.
- For documentation-only changes, check formatting, local links, and `git diff --check`; an application build is unnecessary.
- Update `ARCHITECTURE.md` when changing routes, responsibilities, API contracts, state management, or test setup. Update `README.md` when setup or developer commands change. Keep detailed design explanations in those documents rather than duplicating them here.
- Report what changed, which checks ran and their results, and any material limitations or checks you could not run.
