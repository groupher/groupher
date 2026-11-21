# Groupher Phoenix Backend

`backend/api` is Groupher's domain authority and GraphQL API. It remains a
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
MIX_ENV=dev mix ecto.setup
MIX_ENV=dev mix phx.server
```

`ecto.setup` only creates and migrates the database. To seed the local `home`
community used by Community smoke tests and Dev Hub, run:

```sh
make -C ../.. be.seed.home
```

From the repository root, run `make be.seed.home`.

To build the developer IDE before opening `http://127.0.0.1:4001/graphiql`:

```sh
cd graphiql
npm ci --legacy-peer-deps --ignore-scripts
npm run build
```

The IDE uses the separate `/graphql` API endpoint. Its built assets are included
in the API Docker image; they are not checked into source control.

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

- [`docs/architecture/backend-module-reorganization.md`](../../docs/architecture/backend-module-reorganization.md)
- [`docs/rules/be.md`](../../docs/rules/be.md)
- [`docs/feature/gate/legacy-overview.md`](../../docs/feature/gate/legacy-overview.md)
- [`docs/feature/lifecycle/contract.md`](../../docs/feature/lifecycle/contract.md)
- [`docs/auth/v1.md`](../../docs/auth/v1.md)
- [`docs/architecture/apps.md`](../../docs/architecture/apps.md)
