# Groupher Press

`backend/press` is the read-oriented official-content output application. It
serves cache-friendly public projections and keeps delivery concerns outside
Phoenix while Phoenix CMS remains the canonical authoring, authorization, and
persistence authority.

## Position in the system

```text
Dashboard -> Phoenix CMS.Press -> configuration/public projection
                                      |
                                      v
Browser -> Gateway ----------------> Press -> analysis cache + metrics
                                      |
                                      +-> bounded Phoenix refresh/read
```

Press may cache or project content for delivery, but it does not become a
second authoring system and must not write Phoenix tables directly.

## Source layout

- `src/app.ts`: Hono routes and response policy.
- `src/origin.ts`: bounded Phoenix Press projection client.
- `src/db`: Press-owned PostgreSQL `analysis` schema and migrations.
- `src/server.ts`: Node/Hono entrypoint for local development.
- `src/worker.ts`: Cloudflare Worker default health/internal entrypoint and named `Public` content entrypoint.
- `src/runtime.ts`: per-invocation database client and request lifecycle shared by Worker and Node entrypoints.

## Local development and validation

```sh
pnpm --filter @groupher/press run dev
pnpm --filter @groupher/press run dev:worker
pnpm --filter @groupher/press run test
pnpm --filter @groupher/press run type-check
pnpm --filter @groupher/press run format:check
pnpm --filter @groupher/press run db:generate
pnpm --filter @groupher/press run db:migrate
```

Production runs on Cloudflare Workers; the former Fly app has been deleted. Public content is served through edge-router → named `Public`. `press.groupher.com` exposes only health and signed invalidation. Workers Free remains in use: reject requests at limits, never upgrade or fall back. See the [deployment record](../../docs/press/cloudflare-workers-deployment.md) for evidence and remaining operational work.

## Related documentation

- [`docs/press/v1.md`](../../docs/press/v1.md)
- [`docs/press/cloudflare-workers-migration.md`](../../docs/press/cloudflare-workers-migration.md)
- [`docs/architecture/apps.md`](../../docs/architecture/apps.md)
- [`docs/infra/contracts/health.md`](../../docs/infra/contracts/health.md)
