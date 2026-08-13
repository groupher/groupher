# Groupher Dash

`frontend/dash` is the TanStack Start implementation of Groupher's community
administration UI. It runs in parallel with `frontend/dashboard`; neither is a
compatibility wrapper for the other.

## Position in the system

```text
Admin -> Gateway -> Dash/TanStack Start
                       |
                       +-> Core PlatformProvider
                       +-> Auth Session contract
                       +-> Phoenix GraphQL
                       +-> service-backed dashboard features
```

Dash owns its native file routes, SSR loaders, request-scoped provider setup,
document shell, and Cloudflare deployment adapter. Product widgets, stores, and
GraphQL contracts remain in Core when they are genuinely framework-neutral.

## Local development and validation

```sh
yarn workspace @groupher/frontend-dash dev
yarn workspace @groupher/frontend-dash type-check
yarn workspace @groupher/frontend-dash format:check
yarn workspace @groupher/frontend-dash build
```

Use `/home` for local UI and Playwright verification because other communities
may not contain representative data. Route-tree output is generated and must
not be edited by hand.

## Related documentation

- [`docs/dashboard-to-tanstack/v2.md`](../../docs/dashboard-to-tanstack/v2.md)
- [`docs/dash_route.md`](../../docs/dash_route.md)
- [`docs/platform/links.md`](../../docs/platform/links.md)
- [`docs/auth/v1.md`](../../docs/auth/v1.md)
