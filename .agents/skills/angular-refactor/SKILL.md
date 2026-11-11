---
name: angular-refactor
description: Perform the refactoring phase after requirements, failing tests, and a passing Angular implementation. Improve the implemented feature only where concrete evidence justifies a change, following project standards and preserving acceptance criteria and passing tests. Also use for explicitly requested component refactoring reviews.
---

# Angular refactor

Improve Angular components only where the code demonstrates a useful reason to refactor. Preserve required behavior and
public contracts, follow the project's established design, and validate the result.

## Place in the development workflow

This skill is the refactoring phase of the feature workflow, followed by requirements finalization:

1. `clarify-feature`: clarify the goal, scope, constraints, user story, and acceptance criteria.
2. `issue-to-tests`: express those requirements as tests and verify the expected red phase.
3. `tests-to-implementation`: implement the required behavior and establish a passing test suite and production build.
4. `angular-refactor`: review the implemented feature for justified structural improvements while keeping behavior green.
5. `finalize-requirements`: reconcile the result with the original requirements, update the associated issue, and close it
   when the agreed work is complete and verified.

Use the requirements, acceptance-to-test mapping, changed production files, and validation results handed over from the
preceding phases. Keep this context in the active conversation; no additional tracking file is required. If context is
missing, recover it with `load-requirements` and inspect the actual working tree instead of restarting the earlier phases.

When invoked as the refactoring workflow phase, focus on the feature's implementation and directly affected components rather
than opening an unrelated application-wide cleanup. The requirement to review does not imply a requirement to change code:
if the implementation already meets project standards, a justified no-change result completes this phase.

Confirm a green baseline before structural changes. Reuse current results only when they apply to the same working tree and
required test scope; otherwise run the necessary checks. If feature tests are still red or acceptance criteria remain
unimplemented, identify that implementation gap first. Within an authorized end-to-end feature task, use
`tests-to-implementation` to resolve it before refactoring; for a refactoring-only request, report the gap and the needed
handoff without silently expanding scope. Environmental blockers do not establish a green baseline.

## Establish scope and standards

Identify the requested component or feature boundary. Read applicable `AGENTS.md` files, README, architecture documentation,
formatting and compiler configuration, and the installed Angular version. Inspect the component's class, template, styles,
callers, services, and relevant tests. Preserve existing working-tree changes.

Use explicit user requirements and project instructions to establish the intended behavior. If an issue defines the task
and its context is missing, use the available `load-requirements` skill. Do not turn the component's current implementation
into a requirement when other evidence contradicts it.

Distinguish documented conventions, patterns still used in current code, and outdated examples. Use official Angular
documentation when a proposed API or version-sensitive practice needs verification. General best practices inform a choice;
they do not automatically override the user's requirements or project architecture. Surface material conflicts rather than
silently performing a migration.

## Decide whether a change is warranted

Look for concrete problems within the requested scope, such as:

- Mixed responsibilities that make behavior difficult to understand, change, or test.
- Duplicated behavior that has diverged or creates repeated maintenance work.
- Unclear input/output contracts or state transitions that allow inconsistent results.
- Subscription, listener, timer, or asynchronous request handling that breaks component lifetime or ordering guarantees.
- Template structure, naming, or type safety that hides meaningful behavior or makes likely mistakes hard to detect.
- Accessibility or responsive behavior that would be affected by the proposed restructuring.

For each proposed change, identify the evidence, intended benefit, behavior to preserve, and appropriate validation. Keep
this explanation proportional to the change; an ordinary local refactoring does not need a separate planning document or
approval round.

A long file, personal syntax preference, or the availability of a newer Angular API is not sufficient evidence on its own.
If there is no worthwhile improvement, explain that conclusion and leave the code unchanged. Do not manufacture changes to
complete a checklist.

## Refactor proportionally

- Prefer the smallest cohesive change that addresses the observed problem. Keep feature-specific behavior within its
  feature, and extract shared functionality only when actual reuse or an independent responsibility justifies it.
- Keep presentation components focused on rendering and interaction. Follow established service boundaries for HTTP and
  domain operations. Do not add facades, stores, generic state frameworks, or dependencies merely to reorganize code.
- Keep state local unless the requirements establish shared ownership. Preserve explicit loading, success, empty,
  not-found, and error states where they exist.
- Preserve observable timing and ordering, including debounce, cancellation, retry, and cleanup. Tie subscriptions,
  listeners, and timers to their owner's lifetime; prevent superseded requests from replacing newer state.
- Preserve input/output names, types, defaults, requiredness, selectors, routes, API payloads, and DOM behavior used by
  consumers. If the requested refactoring includes a justified contract change, update its callers and validation together.
- Keep standalone template dependencies explicit where the project uses standalone components. Preserve strict TypeScript
  and template checking; do not hide errors with broader types, disabled checks, or unjustified non-null assertions.
- Follow the project's styling, template, forms, and state conventions. Adopting signals, `OnPush`, newer control flow, or
  different injection syntax requires a concrete benefit and compatibility with the component's behavior. Avoid blanket
  rewrites of established working patterns.
- Preserve semantic headings, accessible names, keyboard operation, visible focus, responsive layouts, and safe text
  rendering. A template extraction must retain these behaviors.

Separate a discovered behavior defect from a structural refactoring. Fix it within the user's authorized scope when the
intended behavior is clear, with focused regression coverage as appropriate. Otherwise report it and continue independent
refactoring; do not invent product behavior to resolve an ambiguity.

## Validate behavior preservation

Use focused tests during each refactoring step. After the final change in the feature workflow, run the production build,
the full configured application suite including all browser projects, and required repository checks. For a standalone
component review, run the affected suites and broaden to the full suite when shared components, global styling, providers,
routing, or cross-screen behavior are affected. If no code changed, current baseline results may be reused with their scope
stated explicitly.

Keep valid tests intact. Do not weaken assertions, remove scenarios, increase retries, or skip failures to accommodate a
regression. If a test depends on an internal structure intentionally changed by the refactoring, demonstrate that its
behavioral expectation is preserved and make only the necessary adaptation. Add tests for demonstrated coverage gaps, not
private method names or code that merely mirrors the implementation.

Format only changed files, run `git diff --check`, and review the final diff for unrelated edits. Update affected architecture
or setup documentation when responsibilities, data flow, contracts, or developer commands change. Verify changed local
documentation links. After further corrections, rerun the checks affected by them.

Treat missing browsers, unavailable runners, and startup failures as verification blockers rather than application failures.
Report what was actually run; do not claim a full suite passed based on a filtered run or a stale result.

## Handoff

Explain what changed and why it was necessary, how required behavior and contracts were preserved, and which checks passed
or remain blocked. Relate the final result to the original issue and acceptance criteria, and distinguish the changes made
in this phase from the preceding implementation. Disclose test adaptations and their evidence. If no refactoring was
justified, state that outcome with the relevant reasoning. Hand the acceptance status, refactoring outcome, and current
validation evidence to `finalize-requirements` when the requested workflow includes that final phase. Refactoring is complete
only when required behavior is preserved and the required checks are green; report remaining gaps explicitly. Issue updates
and completed-issue closure belong to the separately requested finalization phase. Committing or publishing code requires
a user request.
