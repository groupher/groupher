# Passport P4c legacy inventory — 2026-11-24

## Scope and safety

- Source: existing Neon branch `main` (`br-falling-silence-a1eslt2n`).
- Read-only rehearsal clone: `docs-d3-acceptance-20261123` (`br-wandering-mouse-a13jlyqy`), database `neondb`.
- All database checks below used read-only `SELECT` statements on the clone. No migration or data write was run. The clone metadata reported zero written data bytes.
- This is an aggregate inventory, not a completed `LegacyPlan.report` or a production acceptance.

## Database and migration facts

- `neondb` contains 819 `schema_migrations` rows; latest applied version is `20261123102000`.
- The local Passport docs worktree has 816 migration files and latest local version `20261123102000`.
- Applied versions not present in that worktree are `20260820110000`, `20260821103000`, and `20261018080000`. The two newest local migration files, `20261122120000` and `20261123102000`, are present and applied. `20261018080000` is referenced in `docs/import/cloudflare-workers-migration-plan.md` as a deployed Activity contract repair; provenance for the other two absent versions is not established here.
- The legacy seed database `groupher_prod_seed_20261104` has 742 migration rows (latest `20261104120000`), 33 Articles, 8 body snapshots, 32 Article publics, and no Passport rows. It is a separate seed dataset; it does not supply Passport report input.

## Passport aggregate findings

On the rehearsal clone's `neondb`:

- 3 Passport rows map to 3 distinct, non-null users; none has null rules.
- All 3 rules values are JSON objects with an object-valued `global` field. The `cms` field is absent in all 3.
- The normalized community-scope inventory contains 3 scopes. Each has exactly one canonical membership; no missing or ambiguous membership was found.
- The 3 community-scope entries are boolean `true`; there are no global grant entries or non-boolean entries.

These checks establish only JSON shape and membership cardinality. They do not determine whether each legacy permission is still known, grantable, same-scope, semantically equivalent, retired, or requires manual mapping. Those classifications require the application `Catalog` and a complete `LegacyPlan.report`.

## Earlier application report attempt (superseded by the completed report below)

- The target worktree has no completed `MIX_ENV=prod` build. A private cold build was interrupted during dependency/application compilation; no `deps.get`, migration, or database write occurred. No Mix/Elixir report process remains active.
- Direct read-only SQL connectivity to the Neon clone was verified. An application-level read-only `LegacyPlan.report` attempt did not complete across all Passport rows, so that interrupted attempt produced no complete application report; the later completed run is recorded below.
- **Decision:** do not apply migrations or cut over based on this rehearsal. Reconcile the three applied versions absent from the local migration files against the full target history, then run and review the complete report using the target's supported build/runtime. Any report exceptions remain a blocker to applying legacy grants.

## Completed application report on 2026-11-24

Normal target-source compilation with warnings as errors completed before this report. The recorded baseline was 1267e055e plus uncommitted validation-only edits, including multiline block style in LegacyPlan. The exact dirty source blob was not recorded, so this historical report is not a reproducible acceptance result for the current PR head. Current Catalog/LegacyPlan behavior must be checked against its committed source and tests; D3 release rehearsal remains separate.

Clone identity was rechecked against project summer-union-85679467, branch br-wandering-mouse-a13jlyqy, parent br-falling-silence-a1eslt2n and parent LSN 0/59DB3D18. Only Repo was started. The session used default_transaction_read_only=on and the report ran in a REPEATABLE READ READ ONLY transaction. Observed database was neondb and transaction_read_only was on. All three distinct Passport users were passed through the target LegacyPlan.report/1 and Catalog.

| User ID | Community        | Community ID | Member ID | Planned identity | Permission keys | Exceptions |
| ------- | ---------------- | ------------ | --------- | ---------------- | --------------- | ---------- |
| 1       | home             | 9            | 9         | lord             | none            | none       |
| 709     | home             | 9            | 10        | lord             | none            | none       |
| 710     | press-acceptance | 10           | 11        | lord             | none            | none       |

All three results were successful plans with empty exceptions, empty Global permissions, is_root=false and the listed Community is_lord=true. These three rows require no manual grant mapping. No grants were applied. Application-level migration and recovery acceptance, and provenance of the two unidentified migration versions, remain open.
