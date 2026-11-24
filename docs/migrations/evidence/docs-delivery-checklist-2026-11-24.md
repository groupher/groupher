# Docs final delivery verification — 2026-11-24

## D1 integration into the active branch

The active branch is doc-redesign. The implementation source for this integration is PR #616 at 13929bdb3, whose 27 reported checks passed. The existing co-author UI was committed separately as e8b04e5e3.

The D1 integration includes the Community Queue editor entry, docsQueueMember GraphQL reader and generated client registration, Queue Save/Merge Article admission, and rejection of legacy default-copy paths for active Doc co-authors. Existing source documentation edits in the active worktree were preserved.

Current-worktree checks completed successfully:

- Core and Dash TypeScript checks.
- Queue entry and drawer tests, 6 passed.
- GraphQL source and generated contracts.
- coauthor_queue_access_test.exs on the isolated groupher_d1final24_test database, 9 passed in 5.0 seconds after compilation and migrations.

Strict compilation encountered pre-existing duplicate documentation attributes in other edited modules. SDL generation completed. The real two-session acceptance described below completed successfully.

Fixture run docs-final24 created synthetic owner/editor accounts and Community docs-final24 through Dev Hub. The temporary runtime ownership and compilation obstacles were recovered through Dev Hub. Final cleanup returned cleaned with errors and blockers empty, zero Admin/Global/co-author grants and pending requests. Both actors were closed. The run-owned community was archived, while Article and audit history were retained. The isolated backend test database was dropped.

## D2 evidence mapped to the PR version

| Contract                                               | Evidence at PR #616 head 13929bdb3                                                                                                                          | Remaining acceptance                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Restore subtree ordering and transaction rollback      | workspace_restore_target_test.exs contains saved subtree ordering and pending-ancestor/cycle rejection cases                                                | Confirm final integrated version if moved into the active branch                                       |
| Purge Binding Trash protection and transaction effects | legacy_queue_delete_commands_test.exs covers protected Binding rejection, scoped Activity and cache invalidation                                            | Confirm final integrated version if moved into the active branch                                       |
| Composite Trash identity and reader isolation          | community_doc_trash_query_test.exs covers one item per TrashAction, detail/member identity, permission rejection and a read transaction without write locks | Multi-group page boundaries and mixed released/pending membership need explicit final-version evidence |
| Cross-site Article mutation serialization              | doc_binding_lock_concurrency_test.exs covers rechecking a cross-site Binding mutation after the shared Article row lock                                     | The test is skipped unless TEST_REF_ISOLATED=1, so a green ordinary CI does not prove this case ran    |
| Mention and Review multi-site behavior                 | mentions_doc_comment_joint_test.exs and review_decision_test.exs are present at the target revision                                                         | Preserve case-specific evidence for final integration                                                  |

The D2 implementation remains in #616. This checklist records verified coverage and its gaps. Overall D2 acceptance remains open.

## D3 / P4c

The complete LegacyPlan application report and all three successful mappings are recorded in passport-p4c-legacy-inventory-2026-11-24.md. Application migration/recovery acceptance and provenance of migration versions 20260820110000 and 20260821103000 remain open. No production cutover has occurred.

## Completed D1 two-session acceptance

- Synthetic owner login was lt-docs-final24-owner-2a4b56c5f8ec and editor login was lt-docs-final24-editor-2c1fb0d4a16e. Editor had only article.read_draft and article.update for the test Article and no site Admin grant.
- Owner created, saved, enqueued and initially published the Doc through the real Dash editor, then created a new default draft and enqueued it. Article ID was 8c708e2e-d7b8-4536-b7ba-536221f15b20 and Community ref was cm_d5db5d35eacc8d54093f361bbc83a0f3.
- Editor opened Community /docs-final24/doc/1/queue-acceptance in its independent registered browser profile, used Edit queued content and saved changed body text through Save queued content.
- Owner used the real Dash Publish queue drawer to open the same member, asserted the changed body text and saved a changed subtitle. Editor reopened its drawer and read the owner subtitle from the same member.
- The workspace copy ID stayed 2b3fc093-3a1d-4aa6-ad5f-e20f522f8502 with revision 1 -> 2 -> 3. The default copy ID stayed 2cab5c1b-42af-4324-bffa-96decf4ed43f at revision 1. Public Snapshot stayed 3f42dd55-d6b7-45d2-a16d-dedd41f7396c. These identities/revisions were verified with read-only Repo queries before and after browser saves.
- Browser acceptance found and fixed missing stable Doc.id in the detail query and Dashboard-only translation placement. Both fixes were committed and pushed to #616 as c646364a8 and 056917fb9. The latest reported CI for 056917fb9 was 29 passed, 4 skipped.
- Negative authorization boundaries were exercised by the nine focused backend tests, including cross-Doc/cross-community rejection, removal revocation, default-copy bypass rejection, and denial of Enqueue/Release to the co-author. These negative paths were not all repeated manually in the browser.
- Fixture tooling needed exact empty-name textbox matching and real keyboard input events for contenteditable controls. The local CLI and browser worker changes passed 11 focused tooling tests. The worker lifecycle was restarted only for this owned run.

D1 browser and scoped backend acceptance are complete. D2 coverage gaps and D3/P4c open items above remain independent delivery requirements.
