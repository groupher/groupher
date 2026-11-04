# Review restrictions, reports, and Ticket source visibility fix

> Status: application implementation and local verification are complete. The hard-cutover runbook is operational guidance and has not been executed against a deployed environment.

## 1. Product behavior

### Content review

CMS owns content visibility. ReviewBot supplies an opinion; it cannot publish, hide, or punish content by itself. The moderator actions are `approve` and `reject`:

| Action    | Meaning                                  | Fixed server behavior                                                                                                                                                          |
| --------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `approve` | A moderator accepts the current content. | Resolve every active restriction in the same review scope, including `manual_hold` and `report_threshold_hold`. A different scope's restriction and lifecycle blockers remain. |
| `reject`  | A moderator rejects the current content. | Resolve automatic restrictions in the same review scope, including `report_threshold_hold`, then apply `manual_hold`. AI results cannot clear `manual_hold`.                   |

The client supplies the target and command ID; it does not select restriction rows. The server derives the review scope from the target and applies the fixed rules above. Any active restriction blocks public visibility; `manual_hold` has no special visibility priority. Its precedence is enforced when writing restrictions: automated outcomes cannot remove or replace a moderator's hold.

AI result application uses restriction type plus content-generation identity, not a source-only test. When new content replaces an old request, a clear result may end the old request's `ai_review_hold`, `ai_suspect_hold`, and `human_review_hold` in the same scope, but only when that old request has `outdated_at` set. Article, Comment, Doc, and doc-thread Comment paths must locate and end these holds by the superseded request IDs; filtering only by the new Comment request's `artiment_review_id` is incorrect. `replaced_at` alone is insufficient: a manual recheck changes only the request generation, not the content. Its clear result must not end any old request-bound AI or human waiting hold in any resource type; the moderator must decide whether to approve/reject. AI results must never end `manual_hold` or `report_threshold_hold`, regardless of source. In particular, `report_threshold_hold` uses `source: :domain`, so excluding only `source: :human` is unsafe.

AI work in `queued` or `running` state must finish before `approve`. A `failed` AI request does not block a human `approve`: the command marks/supersedes that failed request as resolved in the same transaction before clearing the scope's restrictions. The implementation must not leave a running job able to reapply a stale restriction after approval; it must invalidate the request generation or otherwise reject stale results. `reject` remains available while AI work is queued, running, or failed and makes later AI results unable to clear `manual_hold`.

This replaces the current `approve / deny / release` contract: `deny` becomes `reject`; `release` is removed; `approve` becomes the only way to clear a `manual_hold`. This is a breaking contract cutover: remove all existing review mutation root fields, including existing approve/recheck fields, and expose fresh `...V2` fields (for example `approveArticleV2`, `rejectArticleV2`, `recheckArticleV2`, with matching Comment, Doc, and doc-thread Comment fields). Doc and doc-thread Comment recheck are supported by this contract. Do not leave aliases. This ensures stale clients are rejected by GraphQL before they can submit an old `commandId` after receipt cleanup. Update the GraphQL schema, UI actions/translations, command validation, and `v2.md` together.

### Report threshold

A report is a moderation signal. One report alone does not hide content. A configured threshold of distinct reporters can apply a temporary restriction to CMS content.

Count active reports for the same Alert item. The item is bound to one observed public content version: content edits supersede the old item and mark its reports outdated before a new version can be reported. The submit path must validate this invariant under the CMS target lock; add tests proving reports for different observed versions never combine. Withdrawn, outdated, and resolved reports do not count, and one reporter contributes at most one active report to an item.

The `SubmitReport` command owns threshold evaluation. For CMS targets, in the existing target-locked transaction it records the report, counts distinct active reporters for that item, and applies `report_threshold_hold` once the configured threshold is reached. Use the stable source reference `report_threshold:item:<item_id>` for idempotency. Keep the lock order target -> Alert item/report -> restriction rows; do not acquire the target lock after locking the Alert item. Account reports do not apply content restrictions.

If threshold restriction application fails, the transaction rolls back the threshold-crossing report too; retry uses the same `commandId`. This keeps accepted report state and the visibility restriction atomic. Runtime policy is three distinct active reporters per Wall item and current observed version, with no time window and platform-wide scope. `CMS.Review.Config` reads the threshold from `:cms_review_report_threshold`.

`resolveAlertItem` resolves only the Wall item. It must never clear `report_threshold_hold`; only `approve` or `reject` in the matching CMS review scope may clear it. `reject` clears the automatic threshold restriction and applies `manual_hold`, so the content stays hidden pending any later human approval.

### Ticket source visibility

Current product behavior is intentionally retained: only a Ticket with exactly one source is downgraded when that source becomes private. A multi-source Ticket remains Published even if all of its source Posts become private; this is existing behavior and has an explicit test. Changing that policy is a separate product change.

```text
P7 becomes private
  |
  +--> T42 links only P7
  |      Published -> Draft
  |
  +--> T43 links P7 and public P9
  |      remains Published
  |
  `--> T44 links P7 and P9, both private
         remains Published (current contract)
```

Ticket state and Activity history are written synchronously in the caller's transaction. Cache invalidation intent and `TicketState.workflow_version` increments are also persisted transactionally. An Outbox worker asynchronously purges affected Ticket list/detail and linked Post cache tags after commit.

## 2. Canonical const/enum contract

Do not spread action, restriction, source, status, or provider outcome strings through decision code, GraphQL resolvers, UI conditionals, and tests. Each domain has one typed source of truth; boundary layers map to it.

| Domain                | Canonical definition                                                                                                                                      | Boundary rule                                                                                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Result action         | `GroupherServer.CMS.Review.Const.result_action`: `:approve`, `:reject`, `:recheck`                                                                        | Keep separate approve/reject/recheck mutations. Type `ReviewCommandResult.action` as GraphQL enum `ReviewAction` with `APPROVE`, `REJECT`, and `RECHECK`; resolver returns the enum's `:recheck` atom for recheck results. Frontend uses generated GraphQL enum types. |
| Decision action       | `GroupherServer.CMS.Review.Const.decision_action`: `:approve`, `:reject`                                                                                  | `Decide.execute` and `Decisions.apply_in_transaction` validate against this strict subset, never the full result-action enum. `:recheck` is not a moderator decision.                                                                                                  |
| Restriction type      | `GroupherServer.CMS.Review.Const.restriction_type`: `:ai_review_hold`, `:human_review_hold`, `:ai_suspect_hold`, `:manual_hold`, `:report_threshold_hold` | Ecto enum and all domain checks use this enum. Old rows are cleared at the hard cutover; no old-value mapping or backfill.                                                                                                                                             |
| Restriction source    | `GroupherServer.CMS.Review.Const.restriction_source`: `:request`, `:human`, `:domain`                                                                     | `report_threshold_hold` uses `:domain`; its Wall item identity belongs in `source_ref`, not a new duplicated `:report` source.                                                                                                                                         |
| Restriction lifecycle | `GroupherServer.CMS.Review.Const` helper over `resolved_at`                                                                                               | Active/resolved is derived from the paired resolution fields; do not add a second status column or duplicate status enum.                                                                                                                                              |
| AI opinion            | `GroupherServer.AI.OpinionOutput` / AI-owned status enum                                                                                                  | The AI domain owns and validates opinion values. CMS consumes the validated contract and maps it to review behavior; AI modules must not depend on CMS.                                                                                                                |
| Threshold policy      | `GroupherServer.CMS.Review.Config` or `ReviewBotConfig`                                                                                                   | Threshold/window/scope are runtime policy, not `ex_const` enums. Resolve the value from typed configuration; do not embed policy numbers in command code.                                                                                                              |

Put only closed CMS review vocabulary (action, restriction type/source and lifecycle helpers) in `GroupherServer.CMS.Review.Const`, using the repository's `ex_const` convention and generated helpers. Keep AI opinion in the AI domain and threshold policy in runtime config. GraphQL enum names can remain public API names, but each maps in one place to its canonical owner. The TypeScript Review AI Worker cannot import Elixir modules: define its request/response contract once in a language-neutral schema under `packages/contracts` and generate/use the TypeScript types from it. Provider/model implementation constants may remain provider-owned. SQL `CHECK` constraints necessarily contain persisted values; keep their allowed values synchronized with the canonical enum via migration helpers where supported and a contract test that compares the database constraint values with the enum values. Do not add independent domain atom/string lists in schemas, resolvers, workers, or UI.

This is a breaking hard cutover with no compatibility layer or historical-data support: do not add old-value aliases, dual reads/writes, backfills, receipt translation, or replay support. This does not waive V2's zero-count safety gate. Never delete or resolve an active restriction directly to pass the gate; process each active target through its current V2 review/lifecycle command and stop if any target remains unresolved. Existing active `manual_hold` decisions therefore remain in force until an authorized V2 decision changes them. All old GraphQL review mutation root fields must be absent from the new schema; adding `...V2` root fields is the protocol boundary that rejects old-client retries, including retries of the otherwise unchanged approve action.

Cutover order is fixed:

1. Open a maintenance window and block all ordinary external writes that can create or change review state, content generations, source visibility, or Ticket state: Article/Comment/Doc publish and edit, reports and moderator decisions, Ticket source mutations, Article trash, and Community lifecycle/readability changes. Public reads remain available by default; if these write paths cannot be frozen independently and reliably, switch the whole application to read-only and keep reads frozen until Step 10. Also keep reads frozen through Step 10 for any pre-write recheck that has no request-bound waiting hold and is not protected by an AI-unclearable restriction. Pause ReviewBot/recheck/report producers and cron before draining so no new request/job is created or enqueued; keep existing `cms_review` Oban consumers running to drain already-enqueued jobs. `CMS.Outbox.send/1` inserts the event and Oban wakeup together, so there is no separate event-to-job dispatcher to pause. The only write-freeze exceptions are audited V2 moderator decisions in Step 3, the first-contract-write canary in Step 8, and threshold/recheck initialization in Step 9. These Step 8/9 writes use normal domain transactions and are expected new-contract writes, not ordinary ingress. Take a complete, transaction-consistent database backup and verify it is restorable before any business-state processing or destructive change. Capture code/config image IDs and a read-only inventory of review-related tables.
2. Export the initial target snapshot before processing: resource/scope, active restriction IDs/types/sources, current `artiment_reviews` IDs/state/`replaced_at`/`outdated_at`, relevant Oban job IDs/state, open AlertWall item IDs, and active report IDs/status/observed version. Record which targets an authorized owner explicitly requests for fresh AI recheck; also record the dedicated canary Article and hold-producing scope. It must be current published content with an `ArticlePublic` projection, no active review restriction, and a baseline visibility condition (such as a non-public Community) that keeps it inaccessible to ordinary readers while still passing `recheckArticleV2` validation. The snapshot defines audit/recheck scope and is not an instruction to rescan the whole site.
3. Keep existing review workers running only to drain jobs that were already queued/running when producers were paused. Do not invoke `recheck` or any command that enqueues a new job during this phase. For a stuck/failed request, only a current V2 moderator decision command may resolve it; there is no public request-invalidation command in this runbook. Allow only audited moderator commands through the external write freeze. Resolve active `manual_hold` only through an authorized V2 moderator command—never a cleanup script or direct SQL. Do not delete Oban rows or requests to fake `pending_target_count=0`. If a request cannot safely drain or a moderator cannot formally resolve it, abort the cutover.
4. Once no queued/running job can write and all requests/targets are in terminal business states, stop the review workers and verify no executing/retryable job can start. Refresh the target/status snapshot after worker drain. Run the V2 zero-count and visibility-consistency preflight against this final snapshot. If any count is nonzero, hidden state is unexplained, or a query fails, abort; do not run destructive DDL.
5. With the gate passed and writes still frozen, delete review-block rows first: assert there are no active rows, then delete all ended rows so none can retain an old `type` or block request deletion. Next define the retained request set by the actual string reference: retain an `artiment_reviews` row iff an `alert_wall.items.ai_source_ref` exactly equals `artiment_reviews.id::text`; delete unreferenced request rows. Before retaining a referenced request, set `replaced_at` to the cutover timestamp if it is nil, making it terminal and excluding it from `Requests.pending_for_scope`; keep it read-only for Wall history only. Add a cutover test proving these rows cannot appear in `pendingContentReviews`. Clear `cms.command_receipts` only for `cms.review_decision`, `cms.review_recheck`, and `cms.review_apply_result`; preserve receipts for every other operation. Do not truncate the shared receipt table. Finish this cleanup before running `mix ecto.migrate`: the review-vocabulary migration preflights every retained restriction row and aborts if any `type` or `source` is outside the new enum. Do not bypass that guard; stop and complete the authorized cleanup or abort the cutover.
6. With the old `cms_review` consumer stopped, delete all pre-cutover Oban jobs in that queue; verify no job is executing before deletion and the queue is empty afterward. If undelivered `cms.artiment_review` Outbox events for pre-cutover request IDs are not needed for audit/history, they may also be deleted or marked terminal, scoped by event and request ID. These events do not recreate jobs; `CMS.Outbox.send/1` created each event and Oban wakeup together. Preserve unrelated queues and Outbox events. Keep current V2 AlertWall items/reports; they are active product facts, not legacy V1 data.
7. Run the guarded DDL migration only after Step 5 cleanup and then deploy the new code: it replaces old restriction checks with the new enum checks and switches the GraphQL/UI contract. The migration checks all three review-block tables before changing any constraint and fails fast if retired values remain. There is one vocabulary migration; do not deploy code or migration past a failed preflight. Before creating any new cutover recheck jobs, verify the old `cms_review` queue is still empty; no Outbox dispatcher can recreate the deleted jobs.
8. Perform the canary as the first accepted new-contract write, before threshold initialization or any other new-contract write. Keep ordinary ingress frozen. Through the audited maintenance exception, issue one `recheckArticleV2` for the dedicated canary from Step 2. Verify the normal transaction created its `artiment_reviews` request, active waiting hold, `cms.artiment_review` Outbox event, and matching `cms_review` Oban job. Start the new `cms_review` worker and verify the canary job is consumed without making the target publicly visible; finish/retire the canary through the V2 business path. Then gracefully stop the consumer and confirm no job is executing before Step 9. If the canary transaction did not commit, restore the verified backup and old images. If it committed but validation failed, there is no in-place rollback: choose a full database restore (discarding the canary write) or a forward fix.
9. Keep ordinary ingress, ReviewBot/recheck/report producers, cron, and the new `cms_review` consumer paused while applying threshold/recheck initialization. Use the report snapshot only to select candidate item IDs. For each candidate, lock/re-read the current target and item, then re-read report status, `observed_version`, and current public version. Count only distinct reports that are still active for the current item/version; skip candidates whose item is resolved/superseded, whose reports are withdrawn/outdated/resolved, or whose observed version is no longer public. Apply `report_threshold_hold` only from that fresh locked state. V1 legacy reports are not imported. Verify the threshold initialization separately from request/job verification: for every candidate still eligible at the locked re-read, assert a `report_threshold_hold` exists iff the fresh distinct-active count meets the configured threshold; when present, assert `source_ref == "report_threshold:item:<item_id>"` and that repeating initialization does not create a second active `report_threshold_hold`; below threshold, assert no `report_threshold_hold` exists (other restriction types may still exist). Record the locked item/version, counted report IDs/statuses, threshold decision, and resulting restriction ID/source_ref as the evidence set.

   A fresh AI recheck may be included in this pre-write phase only when `RequestSubmission.apply_initial_hold` creates an active hold for every public scope that would otherwise expose the target, or a separately verified active restriction already keeps each such scope hidden. For a multi-Community Article, select the target only if every applicable public scope is enumerated and rechecked separately through its own `RequestSubmission` transaction; one scope's hold does not cover another scope. System-only and `immediate` scopes that skip initial holds are otherwise excluded from pre-write rechecks and run after writes/reads reopen. Such a scope may be included before reads reopen only if an active `manual_hold`, `report_threshold_hold`, or another restriction explicitly designated in the canonical contract as AI-unclearable keeps every applicable public scope hidden. An `ai_review_hold`, `ai_suspect_hold`, or `human_review_hold` does not qualify: applying the new AI result may clear it. If no qualifying external hold exists, either defer the recheck until reads reopen or keep public reads frozen through Step 10 result verification. Do not rely on the Step 9 snapshot assertion to prove the target stays hidden after AI processing. For each eligible pre-write scope recheck, use the normal V2 recheck/`RequestSubmission` transaction so the request, generation-bound waiting hold when applicable, Effect, and idempotency key commit together. These explicitly listed commands are the only Step 9 write-freeze exceptions; no producer or cron may add unrelated requests/jobs. Keep the `cms_review` consumer stopped while these transactions run. Verify every Step 9 request ID separately has its expected Effect and queued job, plus a request-bound hold when `RequestSubmission.apply_initial_hold` creates one; otherwise verify that the qualifying AI-unclearable external restriction is active. The queue may contain Step 9 recheck IDs only. Do not automatically re-evaluate targets whose active manual decision was intentionally resolved during the V2 gate.

10. Start the new `cms_review` consumer and let it process the Step 9 request IDs; verify their result/application state and ensure no unintended target became public. For each request that had no request-bound waiting hold, re-read the final restriction state after result application and assert the target is still hidden by `manual_hold`, `report_threshold_hold`, or another restriction explicitly designated AI-unclearable. If that assertion fails, keep public reads frozen and resolve the visibility state through the V2 business path. Only after these post-consumer assertions pass may reads be reopened when they were frozen. Then coordinate ordinary write-ingress reopening with re-enabling the new ReviewBot/recheck/report producers and cron; do not enable producers/cron earlier, since they can create unrelated requests/jobs while the queue is being audited. If public reads stayed available, perform the same coordinated write/producers/cron switch after verification. The canary and Step 9 transactions already verified the normal write path before this switch.

No old `deny`/`release` client or receipt is supported after the cutover. Historical moderator decisions and old receipts are intentionally not carried forward, but current active V2 decisions are respected through the zero-count gate before old-valued review-block rows are retired. Replace the database `type IN (...)` and `source IN (...)` constraints only after the gate has passed and every row violating the new checks has been retired.

Rollback contract: before the canary commits, keep writes frozen and restore the verified pre-cutover database backup plus exact old app/config images; this is a full restore because DDL and cleanup have already run. The canary is the first new-contract write. After it commits, there is no in-place rollback: use a forward fix or restore the full backup, discarding the canary and any later cutover writes. Reopening ordinary writes is the point after which a restore also discards user writes. Before resuming the restored system, invalidate local pending command queues and require fresh command IDs so commands accepted after the backup are not accidentally repeated under the restored receipt table. Never mix post-cutover rows into the old schema or attempt partial receipt restoration.

## 3. Ticket module boundary and call flow

Keep a small fixed module, not a generic workflow framework. Preserve distinct composite entry points because a source/community pair cannot represent a whole Community change or a global Post deletion:

```elixir
SourceVisibility.update_in_transaction(post_id, community, actor, cause, operation_ref)
SourceVisibility.update_community_in_transaction(community, actor, operation_ref)
SourceVisibility.update_all_in_transaction(post_id, actor, cause, operation_ref)
SourceVisibility.revalidate_cache_in_transaction(post_id, identity, effect_key)
```

`update_in_transaction/5` handles one Post/Community pair. Each lifecycle wrapper supplies `visibility_cause` from `Tickets.Const.visibility_cause`, preserving the existing values `:post_trash`, `:post_restore`, `:post_review_block`, `:community_visibility`, and `:ticket_review_block_resolved`. Do not rename these observable values: they appear in Activity metadata and Outbox effect keys. `update_community_in_transaction/3` visits every linked Post and retains the existing `FOR UPDATE` row locks. `update_all_in_transaction/4` visits all linked Communities and preserves the current global lock scope. `revalidate_cache_in_transaction/3` is the publish-revision cache-only path: it must not change Ticket lifecycle or Activity.

The public flow is:

```elixir
update_all_in_transaction(post, actor, cause, operation_ref)
  -> linked_to(post) # Communities bound to the Post
  -> update_in_transaction(post, community, actor, cause, operation_ref) per Community
  -> PublicPosts.public?(community.id, post)
  -> recheck_visibility(public?, post, community, actor, cause, operation_ref)
```

`update_all_in_transaction/4` enumerates bound Communities through `linked_to/1`. For each binding, `update_in_transaction/5` asks `PublicPosts.public?/2` whether the source is public in that Community. The private `recheck_visibility/6` then chooses the fixed branch:

```elixir
if public? do
  cache_revalidate(community, source, operation_ref, effect_key)
else
  Persist.hold_linked_to_post(community, source, actor, operation_ref, cause)
end
```

`Persist` owns the synchronous Ticket lifecycle update, Activity insert, workflow-version increment, and Outbox intent in the caller's transaction. The Outbox worker purges cache tags after commit. `update_community_in_transaction/3` first locks every bound Post with `FOR UPDATE`, then runs the same per-Community path. `revalidate_cache_in_transaction/3` is the publish-revision path and calls cache invalidation only.

Within `CMS.Tickets.SourceVisibility`, omit redundant `ticket_` prefixes:

- `linked_to/1` loads bound Communities for a Post; Ticket selection happens in `Persist`.
- `recheck_visibility/6` chooses the public cache-only path or private visibility path. `Persist` applies the fixed single-source rule; multiple-source Ticket behavior remains unchanged.
- `cache_revalidate/4` synchronously writes invalidation intents for affected Ticket list/detail and source cache tags to Outbox; actual purge is asynchronous.
- Every public entry point checks `Repo.in_transaction?/0` and returns `{:error, reason}` when called outside its caller-owned transaction.

The publish-revision cache-only caller must preserve the existing version/cache behavior without recording a lifecycle Activity. All wrappers must preserve caller-owned transaction and operation identity.

```text
CMS article trash ─────────────────────────> update_all_in_transaction
CMS review restriction apply/end ──────────> update_in_transaction per Community
Community public-readability change ───────> update_community_in_transaction
Post publish new revision (cache only) ────> revalidate_cache_in_transaction
```

## 4. AI provider contract and testing

The moderator/business contract stays provider-neutral:

```text
ReviewBot -> stable AI adapter contract -> configured provider -> validated OpinionOutput
```

The current Cloudflare path is Phoenix calling the Review AI Worker over its configured HTTP endpoint; the Worker calls Cloudflare Workers AI with the configured Cloudflare Workers AI model (Clef-flash). This model path is text-only; image-required requests fail closed. Keep the adapter request/response schema stable if changing providers. Provider/model selection belongs in provider-owned typed configuration; opinion values belong to the AI-owned output enum and shared contract schema, not duplicated inline strings. Every provider must return the same validated opinion contract (`clear`, `suspect`, `uncertain`, coverage, and bounded notes); provider changes must not alter CMS review or AlertWall interfaces.

Tests should stub the stable adapter boundary and simulate provider outcomes; local tests must not call Cloudflare:

- `clear`, `suspect`, `uncertain`, malformed output, timeout/unavailable, and retry exhaustion;
- Article, Comment, Doc, and doc-thread Comment tests separately cover content edit clear ending the outdated request's `ai_review_hold`, `ai_suspect_hold`, and `human_review_hold` in the same scope, while preserving `manual_hold` and `report_threshold_hold`;
- Article, Comment, Doc, and doc-thread Comment tests separately cover manual recheck (`replaced_at` without `outdated_at`) clear not ending old request-bound AI or human waiting holds;
- cutover tests verify retained `artiment_reviews` rows with `replaced_at` set are excluded from `pendingContentReviews` but remain readable through Wall history;
- `approve` and `reject` apply the fixed server scope, including failed AI approval and stale-result rejection;
- `approve` clears an independently applied `manual_hold` in the same scope, while a hold in another scope remains active;
- threshold counts distinct active reporters; reports for different observed versions do not combine;
- concurrent threshold-crossing reports apply one hold atomically; failed restriction persistence rolls back the crossing report;
- threshold initialization re-reads item/report state under the target lock and skips a snapshot candidate resolved or outdated before application;
- threshold initialization asserts the `report_threshold_hold` threshold boundary, stable `source_ref`, idempotent application, and absence of `report_threshold_hold` below threshold independently of other restriction types and recheck request/job assertions;
- account reports never apply a content restriction; `resolveAlertItem` never clears `report_threshold_hold`;
- threshold integration covers platform-scoped Post Comments reported from different Communities, Doc Comments using their branch Community scope, and platform-scoped Docs; an author sees a threshold hold as `waiting_human`;
- the single vocabulary migration checks all restriction tables for retired type/source values before changing any constraint, and aborts without modifying constraints when stale rows remain;
- single-source Ticket downgrade caused by `report_threshold_hold`, multi-source Ticket preservation when one or all sources are hidden;
- cutover recheck tests cover each public Community scope independently; a multi-Community Article is selected only when every exposed scope is held by its own waiting hold or another verified active restriction. A system-only/`immediate` pre-write recheck without a request-bound hold requires `manual_hold`, `report_threshold_hold`, or another explicitly AI-unclearable restriction on every exposed scope; after consumer result application, assert that restriction still hides the target before reopening reads. Otherwise keep reads frozen through Step 10 or defer the recheck until reads reopen;
- cutover job cleanup verifies the old consumer is stopped before deletion, the canary consumer is stopped before Step 9 jobs are created, only Step 9 request IDs remain queued during hold/effect verification, and the consumer resumes only afterward;
- canary preflight verifies current published content/`ArticlePublic`, a hold-producing scope, zero active review restrictions, and a non-public baseline visibility condition;
- Ticket state, `TicketState.workflow_version`, and Activity roll back together; Outbox intent commits with state and worker purges the expected cache tags;
- GraphQL/UI contract tests cover fresh `...V2` approve/reject/recheck mutation fields, assert old root fields are absent, and verify typed `ReviewCommandResult.action` serialization for `APPROVE`, `REJECT`, and `RECHECK`;
- a shared AI schema contract test verifies Phoenix request/response fields, status values, coverage values, and note bounds against the language-neutral schema and generated Worker types;
- hard-cutover deployment verification covers all affected write paths frozen, read-only fallback behavior, producers/cron/consumer paused during Step 9 job audit, target/job snapshot, V2 zero-count gate, per-table retention predicates, operation-filtered receipt cleanup, DDL order, old Oban job removal and optional scoped Outbox event cleanup, threshold initialization from re-read current V2 reports, per-scope pre-write rechecks, canary as first new-contract write, canary eligibility and failure restore/forward-fix path, and coordinated producer/cron/write-ingress restart with no old client/command-ID support;

Local Worker tests mock `env.AI.run`; Phoenix tests inject a fake adapter and exercise request/result application. An opt-in integration run may call the real Cloudflare Worker and consume Workers AI quota.

## 5. Implementation sequence

1. Add closed review enums to `GroupherServer.CMS.Review.Const`, runtime policy to `GroupherServer.CMS.Review.Config` (or `ReviewBotConfig`), and the language-neutral AI request/response schema to `packages/contracts`; add boundary/contract tests.
2. Perform the breaking cutover in the ordered maintenance procedure above: satisfy the V2 zero-count gate through formal commands, snapshot targets/jobs/reports, filter receipt cleanup by review operation, then apply DDL and new code. No aliases, data translation, or old-client support.
3. Add the atomic report-threshold transaction, stable `source_ref`, and tests for version isolation, idempotency, concurrency, rollback, account scope, and Wall-only resolution.
4. Add `Tickets.Const.visibility_cause` with the existing values, then route Post trash/restore, review restriction changes, Community readability changes, and Post revision cache revalidation through `Tickets.SourceVisibility`. Ticket state, synchronous Activity, workflow version increments, and cache invalidation intent remain in the caller transaction; cache purge remains asynchronous.
5. Focused local verification passed: backend AI/review/GraphQL/Ticket tests (95), Review AI Worker tests (8), contracts tests (26), and CMSReview UI tests (2). Backend `mix compile --warnings-as-errors`, Worker/contracts/Core type-checks, GraphQL SDL and TS code generation, AI contract generation check, and `pnpm docs:check` also passed. The hard-cutover runbook has not been executed against a deployed environment.

The configured threshold is three distinct reporters per current Wall item/version, with no time window and platform-wide scope. Action, restriction, provider result, and visibility-cause vocabularies remain in their domain `Const` modules; runtime threshold policy remains in `CMS.Review.Config`.
