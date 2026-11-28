---
name: grstack
description: Prepare pnpm and Mix dependencies and build caches for Groupher worktrees. Use GrStack also for feature design, bug reproduction, shared contract changes, diff cleanup and acceptance.
---

# GrStack

Follow the repository’s [working agreements](../../../AGENTS.md) for assessment and implementation. Before editing, inspect existing changes in the affected files so you can identify your own hunks later.

## Prioritize the acceptance path

- Identify the shortest workflow that proves the user's requested outcome and its environment prerequisites. Run it end to end before exploring exception cases. For a write, use the real product entry point, then refresh or issue a fresh read as the intended reader and verify the saved change. Record unrelated findings for separate work.
- Before expensive validation, pin the candidate to a commit SHA or, for uncommitted work, a base SHA plus the exact patch being tested, including relevant new files. Record results against that candidate.
- Before widening an investigation, name the acceptance step it blocks, a testable cause, and the smallest check that distinguishes it from another plausible cause. State which result would justify investigating further. If the check only reproduces the known symptom, choose a check that can distinguish the causes or advance an independent, authorized deliverable.
- In each progress update, say what new evidence changed or ruled out, which acceptance step remains blocked, and what result would change the next decision. Identify any deliverable that can still proceed. Before submitting, verify the intended changes independently of unrelated worktree changes.
- Before repeating a full suite, state which change or new evidence makes the previous result insufficient and why a focused check cannot answer the question. Use focused tests while iterating and run the required suite on the final candidate.

## Prepare worktree dependencies

When preparing a new or existing linked worktree for development, tests or Dev Hub startup, check its existing dependencies and compatible caches before installing or compiling. Reuse the pnpm store and compatible backend caches, while keeping workspace links and writable build outputs owned by the target checkout. Never point an active checkout at another checkout's writable build directory. Use the [dependency preparation procedure](references/pr-integration.md#reuse-caches-without-mixing-checkouts), verify that the target actually loads its own code, and report cache reuse, reinstalls or recompiles and their reasons. Creating or switching a worktree still requires the authorization in AGENTS.md.

## Choose the relevant project guidance

Use the project skill for the boundary under test. Read the linked procedure only when its trigger applies.

| Task                                                                                 | Entry                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend components, routing, shared Core                                            | [Frontend](../fe/SKILL.md)                                                                                                                                                                                                             |
| Add or change a backend Context API or GraphQL resolver                              | [Backend rules](../../../docs/rules/be.md), [Context module layout](../../../docs/rules/be-context-module-structure.md), [resolver boundary](../../../docs/architecture/graphql-resolver-boundary.md)                                  |
| Verify parallel development in A and B                                               | [Two-worktree acceptance journey](../../../docs/infra/tooling/acceptance/two-worktrees.md)                                                                                                                                             |
| Diagnose access, permissions or resource state                                       | [Gate and Lifecycle](../gate-lifecycle/SKILL.md)                                                                                                                                                                                       |
| Change a retryable CMS write or its effects                                          | Follow the [Command contract](../../../docs/architecture/cms-command.md), [confirmation and recovery](../../../docs/architecture/cms-command-confirmation.md), and [outbox](../../../docs/architecture/cms-outbox.md) where applicable |
| Asset ownership or publishing                                                        | [CMS Assets](../cms-assets/SKILL.md) or [Content Publisher](../content-publisher/SKILL.md)                                                                                                                                             |
| Import one item or review and apply a Docs dataset                                   | [Import](../import/SKILL.md)                                                                                                                                                                                                           |
| Local services, browser identity or test resources                                   | [Dev Hub](../dev-hub/SKILL.md), [local login diagnosis](../dev-hub/references/local-auth.md), [seed](../seed/SKILL.md)                                                                                                                 |
| Rehearse a schema migration and recovery on a clone                                  | [Database migration rehearsal](../db-migration-rehearsal/SKILL.md)                                                                                                                                                                     |
| Verify a Community journey or reclaim run-owned resources                            | [Browser acceptance](references/verify-community.md), [cleanup](references/test-cleanup.md)                                                                                                                                            |
| Accept a specific PR revision, split requested commits or audit source documentation | [PR acceptance](references/pr-integration.md), [commit splitting](references/commit-split.md), [source documentation audit](references/codedoc-audit.md)                                                                               |

## Design around the contract

Trace the real entry point with CodeGraph. Before adding or moving a module or introducing a dependency, identify the owning runtime, the business owner, and the entry point callers may use. Follow the target directory’s local instructions and placement conventions. For generated files, locate the source definition. Consult the [application boundaries](../../../docs/architecture/apps.md), [backend Context layout](../../../docs/rules/be-context-module-structure.md), or [cross-runtime contracts](../../../docs/architecture/contracts.md) as applicable.

For a shared contract, identify who produces the value, where it is transformed, and what each consumer does with it. State the smallest change and the check that would catch an incorrect interpretation. Explain alternatives only when the choice changes behavior or ownership.

## Reproduce at the reported entry point

Record the original input, where the failure is observable, and the expected and actual results. Before fixing, reproduce with a focused test or repeatable runtime action. If an inner-layer probe fails, verify that the real entry point can produce its preconditions before calling it a product defect. After fixing, repeat the original observation with the same input.

For local application debugging, use Dev Hub to confirm the active checkout and service status, manage the affected services, and obtain the canonical HTTPS product URL. For role comparisons within one environment, open each actor in its own browser profile. To verify A/B cookie isolation, sign in to each environment with a distinct account in the same profile. Sign out of A and refresh B to verify its original user, sign back in to A, then sign out of B and refresh A to verify its original user. Exercise the provider login or callback when OAuth itself is under test.

For a permission boundary, use actors with and without the required grant to exercise the same action on the same resource. On denial, verify the actor, resource scope, and action before changing any grant. Trace service identity separately when a service call fails authentication. If invitation acceptance is under test, leave the invitation pending and accept it through the product UI.

For historical reviews, cite an existing failure record when it identifies the input, assertion, and outcome. Distinguish historical evidence from checks rerun now. If reproduction is blocked, identify the missing condition and label the suspected cause as a hypothesis.

## Clean up the task’s deliverable

Run cleanup only when this task produces a diff for delivery. Review its hunks and new files for unused helpers, redundant conversions or fallbacks, and comments or prose that repeat what is already clear. Check callers and contract requirements before deleting code, and preserve the rationale for non-obvious constraints. When ownership, public behavior, error semantics, or side effects change, check affected module docs, API comments, and flow diagrams against the implementation. Update stale claims and follow the documentation requirements for the affected paths. For a requested documentation sweep, follow the [source documentation audit](references/codedoc-audit.md). Rerun affected checks after cleanup.

## Report evidence by behavior

Choose checks from the [validation matrix](../../../docs/infra/tooling/validation.md). Confirm which configuration each lint or contract check loads, the paths it covers, and what makes it fail. Include affected hosts for shared code and generated outputs and consumers for protocol changes. Distinguish report-only findings from enforced checks. For each behavior, group the commands or user actions, their observed results, and the remaining coverage gap. For a fix, include the before and after. Name the boundary replaced by a mock and identify relevant failed, blocked, or unrun checks.

For local permission checks, record the run, actor aliases and roles, target resource, action, and outcome for each actor. Report which sessions were closed and which fixtures or grants remain. When fixture cleanup is in scope, preview its effects before applying it. Keep credentials and session references out of the report.
