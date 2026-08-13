# Groupher Phoenix Backend

`backend/main` is Groupher's domain authority and GraphQL API. It remains a
modular monolith: Accounts, CMS, Messaging, Analysis, authorization, lifecycle,
and persistence live in Phoenix contexts and share one PostgreSQL repository.

## Position in the system

```text
Browser / internal service
          |
          v
       Gateway
          |
          v
Phoenix Endpoint -> Router -> Absinthe schema -> Resolver
                                              |
                                              v
                                      Domain context/facade
                                              |
                                  +-----------+-----------+
                                  |                       |
                                  v                       v
                           Policy/lifecycle          Read/write module
                                                          |
                                                          v
                                                   Ecto Repo -> PostgreSQL
```

Phoenix owns business authorization and persisted state. Node/Python services
may execute bounded work, but they do not bypass Phoenix or connect directly to
its database.

## Main areas

- `lib/groupher_server/accounts`: users, profiles, sessions, OAuth identities,
  followers, collections, and account-facing projections.
- `lib/groupher_server/cms`: communities, content, comments, Docs trees,
  Dashboard configuration, assets metadata, Gate/Lifecycle, and background
  business workflows.
- `lib/groupher_server/messaging`: persisted inbox and notification boundaries.
- `lib/groupher_server/analysis`: contribution and web-analysis projections.
- `lib/groupher_server_web`: HTTP, GraphQL, middleware, service-auth, and socket
  boundaries.
- `lib/helper`: cross-domain infrastructure helpers. Domain-specific rules do
  not belong here.
- `priv/repo`: migrations and seed data.

## Local development

From this directory:

```sh
mix deps.get
mix ecto.setup
mix phx.server
```

The default local endpoint is `http://127.0.0.1:4001`; normal browser traffic
should use the Gateway-managed local host configured by Portless.

## Validation

```sh
mix format --check-formatted
mix compile --warnings-as-errors
mix test
```

Application datetimes are UTC, Ecto datetime fields use `:utc_datetime`, and
regular migration datetime columns use `:timestamptz`.

## Related documentation

- [`docs/reorg_be_modules.md`](../../docs/reorg_be_modules.md)
- [`docs/rules_be.md`](../../docs/rules_be.md)
- [`docs/community/gate.md`](../../docs/community/gate.md)
- [`docs/community/lifecycle.md`](../../docs/community/lifecycle.md)
- [`docs/auth/v1.md`](../../docs/auth/v1.md)
- [`docs/sub-apps/README.md`](../../docs/sub-apps/README.md)
