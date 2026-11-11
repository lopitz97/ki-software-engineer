---
name: finalize-requirements
description: Finish the requirements-to-tests-to-implementation-to-refactoring workflow by reconciling delivered behavior with the original requirements, updating the GitHub issue with implementation and validation evidence, and closing the issue when the agreed work is complete and verified.
---

# Finalize requirements

Perform the final requirements reconciliation and update the associated issue accurately. Preserve the original request and
make the delivered behavior, evidence, and remaining work visible.

## Place in the workflow

This skill follows `clarify-feature`, `issue-to-tests`, `tests-to-implementation`, and `angular-refactor`. Consume the agreed
requirements, acceptance-to-test mapping, implementation and refactoring summaries, and actual validation results. A
no-change refactoring result is a valid input.

An explicit request to use this skill for an identified issue authorizes preparing the finalization report. Show the
concrete preview below and obtain confirmation before updating or closing the issue. Creating or editing the skill itself
does not authorize an issue update or closure. Respect a request for a draft, read-only review, or keeping the issue open.
Do not infer permission to reopen issues, modify labels or assignees, create follow-up issues, commit or push code, merge,
or deploy.

## Recover the original requirements and final state

Read the intended repository and issue, including the current body, relevant comments, linked specifications, and agreed user
clarifications. Use the available `load-requirements` skill when context is missing. Do not choose an arbitrary issue when
the task-to-issue connection is ambiguous.

Recover the original requirements from the earlier workflow context or available issue history, and distinguish later agreed
scope changes. If the original baseline is unavailable, state that limitation and identify which version was reviewed.
Preserve the distinction between agreed requirements, inferred expectations, and proposed technical approaches.

Inspect the actual final source, tests, relevant documentation, and repository state. Check that handed-over validation
results apply to the current code and the claimed test scope. Reuse current, applicable results; rerun checks only when
changes, missing evidence, or uncertainty justify it. Never infer passing tests from their mere existence.

## Reconcile each acceptance criterion

For each original acceptance criterion, record:

- The agreed expected behavior, including any explicit later clarification.
- The relevant implementation and test evidence, with useful file, commit, or pull-request references when available.
- Status: implemented and verified, implemented but not fully verified, not implemented, or changed/deferred by explicit
  agreement.
- Any unmet part, discrepancy, limitation, or next action.

Compare behavior beyond the happy path and assertions currently reached by the tests. Passing tests alone do not establish
untested accessibility, visual, integration, or deployment requirements. Distinguish a missing implementation from missing
verification. An environment failure is not proof that the feature is broken or complete.

Do not rewrite requirements to match the code, silently remove unmet criteria, or treat a proposal as an approved scope
change. If a material contradiction remains, ask the focused question needed to resolve it and continue independent review.
Report implementation gaps and hand them back to the relevant earlier phase; finalization does not itself change production
code or weaken tests.

## Prepare the issue update

Compose a concise report that a reader can understand without this conversation:

1. Implementation summary: what users can now do and the main changes that deliver it.
2. Acceptance status: the criterion-by-criterion reconciliation, using a table when useful.
3. Validation: commands actually run, outcomes, browser or configuration scope, and material limitations.
4. Remaining work: unresolved requirements, missing verification, and agreed deviations. State when no known implementation
   gap was found without implying that every possible quality property was audited.

Distinguish local implementation, committed changes, and published pull requests or deployments. Do not invent remote links
for local-only files or imply that an issue update publishes the code. Mention refactoring only when its outcome helps
explain the final implementation; a no-change review may be summarized briefly.

## Preview changes before execution

Prepare the complete proposed issue body locally before requesting confirmation. Show the user:

- The target repository, issue number, and issue link.
- The exact proposed text changes as a diff or clearly identified before-and-after sections, including the complete new
  implementation report. A summary alone is insufficient.
- The planned status action: close as completed, leave open, or keep the existing closed state, with a brief reason.

Do not update the issue body, post a comment, or close the issue while preparing the preview. If neither the report nor the
status needs a change, explain that no write is needed.

Ask the user to confirm the displayed changes and wait before executing them. Explain that this skill requires confirmation
of the preview before mutating the issue. Prior permission to run finalization does not replace confirmation of the concrete
preview; confirmation already given for that same preview remains valid. If the user requests revisions, update the preview
before seeking confirmation again.

## Update the associated issue

Use an available connected GitHub tool, otherwise authenticated GitHub CLI access. For multiline CLI updates, write the
exact body to a temporary UTF-8 file and use `--body-file` rather than constructing a shell command from issue text.

Preserve the existing issue title, original story, acceptance criteria, and all unrelated content. Append an
`Implementation status` section delimited by these markers, or replace only that section if it already exists:

```markdown
<!-- finalize-requirements:start -->

## Implementation status

The prepared implementation summary, acceptance status, validation evidence, and remaining work go here.

<!-- finalize-requirements:end -->
```

Treat this as a maintained report, not a new comment on every invocation. If the existing report already matches the
verified state, avoid an unnecessary write. If markers are malformed or duplicated, inspect the existing content and resolve
the ambiguity before replacing anything.

After confirmation, read the latest issue body immediately before editing and merge the approved report into that version.
If requirements or competing edits changed since review, reassess the affected content before writing; if this changes the
proposed report or status action, show a revised preview and obtain confirmation again. Preserve unrelated concurrent edits
without requiring confirmation of unchanged proposed changes. Use conditional updates when supported. Do not overwrite
unrelated changes from another contributor. After a timeout or uncertain write result, read the issue before retrying to
avoid duplicate or conflicting updates.

Read the issue back after the write to verify that the report is present and original requirements remain intact. Do not
claim publication without a confirmed result. If authentication or permissions block the update, retain the prepared text,
explain the specific blocker, and identify the action needed to finish.

## Close completed issues

After publishing and verifying the finalization report, close the issue as completed only when closure was included in the
confirmed preview and:

- Every acceptance criterion in the agreed final scope is fulfilled and supported by adequate, current evidence.
- Required build and test checks have passed, with no unresolved failure or material verification gap affecting acceptance.
- No implementation blocker or unresolved scope contradiction remains.

An explicitly agreed scope change may remove or defer work, but preserve the original requirement and the agreement in the
report. Optional improvements or audits that were never required do not prevent closure. Do not introduce new completion
requirements during finalization. Conversely, a known unverified part of an actual acceptance criterion must not be silently
treated as optional just to close the issue.

Refresh the issue before closing to check that no new requirements or blocking discussion invalidate the completion
assessment. Use the connector's completed closure action or `gh issue close NUMBER --repo OWNER/REPO --reason completed`.
Keep the report consistent with the outcome; do not leave a statement that the issue will remain open when closing it.

Read the issue back and confirm its closed state before reporting successful closure. If it is already closed, do not
repeat the close action. If closure returns an uncertain result, read the current state before retrying. If the assessment
finds outstanding work, leave an open issue open and explain the gaps in the report. Do not automatically reopen an already
closed issue. If the report update succeeds but closure is blocked, report those two outcomes separately.

## Handoff

Link the updated issue and summarize its completion status and any remaining gaps. Identify blockers separately from
completed work. State whether closure was verified or why the issue remains open. Report partial finalization honestly when
the review, publication, or required closure could not be completed.
