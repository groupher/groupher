---
name: db-migration-rehearsal
description: Rehearse Groupher database migrations on an explicitly selected isolated clone, verify data and schema invariants, and exercise the planned recovery path. Use for migration acceptance and cutover preparation, including Neon branches or disposable local PostgreSQL databases.
---

# Database Migration Rehearsal

Rehearse the existing migration contract on a clone and keep enough evidence to resume without repeating discovery. This skill does not authorize production changes, expand a deletion manifest, or replace the domain's migration design.

## Identify the target once

- Record repository HEAD and dirty migration files, source provider/project/branch/database, clone identity, and the exact migration range. A branch can contain multiple databases. Confirm the database from current runtime evidence or the user's selection; never choose it because its name contains `prod`, `seed` or `main`.
- Use the installed `neon-postgres:neon-postgres` skill and Neon connector/CLI for Neon branch operations. Read its current branch/connection guidance rather than copying provider commands here. For local PostgreSQL, use an explicitly named disposable database and the project's existing scripts. Neither path should modify the source database.
- Keep connection credentials in private temporary files or supported secret inputs, outside the evidence record. Use a direct connection for migrations and backup/restore; a `-pooler` endpoint is unsuitable for session-dependent migration work.

## Preflight before mutation

1. Read the domain migration plan and its existing inventory/migration entrypoints. For Docs, start with [Docs Queue contract](../../../docs/migrations/docs-publish-queue-refactor.md) and the relevant batch's current runbook. Preserve Queue ownership of body editing, Save/Merge, Approval and Release. Historical acceptance scripts are examples, not approval for their hardcoded targets or cleanup scope.
2. Create or reuse the recorded clone only after verifying its source identity, creation time and baseline. Record `current_database()`, `current_user`, PostgreSQL version, applied migration versions and counts; compare exact versions with local migration files. Do not infer pending count from only the highest version.
3. Run the domain's read-only inventory. Return counts, reference classifications and fingerprints rather than body content. Compare the deletion manifest to actual tables and inbound FKs before applying it. Missing tables and newly discovered references require review; do not add populated tables, use `CASCADE`, or clear ordinary Articles to get past a Docs migration guard without authorization for that exact scope.
4. Establish the recovery baseline before writes. On Neon, use a provider-supported snapshot or an independent pre-change branch; snapshot eligibility depends on the branch type. On local PostgreSQL, use a backup that can be restored into another disposable database. Record provider IDs/LSN or backup identity and the data/schema checks that will prove recovery. Preserve this baseline through acceptance.

## Run and resume

- Execute the reviewed manifest and existing migration entrypoint only against the explicit clone host/database. Preserve domain guards, migration ordering and transactional protection. Verify protected data fingerprints and intended counts after cleanup, then run the migrations. No new migration runner is needed when one already exists.
- Keep the execution session handle and save redacted output. A live process with no new output is not a failure. After a terminal connection failure, inspect `schema_migrations` and current schema before resuming; previous migration transactions may already be committed. Resume unapplied versions through the normal migrator instead of resetting the clone or rerunning destructive cleanup.
- Verify all expected versions, schema constraints, domain invariants and the requested business smoke checks. An empty-database migration proves DDL ordering, not conversion of populated data or real service delivery. Keep those results distinct.
- Exercise recovery in a separate isolated target from the recorded baseline. Compare baseline migration versions, row counts and protected fingerprints and run the required pre-change smoke check. Creating a backup alone does not prove recovery. Do not swap or restore over the source branch; provider destructive-tool requirements still apply.

## Evidence and cleanup

Record source/clone/recovery identities, HEAD and migration-file changes, baseline and final versions, inventory/manifest, counts and fingerprints, elapsed time, failures/resume points, smoke results and recovery comparison. Use the batch's evidence directory under `docs/migrations/evidence/` for durable acceptance records; temporary logs belong under `.playwright/`. Exclude passwords, connection URLs, tokens and content dumps.

Use [test-cleanup](../grstack/references/test-cleanup.md) to account for disposable databases/branches, private connection files and retained evidence. Keep a clone or baseline explicitly retained if follow-up work needs it. Report rehearsal completion separately from production cutover; production execution needs its own authorization.
