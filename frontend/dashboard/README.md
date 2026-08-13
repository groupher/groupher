# Groupher Dashboard

`frontend/dashboard` is the Next.js implementation of Groupher's community
administration application. It remains a first-class application while the
TanStack Start `frontend/dash` implementation evolves in parallel.

## Position in the system

```text
Admin -> Gateway -> Dashboard/Next.js
                         |
                         +-> Core PlatformProvider
                         +-> Auth Session contract
                         +-> Phoenix GraphQL
                         +-> Content Import / Assets Hub / Press
```

Dashboard owns Next.js routing, SSR/cache boundaries, application layout, and
deployment configuration. Shared product widgets and state belong in Core;
framework-specific adapters remain in this package.

## Local development and validation

```sh
yarn workspace @groupher/frontend-dashboard dev
yarn workspace @groupher/frontend-dashboard type-check
yarn workspace @groupher/frontend-dashboard format:check
yarn workspace @groupher/frontend-dashboard build
```

Use `/home` for local UI and Playwright verification. Do not add TanStack route
compatibility aliases here or move framework runtime dependencies into Core.

## Related documentation

- [`docs/dashboard-to-tanstack/v2.md`](../../docs/dashboard-to-tanstack/v2.md)
- [`docs/dash_route.md`](../../docs/dash_route.md)
- [`docs/auth/v1.md`](../../docs/auth/v1.md)
- [`docs/platform/links.md`](../../docs/platform/links.md)
