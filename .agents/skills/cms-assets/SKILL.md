---
name: cms-assets
description: Audit, design, implement, or debug Groupher CMS asset identity, upload/finalize, Article WorkingCopy and Snapshot refs, usage projection, delete protection, replacement, provider cleanup, and Assets Hub handoffs. Do not use for ordinary image styling or generic file uploads outside CMS assets.
---

# CMS Assets

Keep Phoenix business facts separate from Assets Hub object execution, and keep version-owned refs separate from asset-row mutations.

## Current Contracts

- Start with `docs/assets-hub/README.md` for version status and ownership.
- Read `docs/feature/article/working-copy-snapshot-target.md` for current Article ownership and `docs/assets-hub/v5.md` for asset lifecycle history; verify resource-specific refs against current schemas.
- Read `docs/migrations/cms-assets-refactor.md` for the current Phoenix facade, Command, Workflow, Persist, Query, and Effects boundaries.
- Read `docs/assets-hub/local-runtime.md` only for provider/runtime work. Older V1-V4 documents are historical or subsystem-specific and must not override V5 ownership.

## Ownership

```text
user asset-row mutation -> concrete CMS Command -> Gate -> Receipt -> Assets.Persist
upload/provider/replacement process -> named durable Workflow -> Effects/Outbox -> Assets Hub
Article content save -> Article transaction -> Assets.Refs -> version-owned ArticleAssetRef
asset reads/usage -> Assets.Query -> typed projection
```

- `CommunityAsset` owns stable community-scoped business identity and metadata; Assets Hub owns provider object execution.
- `ArticleAssetRef` has exactly one owner: a resource-specific mutable WorkingCopy or immutable Snapshot. It is not a second asset row and not embedded in `ArtimentBody`.
- Publishing freezes body, covers, and refs into a Snapshot. Historical Snapshots remain immutable.
- Delete guard uses authoritative blocking refs and completeness facts; display usage counts are not a safety authority.
- Provider deletion, cleanup, and reconciliation are durable effects/workflows, not synchronous user Command steps.
- Do not let Assets Hub query Phoenix tables or let Phoenix persist provider-specific signed URLs as content identity.

## Workflow

1. Classify the change as asset-row Command, upload/finalize Workflow, content-owned ref mutation, read projection, or provider effect before editing.
2. Trace identity and transaction ownership from the public `GroupherServer.CMS` Context used by external callers through its internal `CMS.Assets` capability, schema constraints, GraphQL/service surface, tests, and current docs.
3. For ref changes, verify WorkingCopy/Snapshot ownership, copy/freeze behavior, completeness fence, deletion guard, and cleanup cascade together.
4. For provider work, verify idempotency identity, durable retry/recovery, capability scope, and reconciliation rather than adding direct object mutations to a user transaction.
5. Validate focused Assets/Article tests, relevant service tests, compile/type-check, documentation gates, and `git diff --check`.
