# Groupher Dash

`frontend/dash` is the TanStack Start implementation of Groupher's community
administration UI. It is the canonical replacement for the retired Next.js
Dashboard application.

## Position in the system

```text
Admin -> Gateway -> Dash/TanStack Start
                       |
                       +-> Core TanStack Router navigation
                       +-> Auth Session contract
                       +-> Phoenix GraphQL
                       +-> Content Import server proxy
```

Dash owns its native file routes, SSR loaders, request-scoped setup,
document shell, and Cloudflare deployment adapter. Product widgets, stores, and
GraphQL contracts remain in Core when they are genuinely framework-neutral.

Docs bulk import remains same-origin in the browser. TanStack server routes under
`/api/docs/import/*` validate the Phoenix browser token, acquire the scoped Dash
service identity, and proxy to `backend/content-import`. Production must provide
`PHX_JWT_SECRET` for browser-token verification plus `SERVICE_AUTH_CLIENT_ID` and
`SERVICE_AUTH_CLIENT_SECRET` for a registered `service:dash` client with
`content-import:internal-api` access.

## Local development and validation

```sh
pnpm --filter @groupher/frontend-dash run dev
pnpm --filter @groupher/frontend-dash run type-check
pnpm --filter @groupher/frontend-dash run format:check
pnpm --filter @groupher/frontend-dash run build
```

Use `/home` for local UI and Playwright verification because other communities
may not contain representative data. Route-tree output is generated and must
not be edited by hand.

## Related documentation

- [`docs/dashboard-to-tanstack/v2.md`](../../docs/dashboard-to-tanstack/v2.md)
- [`docs/dash_route.md`](../../docs/dash_route.md)
- [`docs/platform/links.md`](../../docs/platform/links.md)
- [`docs/auth/v1.md`](../../docs/auth/v1.md)
