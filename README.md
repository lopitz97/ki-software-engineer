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

The issue workflows must be on the default branch. The Codex workflows use the OpenAI API key currently stored in `ANTHROPIC_API_KEY`; despite the secret's name, its value must be an OpenAI API key. They configure a dedicated temporary Codex home and permission profile, use `drop-sudo`, and authenticate GitHub CLI through `GH_TOKEN` with the built-in GitHub token. No personal access token is required for reading issues or posting comments.

## Automatic issue implementation

The [implementation workflow](.github/workflows/issue-implementation.yml) runs exclusively on `issues: labeled` when `ready-for-implementation` is added. The analysis workflow does not explicitly start it. GitHub does not emit a follow-up workflow run for labels set with the built-in `GITHUB_TOKEN`; automatic label-based chaining therefore requires a GitHub App token or PAT for the labeling operation. A manually applied label also triggers implementation. The existing analysis authentication is unchanged.

The workflow prepares `feature/{number}-{sanitized-title}` and uses two jobs with a 15-minute timeout each. The Red job installs Node.js 22 and Playwright dependencies, then invokes `issue-to-tests` to write requirements-based tests and verify intended failures. The skill records an acceptance-to-test mapping and a structured status in `tmp/issue-red-report.md` and `tmp/issue-red-status.json`. The status lists executable `*.spec.ts` paths in `testFiles` and helper/fixture paths separately in `fixtureFiles`. CI accepts helpers in older `testFiles` reports as fixtures, verifies that every mapped file exists under `tests/`, and passes only executable specs to Playwright. CI independently reruns the mapped Chromium tests, captures their log and JSON results, and rejects invalid evidence, setup errors, skipped tests, non-test changes, and commits made during Red. Blocked requirements stop the workflow; an independently confirmed already-satisfied result skips Green.

Only a verified Red result starts the Green job. It checks out the exact starting commit and restores the tests, requirements mapping, and failure evidence from the Red artifact. `ci-se-green` implements and commits those tests and production changes without executing tests, builds, or linters itself. Subsequent CI steps run the production build, all Playwright projects, changed-file formatting, and `git diff --check`. The jobs use separate runners because the Codex Action's `drop-sudo` strategy cannot run twice in one Linux job. The Red network profile allows GitHub and loopback targets for focused browser tests.

The workflow uploads Red diagnostics and an implementation patch as artifacts retained for seven days. It currently does not push a branch or create a PR, merge, deploy, or close the issue. Existing remote feature branches are reused without force or reset. Open questions in the issue must still be answered before tests can define the intended behavior; assigning `ready-for-implementation` alone does not establish those answers.

## Automatic CI fixes

[Auto-fix](.github/workflows/auto-fix.yml) reacts to failed `Deploy to GitHub Pages` runs from branches in this
repository. It prepares an `auto-fix/{run-id}-{attempt}` branch at the failed commit. Codex repairs and commits the
changes and writes a Markdown explanation of the cause, changes, and validation. After an independent successful
`npm run build`, the workflow pushes the fix branch and opens a new PR targeting the failed build's source branch.
The PR includes the explanation, build result, failed-run link, and starting commit. It does not merge the PR.

No PR is created when there are no changes or the source branch has advanced. Uncommitted changes or a missing
explanation fail publication. Fork runs are excluded. The workflow must exist on the default branch, and repository
Settings > Actions > General > Workflow permissions must allow GitHub Actions to create and approve pull requests.

## Pull request review

The [PR-review workflow](.github/workflows/pr-review.yml) runs on `pull_request: opened` and `synchronize` for branches in this repository. It uses the same Codex Action setup as issue analysis, with `pull-requests: write` to post feedback. Codex reviews the exact PR head, reads the diff and applicable `AGENTS.md` instructions, and comments on code quality, bugs, performance, security, and test coverage. The review is static; it does not run PR code, change source files, approve, or merge. A newer push cancels an older review run. Fork and Dependabot PRs are skipped because this workflow requires the repository API-key secret and comment write access.

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
