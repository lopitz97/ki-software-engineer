---
name: tests-to-implementation
description: Analyze failing unit or UI tests against the feature requirements, implement the smallest suitable production change, and verify the full configured test suite passes. Use for the green phase after requirements-based tests have been written; change tests only when demonstrably wrong.
---

# Tests to implementation

Implement the behavior specified by the requirements and failing tests. Keep the change small and consistent with the
application's architecture, preserving valid tests and existing behavior.

## Understand the failures

Read the supplied tests, their helpers and fixtures, recent failure output, and relevant production code. Read applicable
repository instructions, README, architecture documentation, and the actual build and test configuration. Preserve existing
working-tree changes, including untracked tests created in an earlier phase.

Recover the issue and its acceptance criteria from the active task. Use the available `load-requirements` skill when context
is missing. Read relevant issue clarifications and linked requirements; identify an unavailable source rather than inventing
its contents. Ask only about unresolved decisions that materially change the expected behavior, while continuing independent
work.

Map each failing scenario to its required observable outcome. Separate missing product behavior from incorrect tests,
pre-existing regressions, and environment or setup failures. Understand assertions beyond the first failure too: a missing
control may currently hide later checks for persistence, accessibility, or navigation.

Reproduce the relevant failures with the narrowest useful test command, unless a current run on the same working tree
already establishes them. A browser installation, startup, import, or compilation failure does not establish missing feature
behavior. Resolve routine setup problems within the authorized scope; report blockers that prevent meaningful execution.

## Implement the required behavior

Choose the smallest cohesive production change that satisfies the actual requirements. Reuse existing components,
dependencies, contracts, and styling conventions. Keep strict compiler checks, accessibility, responsive behavior, cleanup,
and existing error handling intact. Update affected documentation when responsibilities, routes, contracts, state, or setup
change, as required by the repository.

Minimal means no unrelated refactoring or speculative abstractions. It does not mean hardcoding fixture values, detecting
the test environment, implementing only the first assertion, or omitting requirement paths that the tests do not yet cover.
Implement real user behavior across the agreed scope. Keep mocks and test-specific behavior out of production code.

Work iteratively: implement a coherent part, rerun focused tests, inspect the next failure, and correct production behavior.
Do not expand the feature or introduce new tooling merely to make implementation easier.

## Preserve tests unless they are wrong

Keep supplied tests unchanged by default. A failing assertion, difficult implementation, or mismatch with the current code
is not evidence that a test is wrong.

Before editing a test, establish a concrete defect using the agreed requirements, a verified API contract, or reproducible
test-framework behavior. Examples include an expectation contradicting the issue, a fixture violating the verified API
contract, or an interaction that cannot correctly operate the required accessible control. A test may be too coupled to
markup when the implementation demonstrably satisfies the agreed behavior through a different valid structure.

For a justified correction, explain the defect and supporting evidence, then make the narrowest change that preserves or
improves coverage of the required behavior. Keep the original acceptance criterion intact and rerun the corrected scenario.
If the requirement itself is ambiguous, ask rather than silently redefining it to justify a test change.

Do not remove scenarios, weaken assertions, skip tests, add expected-failure annotations, increase retries or timeouts to
conceal failures, or alter fixtures simply to get a passing result. Add regression coverage only for a demonstrated gap in
required behavior; avoid tests that merely mirror the implementation.

## Verify completion

After the implementation is complete and focused tests pass:

1. Run the full configured application test suite, including existing regression tests and all configured browser projects.
   Run additional test configurations when the change or repository instructions require them. Do not describe a single
   browser or filtered run as the full suite.
2. Run the required production build, compiler checks, changed-file formatting checks, and `git diff --check`. Verify any
   documentation links added or changed. In this repository, `npm test` runs Playwright; no unit-test runner is configured.
3. Review the final diff for scope, accidental test changes, and requirement coverage. Passing tests do not prove an untested
   acceptance criterion is satisfied; identify any remaining validation gap.

When a check reveals a regression caused by this change, fix it and rerun the affected checks. After further production or
test corrections, rerun the full suite before making an all-tests-pass claim. Once checks pass with no subsequent changes,
do not repeat them without a new reason.

If environment restrictions or unrelated failures prevent a clean full run, report exactly what ran, what failed or was not
run, and why. Distinguish passing focused checks from an incomplete full verification; do not claim completion of the green
phase while required failures remain unresolved.

## Handoff

Summarize the behavior implemented, its relationship to the acceptance criteria, changed production files, and actual build
and test results. Disclose every test correction with its reason and evidence, or state that tests were unchanged. Identify
remaining requirements, pre-existing failures, environment blockers, and verification limits when present.

Implementation and local validation do not authorize committing, pushing, publishing, or closing the source issue unless
the user has requested those actions.
