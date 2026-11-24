# Docs D2 backend acceptance — 2026-11-24

## Scope and revision

- Branch: `dude/docs-d2-acceptance-20261124`, based on merged `dev` commit `4e643d1d2e1bc73968e7544fc0150bc7cceac68f`.
- Current model: Queue WorkingCopy owns editing; Approval/Release owns site publication; ArticleBinding represents each site's entry to the shared Article. Site Trash does not imply global Article deletion.
- This change adds acceptance tests and evidence only. Production business code is unchanged.
- All fixtures were newly created in task-owned local databases. Historical-data conversion, old-configuration compatibility and old-database upgrade/recovery rehearsal are excluded.

## New acceptance cases

| Scenario                                                                 | Verified outcome                                                                                                                                                               | Test                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Five deleted folders share the same deletion timestamp                   | Offset and cursor pagination each return every action exactly once, in the stable timestamp/ID order; another site's deletion does not appear                                  | `cms/articles/doc_trash_acceptance_test.exs`     |
| One deletion contains one pending page and two pages removed from public | Aggregate counts remain 1/2; member pages preserve all identities and individual states; nested GraphQL `pagedMembers` works directly from the Trash list projection           | `cms/articles/doc_trash_acceptance_test.exs`     |
| Two authorized editors restore the same folder concurrently              | Both pass admission, exactly one command succeeds, the other receives `docs_state_conflict`; the full saved subtree appears exactly once and the tree revision increments once | `cms/doc_tree/workspace_restore_target_test.exs` |

The mixed-state test intentionally constructs canonical relational facts to isolate reader projection and pagination. It does not claim a browser deletion/Release workflow. The restoration race uses the real Create/Delete/Restore Commands and independent database connections.

## Final combined verification

The nine files below passed together on fresh database `groupher_d2_verified_20261124_test`:

- `test/groupher_server/cms/articles/community_doc_trash_query_test.exs`
- `test/groupher_server/cms/articles/doc_trash_acceptance_test.exs`
- `test/groupher_server/cms/articles/doc_binding_lock_concurrency_test.exs`
- `test/groupher_server/cms/articles/docs_public_read_scope_test.exs`
- `test/groupher_server/cms/doc_tree/workspace_restore_target_test.exs`
- `test/groupher_server/cms/doc_tree/legacy_queue_delete_commands_test.exs`
- `test/groupher_server/cms/doc_tree/release_effects_test.exs`
- `test/groupher_server/cms/mentions_doc_comment_joint_test.exs`
- `test/groupher_server/cms/review_decision_test.exs`

Result: **85 passed, zero failures**, 36.6 seconds after fresh-database initialization, seed `615008`. `TEST_REF_ISOLATED=1` enabled the real database concurrency tests. The run used an exclusive absolute `MIX_BUILD_PATH`, `MIX_ENV=test` and `TEST_DB_NAME`; no shared application runtime was moved or restarted.

Together these cases cover saved subtree ordering, pending-ancestor/cycle rejection, rollback preservation, protected Binding purge, site-scoped Activity/cache effects, Release/Outbox atomicity, row-local public admission, cross-site mutation rechecks and Doc Comment Mention/Review behavior.

Source style and whitespace checks passed. This is backend/GraphQL acceptance, not a claim of new browser or production acceptance. No deployment, credential rotation, historical-data conversion or production write was performed. Both task-owned test databases were removed after verification.
