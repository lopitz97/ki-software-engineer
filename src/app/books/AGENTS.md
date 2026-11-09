# Book feature instructions

These instructions supplement the [root instructions](../../../AGENTS.md) for `src/app/books/`. See the [architecture guide](../../../ARCHITECTURE.md) for the full data flow.

## Responsibilities

- `BookListComponent` owns collection loading, search, and screen state. `BookDetailsComponent` owns route-driven detail loading and retry state.
- `BookItemComponent` renders its `book` input and links to details. Keep HTTP calls and collection state out of this presentation component.
- `BookApiClient` owns HTTP URLs, query parameters, and response selection. Components should use its typed methods rather than construct requests themselves.
- `Book` describes the backend response. Preserve its actual field types, including string IDs and string prices; do not infer a currency or change the contract to suit a template.

## Routing and API contract

- Frontend detail routes use `/books/:id`, with the model's `id`, not its ISBN. Keep direct navigation and refresh working without requiring a previously loaded list.
- The backend's `/books/:isbn` endpoint uses ISBN. The current `getBook(id)` intentionally requests `/books?id=<encoded ID>`, selects the exact ID match, and reports a missing match as HTTP 404. Do not replace this with `/books/<id>` without verifying and intentionally changing the API contract.
- Use `HttpParams` for query values. Collection requests use `_limit` and optional `q`; search semantics belong to the API.
- The API URL is currently centralized in `BookApiClient` and points to localhost. Do not duplicate that URL in components.

## State and presentation

- Preserve detail loading, success, not-found, error/retry, and back-navigation behavior. Keep not-found distinct from other request failures.
- Details currently use route parameters and retry events with `switchMap` and an async pipe. Preserve cancellation of superseded requests and subscription cleanup when changing that flow.
- When modifying collection search, account for pending debounce timers, request ordering, clear-search behavior, and component destruction. Do not copy its known cleanup limitations into new screens.
- Display abstracts as text and preserve line breaks. Keep missing/failed-cover fallbacks in details, optional text handling, keyboard navigation, and mobile layouts working.
- Update the matching tests in `tests/` when behavior changes. Run the production build and relevant Playwright coverage as described in the root instructions.
