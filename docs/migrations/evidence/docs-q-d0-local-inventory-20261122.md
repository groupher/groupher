# Docs Q D0 Local Inventory — 2026-11-22

## Scope

This is a report-only read of the local development database `groupher_server_dev` on 2026-11-22. The connection was explicitly placed in a PostgreSQL `READ ONLY` transaction and rolled back after the queries. It is local development evidence only; it is not production or rehearsal evidence and does not authorize DDL or deletion.

The repeatable inventory query is [docs-q-d0-inventory.sql](./docs-q-d0-inventory.sql). It compares each active Queue WorkingCopy with its recorded source Snapshot, counts Queue-linked asset and cover references, and inventories Approval, Release, and post-publish conflict references without returning body content.

## Findings

- One Docs Queue exists for Community `home`; its `queue_revision` and `tree_lock_version` are both `0`. It has no public Release or latest Approval and contains **0** queued Articles.
- There are **0** Queue-linked WorkingCopies, including non-default-scope copies; the local database has no Queue WorkingCopy revision or body difference to disposition.
- There are **0** Docs Publish Approvals, **0** Approval Article rows, **0** Docs Releases, and **0** Release Article rows.
- Queue article contributors, tree contributors, approval contributors, and tree changes are all **0**.
- Queue-linked WorkingCopy and source-Snapshot asset references, cover-edit references, Approval / Release Snapshot asset references, and post-publish conflicts are all **0**.

## D0 Status

The current local development database has no active Queue body content or related references requiring disposition. D0 is **not globally complete**: this evidence does not cover a production snapshot, a staging clone, another developer database, or an approved rehearsal database. D1 code may be developed against the target contract, but any DDL or data cutover still requires the same report against the selected clone, an item-level disposition list for any non-empty result, and the D3 backup/rehearsal evidence described in [Docs Mirror Fix §6.2](../docs-mirror-fix.md#62-queue-preserving-d1-局部交付).
