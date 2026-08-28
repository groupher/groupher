# Assets Hub

`backend/assets-hub` is the Hono execution boundary for Groupher-managed
objects. Its current implementation exposes bounded upload/read operations and
health reporting around Cloudflare R2. Phoenix remains the owner of asset
metadata, permissions, references, quotas, billing, and lifecycle state.

## Position in the system

```text
Dashboard -> Phoenix CMS.Assets -> signed capability
    |                                   |
    +---------------- upload ---------->|
                                        v
                                  Assets Hub -> R2
                                        |
                                        v
                              result/measurement -> Phoenix
```

Assets Hub does not connect to the Phoenix database and must not decide whether
a community may upload or delete an asset. Planned media transforms, variants,
reconciliation, and provider migration belong to this execution boundary only
after their contracts are implemented.

## Source layout

- `src/app.ts`: Hono routes and request boundary.
- `src/worker.ts`: Cloudflare Worker entrypoint.
- `src/server.ts`: local Node entrypoint.
- `src/r2.ts`: object-storage operations.
- `src/auth.ts`: capability/service authentication.
- `src/health.ts`: shared `health.v1` response.

## Local development and validation

```sh
pnpm --filter @groupher/assets-hub run dev:local
pnpm --filter @groupher/assets-hub run type-check
pnpm --filter @groupher/assets-hub run format:check
```

Use `.env.example` as the configuration inventory. Secrets belong in local or
deployment environment bindings and must not be committed.

## Related documentation

- [`docs/sub-apps/assets_hub.md`](../../docs/sub-apps/assets_hub.md)
- [`docs/assets-hub/v1.md`](../../docs/assets-hub/v1.md)
- [`docs/assets-hub/v4.md`](../../docs/assets-hub/v4.md)
- [`docs/sub-apps/health.md`](../../docs/sub-apps/health.md)
