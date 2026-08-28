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
Browser -> Gateway ----------------> Press -> cache/D1 projection
                                      |
                                      +-> bounded Phoenix refresh/read
```

Press may cache or project content for delivery, but it does not become a
second authoring system and must not write Phoenix tables directly.

## Source layout

- `src/app.ts`: Hono routes and response policy.
- `src/config.ts`: runtime configuration.
- `src/db`: Press-owned D1 projection schema and migrations.
- `src/phoenix.ts`: bounded Phoenix client.
- `src/server.ts` / `src/worker.ts`: local Node and Worker entrypoints.

## Local development and validation

```sh
pnpm --filter @groupher/press run dev
pnpm --filter @groupher/press run test
pnpm --filter @groupher/press run type-check
pnpm --filter @groupher/press run format:check
pnpm --filter @groupher/press run db:generate
pnpm --filter @groupher/press run db:migrate
```

## Related documentation

- [`docs/press/v1.md`](../../docs/press/v1.md)
- [`docs/sub-apps/README.md`](../../docs/sub-apps/README.md)
- [`docs/sub-apps/health.md`](../../docs/sub-apps/health.md)
