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

## Issue analysis automation

The [issue-analysis workflow](.github/workflows/issue-analysis.yml) analyzes new or edited issues and human issue comments using `clarify-feature`. It maintains one analysis comment, identified by a hidden marker and author, and adds suitable labels, creating reusable labels when needed. Bot and pull-request comments are excluded. Existing labels are preserved except for `ready-for-implementation`: the skill sets it only after requirements are clear and the analysis comment is verified, and removes it if later discussion introduces material uncertainty.

Both workflows must be on the default branch. They use the OpenAI API key currently stored in `ANTHROPIC_API_KEY`; despite the secret's name, its value must be an OpenAI API key. They configure a dedicated temporary Codex home and permission profile, use `drop-sudo`, and authenticate GitHub CLI through `GH_TOKEN` with the built-in GitHub token. No personal access token is required.

## Automatic issue implementation

The [implementation workflow](.github/workflows/issue-implementation.yml) runs exclusively on `issues: labeled` when `ready-for-implementation` is added. The analysis workflow does not explicitly start it. GitHub does not emit a follow-up workflow run for labels set with the built-in `GITHUB_TOKEN`; automatic label-based chaining therefore requires a GitHub App token or PAT for the labeling operation. A manually applied label also triggers implementation. The existing analysis authentication is unchanged.

The workflow creates `feature/{number}-{sanitized-title}` from the default branch and invokes our `ci-se-green` skill through Codex. The skill implements and commits on that branch without running tests, builds, or linters. CI installs Node.js 22 and Playwright dependencies, captures a Chromium baseline in `tmp/ci-test-failures.log` for the skill, and then independently runs the production build, all Playwright projects, changed-file formatting, and `git diff --check` after implementation. Only passing CI checks permit a normal branch push and draft PR. The issue must still be open and ready before publication. The workflow does not merge, deploy, or close the issue. The job has a 15-minute timeout; larger changes may need a longer run.

Runs for the same issue are serialized. Existing local branch names cause branch creation to fail rather than overwriting work; remote pushes never use force. Publication reuses an existing PR for that branch. Codex's network profile permits `api.github.com` for reading issue context, and Git metadata is writable for commits. The later CI steps run outside the Codex sandbox. Repository settings under **Settings → Actions → General → Workflow permissions** must allow GitHub Actions to create pull requests.

`ci-se-green` expects existing failing tests and sufficient failure evidence. This workflow does not generate a red test phase. If the issue needs new tests or the baseline only reports an environment failure, the skill must report the missing prerequisite rather than invent failures or claim that the feature was verified.

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
