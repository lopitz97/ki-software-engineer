---
name: clarify-feature
description: Guide a user from a feature idea to clear requirements through focused questions about the goal, constraints, and scope, then produce a user story with Given/When/Then acceptance criteria and technical notes. Use for feature discovery and requirements clarification before implementation.
---

# Clarify feature

Help the user define a feature that is clear enough to implement and verify. Produce a user story, behavioral acceptance
criteria, and technical notes once material questions are resolved.

## Understand the feature

Start with the conversation and any requirements, issue, or documents the user supplies. Reuse answers already given. If an
existing issue defines the feature, recover its context before asking the user to repeat it. Read relevant repository
instructions and source when technical facts matter and access is available; distinguish existing behavior from desired
behavior. An existing implementation does not establish the intended requirements.

Identify what is known and what remains unclear about:

- The intended user, their problem, and the outcome or value the feature should provide.
- The main workflow: trigger, starting conditions, actions, and observable result.
- Scope boundaries: what is included, excluded, and deferred.
- Constraints that affect the feature, such as compatibility, accessibility, permissions, data handling, integrations,
  performance targets, or delivery constraints.
- Relevant alternate paths, failures, empty states, and recovery behavior.

Use these topics to find meaningful gaps, not as a questionnaire every feature must complete. Ask about an edge case or
quality target only when it changes the intended behavior or how success will be verified. Avoid inventing numeric targets,
business rules, or architectural restrictions.

## Clarify interactively

Ask the most consequential unanswered questions first. Prefer a small round, usually one to three related questions, with
concrete wording and suggested choices when useful. Explain a tradeoff briefly when the user needs it to decide. Let the
user describe an alternative.

Use an available question tool when suitable; otherwise ask directly in the conversation. Wait for answers before deciding
requirements that depend on them. Summarize settled decisions briefly when the scope changes or several answers need to be
reconciled. Follow later user changes and resolve contradictions that materially affect the feature.

Continue until the goal, scope, and required observable behavior are clear enough to write testable acceptance criteria.
Do not repeat answered questions, ask about unrelated implementation preferences, or require an extra approval round when
the answers already establish the requirements.

If a material decision is still unresolved, ask the next focused question instead of presenting a final specification.
Minor implementation choices may remain open in technical notes when they do not change the agreed behavior. If the user
asks to proceed without further clarification, produce a clearly labeled draft and identify assumptions and open decisions;
do not present inferred choices as agreed requirements.

## Produce the story

Use the following structure, adapting its detail to the feature:

### Title

A concise name describing the feature's outcome.

### User story

As a **[user or role]**, I want **[capability]**, so that **[value or outcome]**.

### Scope and constraints

State the agreed inclusions, exclusions, and constraints. Include only boundaries that matter to this feature.

### Acceptance criteria

Write named scenarios with explicit **Given**, **When**, and **Then** statements:

- **Given** the relevant starting state or precondition,
- **When** the user or system performs an action,
- **Then** an observable, verifiable outcome occurs.

Cover the main flow and the alternate or failure paths established during clarification. Use concrete outcomes rather than
phrases such as "works correctly" or "is user-friendly." Keep scenarios focused on required behavior; do not turn an
unconfirmed implementation suggestion into an acceptance criterion. Do not add scenarios merely to reach a fixed count.

### Technical notes

Record the technical context needed to implement the agreed story, as applicable:

- Confirmed architecture, API contracts, data needs, permissions, dependencies, and compatibility constraints.
- Relevant existing components, services, or tests, with source links when inspected.
- Suggested implementation approaches and tradeoffs, explicitly identified as suggestions.
- Validation considerations tied to the acceptance scenarios.
- Remaining technical decisions that do not block the story, and any unverified technical assumptions.

Do not invent endpoints, files, dependencies, estimates, or guarantees. State when technical context has not been inspected.
Keep product behavior in acceptance criteria and implementation guidance in technical notes.

Deliver the story in the conversation unless the user requests a file or another destination. Creating or modifying a
GitHub issue, publishing the specification, or implementing the feature requires a request authorizing that action.
