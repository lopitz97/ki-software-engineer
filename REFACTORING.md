# Refactoring review

Reviewed on 2026-11-09 against the current application, configuration, tests, [README](README.md), and [architecture guide](ARCHITECTURE.md).

The findings below record the original static review; line numbers describe that snapshot. The refactorings have now been implemented. See [ARCHITECTURE.md](ARCHITECTURE.md) for the current design and [README.md](README.md) for commands and deployment requirements.

## Implementation status

- Collection requests use a local cancellable stream, explicit states, and retry; timers and requests are disposed through one async pipe.
- Search controls have accessible names and focus styling.
- Navigation links explicitly participate in tab order, fixing the Windows WebKit keyboard regression found during validation.
- Cards and details share BookCoverComponent; list and details templates are external.
- Book input is required; the unused pageSize input was removed, retaining the API default of 10.
- An injected API base URL uses environment-specific development and production values.
- Collection regression coverage and shared mocks were added; default tests no longer visit external websites.
- npm test and test:e2e run Playwright; the incomplete Karma/Jasmine setup was removed.
- Confirmed unused state libraries, SSR/server dependencies, Material/animation setup, toast service, font links, unused fields, and stale comments were removed. Dependency declarations and lockfile were updated together.

The original recommendations and acceptance scenarios remain below as rationale. Constructors already contained no side effects and needed no change.

## Implementation validation

- Production build passed with an initial bundle of 331.93 kB, within the configured budgets.
- All 63 application browser checks passed across Chromium, Firefox, and WebKit.
- All 21 Chromium checks also passed using the production configuration and same-origin `/api/books` requests.
- Strict TypeScript checking of Playwright suites/configuration, Prettier, local documentation links, and `git diff --check` passed. Retained dependency versions were unchanged.

The standard browser installer stalled during archive extraction on this Windows environment. Validation used the matching official browser archives extracted with Windows `tar` into ignored `tmp/` directories and an ignored temporary Playwright configuration overriding executable paths. That configuration reused only the dedicated test servers started during this task; the committed configuration starts a fresh server and refuses reuse. Browser runs required execution outside the sandbox to allow Firefox startup and process cleanup. The original keyboard assertions were preserved.

These tests mock the backend. A live API and deployment reverse proxy were not exercised; production still requires the `/api` proxy or an appropriate configured base URL as described in README.

## Findings at a glance

| Priority                 | Finding                                                                   | Recommended direction                                               |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| High                     | Collection requests can overwrite newer results                           | One cancellable component-local request stream                      |
| High                     | Collection failures look like empty or successful results                 | Explicit loading, success, and error states with retry              |
| Medium                   | Search controls lack accessible names and a visible input focus indicator | Label the input and clear button; restore focus styling             |
| Medium                   | Cover behavior is duplicated and has already diverged                     | A book-specific cover component used by cards and details           |
| Medium                   | Browser tests omit collection behavior; unit setup is incomplete          | Focused collection regression suite and an intentional test command |
| Medium before deployment | API endpoint is tied to localhost                                         | Inject configuration into the existing API client                   |
| Low                      | Long inline templates mix screen markup with state logic                  | External templates and narrowly scoped extraction                   |
| Low                      | Component input contracts hide assumptions                                | Required book input; decide whether page size is reactive           |
| Low                      | Unused dependencies and scaffolding obscure the actual architecture       | Audit workshop requirements before removing unused pieces           |

## 1. Collection request ordering and lifetime

**Evidence:** [book-list.component.ts](src/app/books/book-list.component.ts), lines 94–118. Every `loadBooks()` creates an independent subscription. Search debouncing uses `searchTimeout: any`, and neither the timer nor active subscriptions are disposed when the component is destroyed. `clearSearch()` starts a request without cancelling the timer.

**Failure scenarios:** A slow request for query A can complete after query B and replace B's results. An older response can also set `loading = false` while the current request is still pending. Typing and immediately clearing produces an immediate unfiltered request followed by another unfiltered request when the timer fires, because the callback reads the now-empty `searchTerm`. Navigating away during the debounce can still start a request on the destroyed component.

HTTP requests normally complete, so this is primarily an ordering and lifetime problem rather than an indefinitely accumulating subscription leak.

**Proposed solution:** Use one local event stream for initial load, query changes, clear, and retry. Keep the API client stateless. Follow the details screen's `switchMap` and single async-pipe subscription pattern.

The operator ordering matters:

1. Emit the initial query immediately.
2. Emit query changes immediately into an outer `switchMap`, so each change cancels both the previous debounce and its request.
3. Inside that branch, wait 300 ms for typed queries, then request books. Initial load, clear, and retry bypass the delay.
4. Convert the request into screen states, catching errors inside the request branch so later searches still work.
5. Bind once with the async pipe, which owns teardown for the whole chain.

A plain `debounceTime(300)` followed by `switchMap` only cancels the previous request after the next debounced value arrives. Use the outer cancellation boundary above if results must remain aligned with the latest typed value during that interval. Keep draft input and the query associated with displayed results explicit; do not label old results using a newer draft query. Suppress redundant typed values, while allowing retry to reload an unchanged query.

**Acceptance checks:** Hold A's response, complete B, then release A; B must remain visible. Verify immediate clear makes one unfiltered request, typing then navigating away starts no delayed request, and superseded requests cannot end the current loading state.

## 2. Collection state cannot distinguish failure from empty results

**Evidence:** [book-list.component.ts](src/app/books/book-list.component.ts), lines 42–75 and 94–105. The error handler only logs and clears `loading`. `books` remains empty after an initial error, or retains a previous query's results after a later error.

**Impact:** An unavailable API looks like “No books available.” A failed search can show unrelated books without explaining the failure. Parallel mutable fields also require every callback to maintain the same invariants.

**Proposed solution:** Introduce a collection-specific discriminated union:

```ts
type CollectionState =
  | { status: 'loading'; query: string }
  | { status: 'success'; query: string; books: Book[] }
  | { status: 'error'; query: string };
```

Render empty results only for a successful response with an empty array. Render failures with an inline alert and retry for the failed query. Initially clear previous results while loading, matching the details screen; retaining results would require an explicit refreshing/error presentation. Keep state local instead of introducing a generic store or request-state framework.

**Acceptance checks:** Initial failure shows an error rather than an empty message; a failed search cannot appear successful; retry and a subsequent different search both recover. Cover empty success separately.

## 3. Collection accessibility is behind the details screen

**Evidence:** [book-list.component.ts](src/app/books/book-list.component.ts), lines 18–38. The input relies on placeholder text without an explicit label, removes its outline without a replacement focus treatment, and the icon-only clear button has no accessible name. Loading text has no live status semantics.

**Proposed solution:** Add an associated “Search books” label, which may use Tailwind's `sr-only` utility. Name the icon button “Clear search,” hide its decorative SVG from assistive technology, and provide visible `focus-visible` styling on interactive controls. Announce loading through `role="status"` and failures through `role="alert"`, consistent with details.

**Acceptance checks:** Locate controls by role and accessible name, operate search and clear by keyboard, and verify visible focus. The existing keyboard test starts by programmatically focusing an unnamed textbox, so it does not catch the missing label.

## 4. Repeated cover markup has produced inconsistent behavior

**Evidence:** [book-item.component.ts](src/app/books/book-item.component.ts), lines 14–23, and [book-details.component.ts](src/app/books/book-details.component.ts), lines 59–69 and 112–113. Both render a cover or placeholder. Only details handles image load failures, and its request pipeline also resets the presentation flag `coverFailed`.

**Impact:** A nonempty but broken cover URL displays a broken image in cards and a placeholder in details. Future fallback changes must be kept in sync across two implementations.

**Proposed solution:** Extract a standalone `BookCoverComponent` inside `books/`, with URL and alternative-text inputs. It owns image failure state, placeholder markup, and reset when the URL changes. Keep surrounding card/detail layout in the parent. The details loading branch destroys the success view, so retry can recreate the cover even when the URL is unchanged; preserve that behavior. Remove `coverFailed` from the details request pipeline once the child owns it.

**Acceptance checks:** Missing and broken URLs show the same fallback on both screens; replacing a failed URL with a valid one restores the image; route changes and retry do not retain a previous failure.

## 5. Test coverage does not protect the riskiest screen

**Evidence:** [book-details.spec.ts](tests/book-details.spec.ts) covers details thoroughly, including cancellation and retry. There is no collection-specific suite. `tests/example.spec.ts` (removed) tests an external website. [package.json](package.json) routes `npm test` to Karma, but the declared development dependencies omit Karma/Jasmine and `tsconfig.spec.json` (removed) references Jasmine types.

**Proposed solution:** Add `tests/book-list.spec.ts` with mocked API responses and controlled response gates for the scenarios in findings 1–3. Reuse fixture/mocking helpers only when the second application suite creates actual duplication. Remove or explicitly separate the external starter suite so default application checks do not depend on `playwright.dev`. Configure Playwright's `baseURL` to avoid repeating the frontend origin across suites.

Make a separate decision on the unit runner: complete the intended setup with real tests, or remove the misleading target and give browser tests an explicit npm command. Do not introduce a new runner solely for this review. Update README and ARCHITECTURE when changing commands or test setup.

**Acceptance checks:** Application tests run without the API or external websites; collection tests fail against the relevant current defects and pass after fixes. Preserve the existing details suite.

## 6. Localhost is embedded in data access

**Evidence:** [book-api-client.service.ts](src/app/books/book-api-client.service.ts), line 8, fixes the endpoint to `http://localhost:4730/books`.

**Impact:** A deployment still calls the visitor's own machine. Tests and alternate environments cannot supply an endpoint through Angular configuration.

**Proposed solution:** Provide a typed API base URL injection token in `app.config.ts`, retaining the current local default for workshop development. Select deployment values through the build configuration, or runtime configuration only if deployment requires one artifact across environments. Keep URL construction in `BookApiClient`.

Preserve `HttpParams`, `_limit`, `q`, and ID-filtered `GET /books?id=...`. The documented backend `/books/:isbn` contract means replacing this with `/books/<id>` would change behavior incorrectly. No live backend contract verification was performed for this review.

**Acceptance checks:** An alternate provider redirects both collection and detail requests; encoded IDs and missing-book behavior remain covered.

## 7. Inline templates make screen logic harder to scan

**Evidence:** The list inline template occupies lines 12–79 and details lines 25–97. Both combine layout, state branches, long utility classes, and presentation markup with the component's TypeScript.

**Assessment:** This is a readability concern, not evidence of a rendering performance defect. The details state switch and metadata definition list are cohesive and do not require separate components just because they contain several branches or rows.

**Proposed solution:** Move the list and details templates into adjacent HTML files. Extract the cover component because it shares behavior. Keep the search controls, loading state, and empty state local until independent complexity or reuse justifies another component. Repeated Tailwind utilities and a few headings alone do not justify a generic UI framework.

**Acceptance checks:** Existing behavior and accessible structure remain unchanged; strict template compilation and browser tests pass.

## 8. Inputs expose contracts that are not enforced

**Evidence:** [book-item.component.ts](src/app/books/book-item.component.ts), line 45, uses `@Input() book!: Book`, which suppresses TypeScript initialization checks without making the input required to consumers. [book-list.component.ts](src/app/books/book-list.component.ts), line 82, exposes `pageSize`, but changes to it after initialization do not trigger a reload.

**Proposed solution:** Declare the book input as `@Input({ required: true }) book!: Book`, preserving the existing decorator convention. For page size, decide whether callers need to change it: if yes, include changes in the request stream and validate a positive integer; if no, make it a local constant and let the API client's existing default remain the transport default. Current routing does not bind page size, so this is a future contract concern rather than a demonstrated current screen bug.

**Acceptance checks:** Missing required book bindings fail template compilation. If page size stays public, changing it reloads once and cancels the previous request.

## 9. Unused setup and small leftovers increase maintenance noise

**Evidence:** [package.json](package.json) includes NgRx, Angular Query, SSR, and Express packages that are not wired into the application. `ToastService` has no current consumer, while animation providers and snack-bar theme configuration remain. `App.title` is unused, the card contains an obsolete author comment, and the API client's comment claims title/author search semantics that the frontend simply delegates to the backend.

**Proposed solution:** Confirm which dependencies are intentional workshop material before removing them. Remove only confirmed unused dependencies, updating the lockfile together with declarations. Review notification service, theme, and animation setup as one change. Remove stale comments and unused fields when touching their files. Describe `q` as backend search rather than promising fields without verifying the API.

Installed packages are not proof of shipped bundle cost because unused code may be eliminated; measure build output before claiming performance savings.

## Patterns to preserve

- Constructors only inject dependencies; there are no constructor-triggered requests, subscriptions, or timers to move elsewhere.
- The details screen already uses cancellable requests, explicit states, retry, and one async-pipe subscription. Use it as the local reference rather than replacing it with a global store.
- The app shell, feature grouping, and API boundary are appropriately small. Keep HTTP out of presentation components.
- Keep abstract interpolation, line-break preservation, string prices without inferred currency, stable ID tracking, and strict compiler settings.
- Eager routes, mixed template control-flow syntax, and the absence of `OnPush` are not demonstrated defects at this scale. Change them when a measured problem or concrete requirement warrants it.

## Suggested implementation order

1. Fix collection cancellation, state, and accessibility together, adding focused browser regression coverage.
2. Extract the cover component and external templates, running collection and existing details coverage.
3. Configure the API endpoint before deployment and resolve input contracts before reusing these components.
4. Clean up test commands, scaffolding, and confirmed unused dependencies in separate focused changes.

For application changes, run the production build, relevant Playwright suites, and formatting checks. Update ARCHITECTURE for changed state flow, responsibilities, API configuration, or test setup; update README for changed developer commands. The implementation requires a production build and the application browser suites.

## Angular references

These references support the proposed mechanisms; the findings themselves come from this repository. The project remains on its declared Angular 20 toolchain.

- [HTTP request subscriptions and cancellation](https://angular.dev/guide/http/making-requests): HTTP observables send a request per subscription; unsubscription aborts an in-progress request.
- [AsyncPipe lifecycle](https://angular.dev/api/common/AsyncPipe): the pipe unsubscribes when its component is destroyed.
- [Required component inputs](https://angular.dev/guide/components/inputs): Angular supports required inputs, including decorator-based declarations.
