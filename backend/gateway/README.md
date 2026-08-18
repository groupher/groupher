# Groupher Gateway

`backend/gateway` is the stable HTTP routing edge for Groupher applications. It
runs a Hono app in local Node and serverless entrypoints, selects a target from
host/path rules, forwards bounded headers and cookies, and proxies HTTP or
WebSocket traffic without owning product authorization.

## Position in the system

```text
Browser / service
       |
       v
    Gateway
       |
       +-> Landing / Main / Dashboard / Dash / Apply
       +-> Auth
       +-> Phoenix GraphQL
       +-> Press and other explicit service routes
```

Gateway owns routing, static edge assets, proxy header policy, upgrade handling,
and public health. Auth owns Session protocol; Phoenix owns authorization and
business data; target applications own rendering and product behavior.

## Source layout

- `src/routing.ts`: canonical host/path-to-target decisions.
- `src/app.ts`: Hono HTTP entry and browser GraphQL boundary.
- `src/proxy.ts`: HTTP request/response forwarding policy.
- `src/upgrade.ts`: WebSocket upgrade forwarding.
- `src/static.ts`: Gateway-owned public files.
- `src/server.ts`: local Node server.
- `api/index.ts`: serverless entrypoint over the same Hono app.

## Local development and validation

```sh
yarn workspace @groupher/gateway dev
yarn workspace @groupher/gateway test
yarn workspace @groupher/gateway type-check
yarn workspace @groupher/gateway format:check
```

Use `.env.example` for target endpoint variables. Ordinary local browser traffic
should use the Portless hosts described in `docs/sub-apps/portless.md`.

## Related documentation

- [`docs/gateway.md`](../../docs/gateway.md)
- [`docs/sub-apps/gateway_hono_migration.md`](../../docs/sub-apps/gateway_hono_migration.md)
- [`docs/sub-apps/service_endpoints.md`](../../docs/sub-apps/service_endpoints.md)
- [`docs/auth/v1.md`](../../docs/auth/v1.md)
