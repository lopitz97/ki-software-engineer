<h1 align="center">Modern Angular Workshop</h1>

<p align="center">
  <img alt="workshops-de-logo-blue" src="docs/logo-workshops-de.png" width="120">
  <br>
  <em>The best way to start embracing AI for your all-day development tasks</em>
  <br>
</p>

<p align="center">
  <a href="https://workshops.de/seminare-schulungen-kurse/angular-ai-agent-driven-development" target="_blank"><strong>workshops.de</strong></a>
  <br>
</p>

## Architecture

BookMonkey is a standalone Angular application organized around a books feature, with component-local state and a dedicated HTTP API client. See [ARCHITECTURE.md](ARCHITECTURE.md) for the project structure, routing, data flow, styling, testing setup, and guidance for new developers.

## Local Development

| Command       | Description                                      |
| ------------- | ------------------------------------------------ |
| `npm install` | Installs the packages to develop the Angular app |
| `npm start`   | Starts the Angular app                           |

## Validation

Run `npm run build` for a production build. Install browser binaries once with `npx playwright install`, then run `npm test` (or `npm run test:e2e`) for Chromium, Firefox, and WebKit. Use `npm test -- --project=chromium` for a focused run. Tests start a dedicated frontend on port 4202 and mock the API; the backend does not need to run. No unit-test runner is configured.

On PowerShell, use `npm.cmd` / `npx.cmd` if execution policy blocks the script wrappers.

To test the production API configuration on port 4201 in PowerShell:

```powershell
$env:BOOKMONKEY_TEST_PRODUCTION = '1'
try { npm.cmd test -- --project=chromium } finally { Remove-Item Env:BOOKMONKEY_TEST_PRODUCTION }
```

## API configuration and deployment

Development uses `http://localhost:4730` from [environment.development.ts](src/environments/environment.development.ts). Production uses same-origin `/api` from [environment.ts](src/environments/environment.ts), supplied through the `BOOK_API_BASE_URL` injection token. Configure the production base URL before building, or provide a reverse proxy that maps `/api/books` to the backend's `/books` and strips the `/api` prefix. This repository does not implement that proxy. Cross-origin deployments require backend CORS configuration.

## The API

| Command              | Description                                       |
| -------------------- | ------------------------------------------------- |
| `npx bookmonkey-api` | Installs and starts the HTTP API "Bookmonkey API" |

The API provides fake data that you can use in your Angular application.

> [!NOTE]
> The API starts at http://localhost:4730.
> When you open this page, you’ll find documentation for all endpoints. 🚀

## VS Code

If you are using [VS Code](https://code.visualstudio.com/) as you editor of choice, you might see a popup after opening this repository.
We added a few plugin recommendations to simplify writing code during the workshop:

1. Angular Language Service - Adds better syntax-highlighting & automatic refactorings
1. Prettier - Formats your code automatically in the same way across your project.
