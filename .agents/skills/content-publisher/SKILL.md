---
name: content-publisher
description: Audit, design, implement, or debug Groupher canonical rich-content publishing across browser or importer commands, trusted Node BodyBag generation, service and delegated-user auth, Phoenix GraphQL commands, version conflicts, and draft reconciliation. Do not use for read-only rendering or repository/site bulk-import orchestration.
---

# Content Publisher

Preserve one trusted path from raw Plate/Markdown input to canonical persisted content.

## Current Contract

- Read `docs/architecture/content-publisher.md` first. It is the cross-application source of truth.
- For Import Content history or converter boundaries, read `docs/import/article-publish-import-refactor.md`; it does not override the current Publisher contract.
- For command replay and recovery, read `docs/architecture/cms-command.md` and `cms-command-confirmation.md`.
- For version-owned body and asset relationships, read `docs/feature/article/working-copy-snapshot-target.md` and `docs/assets-hub/v5.md` only when that ownership is in scope.

## Invariants

```text
raw Plate / Markdown command
  -> same-origin trusted Node route
  -> @groupher/content-publisher canonical BodyBag
  -> fixed action adapter + service capability + delegated user proof
  -> Phoenix mutation / CMS command
  -> atomic body, metadata, version, receipt, and asset-ref persistence
```

- Browsers submit raw source and typed business payload; they never create BodyBag or receive service credentials.
- Action derives content type, required scope, and fixed GraphQL operation. Never expose an arbitrary GraphQL proxy.
- Keep the shared package transport-neutral. HTTP auth, environment, service tokens, and Phoenix calls belong to the host adapter.
- `body` is the canonical runtime projection. Do not restore `document` aliases, association fallbacks, dual reads, or dual writes.
- Asset refs are version/resource-owned relations, not fields inside `ArtimentBody`; WorkingCopy and Snapshot owners must remain distinct, with resource-specific ownership checked against current schemas.
- Expected-version conflicts use generated domain ErrorCat codes and the current adapter contract. Distinguish Article WorkingCopy, Docs queue, Docs queue copy, and public-head conflicts so clients reload the affected state and preserve dirty edits; do not classify unrelated errors as conflicts. For a remotely changed queue copy, show the current version and require explicit confirmation before replacing it with local edits or discarding those edits; recheck revisions on the next write.
- Receipt unavailable, expired, and identity-conflict responses have distinct recovery semantics. An unknown transport outcome retains the exact command ID and input for retry; never silently rebuild an uncertain command with a new ID. A failed read is not evidence that a write committed.
- Cross-runtime ErrorCat codes have one generated contract and a freshness check. Phoenix and Node consumers must not duplicate numeric literals.
- Service capability and delegated user authorization are independent requirements. `SERVICE_SCOPE_FORBIDDEN` is a service-auth `403`, not a business validation error.
- Expected Publisher validation keeps its stable status, code, and diagnostics; catch-all infrastructure handling must not rewrite it as `502`.
- `429` recovery schedules one cancellable wake-up. If a prior outcome is unknown, retry its original ID and input before saving newer edits; clear the wake-up on success, target change, or unmount.
- When GraphQL returns several errors, adapters use an explicit security/backpressure/conflict/domain precedence rather than trusting array order.

## Workflow

1. Trace the affected action through contracts/parser, host route, Publisher normalization, fixed adapter, GraphQL mutation, BodyBagTrust, Gate/Command, persistence projection, client recovery, and docs.
2. When changing a wire field or error contract, search every generated operation and consumer; regenerate schema/types in the same change.
3. Keep body, metadata, asset refs, expected version, and Receipt transaction ownership explicit. Do not fix one projection while leaving a fallback in another layer.
4. Test parser and adapter mappings, Phoenix success/error extensions, command replay/version conflict, frontend recovery, and browser paths for success, commit-then-response-loss replay, conflict, and rate-limit recovery when autosave is in scope.
5. Model browser mocks as resettable scenarios with receipt identity; do not encode success/conflict behavior in test execution order.
6. Run `make be.gen.schema`, `pnpm graphql:codegen`, `pnpm contract:graphql:generated`, focused tests, type-check, generated-contract freshness, and `git diff --check` in proportion to the change.
