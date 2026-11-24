# Docs D2 Restore Target Adapter: Local Acceptance (2026-11-22; updated 2026-11-23)

This record covers one D2 contract only: preserving the difference between omitted restore target fields and explicitly supplied `null` in the GraphQL adapter. It is local implementation evidence, not D2 completion or release approval.

## Contract and change

Passport §4.4.2 requires an omitted `targetParentNodeId` and `targetIndex` to restore from the Trash snapshot, while an explicit `targetParentNodeId: null` selects the workspace root. Supplying `targetIndex` without supplying the parent field is invalid. The previous resolver used `Map.get/2` for both fields, erasing the parent-field presence distinction before the command ran.

The resolver now maps an omitted parent to the command-local `:restore_original` value and preserves explicit `nil` as root. `WorkspaceRestore` leaves the saved parent/index unchanged for `:restore_original`; `nil` flows through the explicit root relocation path. The resolver rejects an index field without a parent field. No Queue body ownership, Queue save/publish, D1, D3, or Passport P4 files were changed for this slice.

Files changed for this slice:

- `backend/api/lib/groupher_server_web/resolvers/cms/docs.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/commands/restore_workspace_node.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/workspace_restore.ex`
- `backend/api/test/groupher_server_web/resolvers/cms/docs_restore_target_test.exs`

The 2026-11-23 follow-up also closed an R5 lifecycle case found while exercising the restore flow end to end. See the follow-up section below. The record remains limited to local D2 evidence and does not mark D2 complete.

## Verification

Passed:

- `MIX_ENV=test TEST_DB_NAME=groupher_d2_restore_target_20261122 mix test test/groupher_server_web/resolvers/cms/docs_restore_target_test.exs test/groupher_server/cms/doc_tree/command_boundary_test.exs test/groupher_server/cms/content_import_flow_test.exs --seed 0` — 25 tests, 0 failures; includes the Absinthe presence cases and exercises the ContentImport caller after it was switched to `:restore_original`.
- `MIX_ENV=test TEST_DB_NAME=groupher_doc_trash_members_20261122 mix test test/groupher_server/cms/articles/community_doc_trash_query_test.exs --seed 0` — 3 tests, 0 failures; confirms the existing backend `pagedMembers` contract remains present.
- `MIX_ENV=test TEST_DB_NAME=groupher_d2_legacy_delete_20261122 mix test test/groupher_server/cms/doc_tree/legacy_queue_delete_commands_test.exs --seed 0` — 2 tests, 0 failures.
- `MIX_ENV=test mix format` on the three changed Elixir modules and the new focused test.

The focused target tests cover omitted parent, explicit null/root, explicit parent, optional index, index-only rejection, and Absinthe's preservation of an omitted optional argument versus an explicitly null argument. They exercise the resolver's argument mapping and command input validation; they do not replace end-to-end restore tests for valid parent relocation, stale tree/Queue versions, rollback, or concurrent pending-parent checks.

The legacy Queue cleanup test confirms that a remaining `DocsQueueArticle` reference intentionally blocks Trash purge with `docs_trash_in_use` while preserving its WorkingCopy, Snapshot, and TrashAction. That guard passed and remains intact. The historical Q reference's eventual disposition is still a separate D0/D3 cleanup/acceptance question; this change does not remove it or relax the guard.

The initial 2026-11-22 R5 run did not reach its restore assertions: the legacy verifier fixture stamped permissions into the retired Passport model, while current Gate admission reads `CommunityAdmin`; after correcting the verifier fixture, it exposed stale references to removed `DocsLifecycle` fields. Both were verifier setup/model cleanup, not product authorization changes. The 2026-11-23 follow-up below records the corrected verifier and the product lifecycle defect it then uncovered.

## 2026-11-23 R5 recovery follow-up

The verifier now provisions its actor through the current `CommunityAdmin` model with the Docs Queue permissions required by that fixture. Its lifecycle assertions use `ArticleLifecycle` and the current `ArticleWorkingCopy.scope_type` / `scope_id` contract. This changes verifier setup and assertions only; it does not broaden product Gate policy.

Running the repaired verifier then exposed a real restore/re-publish gap: deleting a previously published Doc removes its current `ArticlePublic`; restoring it creates a `draft` lifecycle while retaining historical `first_published_at`. Queue Release classifies the item as a subsequent publication from that historical timestamp, but the lifecycle transition rejected `draft + first_publish? == false`, even though no Public head existed. `CMS.DocTree.Publish.Lifecycle.published/3` now permits a `draft` lifecycle to transition to `published` regardless of the historical first-publication flag. Queue still owns body edits and publication; `first_publish?` continues to control first-publication-specific effects. No Queue body flow, Gate contract, D1, D3, or Passport P4 file was changed.

Added focused regression `a restored draft with prior publication history can publish a new public head` in `backend/api/test/groupher_server/cms/doc_tree/release_effects_test.exs`. It exercises initial publish, Queue deletion Release, Trash restore, Queue re-enqueue and Release, then asserts the new Public head and published lifecycle while preserving the original `first_published_at`.

Passed on fresh disposable test database `groupher_docs_b0_d2_restore_final_test_20261123`:

- `MIX_ENV=test TEST_DB_NAME=groupher_docs_b0_d2_restore_final_test_20261123 mix test test/groupher_server/cms/doc_tree/release_effects_test.exs:1011 --seed 0` — 1 test, 0 failures.
- `TEST_DB_NAME=groupher_docs_b0_d2_restore_final_test_20261123 DOCS_B0_DISPOSABLE_DATABASE=groupher_docs_b0_d2_restore_final_test_20261123 MIX_ENV=test mix run scripts/docs_default_lifecycle_r5_verify.exs` — completed all stages: `R5 clean deletion, explicit initialization, retention, conflict and Receipt checks passed`; `R5 rollback and Trash recovery lifecycle checks passed`; `R5 save/publication ordering checks passed`. This reaches both restore assertions and the later republish assertion.

The first attempted focused regression DB name lacked the test runner's required `test` marker and was rejected during setup before the test body ran. The passing run used the correctly named fresh DB above. No R5 process remains active.

## Remaining D2 acceptance

This local slice does not complete D2. The D2 exit criteria in `docs-mirror-fix.md` and Passport §4.4.2 still require independent evidence for at least:

- Restore behavior against real saved trees: original parent/order, moved-but-valid parent, missing parent, explicit root/new parent, invalid or pending ancestors, cycles, and atomic rollback with Trash preserved.
- Cross-node `recordRevision` validation and stale member-page refresh behavior under actual Queue/Release changes.
- Mixed pending/effective subtree counts and `publicVisible`, multi-page group pagination without duplicates, query-count/SQL-plan and large-subtree latency checks.
- Snapshot read behavior under a held Docs site lock and the reverse write/read concurrency case.
- Full authorization negatives and Docs Activity projection assertions. A literal scan of runtime directories for `"doc.trash"`, `:docs_trash_read`, `docs_trash_read`, and `docTreeTrashItems` currently returns no matches; schema / authorization / generated-consumer tests are still needed to close the retirement contract.
- The remaining Docs multi-site integration and Search/Press/cache/retry evidence listed by the D2 matrix.

The current branch still contains the earlier Doc Trash `pagedMembers` GraphQL/UI wiring. Its backend contract test was re-run above; the frontend focused test was not re-run in this slice. Neither result means D2 is complete.
