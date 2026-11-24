# Community feature map

> 状态：current

| Journey                                  | User outcome                                                    | Coverage boundary                                                                         |
| ---------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Read a published Post](post-reading.md) | Find a prepared Post in the list, read its detail and reopen it | Passed on 2026-11-24; authenticated owner, real body rendering, preview and direct detail |

This is an initial map of one journey. It does not cover draft editing, publishing UI, comments, permissions, search, or other Article threads. Add a journey when its real entrypoint, required fixtures and observable success state have been established.

Use the existing local `dev-hub`, `local-test-fixtures` and `test-cleanup` skills for runtime, identity and resource ownership. Agent skills under `.agents/` are local-only; the versioned journey lives here so the acceptance contract can be reviewed and maintained with the product.
