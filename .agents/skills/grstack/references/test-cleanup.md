# Test Cleanup and Findings

Use one small resource ledger for a test run so cleanup does not require rediscovering ownership. Follow the existing domain tools and retention contracts. Cleanup is complete when temporary access and resources are removed or explicitly retained with a reason, and any interrupted original runtime is restored.

## Record while creating

Keep a non-secret record under `.playwright/<run>/cleanup.md` or the acceptance runner's existing evidence file. Reuse the current run record rather than creating a parallel registry. Record only resources this task actually owns:

| Resource                 | Identity and ownership evidence                                    | Planned disposition                    | Actual result |
| ------------------------ | ------------------------------------------------------------------ | -------------------------------------- | ------------- |
| Fixture run              | run name, aliases, recorded Community/Article refs                 | clean/close; retain content per policy | pending       |
| Browser/session          | actor alias, owned profile/session handle                          | revoke and close                       | pending       |
| Isolated database/branch | exact host/database or provider project/branch ID; creation result | remove or retain for follow-up         | pending       |
| Temporary checkout/cache | path, base SHA, task-created overlay, owned process handles        | remove target-owned checkout/cache     | pending       |
| Runtime handoff          | original root and active service set                               | restore original identity/health       | pending       |

Record an exact identity, not a name prefix. Different worktrees and run names can still share a database. A pre-existing resource or another task's live process is not owned by this run.

## Finish in dependency order

1. Save test results and evidence before teardown. Check any still-running job by its session/process handle. A tool observation timeout alone does not justify stopping or replacing it.
2. While the test code and schema are available, preview and apply fixture cleanup through [seed](../../seed/SKILL.md): `pnpm seed cleanup run --run <run>`, then `--apply` when cleanup is within scope. Inspect blockers and remaining grants/requests. Use `pnpm devhub actors close --run <run>` for final session revocation and run closure if not already closed. Preserve Article/account/history records according to the tool's policy; do not force-delete rows or disable triggers.
3. Close owned browser profiles and verify revoked sessions through the fixture tool's report or existing session verifier. Closing a browser window alone does not revoke its session. Record any deliberately retained user session.
4. After test processes release their connections, remove only the exact disposable local test databases created by this run and verify absence. For registered secondary checkouts, use `pnpm devhub db drop --target test` or `--target dev` after the run's fixture cleanup and service shutdown; do not override the registered database name. Unregistered isolated test runners may use `MIX_ENV=test TEST_DB_NAME=<unique-name-containing-test>`; `DB_NAME` does not select the test database. Never reset/drop shared `groupher_server_test` or terminate unrelated sessions to make cleanup succeed. For remote clones, follow the provider tool's deletion authorization and recovery retention requirements; mark retained branches explicitly if deletion is not authorized.
5. Follow [dev-hub-worktree](../../dev-hub/references/shared-runtime-handoff.md) to restore any planned temporary schema/runtime handoff. Verify original Hub identity and the original service set. For a disposable PR checkout, use [pr-integration](pr-integration.md); check for unrecorded edits before removing it, and remove only target-owned caches, never the source dependency/build cache. Delete private temporary credential files when no longer needed; keep the redacted evidence.

If one cleanup step fails, continue independent cleanup and keep the affected ledger rows open. Report the exact remaining identity, impact and next action. Do not call a partial cleanup successful or remove evidence needed to diagnose it.

## Record findings that prevent repeat work

For a fixture or cleanup defect, record the failing command/test, current code/schema versions, cause, narrow fix, focused rerun result and resource disposition. Distinguish a product defect from a stale fixture, environment mismatch and shared-data contamination. Append to the active batch's existing evidence record; use `docs/migrations/evidence/` only when the work belongs to a migration batch.

Before the next acceptance attempt, read unresolved rows and reuse verified retained fixtures where their intent still matches. Do not recreate accounts, repeat schema discovery or rerun a completed expensive suite merely because the previous result was not included in a status message.
