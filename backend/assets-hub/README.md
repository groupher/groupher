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
pnpm devhub start assets-hub
pnpm devhub start assets-read-worker
pnpm --filter @groupher/assets-hub run type-check
pnpm --filter @groupher/assets-hub run format:check
```

The Node upload provider and Cloudflare read Worker are separate Hub services.
The Node provider is the default local runtime; start `assets-read-worker`
explicitly when validating Cloudflare R2/Queue/DO integration. Its local service
identity comes from Dev Hub private state. Use `.env.example` only to identify
optional external R2 credentials; never commit them.

The production Node entrypoint reads configuration from the process environment, not local dotenv
files. It rejects the local storage provider and loopback service targets before serving requests.

## Related documentation

- [`docs/assets-hub/README.md`](../../docs/assets-hub/README.md)
- [`docs/assets-hub/v1.md`](../../docs/assets-hub/v1.md)
- [`docs/assets-hub/v4.md`](../../docs/assets-hub/v4.md)
- [`docs/infra/contracts/health.md`](../../docs/infra/contracts/health.md)
