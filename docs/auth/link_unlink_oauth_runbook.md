# OAuth V1 Cutover Runbook

This runbook is the reviewed execution checklist for the OAuth link/unlink V1
cutover described in [link_unlink_oauth.md](./link_unlink_oauth.md).

It is not an automatic Ecto migration. The raw cleanup is an explicitly-run
post-deploy data operation and must happen only after the new Auth/Phoenix
release is fully serving and all old writers have drained.

## Artifacts

- Cleanup SQL: [`backend/main/scripts/oauth_cutover_raw_cleanup.sql`](../../backend/main/scripts/oauth_cutover_raw_cleanup.sql)
- Migration: `backend/main/priv/repo/migrations/20260811100000_harden_oauth_provider_bindings.exs`
- Reviewed release commit: `________________________`
- Cleanup script version or checksum: `________________________`

The cleanup SQL is forward-only. It does not create a backup table and it is
not a rollback action.

## Before deployment

- [ ] Confirm the release commit contains the bounded OAuth DTO and no raw
      writer in Auth or Phoenix.
- [ ] Confirm the migration preflight reports zero duplicate
      `(user_id, provider)` groups.
- [ ] Record the duplicate preflight query output and affected-row count.
- [ ] Confirm the database is PostgreSQL 13+ (`gen_random_uuid()` is used by
      the binding migration).
- [ ] Confirm the approved first-party Auth origins and CSRF configuration.
- [ ] Record operator and approver.

If the duplicate assertion fails, stop. This cutover does not delete, rewrite,
merge, archive, or otherwise repair provider bindings.

## Rollout and drain

- [ ] Deploy the new Auth and Phoenix versions.
- [ ] Verify every Auth instance reports the new release commit.
- [ ] Verify every Phoenix instance reports the new release commit.
- [ ] Drain and remove all old instances.
- [ ] Prove no old registration or link writer remains active.
- [ ] Record rollout completion time and the drain evidence/links.

Do not run the cleanup while an old writer can still write
`account.oauth_providers.raw`; a subsequent sign-in could repopulate the value.

## Execute cleanup

Run the checked-in SQL with `ON_ERROR_STOP` enabled, for example:

```sh
psql --set ON_ERROR_STOP=1 "$DATABASE_URL" \\
  -f backend/main/scripts/oauth_cutover_raw_cleanup.sql
```

- [ ] Record `non_null_raw_before`.
- [ ] Record `rows_cleared`.
- [ ] Record `non_null_raw_after` (must be `0`).
- [ ] Confirm the transaction committed successfully.

## Post-run verification

- [ ] Duplicate `(user_id, provider)` count remains `0`.
- [ ] `account.oauth_providers.raw IS NOT NULL` count is `0`.
- [ ] A new sign-in stores only bounded allowlisted metadata.
- [ ] Link smoke test succeeds through Auth and the GitHub callback.
- [ ] Unlink smoke test succeeds and preserves the last-login-method rule.
- [ ] Normal sign-in still creates or reuses the expected Browser Session.
- [ ] Monitoring shows no OAuth callback, token refresh, or Phoenix delegation
      error spike.
- [ ] Record smoke-test results, monitoring links, execution time, and final
      status.

## Failure handling

- Migration duplicate assertion: stop deployment and produce the conflicting
  row report for separate product-approved review.
- Cleanup SQL failure before commit: investigate and rerun only after the
  release/drain preconditions are still true.
- Cleanup committed with a non-zero post-run raw count: stop rollout follow-up,
  verify writers and rerun the checked-in SQL after approval.
- Never restore unbounded raw values during rollback. The cleanup is
  intentionally forward-only.

## Execution record

```text
release commit:
cleanup script checksum:
operator:
approver:
started at:
finished at:
duplicate groups before:
non_null_raw_before:
rows_cleared:
non_null_raw_after:
post-run duplicate groups:
link smoke:
unlink smoke:
sign-in smoke:
monitoring result:
final status:
notes:
```
