# Community feature map

> 状态：current

| Journey                                  | User outcome                                                    | Coverage boundary                                                                         |
| ---------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Read a published Post](post-reading.md) | Find a prepared Post in the list, read its detail and reopen it | Passed on 2026-11-24; authenticated owner, real body rendering, preview and direct detail |

This is an initial map of one journey. It does not cover draft editing, publishing UI, comments, permissions, search, or other Article threads. Add a journey when its real entrypoint, required fixtures and observable success state have been established.

## Local environment acceptance

[Two-worktree acceptance](two-worktrees.md) covers parallel runtimes, login, a real permissioned write and secondary teardown. Record the result against the revisions exercised in each run.

Use the [GrStack browser acceptance procedure](../../../../.agents/skills/grstack/references/verify-community.md) for preparation and evidence. The [cleanup procedure](../../../../.agents/skills/grstack/references/test-cleanup.md) also applies to runs that own databases or temporary worktrees. Maintain the product assertions in the journey files here.

## Reusable acceptance record

Keep a short record with the work being reviewed. Fill in only the environments and actions exercised; distinguish a pass from a blocked or unrun check.

```text
Candidate: commit SHA, or base SHA plus the exact uncommitted changes
Environment: checkout, Hub ownership, database target, product URL
Prerequisites: relevant service dependencies and migration state
Fixtures: run, actor aliases, roles and resource references (no credentials)
Action and result: entry point, expected outcome and observed outcome
Isolation: operations and observations in each environment, when applicable
Cleanup: preview, applied result, retained resources and removed test environment
Coverage gaps: failed, blocked or unrun checks and their reason
```

For permission and invitation fixtures, use the [typical seed cases](../../../../backend/api/dev/seed/README.md#典型测试-case). The same guide provides composable actor, community, invitation and cleanup commands for an individual admin workflow.
