---
name: gstack
description: Guide Groupher feature design, bug reproduction, diff cleanup, and evidence-based delivery. Use for GStack requests, shared behavior or contract changes, and defects that need diagnosis and verification.
---

# GStack

Follow the repository’s [working agreements](../../../AGENTS.md) for assessment and implementation. Before editing, inspect existing changes in the affected files so you can identify your own hunks later.

## Choose the relevant project skill

Open the matching guidance when the task reaches its boundary.

| Boundary                                             | Guidance                                                                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend components, routing, shared Core            | [Frontend](../fe/SKILL.md)                                                                                                                      |
| CMS access or state transitions                      | [Gate and Lifecycle](../gate-lifecycle/SKILL.md)                                                                                                |
| Uploads, asset references or rich-content publishing | [CMS assets](../cms-assets/SKILL.md), [content publisher](../content-publisher/SKILL.md)                                                        |
| Importing one article or a Docs collection           | [Single article](../single-article-import/SKILL.md), [bulk Docs](../docs-bulk-import/SKILL.md)                                                  |
| Local application runtime or session diagnosis       | [Dev Hub](../dev-hub/SKILL.md), [local auth](../local-auth-debug/SKILL.md)                                                                      |
| Community browser acceptance                         | [Verify Community](../verify-community/SKILL.md), [test fixtures](../local-test-fixtures/SKILL.md), [fixture cleanup](../test-cleanup/SKILL.md) |

## Design around the contract

Trace the real entry point with CodeGraph. For a shared contract, identify who produces the value, where it is transformed, and what each consumer does with it. State the smallest change and the check that would catch an incorrect interpretation. Explain alternatives only when the choice changes behavior or ownership.

## Reproduce at the reported entry point

Record the original input, where the failure is observable, and the expected and actual results. Before fixing, reproduce with a focused test or repeatable runtime action. If an inner-layer probe fails, verify that the real entry point can produce its preconditions before calling it a product defect. After fixing, repeat the original observation with the same input.

For historical reviews, cite an existing failure record when it identifies the input, assertion, and outcome. Distinguish historical evidence from checks rerun now. If reproduction is blocked, identify the missing condition and label the suspected cause as a hypothesis.

## Clean up the task’s deliverable

Run cleanup only when this task produces a diff for delivery. Review its hunks and new files for unused helpers, redundant conversions or fallbacks, and comments or prose that repeat what is already clear. Check callers and contract requirements before deleting code, preserve rationale for non-obvious constraints, and rerun affected checks after cleanup.

## Report evidence by behavior

Choose checks from the [validation matrix](../../../docs/infra/tooling/validation.md) and the relevant domain skill. For each behavior, group the commands or user actions, their observed results, and the remaining coverage gap. For a fix, include the before and after. Name the boundary replaced by a mock and identify relevant failed, blocked, or unrun checks.
