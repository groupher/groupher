# Community feature map

> 状态：current

| Journey                                  | User outcome                                                    | Coverage boundary                                                                         |
| ---------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Read a published Post](post-reading.md) | Find a prepared Post in the list, read its detail and reopen it | Passed on 2026-11-24; authenticated owner, real body rendering, preview and direct detail |

This is an initial map of one journey. It does not cover draft editing, publishing UI, comments, permissions, search, or other Article threads. Add a journey when its real entrypoint, required fixtures and observable success state have been established.

## Local environment acceptance

[Two-worktree acceptance](two-worktrees.md) covers parallel runtimes, login, a real permissioned write and secondary teardown. Record the result against the revisions exercised in each run.

Use the [GrStack browser acceptance procedure](../../../../.agents/skills/grstack/references/verify-community.md) for preparation and evidence. The [cleanup procedure](../../../../.agents/skills/grstack/references/test-cleanup.md) also applies to runs that own databases or temporary worktrees. Maintain the product assertions in the journey files here.
