---
name: gate-lifecycle
description: Audit, design, implement, or repair Groupher CMS Gate admission and resource Lifecycle changes. Use when authorization, read scope, typed Gate context, lifecycle state, transitions, blockers, or their boundary is involved.
---

# Gate Lifecycle

Keep actor-aware admission separate from actor-independent resource state.

## Choose the failing behavior

- A user unexpectedly sees or can mutate a resource. Reproduce with the same actor, action, resource and community. Check the scoped Passport facts, membership and resource state, then verify one allowed and one denied case. [Passport scope](../../../docs/architecture/passport-request-scope.md) · [Gate](../../../docs/feature/gate/README.md)
- A resource moves to the wrong state. Start from its current state and requested transition, inspect the blockers, then check persistence and subsequent read visibility. Exercise both the allowed transition and a rejected one. [Lifecycle](../../../docs/feature/lifecycle/README.md)
- A write times out or a retry produces duplicate effects. Follow the command identity through confirmation, transaction and effect delivery. Start from the [Command contract](../../../docs/architecture/cms-command.md) and the affected domain's own workflow.

## Current Contracts

- Start with `docs/feature/gate/README.md`; it classifies current contracts versus implementation history.
- Read `docs/feature/gate/v5.md` for the implemented `Scope.Query` naming and dispatch boundary, and `v4.md` when typed Access/Scope Context is involved. Use `v2.md` and `v3.md` only for the historical contract or an Article/Doc boundary they still own.
- Start Lifecycle work from `docs/feature/lifecycle/README.md`. Read `contract.md` for Community Lifecycle; use the target resource's own current document, such as `docs/feature/article/working-copy-snapshot-target.md`, for Article/Doc state.
- For a write-path ownership question spanning Command, Gate, Lifecycle, and persistence, also read `docs/migrations/cms-command-gate-lifecycle-persist-boundary.md`.
- Treat design documents as contracts to verify against current code, not automatic proof that every phase is implemented.

## Ownership

```text
Reader/query caller
  -> CMS.Gate.scope/4
  -> typed Scope Context
  -> Ecto.Query

Mutation command/writer
  -> CMS.Gate.access_check/3
  -> Gate Loader + typed Access Context
  -> canonical resource
  -> Lifecycle transition / domain write
  -> audit and post-commit effects
```

- Gate owns actor/action admission and composes authoritative facts from Passport, resource relationships, Lifecycle, membership, moderation, billing, and operational policy.
- Lifecycle owns resource state, allowed transitions, blockers, capability predicates, locking, and version/concurrency guards. Lifecycle does not decide actor roles or permissions.
- Scope constructs one composable query and does not execute Repo. List/search readers must not add per-row Gate checks or duplicate lower public-read filters.
- Mutation callers prefer `Gate.with_check/4`: load and lock the canonical resource once, authorize it, and reuse it in the callback. Use `access_check/3` only where the caller already owns the canonical resource and lock/transaction contract.
- Keep CMS Gate CMS-owned. Do not introduce a global Gate or bypass existing CMS Reader and management authorization boundaries.

## Typed and Fail-Closed Rules

- Preserve resource-specific `Gate.Context.Scope.*` and `Gate.Context.Access.*` types; do not replace them with one optional-field map.
- Actor remains explicit. `policy_mode` changes read semantics but is never a permission credential.
- Root schema and Context mismatches, missing Context, unknown threads, and invalid branch combinations fail closed.
- Article and Doc contexts remain distinct even where Doc reuses an Article query implementation or loader dispatch path.
- Keep Versioning, TreeVersioning, snapshots, release coordination, and scheduling outside Lifecycle state authority.

## Workflow

1. If the user has not authorized code changes, produce a read-only map of the public facade, context constructor, policy/Scope implementation, Lifecycle authority, callers, tests, and relevant docs.
2. Use CodeGraph first for structural symbol/caller/impact questions. Use literal search for actions, error codes, documentation wording, and migration residue.
3. State whether the request changes public admission behavior, query visibility, Lifecycle state, error protocol, or only internal structure/naming.
4. Trace every changed action or state through its producer, Gate admission, Lifecycle transition, Reader/Scope visibility, GraphQL/product surface, tests, and docs. Do not update only one layer of the contract.
5. Keep locks and transaction ownership explicit. A Gate admission lock is not a permanent freeze; the transition or write must enforce its own current-state and version guards.
6. Validate focused Gate/Scope/Lifecycle tests and `mix compile --warnings-as-errors`. Add query-count or SQL-shape coverage when a read-path change could introduce N+1 checks or duplicate filtering.

## Documentation Standard

When implementation changes ownership or flow, update the source-of-truth domain document and accurate source-level moduledocs/ASCII flow. Do not preserve superseded names as current behavior merely for compatibility with stale documentation.
