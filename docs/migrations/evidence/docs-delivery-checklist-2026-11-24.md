# Docs final delivery verification — 2026-11-24

## Current delivery status — supersedes the historical log below

The user excludes historical-data conversion, legacy configuration compatibility and old-database migration/recovery rehearsal. D3/P4c is removed from this delivery scope; historical notes below do not reinstate it as a prerequisite.

| Work                               | Current evidence                                                                                                                                                                                                                                                                | Remaining acceptance                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original Post/D1/Passport delivery | #619 merged as `4e643d1d2`; prior local dual-session Post/D1 acceptance and fixture cleanup are recorded below                                                                                                                                                                  | Production smoke belongs to the coordinated new release, not the old local evidence                                                                     |
| Remaining code and documentation   | #620 includes real-body rendering/navigation, viewer checks, backend/GraphQL descriptions, Seed race regression, design/prototype, local ignores, generated assets, the Postgrex connection-option fix and canonical Import registry support                                    | Latest-head CI/review and user-controlled merge                                                                                                         |
| API deployment                     | Replacement Fly token passed authentication and image build. The next release failed on Postgrex receiving string channel_binding; normalization and production-config evaluation pass locally                                                                                  | Merge #620, redeploy, confirm API health                                                                                                                |
| Import canonical resources         | `groupher-import`, `IMPORT_PREVIEW_SECRET` and the dedicated Auth Import/Dash registry secret were provisioned; unrelated service registrations are preserved                                                                                                                   | Coordinated Auth/Import/Dash code and consumer-credential cutover after API release; new-content preview/apply/save/reload and Post/D1 production smoke |
| D2 backend/GraphQL acceptance      | Separate #621, based on merged dev: nine-file isolated suite 85 passed. Review corrected paging fixtures to rollback-owned REPEATABLE READ; those cases passed 2/2 with zero retained Communities/Articles. Its latest checked CI had 26 successes, one neutral and no failures | User review/merge; no new browser or production acceptance is claimed                                                                                   |
| Worktree housekeeping              | Removed the inactive coauthors-ui and passport-docs-on-615 checkouts, retaining branch history                                                                                                                                                                                  | Retain the coauthors checkout with an active process cwd; retain mixed/unique dirty work and checkouts owned by other tasks                             |

Reading regression follow-up passed 6 tests, Auth passed 87, and consolidated database-option/Seed regressions passed 5. Runtime configuration evaluation, strict backend compilation, source/Context/documentation checks and schema generation passed. The regenerated SDL has the same structure when descriptions are omitted. PR descriptions and live GitHub checks remain authoritative for their final heads.

## Historical implementation log

The following entries describe earlier revisions and superseded delivery organization. Their references to #615/#616, old counts and D3 are historical evidence, not the current PR split or remaining scope.

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

## Ordinary Post delivery alignment

The two remaining accessibility changes from the accepted UI were committed to #615 as abdd92bc2 and merged into the #616 branch as 49021b9be. The body editor implementation and its existing focused tests were already present. The earlier ordinary Post two-account acceptance and coauthor-final24 cleanup are recorded in the active branch co-authors document, committed as e8b04e5e3. Browser acceptance used the active main worktree with its recorded local source integration.

PR #615 also includes Admin, Import and Docs changes across 421 files. PR #616 is stacked on that branch. Merging those PRs deploys the combined scope through the existing dev workflow. Independent Post/D1 acceptance does not narrow the existing PR scope.

## Unified current-branch delivery

The current `doc-redesign` branch now contains both PR histories through merge commit `81c6228af`, preserving the five subsequent Import fixes (`512311a2c`, `a47f4040c`, `d8da3cdea`, `26567c451`, `309ff4d3b`) and the existing Landing change. The unified branch passed 34 focused backend Import/Queue tests and 18 frontend tests; Import passed 148 tests with one skipped. Core/Dash/Community/Import types, generated GraphQL contracts, documentation checks and backend style passed.

The full backend run completed in 755.5 seconds: 2963 passed, eight failed, one skipped and eight excluded. The failures all assumed globally empty/exact Analysis event counts. Each affected file passed on its own fresh database (37 tests total). Commit `0032ade9e` scopes event assertions to the fixture Article and measures aggregate maintenance counts relative to their baseline. All 37 tests then passed against the previously failing database. The final full rerun on fresh isolated database `groupher_unified_verified_20261124_test` completed in 791.0 seconds: 2971 passed, zero failures, one skipped and eight excluded (`--exclude skip_ci`, `TEST_REF_ISOLATED=1`).

D2 and D3 acceptance gaps remain as listed above; consolidation is not evidence that those checks passed.

CI partition 1 exposed a missing explicit `Articles` fixture-helper load in `local_test_actors_grants_test.exs`. A standalone fresh-database process reproduced two failures (3/5 passed); adding the helper to that file's existing require list passed all five tests in a second fresh database. The complete-suite result above preceded this test-loading-only fix; CI partitions verify the final revision.
